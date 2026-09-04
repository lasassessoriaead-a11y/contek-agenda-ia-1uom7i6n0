/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Teste de atualização da empresa Lulu com os dados do endpoint
    try {
      const org = app.findFirstRecordByData('organizations', 'slug', 'lulu')
      const markalyPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')

      org.set('product', 'markaly')
      org.set('status', 'active')
      org.set('plan_id', markalyPlan.getString('slug'))
      app.save(org)

      // Atualizar subscription correspondente com histórico em JSON
      const sub = app.findFirstRecordByData('subscriptions', 'organization_id', org.id)
      sub.set('plan_id', markalyPlan.id)
      sub.set('status', 'active')
      sub.set('notes', 'Atualizado pelo SuperAdmin (teste de integridade)')

      let historyList = []
      try {
        const rawHistory = sub.get('history')
        if (Array.isArray(rawHistory)) {
          historyList = rawHistory.slice()
        } else if (typeof rawHistory === 'string' && rawHistory.trim()) {
          historyList = JSON.parse(rawHistory)
        }
      } catch (_) {}

      historyList.push({
        date: new Date().toISOString(),
        action: 'SUPERADMIN_UPDATE',
        changed_by: 'luka2510@hotmail.com',
        changes: { product: 'markaly', plan_id: markalyPlan.id },
      })

      sub.set('history', JSON.stringify(historyList))
      app.save(sub)
    } catch (err) {
      console.log('[migration 0017] Error verifying Lulu update:', err)
    }
  },
  (app) => {},
)
