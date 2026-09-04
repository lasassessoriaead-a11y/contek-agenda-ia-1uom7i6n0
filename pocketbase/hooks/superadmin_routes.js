/// <reference path="../pb_data/types.d.ts" />

/**
 * SuperAdmin API endpoints - Gestão Central Contek Multi-Produto
 * Exclusivo para usuários com is_super_admin = true.
 *
 * GET  /backend/v1/superadmin/overview -> Estatísticas globais e lista de organizações com métricas
 * POST /backend/v1/superadmin/org/update -> Atualizar produto, plano, status da org ou assinatura
 * POST /backend/v1/superadmin/org/create -> Criar manualmente uma organização completa com tenant isolado
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

      // Subscriptions
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

      // Se passou plan_id, também manter org.plan_id alinhado
      if (plan_id) {
        try {
          const planRecord = $app.findRecordById('plans', plan_id)
          if (planRecord) {
            org.set('plan_id', planRecord.getString('slug') || plan_id)
          }
        } catch (_) {
          org.set('plan_id', plan_id)
        }
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

      // Adicionar entrada no histórico de forma segura para campo JSON do PocketBase
      let historyList = []
      try {
        const rawHistory = subRecord.get('history')
        if (Array.isArray(rawHistory)) {
          historyList = rawHistory.slice()
        } else if (typeof rawHistory === 'string' && rawHistory.trim()) {
          historyList = JSON.parse(rawHistory)
        }
      } catch (_) {
        historyList = []
      }

      historyList.push({
        date: new Date().toISOString(),
        action: 'SUPERADMIN_UPDATE',
        changed_by: user.getString('email'),
        changes: { product, status, plan_id, subscription_status },
      })
      subRecord.set('history', JSON.stringify(historyList))

      $app.save(subRecord)

      return e.json(200, {
        success: true,
        message: 'Organização e assinatura atualizadas com sucesso!',
        organization: {
          id: org.id,
          name: org.getString('name'),
          product: org.getString('product'),
          status: org.getString('status'),
          plan_id: org.getString('plan_id'),
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

routerAdd(
  'POST',
  '/backend/v1/superadmin/org/create',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const {
        name,
        slug = '',
        admin_name,
        admin_email,
        admin_password,
        product = 'agyli',
        plan_id = '',
      } = body

      const cleanOrgName = typeof name === 'string' ? name.trim() : ''
      const customSlug = typeof slug === 'string' ? slug.trim() : ''
      const cleanAdminName = typeof admin_name === 'string' ? admin_name.trim() : ''
      const cleanAdminEmail =
        typeof admin_email === 'string' ? admin_email.trim().toLowerCase() : ''
      const cleanAdminPassword = typeof admin_password === 'string' ? admin_password : ''
      const chosenProduct = product === 'markaly' ? 'markaly' : 'agyli'

      // 1. Validações
      if (!cleanOrgName) {
        return e.badRequestError('O nome da empresa é obrigatório.')
      }
      if (!cleanAdminEmail) {
        return e.badRequestError('O e-mail do usuário administrador é obrigatório.')
      }
      if (!cleanAdminPassword || cleanAdminPassword.length < 8) {
        return e.badRequestError('A senha inicial deve conter no mínimo 8 caracteres.')
      }

      const finalAdminName = cleanAdminName || `Gestor ${cleanOrgName}`

      // 2. Verificar se o e-mail já existe
      try {
        const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', cleanAdminEmail)
        if (existingUser) {
          return e.json(409, {
            error: 'Este e-mail de administrador já está cadastrado no sistema.',
          })
        }
      } catch (_) {}

      // 3. Gerar / validar slug (slug opcional: quando vazio ou ausente, gera automaticamente a partir do nome)
      let baseSlug = customSlug
        ? customSlug
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')
        : cleanOrgName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '')

      if (!baseSlug) {
        baseSlug = 'empresa'
      }

      let finalSlug = baseSlug
      let suffix = 1
      while (true) {
        try {
          const found = $app.findFirstRecordByData('organizations', 'slug', finalSlug)
          if (found) {
            suffix++
            finalSlug = `${baseSlug}-${suffix}`
          } else {
            break
          }
        } catch (_) {
          break
        }
      }

      // 4. Resolver o plano correto
      let resolvedPlanRecord = null
      if (plan_id) {
        try {
          resolvedPlanRecord = $app.findRecordById('plans', plan_id)
        } catch (_) {}
      }

      if (!resolvedPlanRecord) {
        const defaultSlug = chosenProduct === 'markaly' ? 'markaly-start' : 'agyli-pro'
        try {
          resolvedPlanRecord = $app.findFirstRecordByData('plans', 'slug', defaultSlug)
        } catch (_) {
          const matchPlans = $app.findRecordsByFilter(
            'plans',
            'product = "' + chosenProduct + '"',
            '-created',
            1,
            0,
          )
          if (matchPlans && matchPlans.length > 0) {
            resolvedPlanRecord = matchPlans[0]
          }
        }
      }

      const planSlugToSave = resolvedPlanRecord
        ? resolvedPlanRecord.getString('slug')
        : chosenProduct === 'markaly'
          ? 'markaly-start'
          : 'agyli-pro'

      let createdOrg = null
      let createdUser = null

      $app.runInTransaction((txApp) => {
        // 4.1 Criar Organização
        const orgsCol = txApp.findCollectionByNameOrId('organizations')
        const orgRecord = new Record(orgsCol)
        orgRecord.set('name', cleanOrgName)
        orgRecord.set('slug', finalSlug)
        orgRecord.set('email', cleanAdminEmail)
        orgRecord.set('status', 'active')
        orgRecord.set('product', chosenProduct)
        orgRecord.set('plan_id', planSlugToSave)
        txApp.save(orgRecord)
        createdOrg = orgRecord
        const orgId = orgRecord.id

        // 4.2 Criar Subscription ativa vinculada ao plano
        if (resolvedPlanRecord) {
          const subsCol = txApp.findCollectionByNameOrId('subscriptions')
          const subRecord = new Record(subsCol)
          subRecord.set('organization_id', orgId)
          subRecord.set('plan_id', resolvedPlanRecord.id)
          subRecord.set('status', 'active')
          const now = new Date()
          subRecord.set('starts_at', now.toISOString())
          subRecord.set('notes', 'Empresa criada manualmente pelo SuperAdmin Contek.')
          subRecord.set(
            'history',
            JSON.stringify([
              {
                date: now.toISOString(),
                action: 'SUPERADMIN_CREATE',
                created_by: user.getString('email'),
                note: 'Criação manual da organização via Painel SuperAdmin',
              },
            ]),
          )
          txApp.save(subRecord)
        }

        // 4.3 Criar Business Settings com dados padrão
        const settingsCol = txApp.findCollectionByNameOrId('business_settings')
        const settingsRecord = new Record(settingsCol)
        settingsRecord.set('organization_id', orgId)
        settingsRecord.set('business_name', cleanOrgName)
        settingsRecord.set('opening_time', '08:00')
        settingsRecord.set('closing_time', '19:00')
        settingsRecord.set(
          'working_days',
          JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']),
        )
        settingsRecord.set('slot_interval_minutes', 30)
        settingsRecord.set('buffer_between_appointments', 10)
        settingsRecord.set(
          'default_booking_message',
          `Olá! Seu agendamento foi confirmado com sucesso na ${cleanOrgName}.`,
        )
        settingsRecord.set('whatsapp_enabled', true)
        txApp.save(settingsRecord)

        // 4.4 Criar Usuário Administrador
        const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
        const userRecord = new Record(usersCol)
        userRecord.setEmail(cleanAdminEmail)
        userRecord.setPassword(cleanAdminPassword)
        userRecord.setVerified(true)
        userRecord.set('name', finalAdminName)
        userRecord.set('role', 'ADMINISTRADOR')
        userRecord.set('organization_id', orgId)
        userRecord.set('is_super_admin', false)
        txApp.save(userRecord)
        createdUser = userRecord

        // 4.5 Vincular em organization_users
        const orgUsersCol = txApp.findCollectionByNameOrId('organization_users')
        const orgUserRecord = new Record(orgUsersCol)
        orgUserRecord.set('organization_id', orgId)
        orgUserRecord.set('user_id', userRecord.id)
        orgUserRecord.set('role', 'ADMINISTRADOR')
        txApp.save(orgUserRecord)

        // 4.5.1 Garantir que o superadmin atual também tenha vínculo em organization_users
        // para compatibilidade absoluta com qualquer regra baseada em organization_users
        try {
          const superAdminOrgUser = new Record(orgUsersCol)
          superAdminOrgUser.set('organization_id', orgId)
          superAdminOrgUser.set('user_id', user.id)
          superAdminOrgUser.set('role', 'ADMINISTRADOR')
          txApp.save(superAdminOrgUser)
        } catch (_) {}

        // 4.6 Criar Profissional Padrão
        const profCol = txApp.findCollectionByNameOrId('professionals')
        const profRecord = new Record(profCol)
        profRecord.set('organization_id', orgId)
        profRecord.set('user_id', userRecord.id)
        profRecord.set('name', finalAdminName)
        profRecord.set('specialty', 'Especialista')
        profRecord.set('email', cleanAdminEmail)
        profRecord.set('default_duration', 45)
        profRecord.set('work_days', JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']))
        profRecord.set('work_hours', JSON.stringify({ start: '08:00', end: '19:00' }))
        profRecord.set('active', true)
        txApp.save(profRecord)

        // 4.7 Criar Serviço Inicial Padrão
        const servCol = txApp.findCollectionByNameOrId('services')
        const servRecord = new Record(servCol)
        servRecord.set('organization_id', orgId)
        servRecord.set('name', 'Atendimento Inicial / Consulta')
        servRecord.set('description', 'Serviço padrão configurado automaticamente')
        servRecord.set('duration', 45)
        servRecord.set('price', 150)
        servRecord.set('color', '#10b981')
        servRecord.set('category', 'Geral')
        servRecord.set('active', true)
        txApp.save(servRecord)

        // 4.8 Vincular Profissional ao Serviço
        const profServCol = txApp.findCollectionByNameOrId('professional_services')
        const profServRecord = new Record(profServCol)
        profServRecord.set('organization_id', orgId)
        profServRecord.set('professional_id', profRecord.id)
        profServRecord.set('service_id', servRecord.id)
        txApp.save(profServRecord)
      })

      return e.json(200, {
        success: true,
        message: `Empresa "${cleanOrgName}" cadastrada com sucesso pelo SuperAdmin!`,
        organization: {
          id: createdOrg.id,
          name: createdOrg.getString('name'),
          slug: createdOrg.getString('slug'),
          product: createdOrg.getString('product'),
          status: createdOrg.getString('status'),
          plan_id: createdOrg.getString('plan_id'),
        },
        user: {
          id: createdUser.id,
          name: createdUser.getString('name'),
          email: createdUser.getString('email'),
        },
        created_credentials: {
          name: cleanOrgName,
          slug: finalSlug,
          admin_name: finalAdminName,
          admin_email: cleanAdminEmail,
          admin_password: cleanAdminPassword,
          login_url: '/login',
          public_url: `/agendar/${finalSlug}`,
        },
      })
    } catch (err) {
      console.log('[superadmin/org/create] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao criar organização pelo SuperAdmin.' })
    }
  },
  $apis.requireAuth(),
)
