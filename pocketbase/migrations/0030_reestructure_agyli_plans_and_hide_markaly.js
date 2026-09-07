/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0030: Reestruturação dos planos AGYLI (Essencial e Pro)
 * - Criação do plano `agyli-essencial`: R$ 19,90/mês, 7 dias de trial, 1 profissional máximo,
 *   módulos: dashboard, agenda, clientes, servicos, configuracoes_basicas (sem financeiro, sem IA).
 * - Atualização do plano `agyli-pro`: R$ 29,90/mês, 7 dias de trial, 5 profissionais máximo,
 *   todos os módulos liberados (+financeiro, assistente_ia, whatsapp_ai, encaixes, relatorios).
 * - Marcação do plano `markaly-start`: active = false (não exposto publicamente, preservando histórico).
 * - Preservação da organização "Gabysalgado" e demais clientes ativos em agyli-pro.
 */
migrate(
  (app) => {
    const plansColl = app.findCollectionByNameOrId('plans')

    // 1. Criar ou atualizar agyli-essencial
    let agyliEssencial = null
    try {
      agyliEssencial = app.findFirstRecordByData('plans', 'slug', 'agyli-essencial')
    } catch (_) {
      agyliEssencial = null
    }

    if (!agyliEssencial) {
      agyliEssencial = new Record(plansColl)
      agyliEssencial.set('slug', 'agyli-essencial')
    }

    agyliEssencial.set('name', 'AGYLI Essencial')
    agyliEssencial.set('product', 'agyli')
    agyliEssencial.set('price_monthly', 19.9)
    agyliEssencial.set('trial_days', 7)
    agyliEssencial.set('max_professionals', 1)
    agyliEssencial.set(
      'modules_included',
      JSON.stringify([
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'configuracoes_basicas',
        'whatsapp_notificacoes',
      ]),
    )
    agyliEssencial.set(
      'description',
      'Plano essencial para 1 profissional: agendamento online e presencial, gestão de clientes, serviços e notificações WhatsApp sem módulo financeiro ou IA.',
    )
    agyliEssencial.set('active', true)
    app.save(agyliEssencial)

    // 2. Atualizar agyli-pro
    let agyliPro = null
    try {
      agyliPro = app.findFirstRecordByData('plans', 'slug', 'agyli-pro')
    } catch (_) {
      try {
        agyliPro = app.findFirstRecordByData('plans', 'product', 'agyli')
      } catch (_) {
        agyliPro = null
      }
    }

    if (!agyliPro) {
      agyliPro = new Record(plansColl)
      agyliPro.set('slug', 'agyli-pro')
    }

    agyliPro.set('name', 'AGYLI Pro')
    agyliPro.set('product', 'agyli')
    agyliPro.set('price_monthly', 29.9)
    agyliPro.set('trial_days', 7)
    agyliPro.set('max_professionals', 5)
    agyliPro.set(
      'modules_included',
      JSON.stringify([
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'financeiro',
        'assistente_ia',
        'whatsapp_ai',
        'relatorios',
        'configuracoes_basicas',
        'configuracoes_avancadas',
      ]),
    )
    agyliPro.set(
      'description',
      'Plano profissional completo para até 5 profissionais: financeiro total com comissões, inteligência artificial integrada, recepção por WhatsApp e encaixes inteligentes.',
    )
    agyliPro.set('active', true)
    app.save(agyliPro)

    // 3. Ocultar plano MARKALY público marcando active = false
    try {
      const markalyPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')
      if (markalyPlan) {
        markalyPlan.set('active', false)
        app.save(markalyPlan)
      }
    } catch (_) {}

    // 4. Garantir que a empresa "Gabysalgado" continua intacta em agyli-pro
    try {
      const gabyOrg = app.findFirstRecordByData('organizations', 'slug', 'gabysalgado')
      if (gabyOrg) {
        gabyOrg.set('product', 'agyli')
        gabyOrg.set('plan_id', 'agyli-pro')
        app.save(gabyOrg)

        const subs = app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + gabyOrg.id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const gabySub = subs[0]
          gabySub.set('plan_id', agyliPro.id)
          gabySub.set('status', 'active')
          app.save(gabySub)
        }
      }
    } catch (_) {}
  },
  (app) => {
    // Rollback se necessário
    try {
      const markalyPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')
      if (markalyPlan) {
        markalyPlan.set('active', true)
        app.save(markalyPlan)
      }
    } catch (_) {}
  },
)
