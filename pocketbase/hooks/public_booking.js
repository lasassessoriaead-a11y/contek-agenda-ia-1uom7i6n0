/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/backend/v1/public-booking', (e) => {
  const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0
    const parts = t.split(':')
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  const body = e.requestInfo().body || {}
  const {
    org_slug,
    service_id,
    professional_id,
    date,
    start_time,
    client_name,
    client_phone,
    client_email,
    notes,
  } = body

  if (
    !org_slug ||
    !service_id ||
    !professional_id ||
    !date ||
    !start_time ||
    !client_name ||
    !client_phone
  ) {
    return e.json(400, { error: 'Todos os campos obrigatórios devem ser preenchidos.' })
  }

  try {
    // 1. Resolve organization by unique slug
    const org = $app.findFirstRecordByData('organizations', 'slug', org_slug)
    if (!org) {
      return e.json(404, { error: 'Empresa ou estabelecimento não encontrado.' })
    }
    const orgId = org.id

    // 2. Fetch service & professional and ensure they belong strictly to this organization
    const servRecord = $app.findRecordById('services', service_id)
    if (!servRecord || servRecord.getString('organization_id') !== orgId) {
      return e.json(400, { error: 'Serviço inválido para esta organização.' })
    }
    if (servRecord.getBool('active') === false) {
      return e.json(400, { error: 'O serviço selecionado está inativo no momento.' })
    }

    const profRecord = $app.findRecordById('professionals', professional_id)
    if (!profRecord || profRecord.getString('organization_id') !== orgId) {
      return e.json(400, { error: 'Profissional inválido para esta organização.' })
    }
    if (profRecord.getBool('active') === false) {
      return e.json(400, { error: 'O profissional selecionado está indisponível.' })
    }

    const duration = servRecord.getInt('duration') || 30
    const price = servRecord.getFloat('price') || 0

    // 3. Calculate end_time
    const parts = start_time.split(':')
    const startHour = parseInt(parts[0], 10)
    const startMin = parseInt(parts[1], 10)
    const totalMinutes = startHour * 60 + startMin + duration
    const endH = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0')
    const endM = (totalMinutes % 60).toString().padStart(2, '0')
    const end_time = `${endH}:${endM}`
    const newStartMin = startHour * 60 + startMin
    const newEndMin = totalMinutes

    // 4. Validate working days and working hours
    const dateStr = typeof date === 'string' ? date.slice(0, 10) : ''
    const partsDate = dateStr.split('-')
    const y = parseInt(partsDate[0], 10)
    const m = parseInt(partsDate[1], 10)
    const d = parseInt(partsDate[2], 10)
    // Use UTC date to avoid any timezone/DST shift issues in JS runtime
    const dayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
    const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
    const dayKey = dayMap[dayIdx]

    // Parse helper for JSON/array fields
    const parseListField = (val) => {
      if (!val) return []
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'number') {
          try {
            const str = String.fromCharCode(...val)
            const parsed = JSON.parse(str)
            return Array.isArray(parsed) ? parsed : []
          } catch (_) {
            return []
          }
        }
        return val
      }
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          return Array.isArray(parsed) ? parsed : []
        } catch (_) {
          return []
        }
      }
      return []
    }

    const parseObjField = (val) => {
      if (!val) return null
      if (Array.isArray(val)) {
        if (val.length > 0 && typeof val[0] === 'number') {
          try {
            const str = String.fromCharCode(...val)
            const parsed = JSON.parse(str)
            return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
          } catch (_) {
            return null
          }
        }
        return null
      }
      if (typeof val === 'object' && !Array.isArray(val)) return val
      if (typeof val === 'string') {
        try {
          const parsed = JSON.parse(val)
          return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
        } catch (_) {
          return null
        }
      }
      return null
    }

    // Check organization settings working days if available
    try {
      const bizSettings = $app.findFirstRecordByData('business_settings', 'organization_id', orgId)
      if (bizSettings) {
        const orgWorkingDays = parseListField(bizSettings.get('working_days'))
        console.log(
          `[public_booking] date=${date} dayKey=${dayKey} orgDays=${JSON.stringify(orgWorkingDays)}`,
        )
        if (orgWorkingDays.length > 0 && !orgWorkingDays.includes(dayKey)) {
          return e.json(400, { error: 'O estabelecimento não abre no dia da semana selecionado.' })
        }
      }
    } catch (_) {}

    const profWorkDays = parseListField(profRecord.get('work_days'))
    if (profWorkDays.length > 0 && !profWorkDays.includes(dayKey)) {
      return e.json(400, { error: 'O profissional não atende no dia da semana selecionado.' })
    }

    const profWorkHours = parseObjField(profRecord.get('work_hours'))
    if (profWorkHours && profWorkHours.start && profWorkHours.end) {
      const pStart = timeToMinutes(profWorkHours.start)
      const pEnd = timeToMinutes(profWorkHours.end)
      if (newStartMin < pStart || newEndMin > pEnd) {
        return e.json(400, {
          error: `Horário fora do expediente do profissional (${profWorkHours.start} às ${profWorkHours.end}).`,
        })
      }
    }
    // 5. Check conflict on the same date for the professional
    const cleanDate = typeof date === 'string' ? date.slice(0, 10) : ''
    const filter = `professional_id = "${professional_id}" && status != "CANCELADO"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 200, 0)
    for (const appt of existing) {
      const apptDateStr = (appt.getString('date') || '').slice(0, 10)
      if (apptDateStr !== cleanDate) continue

      const existStart = appt.getString('start_time')
      const existEnd = appt.getString('end_time')
      const existStartMin = timeToMinutes(existStart)
      const existEndMin = timeToMinutes(existEnd)

      if (newStartMin < existEndMin && newEndMin > existStartMin) {
        return e.json(409, {
          error: `Conflito de horário para este profissional: já existe agendamento das ${existStart} às ${existEnd}.`,
        })
      }
    }

    // 6. Find or Create Client within this organization
    let clientId = ''
    const cleanPhone = client_phone.trim()
    try {
      const clientFilter = `organization_id = "${orgId}" && phone = "${cleanPhone}"`
      const foundClients = $app.findRecordsByFilter('clients', clientFilter, '', 1, 0)
      if (foundClients.length > 0) {
        clientId = foundClients[0].id
      }
    } catch (_) {}

    if (!clientId) {
      const clientsCol = $app.findCollectionByNameOrId('clients')
      const clientRecord = new Record(clientsCol)
      clientRecord.set('organization_id', orgId)
      clientRecord.set('name', client_name.trim())
      clientRecord.set('phone', cleanPhone)
      if (client_email) clientRecord.set('email', client_email.trim())
      clientRecord.set('notes', 'Cadastrado automaticamente via agendamento online')
      $app.save(clientRecord)
      clientId = clientRecord.id
    }

    // 7. Create Appointment
    const apptsCol = $app.findCollectionByNameOrId('appointments')
    const apptRecord = new Record(apptsCol)
    apptRecord.set('organization_id', orgId)
    apptRecord.set('client_id', clientId)
    apptRecord.set('service_id', service_id)
    apptRecord.set('professional_id', professional_id)
    apptRecord.set('date', cleanDate + ' 00:00:00.000Z')
    apptRecord.set('start_time', start_time)
    apptRecord.set('end_time', end_time)
    apptRecord.set('duration', duration)
    apptRecord.set('price', price)
    apptRecord.set('status', 'AGENDADO')
    apptRecord.set('client_name_snapshot', client_name.trim())
    apptRecord.set('client_phone_snapshot', cleanPhone)
    apptRecord.set('notes', notes ? notes.trim() : 'Agendado pelo cliente via página pública')

    $app.save(apptRecord)

    // 8. Create associated pending payment entry
    const paymentsCol = $app.findCollectionByNameOrId('payments')
    const payRecord = new Record(paymentsCol)
    payRecord.set('organization_id', orgId)
    payRecord.set('appointment_id', apptRecord.id)
    payRecord.set('client_id', clientId)
    payRecord.set('amount', price)
    payRecord.set('is_paid', false)
    payRecord.set('payment_method', 'PIX')
    payRecord.set('description', `${servRecord.getString('name')} - Agendamento Online`)
    $app.save(payRecord)

    return e.json(200, {
      success: true,
      appointment_id: apptRecord.id,
      start_time: start_time,
      end_time: end_time,
      date: cleanDate,
      organization_name: org.getString('name'),
      service_name: servRecord.getString('name'),
      professional_name: profRecord.getString('name'),
      price: price,
      message: 'Agendamento confirmado com sucesso!',
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao processar agendamento.' })
  }
})
