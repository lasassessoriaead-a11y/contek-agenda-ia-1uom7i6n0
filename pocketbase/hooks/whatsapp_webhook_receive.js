/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  try {
    const body = e.requestInfo().body || {}

    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    // Or internal simulation { action: "simulate", sender_phone: "...", message: "...", recipient_phone: "...", slug: "..." }
    const isSimulation = body.action === 'simulate' || (body.sender_phone && body.message)

    if (!isSimulation && body.object !== 'whatsapp_business_account') {
      return e.json(200, { status: 'ignored_not_whatsapp' })
    }

    // Locate system bot user
    let botUser
    try {
      botUser = $app.findAuthRecordByEmail('_pb_users_auth_', 'whatsapp-bot@contek.local')
    } catch (_) {
      try {
        const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
        botUser = new Record(usersCol)
        botUser.setEmail('whatsapp-bot@contek.local')
        botUser.setPassword($security.randomString(32))
        botUser.setVerified(true)
        botUser.set('name', 'Contek WhatsApp Bot')
        botUser.set('role', 'ADMINISTRADOR')
        $app.save(botUser)
      } catch (errUser) {
        console.error('[WhatsApp Hook] Failed to resolve bot user:', errUser)
      }
    }

    const botUserId = botUser ? botUser.id : ''
    const siteUrl = $os.getenv('SITE_URL') || 'https://contekagenda.com.br'
    const defaultAccessToken =
      $os.getenv('META_WA_ACCESS_TOKEN') || $secrets.get('META_WA_ACCESS_TOKEN') || ''
    const defaultPhoneId =
      $os.getenv('META_WA_PHONE_NUMBER_ID') || $secrets.get('META_WA_PHONE_NUMBER_ID') || ''

    // Helper: Convert "HH:MM" to minutes from midnight
    const timeToMinutes = (t) => {
      if (!t || typeof t !== 'string') return 0
      const parts = t.split(':')
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    }

    // Helper: Parse JSON or list field safely
    const parseList = (val) => {
      if (!val) return []
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'number') {
          try {
            const str = String.fromCharCode(...val)
            const p = JSON.parse(str)
            return Array.isArray(p) ? p : []
          } catch (_) {
            return []
          }
        }
        return val
      }
      if (typeof val === 'string') {
        try {
          const p = JSON.parse(val)
          return Array.isArray(p) ? p : []
        } catch (_) {
          return []
        }
      }
      return []
    }

    const parseObj = (val) => {
      if (!val) return null
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'number') {
          try {
            const str = String.fromCharCode(...val)
            const p = JSON.parse(str)
            return typeof p === 'object' && !Array.isArray(p) ? p : null
          } catch (_) {
            return null
          }
        }
        return null
      }
      if (typeof val === 'object' && !Array.isArray(val)) return val
      if (typeof val === 'string') {
        try {
          const p = JSON.parse(val)
          return typeof p === 'object' && !Array.isArray(p) ? p : null
        } catch (_) {
          return null
        }
      }
      return null
    }

    // Helper: Calculate truly available slots for a professional on a given date (YYYY-MM-DD)
    const computeAvailableSlots = (orgId, profRecord, servDuration, dateStr, settingsRecord) => {
      if (!profRecord || !dateStr) return []

      const cleanDate = dateStr.slice(0, 10)
      const partsDate = cleanDate.split('-')
      if (partsDate.length !== 3) return []

      const y = parseInt(partsDate[0], 10)
      const m = parseInt(partsDate[1], 10)
      const d = parseInt(partsDate[2], 10)
      const dayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
      const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
      const dayKey = dayMap[dayIdx]

      // 1. Check organization working days
      if (settingsRecord) {
        const orgDays = parseList(settingsRecord.get('working_days'))
        if (orgDays.length > 0 && !orgDays.includes(dayKey)) {
          return []
        }
      }

      // 2. Check professional date exceptions / folgas
      const profExceptions = parseList(profRecord.get('date_exceptions'))
      if (profExceptions.length > 0) {
        const hasDateException = profExceptions.some((exc) => {
          const excStr = typeof exc === 'string' ? exc.slice(0, 10) : ''
          return excStr === cleanDate
        })
        if (hasDateException) {
          return []
        }
      }

      // 3. Check professional work_days
      const profDays = parseList(profRecord.get('work_days'))
      if (profDays.length > 0 && !profDays.includes(dayKey)) {
        return []
      }

      // 4. Resolve shifts or fallback work_hours
      const rawShifts = parseList(profRecord.get('work_shifts'))
      const activeShifts = []
      if (rawShifts && rawShifts.length > 0) {
        for (const s of rawShifts) {
          if (s && s.start && s.end) {
            activeShifts.push({
              start: s.start,
              end: s.end,
              startMin: timeToMinutes(s.start),
              endMin: timeToMinutes(s.end),
            })
          }
        }
      }

      const parsedHours = parseObj(profRecord.get('work_hours'))
      if (activeShifts.length === 0) {
        const startHStr = parsedHours?.start || settingsRecord?.getString('opening_time') || '08:00'
        const endHStr = parsedHours?.end || settingsRecord?.getString('closing_time') || '18:00'
        activeShifts.push({
          start: startHStr,
          end: endHStr,
          startMin: timeToMinutes(startHStr),
          endMin: timeToMinutes(endHStr),
        })
      }

      const lunchStartStr = parsedHours?.lunch_start
      const lunchEndStr = parsedHours?.lunch_end
      let lunchStartMin = -1
      let lunchEndMin = -1
      if (lunchStartStr && lunchEndStr) {
        lunchStartMin = timeToMinutes(lunchStartStr)
        lunchEndMin = timeToMinutes(lunchEndStr)
      }

      const companyOpenMin = settingsRecord?.getString('opening_time')
        ? timeToMinutes(settingsRecord.getString('opening_time'))
        : 0
      const companyCloseMin = settingsRecord?.getString('closing_time')
        ? timeToMinutes(settingsRecord.getString('closing_time'))
        : 24 * 60

      const slotStep = settingsRecord?.getInt('slot_interval_minutes') || 30
      const duration = servDuration || 30

      // Existing appointments on date for this professional
      const filter = `professional_id = "${profRecord.id}" && status != "CANCELADO"`
      let dayAppts = []
      try {
        const appts = $app.findRecordsByFilter('appointments', filter, '', 150, 0)
        dayAppts = appts.filter((a) => (a.getString('date') || '').slice(0, 10) === cleanDate)
      } catch (_) {}

      const availableSlots = []
      for (const shift of activeShifts) {
        let currentMinutes = shift.startMin
        const shiftEndMinutes = shift.endMin

        while (currentMinutes + duration <= shiftEndMinutes) {
          const slotEndMinutes = currentMinutes + duration

          const outsideCompany = currentMinutes < companyOpenMin || slotEndMinutes > companyCloseMin
          const overlapsLunch =
            lunchStartMin >= 0 &&
            lunchEndMin > lunchStartMin &&
            currentMinutes < lunchEndMin &&
            slotEndMinutes > lunchStartMin

          const hasConflict =
            outsideCompany ||
            overlapsLunch ||
            dayAppts.some((a) => {
              const aStart = timeToMinutes(a.getString('start_time'))
              const aEnd = timeToMinutes(a.getString('end_time'))
              return currentMinutes < aEnd && slotEndMinutes > aStart
            })

          if (!hasConflict) {
            const h = Math.floor(currentMinutes / 60)
            const min = currentMinutes % 60
            const slotStartStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
            if (!availableSlots.includes(slotStartStr)) {
              availableSlots.push(slotStartStr)
            }
          }

          currentMinutes += slotStep
        }
      }

      return availableSlots.sort()
    }

    // Helper: Execute a real booking on the backend with full conflict and shift validation
    const executeBooking = (
      orgId,
      serviceId,
      profId,
      dateStr,
      startTime,
      clientName,
      clientPhone,
    ) => {
      const cleanDate = (dateStr || '').slice(0, 10)
      if (!cleanDate || !startTime || !serviceId || !profId || !clientName || !clientPhone) {
        return { ok: false, error: 'Dados incompletos para agendamento.' }
      }

      // Check service & professional
      let servRecord = null
      let profRecord = null
      try {
        servRecord = $app.findRecordById('services', serviceId)
        profRecord = $app.findRecordById('professionals', profId)
      } catch (errRec) {
        return { ok: false, error: 'Serviço ou profissional não encontrado.' }
      }

      if (
        !servRecord ||
        servRecord.getString('organization_id') !== orgId ||
        !servRecord.getBool('active')
      ) {
        return { ok: false, error: 'Serviço indisponível ou inválido para esta clínica.' }
      }
      if (
        !profRecord ||
        profRecord.getString('organization_id') !== orgId ||
        !profRecord.getBool('active')
      ) {
        return { ok: false, error: 'Profissional indisponível ou inválido para esta clínica.' }
      }

      const duration = servRecord.getInt('duration') || 30
      const price = servRecord.getFloat('price') || 0

      // End time
      const parts = startTime.split(':')
      const startHour = parseInt(parts[0], 10)
      const startMin = parseInt(parts[1], 10)
      const totalMinutes = startHour * 60 + startMin + duration
      const endH = Math.floor(totalMinutes / 60)
        .toString()
        .padStart(2, '0')
      const endM = (totalMinutes % 60).toString().padStart(2, '0')
      const endTime = `${endH}:${endM}`
      const newStartMin = startHour * 60 + startMin
      const newEndMin = totalMinutes

      // Check date working days & folgas
      let bizSettings = null
      try {
        bizSettings = $app.findFirstRecordByData('business_settings', 'organization_id', orgId)
      } catch (_) {}

      const available = computeAvailableSlots(orgId, profRecord, duration, cleanDate, bizSettings)
      if (!available.includes(startTime)) {
        return {
          ok: false,
          error: `O horário ${startTime} do dia ${cleanDate} não está livre para este profissional. Horários disponíveis: ${available.slice(0, 6).join(', ') || 'Nenhum'}.`,
        }
      }

      // Find or create client
      let clientId = ''
      const cleanPhone = clientPhone.toString().trim()
      const digitsOnly = cleanPhone.replace(/\D/g, '')
      const trimmedName = clientName.trim()

      try {
        const clientFilter = `organization_id = "${orgId}" && (phone = "${cleanPhone}" || phone = "${digitsOnly}" || whatsapp = "${cleanPhone}" || whatsapp = "${digitsOnly}")`
        const foundClients = $app.findRecordsByFilter('clients', clientFilter, '', 1, 0)
        if (foundClients.length > 0) {
          const existingClient = foundClients[0]
          clientId = existingClient.id
          if (trimmedName && existingClient.getString('name') !== trimmedName) {
            existingClient.set('name', trimmedName)
            $app.save(existingClient)
          }
        }
      } catch (_) {}

      if (!clientId) {
        const clientsCol = $app.findCollectionByNameOrId('clients')
        const clientRecord = new Record(clientsCol)
        clientRecord.set('organization_id', orgId)
        clientRecord.set('name', trimmedName)
        clientRecord.set('phone', cleanPhone)
        clientRecord.set('whatsapp', cleanPhone)
        clientRecord.set('notes', 'Cadastrado automaticamente via WhatsApp Atendente IA')
        $app.save(clientRecord)
        clientId = clientRecord.id
      }

      // Create appointment
      const apptsCol = $app.findCollectionByNameOrId('appointments')
      const apptRecord = new Record(apptsCol)
      apptRecord.set('organization_id', orgId)
      apptRecord.set('client_id', clientId)
      apptRecord.set('service_id', serviceId)
      apptRecord.set('professional_id', profId)
      apptRecord.set('date', cleanDate + ' 00:00:00.000Z')
      apptRecord.set('start_time', startTime)
      apptRecord.set('end_time', endTime)
      apptRecord.set('duration', duration)
      apptRecord.set('price', price)
      apptRecord.set('status', 'AGENDADO')
      apptRecord.set('client_name_snapshot', trimmedName)
      apptRecord.set('client_phone_snapshot', cleanPhone)
      apptRecord.set('notes', 'Agendado pelo paciente via Atendente Virtual WhatsApp IA')
      $app.save(apptRecord)

      // Create pending payment
      try {
        const paymentsCol = $app.findCollectionByNameOrId('payments')
        const payRecord = new Record(paymentsCol)
        payRecord.set('organization_id', orgId)
        payRecord.set('appointment_id', apptRecord.id)
        payRecord.set('client_id', clientId)
        payRecord.set('amount', price)
        payRecord.set('is_paid', false)
        payRecord.set('payment_method', 'PIX')
        payRecord.set('description', `${servRecord.getString('name')} - Agendado WhatsApp IA`)
        $app.save(payRecord)
      } catch (_) {}

      return {
        ok: true,
        appointment_id: apptRecord.id,
        date: cleanDate,
        start_time: startTime,
        end_time: endTime,
        service_name: servRecord.getString('name'),
        professional_name: profRecord.getString('name'),
        price: price,
      }
    }

    // Build normalised message items list (support Meta webhook entries or direct simulate payload)
    const incomingMessages = []

    if (isSimulation) {
      incomingMessages.push({
        from: (body.sender_phone || '5511999998888').toString().replace(/\D/g, ''),
        text: (body.message || '').toString().trim(),
        recipientPhone: (body.recipient_phone || '').toString().replace(/\D/g, ''),
        forcedSlug: (body.slug || '').toString().trim(),
      })
    } else {
      const entries = body.entry || []
      for (const entry of entries) {
        const changes = entry.changes || []
        for (const change of changes) {
          if (change.field !== 'messages') continue
          const value = change.value || {}
          const msgs = value.messages || []
          const metadata = value.metadata || {}
          const incomingPhoneId = metadata.phone_number_id || defaultPhoneId
          const recipientPhone = (metadata.display_phone_number || '').replace(/\D/g, '')

          for (const msg of msgs) {
            let userText = ''
            if (msg.type === 'text' && msg.text && msg.text.body) {
              userText = msg.text.body.trim()
            } else if (msg.type === 'button' && msg.button && msg.button.text) {
              userText = msg.button.text.trim()
            } else if (msg.type === 'interactive') {
              if (msg.interactive.button_reply) {
                userText = msg.interactive.button_reply.title || ''
              } else if (msg.interactive.list_reply) {
                userText = msg.interactive.list_reply.title || ''
              }
            }

            if (!userText) continue

            let detectedSlug = ''
            if (msg.referral && msg.referral.ref) {
              detectedSlug = msg.referral.ref.trim()
            }

            incomingMessages.push({
              from: (msg.from || '').toString().replace(/\D/g, ''),
              text: userText,
              incomingPhoneId: incomingPhoneId,
              recipientPhone: recipientPhone,
              forcedSlug: detectedSlug,
            })
          }
        }
      }
    }

    const responses = []

    for (const item of incomingMessages) {
      const userText = item.text
      const fromNumber = item.from
      const recipientPhone = item.recipientPhone || ''
      let detectedSlug = item.forcedSlug || ''

      // 1. RESOLVE ORGANIZATION / TENANT MULTI-TENANT
      // Priority A: Phone number that received the message (connected business number per tenant)
      let matchedOrg = null
      let matchedSettings = null

      if (recipientPhone) {
        const cleanRec = recipientPhone.replace(/\D/g, '')
        const recSuffix = cleanRec.slice(-8)
        try {
          // Look up business_settings or organizations by phone/whatsapp
          const allSettings = $app.findRecordsByFilter('business_settings', '', '', 100, 0)
          for (const bs of allSettings) {
            const bsWa = (
              bs.getString('whatsapp_phone_number') ||
              bs.getString('whatsapp') ||
              bs.getString('phone') ||
              ''
            ).replace(/\D/g, '')
            if (bsWa && bsWa.slice(-8) === recSuffix) {
              matchedSettings = bs
              matchedOrg = $app.findRecordById('organizations', bs.getString('organization_id'))
              break
            }
          }
          if (!matchedOrg) {
            const allOrgs = $app.findRecordsByFilter(
              'organizations',
              'status = "active"',
              '',
              50,
              0,
            )
            for (const o of allOrgs) {
              const oWa = (o.getString('whatsapp') || o.getString('phone') || '').replace(/\D/g, '')
              if (oWa && oWa.slice(-8) === recSuffix) {
                matchedOrg = o
                break
              }
            }
          }
        } catch (_) {}
      }

      // Priority B: Explicit slug in referral, brackets or ref:slug
      if (!matchedOrg && !detectedSlug) {
        const refMatch = userText.match(/(?:ref=|ref:|slug=|empresa:|\bref:)([a-zA-Z0-9-_]+)/i)
        if (refMatch && refMatch[1]) {
          detectedSlug = refMatch[1].trim()
        }
      }

      if (!matchedOrg && !detectedSlug) {
        const bracketMatch = userText.match(/\[([a-zA-Z0-9-_]+)\]/)
        if (bracketMatch && bracketMatch[1]) {
          detectedSlug = bracketMatch[1].trim()
        }
      }

      if (!matchedOrg && detectedSlug) {
        try {
          matchedOrg = $app.findFirstRecordByData('organizations', 'slug', detectedSlug)
        } catch (_) {}
      }

      // Priority C: Match organization name or slug mentioned inside user text
      if (!matchedOrg) {
        try {
          const allOrgs = $app.findRecordsByFilter('organizations', 'status = "active"', '', 20, 0)
          for (const o of allOrgs) {
            const s = o.getString('slug')
            const n = o.getString('name').toLowerCase()
            if (s && userText.toLowerCase().includes(s.toLowerCase())) {
              matchedOrg = o
              break
            }
            if (n && n.length > 3 && userText.toLowerCase().includes(n)) {
              matchedOrg = o
              break
            }
          }
        } catch (_) {}
      }

      // Priority D: If only 1 or 2 active organizations exist in DB (e.g. single tenant or demo), pick primary active org
      if (!matchedOrg) {
        try {
          const allActive = $app.findRecordsByFilter(
            'organizations',
            'status = "active"',
            '-created',
            2,
            0,
          )
          if (allActive.length === 1) {
            matchedOrg = allActive[0]
          }
        } catch (_) {}
      }

      // Fetch business settings for the matched organization
      if (matchedOrg && !matchedSettings) {
        try {
          matchedSettings = $app.findFirstRecordByData(
            'business_settings',
            'organization_id',
            matchedOrg.id,
          )
        } catch (_) {}
      }

      const orgId = matchedOrg ? matchedOrg.id : ''
      const orgName = matchedOrg ? matchedOrg.getString('name') : 'Contek Agenda IA'
      const orgSlug = matchedOrg ? matchedOrg.getString('slug') : 'contek-demo'
      const bookingUrl = `${siteUrl}/agendar/${orgSlug}`
      const isAiReceptionistActive = matchedSettings
        ? matchedSettings.getBool('whatsapp_ai_enabled')
        : false

      // 2. CHECK EXISTING APPOINTMENT CONFIRMATION INTENT ("1", "sim", "confirmo")
      const normalizedInput = userText
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúãõç]/g, ' ')
        .trim()
      const isConfirmIntent =
        normalizedInput === '1' ||
        normalizedInput === 'sim' ||
        normalizedInput === 'confirmar' ||
        normalizedInput === 'confirmado' ||
        normalizedInput === 'confirmo' ||
        normalizedInput === 'ok' ||
        normalizedInput.startsWith('1 ') ||
        normalizedInput.includes('confirmar agendamento') ||
        normalizedInput.includes('confirmo minha presenca')

      let handledConfirmation = false
      let botReplyText = ''

      if (isConfirmIntent) {
        try {
          const cleanSender = fromNumber.replace(/\D/g, '')
          const last8or9 = cleanSender.slice(-8)

          const candidateAppts = $app.findRecordsByFilter(
            'appointments',
            `status = "AGENDADO" && (client_phone_snapshot ~ "${last8or9}" || client_id.phone ~ "${last8or9}" || client_id.whatsapp ~ "${last8or9}")`,
            'date,start_time',
            5,
            0,
          )

          if (candidateAppts.length > 0) {
            const targetAppt = candidateAppts[0]
            targetAppt.set('status', 'CONFIRMADO')

            let sentMap = {}
            try {
              const raw = targetAppt.get('notifications_sent')
              if (raw && typeof raw === 'object') sentMap = raw
            } catch (_) {}

            const apptOrgId = targetAppt.getString('organization_id')
            let apptOrgName = matchedOrg ? matchedOrg.getString('name') : 'Contek Agenda'

            let thanksTpl =
              'Muito obrigado por confirmar, {{nome_paciente}}! Seu agendamento na {{empresa}} para dia {{data}} às {{hora}} está confirmado. Estamos te esperando com carinho!'
            try {
              const bs = $app.findFirstRecordByData(
                'business_settings',
                'organization_id',
                apptOrgId,
              )
              if (bs && bs.getString('template_confirmation_thanks')) {
                thanksTpl = bs.getString('template_confirmation_thanks')
              }
            } catch (_) {}

            const rawD = targetAppt.getString('date')
            let dFormatted = rawD
            if (rawD && rawD.length >= 10) {
              const p = rawD.slice(0, 10).split('-')
              if (p.length === 3) dFormatted = `${p[2]}/${p[1]}/${p[0]}`
            }

            let cName = targetAppt.getString('client_name_snapshot')
            if (!cName && targetAppt.getString('client_id')) {
              try {
                const c = $app.findRecordById('clients', targetAppt.getString('client_id'))
                cName = c.getString('name')
              } catch (_) {}
            }

            let profName = ''
            if (targetAppt.getString('professional_id')) {
              try {
                const p = $app.findRecordById(
                  'professionals',
                  targetAppt.getString('professional_id'),
                )
                profName = p.getString('name')
              } catch (_) {}
            }

            let sName = ''
            if (targetAppt.getString('service_id')) {
              try {
                const s = $app.findRecordById('services', targetAppt.getString('service_id'))
                sName = s.getString('name')
              } catch (_) {}
            }

            botReplyText = thanksTpl
              .replace(/{{nome_paciente}}/g, cName || 'Cliente')
              .replace(/{{nome_profissional}}/g, profName || 'Profissional')
              .replace(/{{servico}}/g, sName || 'Atendimento')
              .replace(/{{data}}/g, dFormatted)
              .replace(/{{hora}}/g, targetAppt.getString('start_time'))
              .replace(/{{empresa}}/g, apptOrgName)

            sentMap['CONFIRMATION_THANKS'] = new Date().toISOString()
            targetAppt.set('notifications_sent', sentMap)
            $app.save(targetAppt)

            // Log
            try {
              const nlCol = $app.findCollectionByNameOrId('notification_logs')
              const logR = new Record(nlCol)
              logR.set('organization_id', apptOrgId)
              logR.set('appointment_id', targetAppt.id)
              logR.set('type', 'CONFIRMATION_THANKS')
              logR.set('channel', 'WHATSAPP_AUTO')
              logR.set(
                'status',
                defaultAccessToken && defaultPhoneId ? 'SENT' : 'PENDING_NO_CREDENTIALS',
              )
              logR.set('recipient_phone', fromNumber)
              logR.set('recipient_name', cName || 'Cliente')
              logR.set('message_text', botReplyText)
              $app.save(logR)
            } catch (_) {}

            handledConfirmation = true
          }
        } catch (errConfirm) {
          console.error('[WhatsApp Hook] Error processing confirmation:', errConfirm)
        }
      }

      // 3. FLUXO CONVERSACIONAL DE RECEPCIONISTA VIRTUAL COM IA
      if (!handledConfirmation) {
        // Resolve patient identity if existing in clients
        let knownClientName = ''
        if (orgId) {
          try {
            const cleanDigits = fromNumber.replace(/\D/g, '').slice(-8)
            const cList = $app.findRecordsByFilter(
              'clients',
              `organization_id = "${orgId}" && (phone ~ "${cleanDigits}" || whatsapp ~ "${cleanDigits}")`,
              '-created',
              1,
              0,
            )
            if (cList.length > 0) {
              knownClientName = cList[0].getString('name')
            }
          } catch (_) {}
        }

        // Fetch organization active services and professionals
        let servicesList = []
        let professionalsList = []

        if (orgId) {
          try {
            servicesList = $app.findRecordsByFilter(
              'services',
              `organization_id = "${orgId}" && active = true`,
              'price',
              20,
              0,
            )
          } catch (_) {}

          try {
            professionalsList = $app.findRecordsByFilter(
              'professionals',
              `organization_id = "${orgId}" && active = true`,
              'name',
              20,
              0,
            )
          } catch (_) {}
        }

        // Build rich tenant context for the Agent
        let tenantContext = `[CONTEXTO DA EMPRESA IDENTIFICADA NO MULTI-TENANT]\n`
        tenantContext += `Empresa: ${orgName} (slug: ${orgSlug})\n`
        tenantContext += `Link de Agendamento Oficial: ${bookingUrl}\n`
        tenantContext += `Telefone do Paciente no WhatsApp: ${fromNumber}\n`
        if (knownClientName) {
          tenantContext += `Nome do Paciente Identificado no Sistema: ${knownClientName}\n`
        } else {
          tenantContext += `Nome do Paciente: Não identificado ainda pelo número (pergunte com cordialidade ao saudar).\n`
        }

        if (matchedSettings && matchedSettings.getString('whatsapp_welcome_message')) {
          tenantContext += `Mensagem de boas-vindas cadastrada: "${matchedSettings.getString('whatsapp_welcome_message')}"\n`
        }

        if (servicesList.length > 0) {
          tenantContext += `\nServiços/Procedimentos Ativos:\n`
          for (const s of servicesList) {
            const pr = (s.getFloat('price') || 0).toFixed(2).replace('.', ',')
            tenantContext += `• ID: ${s.id} | Nome: ${s.getString('name')} | Valor: R$ ${pr} | Duração: ${s.getInt('duration')} min\n`
          }
        } else {
          tenantContext += `\nNenhum serviço ativo encontrado para esta empresa.\n`
        }

        if (professionalsList.length > 0) {
          tenantContext += `\nProfissionais Ativos:\n`
          for (const p of professionalsList) {
            const spec = p.getString('specialty') ? ` (${p.getString('specialty')})` : ''
            tenantContext += `• ID: ${p.id} | Nome: ${p.getString('name')}${spec}\n`
          }
        }

        // PRE-CHECK: If user text asks for available times on a date or mentions a date
        // E.g., "amanhã", "segunda", "10/09", "2026-09-05", "horários disponíveis"
        let scheduleInfoBlock = ''
        const dateMatch = userText.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/)
        let targetCheckDate = ''
        if (dateMatch) {
          if (dateMatch[1]) {
            targetCheckDate = dateMatch[1]
          } else if (dateMatch[2]) {
            const partsD = dateMatch[2].split('/')
            const dayP = partsD[0].padStart(2, '0')
            const monthP = partsD[1].padStart(2, '0')
            const yearP = partsD[2] || new Date().getFullYear().toString()
            targetCheckDate = `${yearP}-${monthP}-${dayP}`
          }
        } else if (
          userText.toLowerCase().includes('amanhã') ||
          userText.toLowerCase().includes('amanha')
        ) {
          const tm = new Date(Date.now() + 24 * 60 * 60 * 1000)
          targetCheckDate = tm.toISOString().slice(0, 10)
        } else if (
          userText.toLowerCase().includes('hoje') ||
          userText.toLowerCase().includes('horários') ||
          userText.toLowerCase().includes('horarios') ||
          userText.toLowerCase().includes('horario')
        ) {
          targetCheckDate = new Date().toISOString().slice(0, 10)
        }

        if (targetCheckDate && professionalsList.length > 0 && servicesList.length > 0) {
          const defaultProf = professionalsList[0]
          const defaultServ = servicesList[0]
          const freeSlots = computeAvailableSlots(
            orgId,
            defaultProf,
            defaultServ.getInt('duration') || 30,
            targetCheckDate,
            matchedSettings,
          )

          const partsD = targetCheckDate.split('-')
          const dateBr = `${partsD[2]}/${partsD[1]}/${partsD[0]}`
          if (freeSlots.length > 0) {
            scheduleInfoBlock = `\n[HORÁRIOS LIVRES REAIS NO SISTEMA PARA ${dateBr} com ${defaultProf.getString('name')}]:\n${freeSlots.slice(0, 8).join(', ')}\n(Ofereça estes horários exatos para o paciente caso ele queira agendar nesta data).\n`
          } else {
            scheduleInfoBlock = `\n[AVISO DE DISPONIBILIDADE PARA ${dateBr} com ${defaultProf.getString('name')}]: Nenhum horário disponível nesta data (dia fechado, folga ou agenda cheia). Peça ao paciente para sugerir outra data ou acessar o link.\n`
          }
        }

        tenantContext += scheduleInfoBlock

        // INTENT DETECTION: If user explicitly asks to book and provides date and time:
        // E.g. "Quero agendar Limpeza de Pele dia 2026-09-08 às 09:00 com Dra Camila. Meu nome é Joana"
        let bookingAttemptResult = null
        const bookingActionMatch =
          userText.toLowerCase().includes('agendar') ||
          userText.toLowerCase().includes('marcar') ||
          userText.toLowerCase().includes('horário') ||
          userText.toLowerCase().includes('horario')

        const timeMatch = userText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
        const requestedTime = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : ''

        if (
          bookingActionMatch &&
          targetCheckDate &&
          requestedTime &&
          professionalsList.length > 0 &&
          servicesList.length > 0
        ) {
          // Identify matching service
          let chosenService = servicesList[0]
          for (const s of servicesList) {
            const sName = s.getString('name').toLowerCase()
            if (userText.toLowerCase().includes(sName)) {
              chosenService = s
              break
            }
          }

          // Identify matching professional
          let chosenProf = professionalsList[0]
          for (const p of professionalsList) {
            const pName = p.getString('name').toLowerCase()
            if (userText.toLowerCase().includes(pName)) {
              chosenProf = p
              break
            }
          }

          // Extract patient name
          let bookingPatientName = knownClientName
          if (!bookingPatientName) {
            const nameExtract = userText.match(
              /(?:sou a|sou o|me chamo|nome [ée]|nome:)\s*([A-Za-zÀ-ÿ\s]{2,30})/i,
            )
            if (nameExtract && nameExtract[1]) {
              bookingPatientName = nameExtract[1].trim()
            }
          }
          if (!bookingPatientName) {
            bookingPatientName = 'Paciente WhatsApp'
          }

          // Attempt real database insertion
          bookingAttemptResult = executeBooking(
            orgId,
            chosenService.id,
            chosenProf.id,
            targetCheckDate,
            requestedTime,
            bookingPatientName,
            fromNumber,
          )

          if (bookingAttemptResult.ok) {
            tenantContext += `\n[AGENDAMENTO CRIADO COM SUCESSO NO BANCO DE DADOS PELO SISTEMA]:\n`
            tenantContext += `ID: ${bookingAttemptResult.appointment_id}\n`
            tenantContext += `Paciente: ${bookingPatientName}\n`
            tenantContext += `Serviço: ${bookingAttemptResult.service_name}\n`
            tenantContext += `Profissional: ${bookingAttemptResult.professional_name}\n`
            tenantContext += `Data: ${bookingAttemptResult.date} às ${bookingAttemptResult.start_time}\n`
            tenantContext += `Valor: R$ ${bookingAttemptResult.price.toFixed(2).replace('.', ',')}\n`
            tenantContext += `INSTRUÇÃO: Confirme o agendamento com alegria, envie o resumo completo e informe o link oficial ${bookingUrl}.\n`
          } else {
            tenantContext += `\n[TENTATIVA DE AGENDAMENTO NÃO REALIZADA]: ${bookingAttemptResult.error}\n`
            tenantContext += `INSTRUÇÃO: Explique educadamente o motivo ao paciente e ofereça horários alternativos ou o link oficial.\n`
          }
        }

        tenantContext += `\n[FIM DO CONTEXTO]\n\nMensagem do paciente: "${userText}"`

        // Call Native Skip Cloud Agent
        if (botUserId) {
          try {
            const agentResult = $ai.agent('contek-whatsapp-bot').chat({
              user_id: botUserId,
              message: tenantContext,
            })
            botReplyText = agentResult.content || ''
          } catch (errAgent) {
            console.error('[WhatsApp Hook] Native agent execution failed:', errAgent)
          }
        }

        // Fallback receptionist message if agent is not reachable or empty
        if (!botReplyText) {
          const salutation = knownClientName ? `Olá ${knownClientName}!` : 'Olá!'
          if (matchedOrg) {
            let servicesBrief = ''
            if (servicesList.length > 0) {
              servicesBrief =
                '\n\n*Procedimentos disponíveis:*\n' +
                servicesList
                  .slice(0, 4)
                  .map(
                    (s) =>
                      `• ${s.getString('name')}: R$ ${(s.getFloat('price') || 0).toFixed(2).replace('.', ',')}`,
                  )
                  .join('\n')
            }

            botReplyText =
              `${salutation} Como podemos te ajudar na *${orgName}*?\n\n` +
              `1️⃣ *Agendar um horário*\n` +
              `2️⃣ *Ver procedimentos e valores*\n` +
              `3️⃣ *Tirar dúvidas com a equipe*` +
              servicesBrief +
              `\n\nVocê também pode escolher o melhor dia e horário diretamente no nosso link oficial:\n🔗 ${bookingUrl}`
          } else {
            botReplyText =
              `${salutation} Bem-vindo(a) ao atendimento do Contek Agenda IA!\n\n` +
              `Como podemos te ajudar hoje? Para agendar, informe o nome ou link da clínica desejada.`
          }
        }

        // =========================================================================
        // GUARDA RÍGIDA DE VERACIDADE CONTRA AFIRMAÇÃO FALSA DE AGENDAMENTO CONCLUÍDO
        // Se a resposta afirmar "Agendamento confirmado" ou "horário agendado com sucesso",
        // verificar obrigatoriamente se existe registro real criado nos últimos 3 minutos!
        // =========================================================================
        const CONFIRMATION_CLAIM_PATTERNS = [
          /agendamento\s+confirmado/i,
          /agendado\s+com\s+sucesso/i,
          /hor[áa]rio\s+marcado\s+com\s+sucesso/i,
          /hor[áa]rio\s+reservado\s+com\s+sucesso/i,
          /agendei\s+o\s+seu\s+hor[áa]rio/i,
          /agendei\s+para\s+voc[êe]/i,
          /confirmamos\s+seu\s+agendamento/i,
          /✅[^\n\r]*agendad[oa]/i,
          /✅[^\n\r]*agendamento/i,
        ]

        const hasConfirmationClaim = CONFIRMATION_CLAIM_PATTERNS.some((p) => p.test(botReplyText))
        if (hasConfirmationClaim) {
          let hasRealAppt = false
          if (bookingAttemptResult && bookingAttemptResult.ok) {
            hasRealAppt = true
          } else if (orgId) {
            // Verify in DB created in the last 180 seconds
            try {
              const threeMinAgoIso = new Date(Date.now() - 180 * 1000)
                .toISOString()
                .replace('T', ' ')
              const cleanDigits = fromNumber.replace(/\D/g, '').slice(-8)
              const recentAppts = $app.findRecordsByFilter(
                'appointments',
                `organization_id = "${orgId}" && created >= "${threeMinAgoIso}" && (client_phone_snapshot ~ "${cleanDigits}" || client_id.phone ~ "${cleanDigits}")`,
                '-created',
                1,
                0,
              )
              if (recentAppts.length > 0) {
                hasRealAppt = true
              }
            } catch (_) {}
          }

          if (!hasRealAppt) {
            console.log(
              `[WhatsApp Anti-Hallucination Guard] Blocked false booking claim for phone ${fromNumber} in org ${orgName}. Replacing with reservation options.`,
            )
            botReplyText =
              `Com certeza! Para registrarmos seu agendamento com segurança no sistema da *${orgName}*, por favor me informe:\n\n` +
              `• *Seu nome completo*\n` +
              `• *O procedimento desejado*\n` +
              `• *O dia e horário de sua preferência*\n\n` +
              `Ou se preferir escolher com visualização de todos os horários livres agora mesmo, acesse:\n🔗 ${bookingUrl}`
          }
        }

        // Log interaction into notification_logs
        if (orgId) {
          try {
            const notifLogsCol = $app.findCollectionByNameOrId('notification_logs')
            const logRec = new Record(notifLogsCol)
            logRec.set('organization_id', orgId)
            logRec.set('type', 'WHATSAPP_AI')
            logRec.set('channel', 'WHATSAPP_AUTO')
            logRec.set(
              'status',
              defaultAccessToken && defaultPhoneId ? 'SENT' : 'PENDING_NO_CREDENTIALS',
            )
            logRec.set('recipient_phone', fromNumber)
            logRec.set('recipient_name', knownClientName || 'Paciente')
            logRec.set('message_text', botReplyText)
            logRec.set('payload', {
              incoming_text: userText,
              ai_enabled: isAiReceptionistActive,
              booking_created: Boolean(bookingAttemptResult && bookingAttemptResult.ok),
            })
            $app.save(logRec)
          } catch (errLog) {
            console.error('[WhatsApp Hook] Error saving AI notification log:', errLog)
          }
        }
      }

      // 4. DISPATCH MESSAGE VIA META WHATSAPP CLOUD API IF CREDENTIALS CONFIGURED
      const customPhoneId =
        (matchedSettings && matchedSettings.getString('whatsapp_phone_number_id')) ||
        item.incomingPhoneId ||
        defaultPhoneId

      if (defaultAccessToken && customPhoneId && fromNumber) {
        try {
          const metaUrl = `https://graph.facebook.com/v21.0/${customPhoneId}/messages`
          const metaRes = $http.send({
            url: metaUrl,
            method: 'POST',
            headers: {
              Authorization: `Bearer ${defaultAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: fromNumber.startsWith('55') ? fromNumber : `55${fromNumber}`,
              type: 'text',
              text: {
                preview_url: true,
                body: botReplyText,
              },
            }),
            timeout: 10,
          })
          console.log(
            `[WhatsApp Sent] Meta API response status: ${metaRes.statusCode} to ${fromNumber}`,
          )
        } catch (sendErr) {
          console.error('[WhatsApp Sent] Error sending to Meta Cloud API:', sendErr)
        }
      } else {
        console.log(
          `[WhatsApp Ready - No Meta Credentials] Simulation reply to ${fromNumber} (Org: ${orgName}):\n${botReplyText}`,
        )
      }

      responses.push({
        from: fromNumber,
        org: orgName,
        slug: orgSlug,
        ai_enabled: isAiReceptionistActive,
        reply: botReplyText,
      })
    }

    return e.json(200, {
      status: 'success',
      processed: responses.length,
      responses: responses,
    })
  } catch (err) {
    console.error('[WhatsApp Webhook Handler Error]:', err)
    return e.json(500, { error: err.message || 'Internal webhook error' })
  }
})
