/// <reference path="../pb_data/types.d.ts" />

/**
 * Onboarding Hook - Contek Agenda IA
 *
 * Endpoints:
 * - POST /backend/v1/onboarding/self-service: Onboarding público para novos clientes self-service.
 * - POST /backend/v1/onboarding/manual: Onboarding administrativo para clientes fechados externamente pela Contek.
 */

routerAdd('POST', '/backend/v1/onboarding/self-service', (e) => {
  const body = e.requestInfo().body || {}
  const { org_name, name, phone = '', email, password } = body

  const cleanOrgName = typeof org_name === 'string' ? org_name.trim() : ''
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanPhone = typeof phone === 'string' ? phone.trim() : ''
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const cleanPassword = typeof password === 'string' ? password : ''

  // 1. Validações de campos obrigatórios
  if (!cleanOrgName) {
    return e.json(400, { error: 'O nome do estabelecimento ou empresa é obrigatório.' })
  }
  if (!cleanName) {
    return e.json(400, { error: 'Seu nome completo é obrigatório.' })
  }
  if (!cleanEmail) {
    return e.json(400, { error: 'O e-mail de acesso é obrigatório.' })
  }
  if (!cleanPassword || cleanPassword.length < 8) {
    return e.json(400, { error: 'A senha deve conter no mínimo 8 caracteres.' })
  }

  // 2. Verificar se o e-mail já existe em users
  try {
    const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', cleanEmail)
    if (existingUser) {
      return e.json(409, { error: 'Este e-mail já está cadastrado. Faça login.' })
    }
  } catch (_) {
    // Não encontrado, pode prosseguir
  }

  try {
    // 3. Gerar slug base a partir do nome da organização
    let baseSlug = cleanOrgName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')

    if (!baseSlug) {
      baseSlug = 'empresa'
    }

    // Garantir unicidade do slug
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
        // Slug livre
        break
      }
    }

    let createdOrg = null
    let createdUser = null

    // Executar atomicamente em transação
    const requestedProduct = body.product === 'markaly' ? 'markaly' : 'agyli'

    $app.runInTransaction((txApp) => {
      // 1. Criar Organização
      const orgsCol = txApp.findCollectionByNameOrId('organizations')
      const orgRecord = new Record(orgsCol)
      orgRecord.set('name', cleanOrgName)
      orgRecord.set('slug', finalSlug)
      orgRecord.set('phone', cleanPhone)
      orgRecord.set('whatsapp', cleanPhone)
      orgRecord.set('email', cleanEmail)
      orgRecord.set('status', 'trial')
      orgRecord.set('product', requestedProduct)
      orgRecord.set('plan_id', requestedProduct === 'markaly' ? 'markaly-start' : 'agyli-pro')
      txApp.save(orgRecord)
      createdOrg = orgRecord
      const orgId = orgRecord.id

      // 1.1 Criar Subscription inicial (trial de 7 dias)
      try {
        const plansCol = txApp.findCollectionByNameOrId('plans')
        let planRec = null
        try {
          planRec = txApp.findFirstRecordByData(
            'plans',
            'slug',
            requestedProduct === 'markaly' ? 'markaly-start' : 'agyli-pro',
          )
        } catch (_) {
          const defaultPlans = txApp.findRecordsByFilter(
            'plans',
            'product = "' + requestedProduct + '"',
            '-created',
            1,
            0,
          )
          if (defaultPlans && defaultPlans.length > 0) {
            planRec = defaultPlans[0]
          }
        }

        if (planRec) {
          const subsCol = txApp.findCollectionByNameOrId('subscriptions')
          const subRecord = new Record(subsCol)
          subRecord.set('organization_id', orgId)
          subRecord.set('plan_id', planRec.id)
          subRecord.set('status', 'trial')
          const now = new Date()
          const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          subRecord.set('starts_at', now.toISOString())
          subRecord.set('trial_ends_at', trialEnd.toISOString())
          subRecord.set(
            'notes',
            'Trial de 7 dias criado automaticamente via cadastro self-service.',
          )
          subRecord.set('history', [
            {
              date: now.toISOString(),
              action: 'TRIAL_STARTED',
              note: 'Início do período de teste gratuito de 7 dias',
            },
          ])
          txApp.save(subRecord)
        }
      } catch (subErr) {
        console.log('[onboarding/self-service] warning creating subscription:', subErr)
      }

      // 2. Criar Business Settings
      const settingsCol = txApp.findCollectionByNameOrId('business_settings')
      const settingsRecord = new Record(settingsCol)
      settingsRecord.set('organization_id', orgId)
      settingsRecord.set('business_name', cleanOrgName)
      settingsRecord.set('phone', cleanPhone)
      settingsRecord.set('whatsapp', cleanPhone)
      settingsRecord.set('opening_time', '08:00')
      settingsRecord.set('closing_time', '19:00')
      settingsRecord.set('working_days', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      settingsRecord.set('slot_interval_minutes', 30)
      settingsRecord.set('buffer_between_appointments', 10)
      settingsRecord.set(
        'default_booking_message',
        `Olá! Seu agendamento foi confirmado com sucesso na ${cleanOrgName}.`,
      )
      settingsRecord.set('whatsapp_enabled', true)
      txApp.save(settingsRecord)

      // 3. Criar Usuário Administrador
      const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
      const userRecord = new Record(usersCol)
      userRecord.setEmail(cleanEmail)
      userRecord.setPassword(cleanPassword)
      userRecord.setVerified(true)
      userRecord.set('name', cleanName)
      userRecord.set('phone', cleanPhone)
      userRecord.set('role', 'ADMINISTRADOR')
      userRecord.set('organization_id', orgId)
      txApp.save(userRecord)
      createdUser = userRecord

      // 4. Criar vínculo em organization_users
      const orgUsersCol = txApp.findCollectionByNameOrId('organization_users')
      const orgUserRecord = new Record(orgUsersCol)
      orgUserRecord.set('organization_id', orgId)
      orgUserRecord.set('user_id', userRecord.id)
      orgUserRecord.set('role', 'ADMINISTRADOR')
      txApp.save(orgUserRecord)

      // 5. Criar Profissional padrão
      const profCol = txApp.findCollectionByNameOrId('professionals')
      const profRecord = new Record(profCol)
      profRecord.set('organization_id', orgId)
      profRecord.set('user_id', userRecord.id)
      profRecord.set('name', cleanName)
      profRecord.set('specialty', 'Especialista')
      profRecord.set('phone', cleanPhone)
      profRecord.set('email', cleanEmail)
      profRecord.set('default_duration', 45)
      profRecord.set('work_days', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      profRecord.set('work_hours', { start: '08:00', end: '19:00' })
      profRecord.set('active', true)
      txApp.save(profRecord)

      // 6. Criar Serviço inicial
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

      // 7. Vincular Profissional ao Serviço
      const profServCol = txApp.findCollectionByNameOrId('professional_services')
      const profServRecord = new Record(profServCol)
      profServRecord.set('organization_id', orgId)
      profServRecord.set('professional_id', profRecord.id)
      profServRecord.set('service_id', servRecord.id)
      txApp.save(profServRecord)
    })

    return e.json(200, {
      success: true,
      message: 'Empresa cadastrada com sucesso!',
      organization: {
        id: createdOrg.id,
        name: createdOrg.getString('name'),
        slug: createdOrg.getString('slug'),
        status: createdOrg.getString('status'),
        plan_id: createdOrg.getString('plan_id'),
      },
      user: {
        id: createdUser.id,
        email: createdUser.getString('email'),
        name: createdUser.getString('name'),
        role: createdUser.getString('role'),
      },
    })
  } catch (err) {
    console.log('[onboarding/self-service] error:', err.message || err)
    return e.json(500, {
      error: err.message || 'Erro interno ao processar o cadastro da empresa.',
    })
  }
})

routerAdd('POST', '/backend/v1/onboarding/manual', (e) => {
  // Verificação de segurança via secret / env var X-Contek-Setup-Key
  const configuredKey = $os.getenv('CONTEK_SETUP_KEY') || ''
  const reqKey = e.requestInfo().headers['x-contek-setup-key'] || ''

  if (configuredKey) {
    if (reqKey !== configuredKey) {
      return e.json(401, {
        error: 'Não autorizado: Chave de configuração inválida (X-Contek-Setup-Key).',
      })
    }
  } else {
    console.log(
      '[onboarding/manual] AVISO: Variável CONTEK_SETUP_KEY não configurada no backend. Permitindo cadastro manual provisoriamente.',
    )
  }

  const body = e.requestInfo().body || {}
  const {
    org_name,
    slug = '',
    admin_name,
    admin_email,
    admin_password,
    plan = 'agyli-pro',
    product = 'agyli',
  } = body

  const cleanOrgName = typeof org_name === 'string' ? org_name.trim() : ''
  const customSlug = typeof slug === 'string' ? slug.trim() : ''
  const cleanAdminName = typeof admin_name === 'string' ? admin_name.trim() : ''
  const cleanAdminEmail = typeof admin_email === 'string' ? admin_email.trim().toLowerCase() : ''
  const cleanAdminPassword = typeof admin_password === 'string' ? admin_password : ''
  const cleanPlan = typeof plan === 'string' && plan.trim() ? plan.trim() : 'agyli-pro'
  const chosenProduct = product === 'markaly' ? 'markaly' : 'agyli'

  // Validações
  if (!cleanOrgName) {
    return e.json(400, { error: 'O nome da empresa é obrigatório.' })
  }
  if (!cleanAdminName) {
    return e.json(400, { error: 'O nome do administrador é obrigatório.' })
  }
  if (!cleanAdminEmail) {
    return e.json(400, { error: 'O e-mail do administrador é obrigatório.' })
  }
  if (!cleanAdminPassword || cleanAdminPassword.length < 8) {
    return e.json(400, { error: 'A senha provisória deve conter no mínimo 8 caracteres.' })
  }

  // Verificar se o e-mail já existe
  try {
    const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', cleanAdminEmail)
    if (existingUser) {
      return e.json(409, { error: 'Este e-mail de administrador já está cadastrado.' })
    }
  } catch (_) {}

  try {
    // Gerar slug
    let baseSlug =
      customSlug ||
      cleanOrgName
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

    let createdOrg = null
    let createdUser = null

    $app.runInTransaction((txApp) => {
      // 1. Criar Organização
      const orgsCol = txApp.findCollectionByNameOrId('organizations')
      const orgRecord = new Record(orgsCol)
      orgRecord.set('name', cleanOrgName)
      orgRecord.set('slug', finalSlug)
      orgRecord.set('email', cleanAdminEmail)
      orgRecord.set('status', 'active')
      orgRecord.set('product', chosenProduct)
      orgRecord.set('plan_id', cleanPlan)
      txApp.save(orgRecord)
      createdOrg = orgRecord
      const orgId = orgRecord.id

      // 1.1 Criar Subscription ativa
      try {
        let planRec = null
        try {
          planRec = txApp.findFirstRecordByData('plans', 'slug', cleanPlan)
        } catch (_) {
          const matchingPlans = txApp.findRecordsByFilter(
            'plans',
            'product = "' + chosenProduct + '"',
            '-created',
            1,
            0,
          )
          if (matchingPlans && matchingPlans.length > 0) {
            planRec = matchingPlans[0]
          }
        }

        if (planRec) {
          const subsCol = txApp.findCollectionByNameOrId('subscriptions')
          const subRecord = new Record(subsCol)
          subRecord.set('organization_id', orgId)
          subRecord.set('plan_id', planRec.id)
          subRecord.set('status', 'active')
          const now = new Date()
          subRecord.set('starts_at', now.toISOString())
          subRecord.set('notes', 'Assinatura ativa criada via cadastro administrativo Contek.')
          subRecord.set('history', [
            {
              date: now.toISOString(),
              action: 'MANUAL_ACTIVATION',
              note: 'Ativação direta Contek Admin',
            },
          ])
          txApp.save(subRecord)
        }
      } catch (subErr) {
        console.log('[onboarding/manual] warning creating subscription:', subErr)
      }

      // 2. Criar Business Settings
      const settingsCol = txApp.findCollectionByNameOrId('business_settings')
      const settingsRecord = new Record(settingsCol)
      settingsRecord.set('organization_id', orgId)
      settingsRecord.set('business_name', cleanOrgName)
      settingsRecord.set('opening_time', '08:00')
      settingsRecord.set('closing_time', '19:00')
      settingsRecord.set('working_days', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      settingsRecord.set('slot_interval_minutes', 30)
      settingsRecord.set('buffer_between_appointments', 10)
      settingsRecord.set(
        'default_booking_message',
        `Olá! Seu agendamento foi confirmado na ${cleanOrgName}.`,
      )
      settingsRecord.set('whatsapp_enabled', true)
      txApp.save(settingsRecord)

      // 3. Criar Usuário Admin
      const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
      const userRecord = new Record(usersCol)
      userRecord.setEmail(cleanAdminEmail)
      userRecord.setPassword(cleanAdminPassword)
      userRecord.setVerified(true)
      userRecord.set('name', cleanAdminName)
      userRecord.set('role', 'ADMINISTRADOR')
      userRecord.set('organization_id', orgId)
      txApp.save(userRecord)
      createdUser = userRecord

      // 4. Criar vínculo em organization_users
      const orgUsersCol = txApp.findCollectionByNameOrId('organization_users')
      const orgUserRecord = new Record(orgUsersCol)
      orgUserRecord.set('organization_id', orgId)
      orgUserRecord.set('user_id', userRecord.id)
      orgUserRecord.set('role', 'ADMINISTRADOR')
      txApp.save(orgUserRecord)
    })

    return e.json(200, {
      success: true,
      message: `Empresa ${cleanOrgName} cadastrada pela Contek com sucesso!`,
      organization: {
        id: createdOrg.id,
        name: createdOrg.getString('name'),
        slug: createdOrg.getString('slug'),
        status: createdOrg.getString('status'),
        plan_id: createdOrg.getString('plan_id'),
      },
      user: {
        id: createdUser.id,
        email: createdUser.getString('email'),
        name: createdUser.getString('name'),
        role: createdUser.getString('role'),
      },
    })
  } catch (err) {
    console.log('[onboarding/manual] error:', err.message || err)
    return e.json(500, {
      error: err.message || 'Erro interno ao processar o cadastro manual.',
    })
  }
})
