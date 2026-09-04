/// <reference path="../pb_data/types.d.ts" />

// Cron job running every 15 minutes to sweep upcoming appointments and send automated messages
// 1. D-1 (Tomorrow): send confirmation request with public link
// 2. D-0 (Today): send day reminder
cronAdd('message_automation_sweep', '*/15 * * * *', () => {
  try {
    const siteUrl = $os.getenv('SITE_URL') || 'https://contekagenda.com.br'
    const defaultAccessToken =
      $os.getenv('META_WA_ACCESS_TOKEN') || $secrets.get('META_WA_ACCESS_TOKEN') || ''
    const defaultPhoneId =
      $os.getenv('META_WA_PHONE_NUMBER_ID') || $secrets.get('META_WA_PHONE_NUMBER_ID') || ''

    // Current time in UTC - Brasilia is UTC-3
    const nowUtc = new Date()
    const brNow = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000)

    const todayStr = brNow.toISOString().slice(0, 10)
    const tomorrowDate = new Date(brNow.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10)

    // Sweep all active organizations with business_settings
    const settingsList = $app.findRecordsByFilter('business_settings', '', '', 100, 0)
    for (const bs of settingsList) {
      const orgId = bs.getString('organization_id')
      if (!orgId) continue

      // Check if automated reminders are enabled for this org
      const autoEnabled = bs.get('auto_reminders_enabled') !== false
      if (!autoEnabled) continue

      let orgName = 'Contek Agenda'
      try {
        const org = $app.findRecordById('organizations', orgId)
        if (org.getString('status') !== 'active') continue
        orgName = org.getString('name')
      } catch (_) {
        continue
      }

      const templateConfirm =
        bs.getString('template_confirmation_request') ||
        'Olá, {{nome_paciente}}! Aqui é da {{empresa}}. Lembramos que você tem um agendamento de {{servico}} com {{nome_profissional}} amanhã, dia {{data}} às {{hora}}.\n\nPor favor, confirme sua presença clicando no link: {{link_confirmacao}} ou responda 1 para confirmar.'

      const templateReminder =
        bs.getString('template_day_reminder') ||
        'Olá, {{nome_paciente}}! Passando para lembrar do seu atendimento de {{servico}} HOJE, às {{hora}}, na {{empresa}} com {{nome_profissional}}. Qualquer dúvida, estamos à disposição!'

      // 1. Process D-1 (Tomorrow's appointments for CONFIRMATION_REQUEST)
      // Must be status AGENDADO and not yet sent CONFIRMATION_REQUEST
      try {
        const tomorrowFilter = `organization_id = "${orgId}" && (status = "AGENDADO" || status = "CONFIRMADO") && date >= "${tomorrowStr} 00:00:00.000Z" && date <= "${tomorrowStr} 23:59:59.999Z"`
        const tomorrowAppts = $app.findRecordsByFilter(
          'appointments',
          tomorrowFilter,
          'start_time',
          100,
          0,
        )

        for (const appt of tomorrowAppts) {
          // Verify confirmation_token
          let token = appt.getString('confirmation_token')
          if (!token) {
            token = $security.randomString(32)
            appt.set('confirmation_token', token)
            $app.save(appt)
          }

          let sentMap = {}
          try {
            const raw = appt.get('notifications_sent')
            if (raw && typeof raw === 'object') sentMap = raw
          } catch (_) {}

          if (sentMap['CONFIRMATION_REQUEST']) continue

          // Resolve client info
          let cName = appt.getString('client_name_snapshot')
          let cPhone = appt.getString('client_phone_snapshot')
          const clientId = appt.getString('client_id')
          if (clientId) {
            try {
              const client = $app.findRecordById('clients', clientId)
              if (!cName) cName = client.getString('name')
              if (!cPhone) cPhone = client.getString('phone') || client.getString('whatsapp')
            } catch (_) {}
          }

          if (!cPhone) continue

          let profName = ''
          const profId = appt.getString('professional_id')
          if (profId) {
            try {
              const prof = $app.findRecordById('professionals', profId)
              profName = prof.getString('name')
            } catch (_) {}
          }

          let servName = ''
          const servId = appt.getString('service_id')
          if (servId) {
            try {
              const serv = $app.findRecordById('services', servId)
              servName = serv.getString('name')
            } catch (_) {}
          }

          const rawDate = appt.getString('date')
          let dateFormatted = tomorrowStr
          if (rawDate && rawDate.length >= 10) {
            const parts = rawDate.slice(0, 10).split('-')
            if (parts.length === 3) dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`
          }

          const confirmLink = `${siteUrl}/confirmar/${token}`

          const messageText = templateConfirm
            .replace(/{{nome_paciente}}/g, cName || 'Cliente')
            .replace(/{{nome_profissional}}/g, profName || 'Profissional')
            .replace(/{{servico}}/g, servName || 'Atendimento')
            .replace(/{{data}}/g, dateFormatted)
            .replace(/{{hora}}/g, appt.getString('start_time'))
            .replace(/{{empresa}}/g, orgName)
            .replace(/{{link_confirmacao}}/g, confirmLink)

          // Meta gate check
          const cleanPhone = (cPhone || '').replace(/\D/g, '')
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
                  text: { preview_url: true, body: messageText },
                }),
                timeout: 10,
              })
              if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
                logStatus = 'SENT'
              } else {
                logStatus = 'FAILED'
              }
            } catch (errSend) {
              logStatus = 'FAILED'
            }
          }

          // Save log record
          try {
            const notifLogsCol = $app.findCollectionByNameOrId('notification_logs')
            const logRecord = new Record(notifLogsCol)
            logRecord.set('organization_id', orgId)
            logRecord.set('appointment_id', appt.id)
            logRecord.set('type', 'CONFIRMATION_REQUEST')
            logRecord.set('channel', 'WHATSAPP_AUTO')
            logRecord.set('status', logStatus)
            logRecord.set('recipient_phone', cPhone)
            logRecord.set('recipient_name', cName)
            logRecord.set('message_text', messageText)
            $app.save(logRecord)

            sentMap['CONFIRMATION_REQUEST'] = new Date().toISOString()
            appt.set('notifications_sent', sentMap)
            $app.save(appt)
          } catch (errSave) {
            console.error('[Sweep Cron D-1] Error recording notif log:', errSave)
          }
        }
      } catch (errTomorrow) {
        console.error('[Sweep Cron D-1] Error querying tomorrow appointments:', errTomorrow)
      }

      // 2. Process D-0 (Today's appointments for DAY_REMINDER)
      // Must be status AGENDADO or CONFIRMADO and not yet sent DAY_REMINDER
      try {
        const todayFilter = `organization_id = "${orgId}" && (status = "AGENDADO" || status = "CONFIRMADO") && date >= "${todayStr} 00:00:00.000Z" && date <= "${todayStr} 23:59:59.999Z"`
        const todayAppts = $app.findRecordsByFilter(
          'appointments',
          todayFilter,
          'start_time',
          100,
          0,
        )

        for (const appt of todayAppts) {
          let sentMap = {}
          try {
            const raw = appt.get('notifications_sent')
            if (raw && typeof raw === 'object') sentMap = raw
          } catch (_) {}

          if (sentMap['DAY_REMINDER']) continue

          let cName = appt.getString('client_name_snapshot')
          let cPhone = appt.getString('client_phone_snapshot')
          const clientId = appt.getString('client_id')
          if (clientId) {
            try {
              const client = $app.findRecordById('clients', clientId)
              if (!cName) cName = client.getString('name')
              if (!cPhone) cPhone = client.getString('phone') || client.getString('whatsapp')
            } catch (_) {}
          }

          if (!cPhone) continue

          let profName = ''
          const profId = appt.getString('professional_id')
          if (profId) {
            try {
              const prof = $app.findRecordById('professionals', profId)
              profName = prof.getString('name')
            } catch (_) {}
          }

          let servName = ''
          const servId = appt.getString('service_id')
          if (servId) {
            try {
              const serv = $app.findRecordById('services', servId)
              servName = serv.getString('name')
            } catch (_) {}
          }

          const rawDate = appt.getString('date')
          let dateFormatted = todayStr
          if (rawDate && rawDate.length >= 10) {
            const parts = rawDate.slice(0, 10).split('-')
            if (parts.length === 3) dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`
          }

          const messageText = templateReminder
            .replace(/{{nome_paciente}}/g, cName || 'Cliente')
            .replace(/{{nome_profissional}}/g, profName || 'Profissional')
            .replace(/{{servico}}/g, servName || 'Atendimento')
            .replace(/{{data}}/g, dateFormatted)
            .replace(/{{hora}}/g, appt.getString('start_time'))
            .replace(/{{empresa}}/g, orgName)

          const cleanPhone = (cPhone || '').replace(/\D/g, '')
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
                  text: { preview_url: false, body: messageText },
                }),
                timeout: 10,
              })
              if (metaRes.statusCode >= 200 && metaRes.statusCode < 300) {
                logStatus = 'SENT'
              } else {
                logStatus = 'FAILED'
              }
            } catch (errSend) {
              logStatus = 'FAILED'
            }
          }

          try {
            const notifLogsCol = $app.findCollectionByNameOrId('notification_logs')
            const logRecord = new Record(notifLogsCol)
            logRecord.set('organization_id', orgId)
            logRecord.set('appointment_id', appt.id)
            logRecord.set('type', 'DAY_REMINDER')
            logRecord.set('channel', 'WHATSAPP_AUTO')
            logRecord.set('status', logStatus)
            logRecord.set('recipient_phone', cPhone)
            logRecord.set('recipient_name', cName)
            logRecord.set('message_text', messageText)
            $app.save(logRecord)

            sentMap['DAY_REMINDER'] = new Date().toISOString()
            appt.set('notifications_sent', sentMap)
            $app.save(appt)
          } catch (errSave) {
            console.error('[Sweep Cron D-0] Error recording notif log:', errSave)
          }
        }
      } catch (errToday) {
        console.error('[Sweep Cron D-0] Error querying today appointments:', errToday)
      }
    }
  } catch (errGlobal) {
    console.error('[message_automation_sweep Fatal Error]:', errGlobal)
  }
})
