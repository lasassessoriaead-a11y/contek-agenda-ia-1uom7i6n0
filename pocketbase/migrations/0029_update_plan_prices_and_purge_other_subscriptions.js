/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // -------------------------------------------------------------
    // PARTE 1: ATUALIZAÇÃO DE PREÇOS DOS PLANOS
    // AGYLI Pro: R$ 29,90/mês
    // MARKALY Essencial: R$ 19,90/mês
    // -------------------------------------------------------------
    try {
      const agyliPlan = app.findFirstRecordByData('plans', 'slug', 'agyli-pro')
      if (agyliPlan) {
        agyliPlan.set('price_monthly', 29.9)
        app.save(agyliPlan)
        console.log('[migration 0029] Plano AGYLI Pro atualizado para 29.90')
      }
    } catch (e) {
      console.log('[migration 0029] Erro ao buscar agyli-pro:', e)
    }

    try {
      const markalyPlan = app.findFirstRecordByData('plans', 'slug', 'markaly-start')
      if (markalyPlan) {
        markalyPlan.set('price_monthly', 19.9)
        app.save(markalyPlan)
        console.log('[migration 0029] Plano MARKALY Essencial atualizado para 19.90')
      }
    } catch (e) {
      console.log('[migration 0029] Erro ao buscar markaly-start:', e)
    }

    // -------------------------------------------------------------
    // PARTE 2: LIMPEZA DE ASSINATURAS E EMPRESAS EXCETO GABY SALGADO
    // Pedido verbatim: "estas assinaturas pode apagar deixe só da gaby salgado"
    // "Apague as assinaturas e/ou registros associados de TODAS as outras empresas
    // (CAMILA, la bela e Lulu, LUIS, Contek Estética legacy), deixando SOMENTE
    // a assinatura/organização da Gaby Salgado. Se não existir nenhuma "Gaby Salgado",
    // NÃO apague nada."
    // -------------------------------------------------------------

    // 1. Localizar a organização da Gaby Salgado
    let gabyOrg = null
    const candidateSlugs = ['gabysalgado', 'gaby-salgado', 'gabriela-salgado']
    for (const slug of candidateSlugs) {
      try {
        gabyOrg = app.findFirstRecordByData('organizations', 'slug', slug)
        if (gabyOrg) break
      } catch (_) {}
    }

    if (!gabyOrg) {
      try {
        const orgs = app.findRecordsByFilter(
          'organizations',
          'name ~ "Gaby" || name ~ "Salgado"',
          '-created',
          1,
          0,
        )
        if (orgs && orgs.length > 0) {
          gabyOrg = orgs[0]
        }
      } catch (_) {}
    }

    if (!gabyOrg) {
      console.log(
        '[migration 0029] ATENÇÃO: Nenhuma organização de "Gaby Salgado" encontrada! Abortando exclusão de dados.',
      )
      return
    }

    const gabyOrgId = gabyOrg.id
    console.log(
      `[migration 0029] Organização mantida: ${gabyOrg.getString('name')} (id=${gabyOrgId})`,
    )

    // 2. Identificar organizações a serem excluídas (todas menos a da Gaby Salgado)
    const orgsToDelete = app.findRecordsByFilter(
      'organizations',
      `id != "${gabyOrgId}"`,
      '-created',
      100,
      0,
    )

    console.log(`[migration 0029] Total de organizações a apagar: ${orgsToDelete.length}`)

    for (const org of orgsToDelete) {
      const orgId = org.id
      const orgName = org.getString('name')
      console.log(`[migration 0029] Apagando dados da organização ${orgName} (${orgId})...`)

      // A. Cobranças (contek_charges)
      app
        .db()
        .newQuery('DELETE FROM contek_charges WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // B. Assinaturas (subscriptions)
      app
        .db()
        .newQuery('DELETE FROM subscriptions WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // C. Pagamentos (payments)
      app
        .db()
        .newQuery('DELETE FROM payments WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // D. Notificações (notification_logs)
      app
        .db()
        .newQuery('DELETE FROM notification_logs WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // E. Agendamentos (appointments)
      app
        .db()
        .newQuery('DELETE FROM appointments WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // F. Clientes (clients)
      app
        .db()
        .newQuery('DELETE FROM clients WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // G. Professional services
      app
        .db()
        .newQuery(`
        DELETE FROM professional_services
        WHERE organization_id = {:orgId}
           OR professional_id IN (SELECT id FROM professionals WHERE organization_id = {:orgId})
           OR service_id IN (SELECT id FROM services WHERE organization_id = {:orgId})
      `)
        .bind({ orgId })
        .execute()

      // H. Serviços (services)
      app
        .db()
        .newQuery('DELETE FROM services WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // I. Profissionais (professionals)
      app
        .db()
        .newQuery('DELETE FROM professionals WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // J. Business settings (business_settings)
      app
        .db()
        .newQuery('DELETE FROM business_settings WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // K. Vínculos de usuários (organization_users)
      app
        .db()
        .newQuery('DELETE FROM organization_users WHERE organization_id = {:orgId}')
        .bind({ orgId })
        .execute()

      // L. Apagar a organização
      app.db().newQuery('DELETE FROM organizations WHERE id = {:orgId}').bind({ orgId }).execute()
    }

    // 3. Remover usuários órfãos das empresas apagadas (preservando SuperAdmin e WhatsApp Bot e usuária da Gaby Salgado)
    app
      .db()
      .newQuery(`
      DELETE FROM users 
      WHERE is_super_admin != 1 
        AND role != 'SUPERADMIN' 
        AND email != 'whatsapp-bot@contek.local'
        AND id NOT IN (SELECT user_id FROM organization_users WHERE organization_id = {:gabyOrgId})
        AND organization_id != {:gabyOrgId}
    `)
      .bind({ gabyOrgId })
      .execute()

    console.log('[migration 0029] Limpeza concluída com sucesso. Somente Gaby Salgado preservada.')
  },
  (app) => {
    // Reversão de limpeza de dados não aplicável
  },
)
