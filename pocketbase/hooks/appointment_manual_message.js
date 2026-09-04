/// <reference path="../pb_data/types.d.ts" />

// Manual messaging helper: returns rendered template message & wa.me url for an appointment
// Also logs MANUAL_WA in notification_logs
routerAdd(
  'POST',
  '/backend/v1/appointments/manual-message',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const appointmentId = body.appointment_id
      const messageType = body.type || 'CONFIRMATION_REQUEST' // CONFIRMATION_REQUEST | CONFIRMATION_THANKS | DAY_REMINDER
      const markAsSent = Boolean(body.mark_as_sent)

      if (!appointmentId) {
        return e.json(400, { error: 'appointment_id é obrigatório.' })
      }

      let appt = null
      try {
        appt = $app.findRecordById('appointments', appointmentId)
      } catch (_) {
        return e.json(404, { error: 'Agendamento não encontrado.' })
      }

      const orgId = appt.getString('organization_id')
      const siteUrl = $os.getenv('SITE_URL') || 'https://contekagenda.com.br'

      // Check confirmation token
      let token = appt.getString('confirmation_token')
      if (!token) {
        token = $security.randomString(32)
        appt.set('confirmation_token', token)
        $app.save(appt)
      }

      let orgName = 'Contek Agenda'
      try {
        const org = $app.findRecordById('organizations', orgId)
        orgName = org.getString('name')
      } catch (_) {}

      let clientName = appt.getString('client_name_snapshot')
      let clientPhone = appt.getString('client_phone_snapshot')
      if (appt.getString('client_id')) {
        try {
          const c = $app.findRecordById('clients', appt.getString('client_id'))
          if (!clientName) clientName = c.getString('name')
          if (!clientPhone) clientPhone = c.getString('phone') || c.getString('whatsapp')
        } catch (_) {}
      }

      let profName = ''
      if (appt.getString('professional_id')) {
        try {
          const p = $app.findRecordById('professionals', appt.getString('professional_id'))
          profName = p.getString('name')
        } catch (_) {}
      }

      let servName = ''
      if (appt.getString('service_id')) {
        try {
          const s = $app.findRecordById('services', appt.getString('service_id'))
          servName = s.getString('name')
        } catch (_) {}
      }

      const rawDate = appt.getString('date')
      let dateFormatted = rawDate
      if (rawDate && rawDate.length >= 10) {
        const parts = rawDate.slice(0, 10).split('-')
        if (parts.length === 3) dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`
      }

      // Fetch template from business_settings
      let template = ''
      try {
        const bs = $app.findFirstRecordByData('business_settings', 'organization_id', orgId)
        if (bs) {
          if (messageType === 'CONFIRMATION_REQUEST') {
            template =
              bs.getString('template_confirmation_request') ||
              'Olá, {{nome_paciente}}! Aqui é da {{empresa}}. Lembramos que você tem um agendamento de {{servico}} com {{nome_profissional}} amanhã, dia {{data}} às {{hora}}.\n\nPor favor, confirme sua presença clicando no link: {{link_confirmacao}} ou responda 1 para confirmar.'
          } else if (messageType === 'CONFIRMATION_THANKS') {
            template =
              bs.getString('template_confirmation_thanks') ||
              'Muito obrigado por confirmar, {{nome_paciente}}! Seu agendamento na {{empresa}} para dia {{data}} às {{hora}} está confirmado. Estamos te esperando com carinho!'
          } else if (messageType === 'DAY_REMINDER') {
            template =
              bs.getString('template_day_reminder') ||
              'Olá, {{nome_paciente}}! Passando para lembrar do seu atendimento de {{servico}} HOJE, às {{hora}}, na {{empresa}} com {{nome_profissional}}. Qualquer dúvida, estamos à disposição!'
          }
        }
      } catch (_) {}

      if (!template) {
        template =
          'Olá, {{nome_paciente}}! Lembrando do seu atendimento de {{servico}} dia {{data}} às {{hora}} na {{empresa}}.'
      }

      const confirmLink = `${siteUrl}/confirmar/${token}`

      const renderedText = template
        .replace(/{{nome_paciente}}/g, clientName || 'Cliente')
        .replace(/{{nome_profissional}}/g, profName || 'Profissional')
        .replace(/{{servico}}/g, servName || 'Atendimento')
        .replace(/{{data}}/g, dateFormatted)
        .replace(/{{hora}}/g, appt.getString('start_time'))
        .replace(/{{empresa}}/g, orgName)
        .replace(/{{link_confirmacao}}/g, confirmLink)

      let cleanPhone = (clientPhone || '').replace(/\D/g, '')
      if (cleanPhone && !cleanPhone.startsWith('55') && cleanPhone.length <= 11) {
        cleanPhone = '55' + cleanPhone
      }

      const waLink = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(renderedText)}`
        : `https://wa.me/?text=${encodeURIComponent(renderedText)}`

      if (markAsSent) {
        let sentMap = {}
        try {
          const raw = appt.get('notifications_sent')
          if (raw && typeof raw === 'object') sentMap = raw
        } catch (_) {}

        sentMap[messageType] = new Date().toISOString()
        appt.set('notifications_sent', sentMap)
        $app.save(appt)

        try {
          const nlCol = $app.findCollectionByNameOrId('notification_logs')
          const logRecord = new Record(nlCol)
          logRecord.set('organization_id', orgId)
          logRecord.set('appointment_id', appt.id)
          logRecord.set('type', messageType)
          logRecord.set('channel', 'WHATSAPP_MANUAL')
          logRecord.set('status', 'SENT')
          logRecord.set('recipient_phone', clientPhone)
          logRecord.set('recipient_name', clientName)
          logRecord.set('message_text', renderedText)
          $app.save(logRecord)
        } catch (errLog) {
          console.error('[Manual Message] Error writing notification_log:', errLog)
        }
      }

      return e.json(200, {
        appointment_id: appt.id,
        type: messageType,
        recipient_name: clientName,
        recipient_phone: clientPhone,
        clean_phone: cleanPhone,
        message_text: renderedText,
        wa_link: waLink,
        notifications_sent: appt.get('notifications_sent') || {},
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Erro ao gerar mensagem manual' })
    }
  },
  $apis.requireAuth(),
)
