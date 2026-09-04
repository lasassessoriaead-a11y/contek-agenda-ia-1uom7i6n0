/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Garantir que o usuário luka2510@hotmail.com é SUPERADMIN e is_super_admin = true
    try {
      const luka = app.findAuthRecordByEmail('_pb_users_auth_', 'luka2510@hotmail.com')
      luka.set('is_super_admin', true)
      luka.set('role', 'SUPERADMIN')
      app.save(luka)
    } catch (err) {
      console.log('[migration 0015] luka user not found:', err)
    }

    // 2. Definir produto 'agyli' para todas as organizações existentes sem produto
    const orgs = app.findRecordsByFilter('organizations', '1=1', '', 500, 0)
    for (const org of orgs) {
      if (!org.getString('product')) {
        org.set('product', 'agyli')
        app.save(org)
      }
    }

    // 3. Cadastrar ou atualizar Product Features para AGYLI e MARKALY
    const pfCol = app.findCollectionByNameOrId('product_features')

    // Agyli: Tudo liberado
    try {
      const agyliPf = app.findFirstRecordByData('product_features', 'product', 'agyli')
      agyliPf.set('features', [
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'financeiro',
        'assistente_ia',
        'whatsapp_ai',
        'relatorios',
        'configuracoes_avancadas',
      ])
      agyliPf.set('is_active', true)
      app.save(agyliPf)
    } catch (_) {
      const rec = new Record(pfCol)
      rec.set('product', 'agyli')
      rec.set('name', 'AGYLI - Plataforma Completa')
      rec.set(
        'description',
        'Versão completa com todos os módulos de agendamento, financeiro, IA e relatórios.',
      )
      rec.set('features', [
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'financeiro',
        'assistente_ia',
        'whatsapp_ai',
        'relatorios',
        'configuracoes_avancadas',
      ])
      rec.set('is_active', true)
      app.save(rec)
    }

    // Markaly: Núcleo de operação (dashboard, agenda, clientes, servicos, profissionais, página pública, WhatsApp/lembretes)
    // SEM financeiro, SEM assistente_ia, SEM relatorios
    try {
      const markalyPf = app.findFirstRecordByData('product_features', 'product', 'markaly')
      markalyPf.set('features', [
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'configuracoes_basicas',
        'whatsapp_notificacoes',
      ])
      markalyPf.set('is_active', true)
      app.save(markalyPf)
    } catch (_) {
      const rec = new Record(pfCol)
      rec.set('product', 'markaly')
      rec.set('name', 'MARKALY - Agendamento Essencial')
      rec.set(
        'description',
        'Versão simplificada focada em agendamento, clientes, serviços e comunicação rápida.',
      )
      rec.set('features', [
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'configuracoes_basicas',
        'whatsapp_notificacoes',
      ])
      rec.set('is_active', true)
      app.save(rec)
    }

    // 4. Cadastrar Planos Padrão
    const plansCol = app.findCollectionByNameOrId('plans')

    // Plano AGYLI PRO
    let agyliPlanId = ''
    try {
      const agPlan = app.findFirstRecordByData('plans', 'slug', 'agyli-pro')
      agyliPlanId = agPlan.id
    } catch (_) {
      const p = new Record(plansCol)
      p.set('name', 'AGYLI Pro Completo')
      p.set('slug', 'agyli-pro')
      p.set('product', 'agyli')
      p.set('price_monthly', 129.9)
      p.set('trial_days', 7)
      p.set('max_professionals', 10)
      p.set('modules_included', ['all'])
      p.set('description', 'Plano completo com todos os recursos e inteligência artificial.')
      p.set('active', true)
      app.save(p)
      agyliPlanId = p.id
    }

    // Plano MARKALY START
    let markalyPlanId = ''
    try {
      const mkPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')
      markalyPlanId = mkPlan.id
    } catch (_) {
      const p = new Record(plansCol)
      p.set('name', 'MARKALY Start')
      p.set('slug', 'markaly-start')
      p.set('product', 'markaly')
      p.set('price_monthly', 59.9)
      p.set('trial_days', 7)
      p.set('max_professionals', 3)
      p.set('modules_included', ['core'])
      p.set('description', 'Plano essencial para pequenas agendas sem complexidade financeira.')
      p.set('active', true)
      app.save(p)
      markalyPlanId = p.id
    }

    // 5. Vincular assinaturas para as organizações existentes
    const subsCol = app.findCollectionByNameOrId('subscriptions')
    for (const org of orgs) {
      try {
        app.findFirstRecordByData('subscriptions', 'organization_id', org.id)
      } catch (_) {
        const sub = new Record(subsCol)
        sub.set('organization_id', org.id)
        sub.set('plan_id', org.getString('product') === 'markaly' ? markalyPlanId : agyliPlanId)
        sub.set('status', 'active')
        sub.set('notes', 'Assinatura Legacy/Beta ativada automaticamente.')
        sub.set('starts_at', new Date().toISOString())
        sub.set('history', [
          {
            date: new Date().toISOString(),
            action: 'INITIAL_MIGRATION_ACTIVATION',
            note: 'Ativação como Legacy/Beta',
          },
        ])
        app.save(sub)
      }
    }
  },
  (app) => {},
)
