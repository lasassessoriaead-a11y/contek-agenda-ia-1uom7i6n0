/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoint para consulta detalhada das feature flags e produto da organização logada.
 * GET /backend/v1/organization-features
 */

routerAdd(
  'GET',
  '/backend/v1/organization-features',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')

      let orgId = user.getString('organization_id')
      if (!orgId) {
        try {
          const orgUser = $app.findFirstRecordByData('organization_users', 'user_id', user.id)
          if (orgUser) orgId = orgUser.getString('organization_id')
        } catch (_) {}
      }

      if (!orgId) {
        return e.badRequestError('Nenhuma organização vinculada a este usuário.')
      }

      const org = $app.findRecordById('organizations', orgId)
      const product = org.getString('product') || 'agyli'

      // Buscar features do produto
      let features = []
      let productName = product === 'markaly' ? 'MARKALY' : 'AGYLI'
      let productDescription = ''

      try {
        const pf = $app.findFirstRecordByData('product_features', 'product', product)
        features = pf.get('features') || []
        productName = pf.getString('name') || productName
        productDescription = pf.getString('description') || ''
      } catch (_) {
        if (product === 'agyli') {
          features = [
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
          ]
        } else {
          features = [
            'dashboard',
            'agenda',
            'clientes',
            'servicos',
            'profissionais',
            'configuracoes_basicas',
            'whatsapp_notificacoes',
          ]
        }
      }

      // Buscar dados de assinatura
      let subscription = null
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + orgId + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const s = subs[0]
          let planName = ''
          try {
            const plan = $app.findRecordById('plans', s.getString('plan_id'))
            planName = plan.getString('name')
          } catch (_) {}

          subscription = {
            id: s.id,
            status: s.getString('status'),
            plan_id: s.getString('plan_id'),
            plan_name: planName,
            starts_at: s.getString('starts_at'),
            trial_ends_at: s.getString('trial_ends_at'),
            current_period_ends_at: s.getString('current_period_ends_at'),
            notes: s.getString('notes'),
          }
        }
      } catch (_) {}

      // Mapeamento booleano rápido para o frontend
      const featureMap = {}
      for (const feat of features) {
        featureMap[feat] = true
      }

      return e.json(200, {
        organization_id: org.id,
        organization_name: org.getString('name'),
        slug: org.getString('slug'),
        product: product,
        product_name: productName,
        product_description: productDescription,
        features: features,
        feature_map: featureMap,
        subscription: subscription,
        is_super_admin: user.getBool('is_super_admin'),
      })
    } catch (err) {
      console.log('[organization-features] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao carregar permissões do produto.' })
    }
  },
  $apis.requireAuth(),
)
