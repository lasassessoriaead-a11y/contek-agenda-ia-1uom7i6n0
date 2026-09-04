/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Identificar a organização de teste "ANA TESTE" (slug 'ana-teste')
    let org = null
    try {
      org = app.findFirstRecordByData('organizations', 'slug', 'ana-teste')
    } catch (_) {
      try {
        org = app.findFirstRecordByData('organizations', 'name', 'ANA TESTE')
      } catch (_) {}
    }

    const orgId = org ? org.id : 'osm3gqb57ut9g7g'

    // 2. Identificar o usuário de teste artesdalah23@gmail.com
    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', 'artesdalah23@gmail.com')
    } catch (_) {
      try {
        user = app.findFirstRecordByData('users', 'email', 'artesdalah23@gmail.com')
      } catch (_) {}
    }

    const userId = user ? user.id : '84v56fi3bt3a3se'

    console.log(`[purge_ana_teste] Inserindo limpeza para orgId=${orgId}, userId=${userId}`)

    // 3. Executar deleção ordenada de todas as dependências da organização e do usuário
    // Pagamentos e logs de notificação
    app
      .db()
      .newQuery('DELETE FROM payments WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()
    app
      .db()
      .newQuery('DELETE FROM notification_logs WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Agendamentos
    app
      .db()
      .newQuery('DELETE FROM appointments WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Clientes
    app
      .db()
      .newQuery('DELETE FROM clients WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Professional_services
    app
      .db()
      .newQuery(`
      DELETE FROM professional_services 
      WHERE organization_id = {:orgId} 
         OR professional_id IN (SELECT id FROM professionals WHERE organization_id = {:orgId} OR user_id = {:userId})
         OR service_id IN (SELECT id FROM services WHERE organization_id = {:orgId})
    `)
      .bind({ orgId: orgId, userId: userId })
      .execute()

    // Serviços (bind orgId)
    app
      .db()
      .newQuery('DELETE FROM services WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Profissionais
    app
      .db()
      .newQuery('DELETE FROM professionals WHERE organization_id = {:orgId} OR user_id = {:userId}')
      .bind({ orgId: orgId, userId: userId })
      .execute()

    // Subscrições
    app
      .db()
      .newQuery('DELETE FROM subscriptions WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Business settings
    app
      .db()
      .newQuery('DELETE FROM business_settings WHERE organization_id = {:orgId}')
      .bind({ orgId: orgId })
      .execute()

    // Organization users
    app
      .db()
      .newQuery(
        'DELETE FROM organization_users WHERE organization_id = {:orgId} OR user_id = {:userId}',
      )
      .bind({ orgId: orgId, userId: userId })
      .execute()

    // 4. Apagar a organização
    app
      .db()
      .newQuery("DELETE FROM organizations WHERE id = {:orgId} OR slug = 'ana-teste'")
      .bind({ orgId: orgId })
      .execute()

    // 5. Apagar o usuário
    app
      .db()
      .newQuery("DELETE FROM users WHERE id = {:userId} OR email = 'artesdalah23@gmail.com'")
      .bind({ userId: userId })
      .execute()

    console.log(
      '[purge_ana_teste] Limpeza concluída com sucesso para ANA TESTE / artesdalah23@gmail.com',
    )
  },
  (app) => {
    // Reversão não aplicável para exclusão deliberada de dados de teste
  },
)
