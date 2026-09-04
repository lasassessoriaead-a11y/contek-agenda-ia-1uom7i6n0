/// <reference path="../pb_data/types.d.ts" />

/**
 * SuperAdmin API endpoints - Gestão Central Contek Multi-Produto
 * Exclusivo para usuários com is_super_admin = true.
 *
 * GET  /backend/v1/superadmin/overview -> Estatísticas globais e lista de organizações com métricas
 * POST /backend/v1/superadmin/org/update -> Atualizar produto, plano, status da org ou assinatura
 */

routerAdd(
  'GET',
  '/backend/v1/superadmin/overview',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      // Buscar todas as organizações
      const orgs = $app.findRecordsByFilter('organizations', '1=1', '-created', 500, 0)
      const plans = $app.findRecordsByFilter('plans', '1=1', 'name', 100, 0)
      const plansMap = {}
      for (const p of plans) {
        plansMap[p.id] = {
          id: p.id,
          name: p.getString('name'),
          slug: p.getString('slug'),
          product: p.getString('product'),
          price: p.getInt('price_monthly'),
        }
      }

      // Subscriptions ativas
      const subs = $app.findRecordsByFilter('subscriptions', '1=1', '-created', 500, 0)
      const subMapByOrg = {}
      for (const s of subs) {
        if (!subMapByOrg[s.getString('organization_id')]) {
          subMapByOrg[s.getString('organization_id')] = s
        }
      }

      let totalAgyli = 0
      let totalMarkaly = 0
      let totalActive = 0
      let totalTrial = 0
      let totalSuspended = 0

      const orgList = []

      for (const org of orgs) {
        const orgId = org.id
        const product = org.getString('product') || 'agyli'
        const status = org.getString('status') || 'active'

        if (product === 'agyli') totalAgyli++
        else if (product === 'markaly') totalMarkaly++

        if (status === 'active') totalActive++
        else if (status === 'trial') totalTrial++
        else if (status === 'suspended') totalSuspended++

        // Contagens rápidas por tenant
        let clientsCount = 0
        let apptsCount = 0
        let profsCount = 0
        let usersCount = 0

        try {
          clientsCount = $app.countRecords('clients', 'organization_id = "' + orgId + '"')
        } catch (_) {}
        try {
          apptsCount = $app.countRecords('appointments', 'organization_id = "' + orgId + '"')
        } catch (_) {}
        try {
          profsCount = $app.countRecords('professionals', 'organization_id = "' + orgId + '"')
        } catch (_) {}
        try {
          usersCount = $app.countRecords('organization_users', 'organization_id = "' + orgId + '"')
        } catch (_) {}

        const currentSub = subMapByOrg[orgId]
        let planInfo = null
        if (currentSub) {
          const pId = currentSub.getString('plan_id')
          if (plansMap[pId]) planInfo = plansMap[pId]
        }

        orgList.push({
          id: orgId,
          name: org.getString('name'),
          slug: org.getString('slug'),
          email: org.getString('email'),
          phone: org.getString('phone'),
          product: product,
          status: status,
          created: org.getString('created'),
          updated: org.getString('updated'),
          counts: {
            clients: clientsCount,
            appointments: apptsCount,
            professionals: profsCount,
            users: usersCount,
          },
          subscription: currentSub
            ? {
                id: currentSub.id,
                status: currentSub.getString('status'),
                plan_id: currentSub.getString('plan_id'),
                plan_name: planInfo ? planInfo.name : 'Plano Padrão',
                starts_at: currentSub.getString('starts_at'),
                trial_ends_at: currentSub.getString('trial_ends_at'),
                notes: currentSub.getString('notes'),
              }
            : null,
        })
      }

      return e.json(200, {
        summary: {
          total_organizations: orgs.length,
          total_agyli: totalAgyli,
          total_markaly: totalMarkaly,
          status_breakdown: {
            active: totalActive,
            trial: totalTrial,
            suspended: totalSuspended,
          },
        },
        plans: plans.map((p) => ({
          id: p.id,
          name: p.getString('name'),
          slug: p.getString('slug'),
          product: p.getString('product'),
          price: p.getInt('price_monthly'),
          trial_days: p.getInt('trial_days'),
          max_professionals: p.getInt('max_professionals'),
        })),
        organizations: orgList,
      })
    } catch (err) {
      console.log('[superadmin/overview] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao carregar dados do SuperAdmin.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/org/update',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { organization_id, product, status, plan_id, subscription_status, notes } = body

      if (!organization_id) {
        return e.badRequestError('ID da organização é obrigatório.')
      }

      const org = $app.findRecordById('organizations', organization_id)

      if (product && (product === 'agyli' || product === 'markaly')) {
        org.set('product', product)
      }
      if (status && ['active', 'trial', 'suspended'].indexOf(status) !== -1) {
        org.set('status', status)
      }
      $app.save(org)

      // Atualizar ou criar subscription
      let subRecord = null
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + organization_id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          subRecord = subs[0]
        }
      } catch (_) {}

      if (!subRecord) {
        const subsCol = $app.findCollectionByNameOrId('subscriptions')
        subRecord = new Record(subsCol)
        subRecord.set('organization_id', organization_id)
        subRecord.set('starts_at', new Date().toISOString())
      }

      if (plan_id) {
        subRecord.set('plan_id', plan_id)
      }
      if (
        subscription_status &&
        ['trial', 'active', 'overdue', 'canceled'].indexOf(subscription_status) !== -1
      ) {
        subRecord.set('status', subscription_status)
      }
      if (notes !== undefined) {
        subRecord.set('notes', notes)
      }

      // Adicionar entrada no histórico
      const currentHistory = subRecord.get('history') || []
      const historyList = Array.isArray(currentHistory) ? currentHistory : []
      historyList.push({
        date: new Date().toISOString(),
        action: 'SUPERADMIN_UPDATE',
        changed_by: user.getString('email'),
        changes: { product, status, plan_id, subscription_status },
      })
      subRecord.set('history', historyList)

      $app.save(subRecord)

      return e.json(200, {
        success: true,
        message: 'Organização e assinatura atualizadas com sucesso!',
        organization: {
          id: org.id,
          name: org.getString('name'),
          product: org.getString('product'),
          status: org.getString('status'),
        },
        subscription: {
          id: subRecord.id,
          status: subRecord.getString('status'),
          plan_id: subRecord.getString('plan_id'),
        },
      })
    } catch (err) {
      console.log('[superadmin/org/update] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao atualizar organização.' })
    }
  },
  $apis.requireAuth(),
)
