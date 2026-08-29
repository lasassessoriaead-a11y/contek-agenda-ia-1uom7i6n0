/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    $ai.agents.define(app, {
      slug: 'contek-assistant',
      name: 'Contek Assistant',
      description:
        'Assistente inteligente de negócios do Contek Agenda IA para análise de agendamentos, clientes, serviços e financeiro.',
      systemPrompt: `Você é o Contek Assistant, assistente de gestão inteligente e negócios para a plataforma Contek Agenda IA (desenvolvido pela Contek Tecnologia e Consultoria).
Você ajuda pequenos prestadores de serviços (clínicas de estética, psicólogos, nutricionistas, dentistas, salões, barbearias, personal trainers) a analisarem sua agenda, faturamento, clientes mais frequentes e horários ociosos.
Seja conciso, profissional, prestativo e forneça insights práticos em Português do Brasil.
Sempre que o usuário perguntar sobre números de hoje, da semana ou clientes, responda com dados claros e formatados.`,
      tier: 'fast',
      tools: [
        { collection: 'appointments', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'clients', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'services', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'payments', perms: { list: true, read: true }, actAs: 'admin' },
        { collection: 'professionals', perms: { list: true, read: true }, actAs: 'admin' },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'O Contek Agenda IA é um SaaS multi-tenant desenvolvido pela Contek Tecnologia e Consultoria. Ele oferece gestão de agendamentos com status AGENDADO, CONFIRMADO, EM ATENDIMENTO, CONCLUÍDO, CANCELADO, FALTOU, link de agendamento público /agendar/:slug, controle financeiro simples (PIX, Dinheiro, Cartão, Outro) e perfis de ADMINISTRADOR e PROFISSIONAL.',
          },
        },
      ],
    })
  },
  (app) => {
    $ai.agents.delete(app, 'contek-assistant')
  },
)
