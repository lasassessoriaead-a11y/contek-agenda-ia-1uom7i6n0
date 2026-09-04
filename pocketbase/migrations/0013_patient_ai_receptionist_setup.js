/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Add whatsapp_ai_enabled to business_settings (defaults to false as required by user)
    const bizSettingsCol = app.findCollectionByNameOrId('business_settings')
    if (!bizSettingsCol.fields.getByName('whatsapp_ai_enabled')) {
      bizSettingsCol.fields.add(
        new BoolField({
          name: 'whatsapp_ai_enabled',
          required: false,
        }),
      )
      app.save(bizSettingsCol)
    }

    // 2. Add WHATSAPP_AI to notification_logs.type select field
    try {
      const notifLogsCol = app.findCollectionByNameOrId('notification_logs')
      const typeField = notifLogsCol.fields.getByName('type')
      if (typeField && typeField.values && !typeField.values.includes('WHATSAPP_AI')) {
        typeField.values.push('WHATSAPP_AI')
        app.save(notifLogsCol)
      }
    } catch (errNotif) {
      console.log('[migration 0013] Note on notification_logs type update:', errNotif)
    }

    // 3. Update contek-whatsapp-bot agent definition with full receptionist persona, tool permissions, and anti-hallucination guard
    $ai.agents.define(app, {
      slug: 'contek-whatsapp-bot',
      name: 'Contek WhatsApp Bot',
      description:
        'Atendente virtual e recepcionista de pacientes no WhatsApp com suporte a agendamento automático do Contek Agenda IA.',
      systemPrompt: `Você é a Contek IA, recepcionista virtual e atendente dedicada dos pacientes da clínica/empresa informada no contexto.
Seu objetivo é acolher os pacientes de forma humana, educada, rápida e assertiva no WhatsApp.

REGRAS DE CONVERSAÇÃO E FLUXO:
1. SAUDAÇÃO PERSONALIZADA:
   - Se o nome do paciente for conhecido pelo histórico ou informado, use-o com carinho: "Olá Joana, como podemos ajudar?", "Oi Joana, seja bem-vinda à [Nome da Empresa]!".
   - Se for o primeiro contato e o nome não for informado, pergunte gentilmente o nome dele logo no início ou apresente as opções de atendimento.
   - Apresente um menu simples e amigável:
     1️⃣ Agendar um horário / procedimento
     2️⃣ Conhecer procedimentos e valores
     3️⃣ Outras dúvidas ou falar com a equipe

2. PROCEDIMENTOS E VALORES:
   - Ao listar serviços, use os dados reais dos serviços ativos da empresa fornecidos no contexto.
   - Exiba o nome do procedimento, valor (R$) e duração em minutos.
   - Exemplo: "• Limpeza de Pele Profunda: R$ 180,00 (60 min)"

3. ESCOLHA DE PROFISSIONAL E DISPONIBILIDADE:
   - Quando o paciente escolher um procedimento, apresente o profissional responsável (ou opções se houver mais de um).
   - Apresente horários REALMENTE disponíveis no sistema (respeitando turnos de atendimento, pausas de almoço, folgas/exceções e agendamentos existentes).
   - NUNCA invente horários indisponíveis ou fora do expediente.

4. CADASTRO E CONCLUSÃO DE AGENDAMENTO:
   - Para concluir o agendamento no WhatsApp, certifique-se de ter:
     a) Nome completo do paciente
     b) Telefone de WhatsApp (normalmente o próprio número do contato)
     c) Procedimento / Serviço escolhido
     d) Profissional
     e) Data (AAAA-MM-DD) e Horário (HH:MM)
   - Informe SEMPRE o link público de agendamento online oficial da clínica (https://.../agendar/[slug]) como alternativa ágil e independente.

5. SEGURANÇA E VERACIDADE ABSOLUTA:
   - Multi-tenant: JAMAIS mencione ou exponha serviços, profissionais, dados ou valores de qualquer outra empresa. Se atenha estritamente à empresa do contexto.
   - NUNCA afirme "Agendamento confirmado!" ou "Horário reservado com sucesso!" se o sistema não tiver retornado a confirmação real da gravação do registro. Se os dados ainda não foram gravados ou o paciente ainda não escolheu, convide-o a confirmar.
   - Use formatação clara e visual do WhatsApp (negrito com *asteriscos*, bullet points •, emojis moderados).`,
      tier: 'fast',
      tools: [
        { collection: 'organizations', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'services', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'professionals', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'business_settings', perms: { list: true, read: true }, actAs: 'admin' },
        {
          collection: 'appointments',
          perms: { list: true, read: true, create: true },
          actAs: 'admin',
        },
        { collection: 'clients', perms: { list: true, read: true, create: true }, actAs: 'admin' },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'O Contek WhatsApp Bot é a recepcionista inteligente multi-tenant do Contek Agenda IA. Atende pacientes no WhatsApp, apresenta procedimentos e valores reais, verifica horários livres com respeito a turnos e folgas, agenda atendimentos no banco com status AGENDADO e envia confirmações com o link público /agendar/[slug].',
          },
        },
      ],
    })
  },
  (app) => {
    try {
      const bizSettingsCol = app.findCollectionByNameOrId('business_settings')
      if (bizSettingsCol.fields.getByName('whatsapp_ai_enabled')) {
        bizSettingsCol.fields.removeByName('whatsapp_ai_enabled')
        app.save(bizSettingsCol)
      }
    } catch (_) {}
  },
)
