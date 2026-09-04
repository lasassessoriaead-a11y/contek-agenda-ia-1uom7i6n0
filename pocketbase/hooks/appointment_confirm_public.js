/// <reference path="../pb_data/types.d.ts" />

// Public endpoint to confirm appointment via unique token (/backend/v1/appointments/confirm/:token)
routerAdd('GET', '/backend/v1/appointments/confirm/{token}', (e) => {
  try {
    const token = e.requestInfo().pathParams.token
    if (!token || token.length < 10) {
      return e.json(400, { error: 'Token de confirmação inválido ou ausente.' })
    }

    let appointment = null
    try {
      appointment = $app.findFirstRecordByData('appointments', 'confirmation_token', token)
    } catch (_) {
      return e.json(404, { error: 'Agendamento não encontrado para este link.' })
    }

    const orgId = appointment.getString('organization_id')
    const clientId = appointment.getString('client_id')
    const profId = appointment.getString('professional_id')
    const serviceId = appointment.getString('service_id')

    let orgName = 'Contek Agenda'
    try {
      const org = $app.findRecordById('organizations', orgId)
      orgName = org.getString('name')
    } catch (_) {}

    let clientName = appointment.getString('client_name_snapshot')
    let clientPhone = appointment.getString('client_phone_snapshot')
    if (clientId) {
      try {
        const client = $app.findRecordById('clients', clientId)
        if (!clientName) clientName = client.getString('name')
        if (!clientPhone) clientPhone = client.getString('phone') || client.getString('whatsapp')
      } catch (_) {}
    }

    let profName = ''
    if (profId) {
      try {
        const prof = $app.findRecordById('professionals', profId)
        profName = prof.getString('name')
      } catch (_) {}
    }

    let serviceName = ''
    if (serviceId) {
      try {
        const serv = $app.findRecordById('services', serviceId)
        serviceName = serv.getString('name')
      } catch (_) {}
    }

    const rawDate = appointment.getString('date')
    const startTime = appointment.getString('start_time')
    const currentStatus = appointment.getString('status')

    // Format date string dd/MM/yyyy
    let dateFormatted = rawDate
    if (rawDate && rawDate.length >= 10) {
      const parts = rawDate.slice(0, 10).split('-')
      if (parts.length === 3) {
        dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }

    // If appointment is already cancelled or missed, return state
    if (currentStatus === 'CANCELADO' || currentStatus === 'FALTOU') {
      return e.json(400, {
        error: `Este agendamento encontra-se atualmente como ${currentStatus}. Entre em contato diretamente com a clínica.`,
        status: currentStatus,
      })
    }

    // Update appointment status to CONFIRMADO
    const previousStatus = currentStatus
    if (currentStatus !== 'CONFIRMADO') {
      appointment.set('status', 'CONFIRMADO')
      $app.save(appointment)
    }

    // Fetch business settings for thanks message template
    let thanksTemplate =
      'Muito obrigado por confirmar, {{nome_paciente}}! Seu agendamento na {{empresa}} para dia {{data}} às {{hora}} está confirmado. Estamos te esperando com carinho!'
    try {
      const bizSettings = $app.findFirstRecordByData('business_settings', 'organization_id', orgId)
      if (bizSettings && bizSettings.getString('template_confirmation_thanks')) {
        thanksTemplate = bizSettings.getString('template_confirmation_thanks')
      }
    } catch (_) {}

    const thanksMessage = thanksTemplate
      .replace(/{{nome_paciente}}/g, clientName || 'Cliente')
      .replace(/{{nome_profissional}}/g, profName || 'Profissional')
      .replace(/{{servico}}/g, serviceName || 'Atendimento')
      .replace(/{{data}}/g, dateFormatted)
      .replace(/{{hora}}/g, startTime)
      .replace(/{{empresa}}/g, orgName)

    // Check if thanks notification has already been sent
    let sentMap = {}
    try {
      const rawSent = appointment.get('notifications_sent')
      if (rawSent && typeof rawSent === 'object') {
        sentMap = rawSent
      }
    } catch (_) {}

    let thanksDispatched = false
    if (!sentMap['CONFIRMATION_THANKS']) {
      // Check Meta credentials gate
      const defaultAccessToken =
        $os.getenv('META_WA_ACCESS_TOKEN') || $secrets.get('META_WA_ACCESS_TOKEN') || ''
      const defaultPhoneId =
        $os.getenv('META_WA_PHONE_NUMBER_ID') || $secrets.get('META_WA_PHONE_NUMBER_ID') || ''

      const cleanPhone = (clientPhone || '').replace(/\D/g, '')

      let logStatus = 'PENDING_NO_CREDENTIALS'
      if (defaultAccessToken && defaultPhoneId && cleanPhone) {
        try {
          const metaUrl = `https://graph.facebook.com/v21.0/${defaultPhoneId}/messages`
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
              to: cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`,
              type: 'text',
              text: { preview_url: false, body: thanksMessage },
            }),
            timeout: 10,
          })
          if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
            logStatus = 'SENT'
            thanksDispatched = true
          } else {
            logStatus = 'FAILED'
          }
        } catch (sendErr) {
          logStatus = 'FAILED'
        }
      }

      // Record in notification_logs
      try {
        const notifLogsCol = $app.findCollectionByNameOrId('notification_logs')
        const logRecord = new Record(notifLogsCol)
        logRecord.set('organization_id', orgId)
        logRecord.set('appointment_id', appointment.id)
        logRecord.set('type', 'CONFIRMATION_THANKS')
        logRecord.set('channel', 'WHATSAPP_AUTO')
        logRecord.set('status', logStatus)
        logRecord.set('recipient_phone', clientPhone)
        logRecord.set('recipient_name', clientName)
        logRecord.set('message_text', thanksMessage)
        $app.save(logRecord)

        sentMap['CONFIRMATION_THANKS'] = new Date().toISOString()
        appointment.set('notifications_sent', sentMap)
        $app.save(appointment)
      } catch (logErr) {
        console.error('[Confirmation Endpoint] Failed to write notification_log:', logErr)
      }
    }

    return e.json(200, {
      success: true,
      already_confirmed: previousStatus === 'CONFIRMADO',
      appointment: {
        id: appointment.id,
        status: 'CONFIRMADO',
        client_name: clientName,
        professional_name: profName,
        service_name: serviceName,
        date: dateFormatted,
        start_time: startTime,
        organization_name: orgName,
      },
      thanks_message: thanksMessage,
      thanks_dispatched: thanksDispatched,
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao processar confirmação do agendamento.' })
  }
})
