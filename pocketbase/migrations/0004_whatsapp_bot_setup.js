/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add fields to business_settings for WhatsApp configuration per organization
    const bizSettingsCol = app.findCollectionByNameOrId('business_settings')
    if (!bizSettingsCol.fields.getByName('whatsapp_phone_number')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'whatsapp_phone_number',
          required: false,
        }),
      )
    }
    if (!bizSettingsCol.fields.getByName('whatsapp_welcome_message')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'whatsapp_welcome_message',
          required: false,
        }),
      )
    }
    if (!bizSettingsCol.fields.getByName('whatsapp_phone_number_id')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'whatsapp_phone_number_id',
          required: false,
        }),
      )
    }
    app.save(bizSettingsCol)

    // 2. Ensure a dedicated system user for WhatsApp Agent sessions exists
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    let botUser
    try {
      botUser = app.findAuthRecordByEmail('_pb_users_auth_', 'whatsapp-bot@contek.local')
    } catch (_) {
      botUser = new Record(usersCol)
      botUser.setEmail('whatsapp-bot@contek.local')
      botUser.setPassword($security.randomString(32))
      botUser.setVerified(true)
      botUser.set('name', 'Contek WhatsApp Bot')
      botUser.set('role', 'ADMINISTRADOR')
      app.save(botUser)
    }

    // 3. Define the native Skip Cloud Agent for WhatsApp
    $ai.agents.define(app, {
      slug: 'contek-whatsapp-bot',
      name: 'Contek WhatsApp Bot',
      description:
        'Agente conversacional nativo para atendimento e agendamento via WhatsApp oficial do Contek Agenda IA.',
      systemPrompt: `Você é a Contek IA de Atendimento via WhatsApp Oficial.
Seu objetivo principal é atender interessados em agendar serviços com o profissional ou empresa, de forma cordial, ágil, objetiva e acolhedora em Português do Brasil.

Comportamento obrigatório:
1. Saudação inicial e Identificação: Apresente-se amigavelmente, cite o nome da empresa identificada pelo slug e mostre disposição em ajudar.
2. Serviços e Preços: Informe com clareza os serviços oferecidos pela empresa, com seus respectivos valores e duração.
3. Link Público de Agendamento: Sempre forneça o link direto de agendamento online:
   https://[SITE_URL]/agendar/[slug]
   Explique que pelo link o cliente escolhe a data e horário em poucos segundos.
4. Coleta de Dados e Confirmação: Caso o cliente prefira agendar pela conversa do WhatsApp, pergunte educadamente:
   - Nome completo
   - Serviço desejado
   - Dia ou turno de preferência
   - Telefone de contato
   E oriente para a confirmação.
5. Seja natural, use formatação amigável do WhatsApp (como negrito com asteriscos *exemplo* e tópicos com bullet points).
6. NUNCA invente serviços ou preços fora da organização identificada. Seja ético e prestativo.`,
      tier: 'fast',
      tools: [
        { collection: 'organizations', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'services', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'professionals', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'business_settings', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'appointments', perms: { list: true, read: true }, actAs: 'admin' },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'O Contek WhatsApp Bot atende potenciais clientes via Meta WhatsApp Business Cloud API Oficial. Ele identifica a organização através do parâmetro ref=slug ou menção ao nome da empresa, lista serviços disponíveis com preço e duração, fornece o link https://.../agendar/[slug] e guia o cliente no agendamento.',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'contek-whatsapp-bot')
    } catch (_) {}

    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'whatsapp-bot@contek.local')
      app.delete(user)
    } catch (_) {}

    try {
      const bizSettingsCol = app.findCollectionByNameOrId('business_settings')
      if (bizSettingsCol.fields.getByName('whatsapp_phone_number')) {
        bizSettingsCol.fields.removeByName('whatsapp_phone_number')
      }
      if (bizSettingsCol.fields.getByName('whatsapp_welcome_message')) {
        bizSettingsCol.fields.removeByName('whatsapp_welcome_message')
      }
      if (bizSettingsCol.fields.getByName('whatsapp_phone_number_id')) {
        bizSettingsCol.fields.removeByName('whatsapp_phone_number_id')
      }
      app.save(bizSettingsCol)
    } catch (_) {}
  },
)
