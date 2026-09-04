/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/backend/v1/whatsapp/webhook', (e) => {
  try {
    const body = e.requestInfo().body || {}

    // Meta sends { object: "whatsapp_business_account", entry: [...] }
    if (body.object !== 'whatsapp_business_account') {
      return e.json(200, { status: 'ignored_not_whatsapp' })
    }

    const entries = body.entry || []
    if (entries.length === 0) {
      return e.json(200, { status: 'empty_entry' })
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

    for (const entry of entries) {
      const changes = entry.changes || []
      for (const change of changes) {
        if (change.field !== 'messages') continue
        const value = change.value || {}
        const messages = value.messages || []
        const metadata = value.metadata || {}
        const incomingPhoneId = metadata.phone_number_id || defaultPhoneId

        for (const msg of messages) {
          // Process text messages
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

          if (!userText) {
            continue
          }

          const fromNumber = msg.from // e.g. "5511999998888"

          // 1. Identify organization via slug in message or referral
          // Format expected from deep link: "wa.me/<number>?text=Olá, quero agendar em ... &ref=slug" or "#ref:slug" or "[slug]"
          let matchedOrg = null
          let detectedSlug = ''

          // Check if referral exists in message
          if (msg.referral && msg.referral.ref) {
            detectedSlug = msg.referral.ref.trim()
          }

          if (!detectedSlug) {
            const refMatch = userText.match(/(?:ref=|ref:|slug=|empresa:|\bref:)([a-zA-Z0-9-_]+)/i)
            if (refMatch && refMatch[1]) {
              detectedSlug = refMatch[1].trim()
            }
          }

          if (!detectedSlug) {
            // Check bracketed slug like [slug]
            const bracketMatch = userText.match(/\[([a-zA-Z0-9-_]+)\]/)
            if (bracketMatch && bracketMatch[1]) {
              detectedSlug = bracketMatch[1].trim()
            }
          }

          // Try to look up organization by detected slug
          if (detectedSlug) {
            try {
              matchedOrg = $app.findFirstRecordByData('organizations', 'slug', detectedSlug)
            } catch (_) {}
          }

          // If still not matched by explicit slug, test against organization names or slugs in DB
          if (!matchedOrg) {
            try {
              const allOrgs = $app.findRecordsByFilter(
                'organizations',
                'status = "active"',
                '',
                20,
                0,
              )
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

          // Fetch organization services and info if organization is found
          let orgContext = ''
          let orgWelcome = ''
          let customPhoneId = incomingPhoneId
          let bookingUrl = ''

          if (matchedOrg) {
            const orgId = matchedOrg.id
            const orgName = matchedOrg.getString('name')
            const orgSlug = matchedOrg.getString('slug')
            bookingUrl = `${siteUrl}/agendar/${orgSlug}`

            // Fetch organization settings
            try {
              const bizSettings = $app.findFirstRecordByData(
                'business_settings',
                'organization_id',
                orgId,
              )
              if (bizSettings) {
                orgWelcome = bizSettings.getString('whatsapp_welcome_message')
                const customId = bizSettings.getString('whatsapp_phone_number_id')
                if (customId) customPhoneId = customId
              }
            } catch (_) {}

            // Fetch active services
            let servicesListText = ''
            try {
              const servs = $app.findRecordsByFilter(
                'services',
                `organization_id = "${orgId}" && active = true`,
                'price',
                10,
                0,
              )
              if (servs.length > 0) {
                servicesListText = servs
                  .map((s) => {
                    const priceFormatted = (s.getFloat('price') || 0).toFixed(2).replace('.', ',')
                    return `• ${s.getString('name')}: R$ ${priceFormatted} (${s.getInt('duration')} min)`
                  })
                  .join('\n')
              }
            } catch (_) {}

            orgContext =
              `\n[CONTEXTO DA EMPRESA IDENTIFICADA]` +
              `\nNome da Empresa: ${orgName}` +
              `\nSlug: ${orgSlug}` +
              `\nLink de Agendamento Oficial: ${bookingUrl}` +
              (orgWelcome ? `\nMensagem personalizada de boas-vindas: "${orgWelcome}"` : '') +
              (servicesListText ? `\nServiços Disponíveis:\n${servicesListText}` : '')
          } else {
            orgContext = `\n[CONTEXTO] Nenhuma empresa específica foi identificada ainda na mensagem. Peça educadamente ao cliente para informar o nome ou link da clínica/profissional com quem deseja agendar.`
          }

          // Check if message is a confirmation response (e.g. "1", "sim", "confirmar", "confirmado", "confirmo", "ok")
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
            // Find upcoming appointment for this phone number
            try {
              const cleanSender = fromNumber.replace(/\D/g, '')
              const last8or9 = cleanSender.slice(-8)

              // Search appointments in AGENDADO status for today or future
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

                // Log in notification_logs
                try {
                  const nlCol = $app.findCollectionByNameOrId('notification_logs')
                  const logR = new Record(nlCol)
                  logR.set('organization_id', apptOrgId)
                  logR.set('appointment_id', targetAppt.id)
                  logR.set('type', 'CONFIRMATION_THANKS')
                  logR.set('channel', 'WHATSAPP_AUTO')
                  logR.set(
                    'status',
                    defaultAccessToken && customPhoneId ? 'SENT' : 'PENDING_NO_CREDENTIALS',
                  )
                  logR.set('recipient_phone', fromNumber)
                  logR.set('recipient_name', cName || 'Cliente')
                  logR.set('message_text', botReplyText)
                  $app.save(logR)
                } catch (_) {}

                handledConfirmation = true
              }
            } catch (errSearchAppt) {
              console.error(
                '[WhatsApp Hook] Error matching confirmation appointment:',
                errSearchAppt,
              )
            }
          }

          if (!handledConfirmation) {
            // Build prompt for Skip Cloud Native Agent
            const agentPrompt = `Mensagem recebida de cliente no WhatsApp (${fromNumber}):\n"${userText}"\n${orgContext}`
            if (botUserId) {
              try {
                const agentResult = $ai.agent('contek-whatsapp-bot').chat({
                  user_id: botUserId,
                  message: agentPrompt,
                })
                botReplyText = agentResult.content || ''
              } catch (errAgent) {
                console.error('[WhatsApp Hook] Agent execution failed:', errAgent)
                // Graceful fallback
                if (matchedOrg) {
                  botReplyText =
                    `Olá! Seja bem-vindo(a) à *${matchedOrg.getString('name')}*!\n\n` +
                    (orgWelcome ? `${orgWelcome}\n\n` : '') +
                    `Você pode consultar todos os nossos horários livres e agendar diretamente no nosso link oficial:\n🔗 ${bookingUrl}\n\n` +
                    `Se preferir, pode me dizer qual serviço você deseja e seu nome completo!`
                } else {
                  botReplyText =
                    `Olá! Bem-vindo(a) ao atendimento inteligente Contek Agenda IA.\n\n` +
                    `Com qual clínica ou profissional você gostaria de agendar? Envie o nome ou o link de agendamento!`
                }
              }
            }

            if (!botReplyText) {
              botReplyText = `Olá! Recebemos sua mensagem. Acesse nosso link de agendamento online para escolher seu melhor dia e horário!`
            }
          }

          // Dispatch message back to Meta WhatsApp Cloud API if credentials exist
          if (defaultAccessToken && customPhoneId) {
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
                  to: fromNumber,
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
              `[WhatsApp Ready] Meta credentials not yet configured. Simulated reply to ${fromNumber}:\n${botReplyText}`,
            )
          }
        }
      }
    }

    return e.json(200, { status: 'success' })
  } catch (err) {
    console.error('[WhatsApp Webhook Handler Error]:', err)
    return e.json(500, { error: err.message || 'Internal webhook error' })
  }
})
