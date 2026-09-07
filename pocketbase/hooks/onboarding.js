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
  const {
    org_name,
    slug = '',
    name,
    phone = '',
    email,
    password,
    product = 'agyli',
    plan_slug = '',
    create_example_service = true,
  } = body

  const cleanOrgName = typeof org_name === 'string' ? org_name.trim() : ''
  const customSlug = typeof slug === 'string' ? slug.trim() : ''
  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanPhone = typeof phone === 'string' ? phone.trim() : ''
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const cleanPassword = typeof password === 'string' ? password : ''
  const requestedProduct = product === 'markaly' ? 'markaly' : 'agyli'

  // 1. Validações de campos obrigatórios
  if (!cleanName) {
    return e.json(400, { error: 'Seu nome completo é obrigatório.' })
  }
  if (!cleanEmail) {
    return e.json(400, { error: 'O e-mail de acesso é obrigatório.' })
  }
  // Validação simples de formato de e-mail
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return e.json(400, { error: 'Informe um endereço de e-mail válido.' })
  }
  if (!cleanPassword || cleanPassword.length < 8) {
    return e.json(400, { error: 'A senha deve conter no mínimo 8 caracteres.' })
  }
  if (!cleanOrgName) {
    return e.json(400, { error: 'O nome da empresa é obrigatório.' })
  }

  // 2. Verificar se o e-mail já existe em users
  try {
    const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', cleanEmail)
    if (existingUser) {
      return e.json(409, {
        error:
          'Este endereço de e-mail já está cadastrado no sistema. Por favor, faça login ou recupere sua senha.',
      })
    }
  } catch (_) {
    // Não encontrado, pode prosseguir
  }

  try {
    // 3. Gerar slug base a partir do slug customizado ou do nome da organização
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

    // Garantir unicidade do slug (se já existir, sugerir/gerar variação automaticamente com sufixo numérico)
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

    // 4. Resolver o plano correto
    // Se passou plan_slug (ex: 'agyli-essencial', 'agyli-pro' ou 'markaly-start'), buscar por slug primeiro
    let resolvedPlanRecord = null
    const targetPlanSlug =
      typeof plan_slug === 'string' && plan_slug.trim()
        ? plan_slug.trim()
        : requestedProduct === 'markaly'
          ? 'markaly-start'
          : 'agyli-pro'

    try {
      resolvedPlanRecord = txApp.findFirstRecordByData('plans', 'slug', targetPlanSlug)
    } catch (_) {}

    if (!resolvedPlanRecord) {
      try {
        resolvedPlanRecord = txApp.findFirstRecordByData('plans', 'slug', 'agyli-pro')
      } catch (_) {}
    }

    if (!resolvedPlanRecord) {
      try {
        resolvedPlanRecord = txApp.findFirstRecordByData('plans', 'product', requestedProduct)
      } catch (_) {}
    }

    const planIdForSub = resolvedPlanRecord ? resolvedPlanRecord.id : null
    const planSlugForOrg = resolvedPlanRecord
      ? resolvedPlanRecord.getString('slug')
      : targetPlanSlug

    const planDisplayName = resolvedPlanRecord
      ? resolvedPlanRecord.getString('name')
      : targetPlanSlug === 'agyli-essencial'
        ? 'AGYLI Essencial'
        : requestedProduct === 'markaly'
          ? 'MARKALY Essencial'
          : 'AGYLI Pro'
    let createdOrg = null
    let createdUser = null
    let createdSub = null

    // Executar atomicamente em transação
    $app.runInTransaction((txApp) => {
      // 4.1 Criar Organização com status trial de 7 dias
      const orgsCol = txApp.findCollectionByNameOrId('organizations')
      const orgRecord = new Record(orgsCol)
      orgRecord.set('name', cleanOrgName)
      orgRecord.set('slug', finalSlug)
      orgRecord.set('phone', cleanPhone)
      orgRecord.set('whatsapp', cleanPhone)
      orgRecord.set('email', cleanEmail)
      orgRecord.set('status', 'trial')
      orgRecord.set('product', requestedProduct)
      orgRecord.set('plan_id', planSlugToSave)
      txApp.save(orgRecord)
      createdOrg = orgRecord
      const orgId = orgRecord.id

      // 4.2 Criar Subscription inicial (trial de 7 dias)
      if (resolvedPlanRecord) {
        const subsCol = txApp.findCollectionByNameOrId('subscriptions')
        const subRecord = new Record(subsCol)
        subRecord.set('organization_id', orgId)
        subRecord.set('plan_id', resolvedPlanRecord.id)
        subRecord.set('status', 'trial')
        const now = new Date()
        const trialDays = resolvedPlanRecord.getInt('trial_days') || 7
        const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
        subRecord.set('starts_at', now.toISOString())
        subRecord.set('trial_ends_at', trialEnd.toISOString())
        subRecord.set(
          'notes',
          `Trial de ${trialDays} dias criado automaticamente via cadastro self-service.`,
        )
        subRecord.set(
          'history',
          JSON.stringify([
            {
              date: now.toISOString(),
              action: 'TRIAL_STARTED',
              note: `Início do período de teste gratuito de ${trialDays} dias`,
              plan: planSlugToSave,
            },
          ]),
        )
        txApp.save(subRecord)
        createdSub = subRecord
      }

      // 4.3 Criar Business Settings
      const settingsCol = txApp.findCollectionByNameOrId('business_settings')
      const settingsRecord = new Record(settingsCol)
      settingsRecord.set('organization_id', orgId)
      settingsRecord.set('business_name', cleanOrgName)
      settingsRecord.set('phone', cleanPhone)
      settingsRecord.set('whatsapp', cleanPhone)
      settingsRecord.set('opening_time', '08:00')
      settingsRecord.set('closing_time', '19:00')
      settingsRecord.set('working_days', JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']))
      settingsRecord.set('slot_interval_minutes', 30)
      settingsRecord.set('buffer_between_appointments', 10)
      settingsRecord.set(
        'default_booking_message',
        `Olá! Seu agendamento foi confirmado com sucesso na ${cleanOrgName}.`,
      )
      settingsRecord.set('whatsapp_enabled', true)
      txApp.save(settingsRecord)

      // 4.4 Criar Usuário (role ADMINISTRADOR / owner)
      const usersCol = txApp.findCollectionByNameOrId('_pb_users_auth_')
      const userRecord = new Record(usersCol)
      userRecord.setEmail(cleanEmail)
      userRecord.setPassword(cleanPassword)
      userRecord.setVerified(true)
      userRecord.set('name', cleanName)
      userRecord.set('phone', cleanPhone)
      userRecord.set('role', 'ADMINISTRADOR')
      userRecord.set('organization_id', orgId)
      userRecord.set('is_super_admin', false)
      txApp.save(userRecord)
      createdUser = userRecord

      // 4.5 Criar vínculo em organization_users
      const orgUsersCol = txApp.findCollectionByNameOrId('organization_users')
      const orgUserRecord = new Record(orgUsersCol)
      orgUserRecord.set('organization_id', orgId)
      orgUserRecord.set('user_id', userRecord.id)
      orgUserRecord.set('role', 'ADMINISTRADOR')
      txApp.save(orgUserRecord)

      // 4.6 Criar Profissional padrão exclusivo da nova organização
      // O nome do profissional é SEMPRE o nome da pessoa informada no cadastro (cleanName)
      const profCol = txApp.findCollectionByNameOrId('professionals')
      const profRecord = new Record(profCol)
      profRecord.set('organization_id', orgId)
      profRecord.set('user_id', userRecord.id)
      profRecord.set('name', cleanName)
      profRecord.set('specialty', 'Especialista')
      profRecord.set('phone', cleanPhone)
      profRecord.set('email', cleanEmail)
      profRecord.set('default_duration', 45)
      profRecord.set('work_days', JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']))
      profRecord.set('work_hours', JSON.stringify({ start: '08:00', end: '19:00' }))
      profRecord.set('active', true)
      txApp.save(profRecord)

      // 4.7 Criar Serviço inicial exclusivo da nova organização (opcional, padrão true)
      const shouldCreateExampleService =
        create_example_service !== false && create_example_service !== 'false'
      if (shouldCreateExampleService) {
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

        // 4.8 Vincular Profissional ao Serviço dentro da nova organização
        const profServCol = txApp.findCollectionByNameOrId('professional_services')
        const profServRecord = new Record(profServCol)
        profServRecord.set('organization_id', orgId)
        profServRecord.set('professional_id', profRecord.id)
        profServRecord.set('service_id', servRecord.id)
        txApp.save(profServRecord)
      }
    })

    // 5. Enviar e-mail de BOAS-VINDAS (sem senha/credenciais, pois a própria pessoa definiu a senha)
    // Contém: nome dela, nome da empresa, plano contratado, link de agendamento público e botão para entrar no painel
    let emailSent = false
    let emailError = ''

    try {
      const publicBaseUrl =
        $os.getenv('SITE_URL') ||
        ($app.settings() && $app.settings().meta && $app.settings().meta.appURL) ||
        'https://contek-agenda-ia-479d4.goskip.app'

      const loginUrl =
        publicBaseUrl +
        '/login?org=' +
        encodeURIComponent(finalSlug) +
        '&brand=' +
        encodeURIComponent(requestedProduct) +
        '&email=' +
        encodeURIComponent(cleanEmail)

      const publicBookingUrl = publicBaseUrl + '/agendar/' + finalSlug
      const prodDisplayName = requestedProduct === 'markaly' ? 'MARKALY' : 'AGYLI'

      const senderName =
        ($app.settings() && $app.settings().meta && $app.settings().meta.senderName) ||
        'Grupo CONTEK — Gestão & Tecnologia'
      const senderAddress =
        ($app.settings() && $app.settings().meta && $app.settings().meta.senderAddress) ||
        'suporte@contek.com.br'

      const isMarkaly = requestedProduct === 'markaly'
      const primaryGradient = isMarkaly
        ? 'linear-gradient(135deg, #1E0338 0%, #7C3AED 50%, #F97316 100%)'
        : 'linear-gradient(135deg, #0D1B2A 0%, #1E3A8A 50%, #06B6D4 100%)'
      const accentColor = isMarkaly ? '#F97316' : '#06B6D4'
      const buttonGradient = isMarkaly
        ? 'linear-gradient(135deg, #F97316 0%, #EC4899 50%, #7C3AED 100%)'
        : 'linear-gradient(135deg, #1E3A8A 0%, #06B6D4 100%)'

      const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo(a) ao ${prodDisplayName}!</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0D1B2A; color: #F8FAFC;">
  <div style="max-width: 580px; margin: 0 auto; background: #1E293B; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    
    <!-- Top Header -->
    <div style="background: ${primaryGradient}; padding: 32px 28px; text-align: center; border-bottom: 2px solid #22C55E;">
      <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #67E8F9; margin-bottom: 12px;">
        Uma Solução Grupo CONTEK
      </div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
        Bem-vindo(a) ao ${prodDisplayName}!
      </h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #E2E8F0; font-weight: 400;">
        Plataforma Inteligente de Gestão &amp; Agendamento • Grupo CONTEK
      </p>
    </div>

    <!-- Content Body -->
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #F1F5F9; margin: 0 0 16px 0;">
        Olá, <strong>${cleanName}</strong>!
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 24px 0;">
        Sua conta e a empresa <strong>${cleanOrgName}</strong> foram criadas com sucesso no sistema <strong>${prodDisplayName}</strong>! Seu período de <strong>teste gratuito de 7 dias</strong> já está ativo no plano <strong>${planDisplayName}</strong>.
      </p>

      <!-- Resumo do Cadastro Card -->
      <div style="background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${accentColor}; margin-bottom: 14px;">
          📋 Dados da Sua Conta
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #94A3B8; width: 35%;">Responsável:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              ${cleanName}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Empresa:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              ${cleanOrgName}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Plano Escolhido:</td>
            <td style="padding: 6px 0; color: #38BDF8; font-weight: 600;">
              ${planDisplayName} (7 dias grátis)
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">E-mail de Login:</td>
            <td style="padding: 6px 0; color: #22C55E; font-weight: 700; font-family: monospace; font-size: 14px;">
              ${cleanEmail}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Página Pública:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              <a href="${publicBookingUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: none;">/agendar/${finalSlug}</a>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button - Entrar no Painel -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="background: ${buttonGradient}; color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);">
          Entrar no Painel Agora
        </a>
      </div>

      <!-- Public Booking Link Box -->
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px dashed #22C55E; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 600; color: #4ADE80; margin-bottom: 4px;">
          📅 Seu Link Público de Agendamento Online:
        </div>
        <p style="font-size: 12px; color: #CBD5E1; margin: 0 0 8px 0;">
          Compartilhe este link com seus clientes via WhatsApp, Instagram ou site para agendamentos imediatos:
        </p>
        <a href="${publicBookingUrl}" target="_blank" rel="noopener noreferrer" style="color: #86EFAC; font-weight: 600; font-size: 13px; word-break: break-all;">
          ${publicBookingUrl}
        </a>
      </div>

      <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 0;">
        A senha de acesso foi definida por você durante o cadastro e pode ser utilizada imediatamente. Se precisar de suporte, nossa equipe está à disposição.
      </p>
    </div>

    <!-- Footer Signature -->
    <div style="background: #0D1B2A; padding: 24px 28px; text-align: center; border-top: 1px solid #334155; font-size: 11px; color: #94A3B8; line-height: 1.6;">
      <p style="margin: 0 0 4px 0; font-weight: 700; color: #F8FAFC; letter-spacing: 0.5px;">
        GRUPO CONTEK — TECNOLOGIA E CONSULTORIA
      </p>
      <p style="margin: 0 0 8px 0; color: #06B6D4;">
        Soluções Corporativas • AGYLI &amp; MARKALY
      </p>
      <p style="margin: 0; color: #64748B;">
        Mensagem gerada automaticamente pelo sistema Contek Agenda.
      </p>
    </div>

  </div>
</body>
</html>
      `

      const mailMsg = new MailerMessage({
        from: {
          address: senderAddress,
          name: senderName,
        },
        to: [{ address: cleanEmail }],
        subject: `Bem-vindo(a) ao ${prodDisplayName}! - ${cleanOrgName}`,
        html: htmlBody,
      })

      $app.newMailClient().send(mailMsg)
      emailSent = true
    } catch (mailErr) {
      emailSent = false
      emailError = mailErr && mailErr.message ? mailErr.message : String(mailErr)
      console.log('[onboarding/self-service] Erro ao enviar e-mail de boas-vindas:', emailError)
    }

    return e.json(200, {
      success: true,
      message: emailSent
        ? `Empresa "${cleanOrgName}" cadastrada com sucesso! E-mail de boas-vindas enviado para ${cleanEmail}.`
        : `Empresa "${cleanOrgName}" cadastrada com sucesso!`,
      email_sent: emailSent,
      email_error: emailError || null,
      organization: {
        id: createdOrg.id,
        name: createdOrg.getString('name'),
        slug: createdOrg.getString('slug'),
        product: createdOrg.getString('product'),
        status: createdOrg.getString('status'),
        plan_id: createdOrg.getString('plan_id'),
      },
      subscription: createdSub
        ? {
            id: createdSub.id,
            status: createdSub.getString('status'),
            starts_at: createdSub.getString('starts_at'),
            trial_ends_at: createdSub.getString('trial_ends_at'),
            plan_id: createdSub.getString('plan_id'),
          }
        : null,
      user: {
        id: createdUser.id,
        email: createdUser.getString('email'),
        name: createdUser.getString('name'),
        role: createdUser.getString('role'),
      },
      public_booking_url: `/agendar/${finalSlug}`,
      login_url: `/login?org=${encodeURIComponent(finalSlug)}&brand=${encodeURIComponent(requestedProduct)}&email=${encodeURIComponent(cleanEmail)}`,
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
    name,
    slug,
    admin_name,
    admin_email,
    admin_password,
    product = 'agyli',
    plan = 'agyli-pro',
    create_example_service = true,
  } = body

  const cleanName = typeof name === 'string' ? name.trim() : ''
  const cleanEmail = typeof admin_email === 'string' ? admin_email.trim().toLowerCase() : ''
  const cleanAdminName = typeof admin_name === 'string' ? admin_name.trim() : ''
  const cleanPassword = typeof admin_password === 'string' ? admin_password : ''
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
          subRecord.set(
            'history',
            JSON.stringify([
              {
                date: now.toISOString(),
                action: 'MANUAL_ACTIVATION',
                note: 'Ativação direta Contek Admin',
              },
            ]),
          )
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
      settingsRecord.set('working_days', JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']))
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

      // 5. Criar Profissional inicial administrativo exclusivo da nova organização
      const profCol = txApp.findCollectionByNameOrId('professionals')
      const profRecord = new Record(profCol)
      profRecord.set('organization_id', orgId)
      profRecord.set('user_id', userRecord.id)
      profRecord.set('name', cleanAdminName)
      profRecord.set('specialty', 'Especialista')
      profRecord.set('email', cleanAdminEmail)
      profRecord.set('default_duration', 45)
      profRecord.set('work_days', JSON.stringify(['seg', 'ter', 'qua', 'qui', 'sex', 'sab']))
      profRecord.set('work_hours', JSON.stringify({ start: '08:00', end: '19:00' }))
      profRecord.set('active', true)
      txApp.save(profRecord)

      // 6. Criar Serviço inicial exclusivo da nova organização
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
