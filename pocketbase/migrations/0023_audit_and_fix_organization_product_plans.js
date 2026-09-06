/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Garantir que os planos essenciais existam com os nomes consistentes
    // AGYLI Pro (ou AGYLI Pro Completo)
    let agyliPlan
    try {
      agyliPlan = app.findFirstRecordByData('plans', 'slug', 'agyli-pro')
    } catch (_) {
      try {
        agyliPlan = app.findFirstRecordByData('plans', 'product', 'agyli')
      } catch (_) {}
    }

    if (!agyliPlan) {
      const plansColl = app.findCollectionByNameOrId('plans')
      agyliPlan = new Record(plansColl)
      agyliPlan.set('name', 'AGYLI Pro')
      agyliPlan.set('slug', 'agyli-pro')
      agyliPlan.set('product', 'agyli')
      agyliPlan.set('price_monthly', 129.9)
      agyliPlan.set('max_professionals', 10)
      agyliPlan.set('modules_included', JSON.stringify(['all']))
      agyliPlan.set('trial_days', 7)
      agyliPlan.set('active', true)
      app.save(agyliPlan)
    }

    // MARKALY Essencial (slug: markaly-start ou markaly-essencial)
    let markalyPlan
    try {
      markalyPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')
    } catch (_) {
      try {
        markalyPlan = app.findFirstRecordByData('plans', 'product', 'markaly')
      } catch (_) {}
    }

    if (markalyPlan) {
      // Alinha nome do plano para "MARKALY Essencial"
      markalyPlan.set('name', 'MARKALY Essencial')
      app.save(markalyPlan)
    } else {
      const plansColl = app.findCollectionByNameOrId('plans')
      markalyPlan = new Record(plansColl)
      markalyPlan.set('name', 'MARKALY Essencial')
      markalyPlan.set('slug', 'markaly-start')
      markalyPlan.set('product', 'markaly')
      markalyPlan.set('price_monthly', 59.9)
      markalyPlan.set('max_professionals', 3)
      markalyPlan.set('modules_included', JSON.stringify(['core']))
      markalyPlan.set('trial_days', 7)
      markalyPlan.set('active', true)
      app.save(markalyPlan)
    }

    // 2. Auditar todas as organizações
    const orgs = app.findAllRecords('organizations')
    for (const org of orgs) {
      const orgName = org.getString('name') || ''
      const orgSlug = org.getString('slug') || ''
      const currentProduct = org.getString('product')
      let currentPlanId = org.getString('plan_id')

      // Regras de negócio do ecossistema:
      // La Bela e Lulu são MARKALY
      const isMarkalyOrg =
        orgSlug === 'lulu' ||
        orgSlug === 'la-bela' ||
        orgName.toLowerCase().includes('lulu') ||
        orgName.toLowerCase().includes('la bela') ||
        currentProduct === 'markaly'

      if (isMarkalyOrg) {
        org.set('product', 'markaly')
        org.set('plan_id', 'markaly-start')
        app.save(org)
      } else {
        // Empresas AGYLI (ex: Contek Estética & Saúde, LUIS)
        org.set('product', 'agyli')
        // Se estava com 'pro_v1' ou vazio, atualiza para o slug padrão 'agyli-pro'
        if (!currentPlanId || currentPlanId === 'pro_v1') {
          org.set('plan_id', 'agyli-pro')
        }
        app.save(org)
      }
    }
  },
  (app) => {
    // Revert logic (no-op)
  },
)
