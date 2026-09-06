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
  '/backend/v1/superadmin/org/resend-credentials',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { organization_id, admin_email, custom_password } = body

      if (!organization_id && !admin_email) {
        return e.badRequestError('ID da organização ou e-mail do administrador é obrigatório.')
      }

      let org = null
      if (organization_id) {
        try {
          org = $app.findRecordById('organizations', organization_id)
        } catch (_) {}
      }

      let adminUser = null
      if (admin_email) {
        try {
          adminUser = $app.findAuthRecordByEmail(
            '_pb_users_auth_',
            admin_email.trim().toLowerCase(),
          )
        } catch (_) {}
      }

      if (!adminUser && org) {
        // Buscar usuário administrador vinculado à organização
        try {
          const orgUsers = $app.findRecordsByFilter(
            'organization_users',
            'organization_id = "' + org.id + '" && role = "ADMINISTRADOR"',
            '-created',
            5,
            0,
          )
          for (const ou of orgUsers) {
            try {
              const u = $app.findRecordById('_pb_users_auth_', ou.getString('user_id'))
              if (u && !u.getBool('is_super_admin')) {
                adminUser = u
                break
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      if (!adminUser && org && org.getString('email')) {
        try {
          adminUser = $app.findAuthRecordByEmail('_pb_users_auth_', org.getString('email'))
        } catch (_) {}
      }

      if (!adminUser) {
        return e.json(404, { error: 'Usuário administrador da organização não foi encontrado.' })
      }

      if (!org && adminUser.getString('organization_id')) {
        try {
          org = $app.findRecordById('organizations', adminUser.getString('organization_id'))
        } catch (_) {}
      }

      if (!org) {
        return e.json(404, { error: 'Organização correspondente não foi encontrada.' })
      }

      const orgName = org.getString('name') || 'Sua Empresa'
      const orgSlug = org.getString('slug') || ''
      const orgProduct = org.getString('product') || 'agyli'
      const targetEmail = adminUser.getString('email')
      const targetName = adminUser.getString('name') || `Gestor ${orgName}`

      // Se foi fornecida uma nova senha no reenvio, atualizar o usuário
      let passwordToDisplay = ''
      let isNewGeneratedPassword = false
      if (typeof custom_password === 'string' && custom_password.trim().length >= 8) {
        passwordToDisplay = custom_password.trim()
        adminUser.setPassword(passwordToDisplay)
        $app.save(adminUser)
      } else {
        // Se não foi informada senha nova, gera uma nova senha provisória de 10 caracteres e atualiza
        passwordToDisplay = $security.randomString(10) + '@'
        isNewGeneratedPassword = true
        adminUser.setPassword(passwordToDisplay)
        $app.save(adminUser)
      }

      // Buscar plano para exibição
      let planDisplayName = orgProduct === 'markaly' ? 'Markaly Start' : 'Agyli Pro'
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + org.id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
          if (planRec) planDisplayName = planRec.getString('name')
        }
      } catch (_) {}

      const publicBaseUrl =
        $os.getenv('SITE_URL') ||
        ($app.settings() && $app.settings().meta && $app.settings().meta.appURL) ||
        'https://contek-agenda-ia-479d4.goskip.app'
      const loginUrl =
        publicBaseUrl +
        '/login?org=' +
        encodeURIComponent(orgSlug) +
        '&brand=' +
        encodeURIComponent(orgProduct) +
        '&email=' +
        encodeURIComponent(targetEmail)
      const publicBookingUrl = publicBaseUrl + '/agendar/' + orgSlug
      const resetPassUrl = publicBaseUrl + '/redefinir-senha'

      const prodDisplayName = orgProduct === 'markaly' ? 'MARKALY' : 'AGYLI'
      const senderName =
        ($app.settings() && $app.settings().meta && $app.settings().meta.senderName) ||
        'Grupo CONTEK — Gestão & Tecnologia'
      const senderAddress =
        ($app.settings() && $app.settings().meta && $app.settings().meta.senderAddress) ||
        'suporte@contek.com.br'

      const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Credenciais de Acesso ao Sistema - ${prodDisplayName}</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0D1B2A; color: #F8FAFC;">
  <div style="max-width: 580px; margin: 0 auto; background: #1E293B; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    
    <!-- Top Header -->
    <div style="background: linear-gradient(135deg, #0D1B2A 0%, #1E3A8A 50%, #06B6D4 100%); padding: 32px 28px; text-align: center; border-bottom: 2px solid #22C55E;">
      <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #67E8F9; margin-bottom: 12px;">
        Uma Solução Grupo CONTEK
      </div>
      <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
        Reenvio de Credenciais: ${prodDisplayName}
      </h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #E2E8F0; font-weight: 400;">
        Plataforma Inteligente de Gestão &amp; Agendamento • Grupo CONTEK
      </p>
    </div>

    <!-- Content Body -->
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #F1F5F9; margin: 0 0 16px 0;">
        Olá, <strong>${targetName}</strong>!
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 24px 0;">
        Conforme solicitado pelo suporte do Grupo CONTEK, reenviamos suas credenciais de acesso ao sistema <strong>${prodDisplayName}</strong> da sua empresa <strong>${orgName}</strong> (Plano <strong>${planDisplayName}</strong>).
      </p>

      <!-- Credentials Card -->
      <div style="background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #06B6D4; margin-bottom: 14px;">
          🔑 Suas Credenciais Atualizadas
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #94A3B8; width: 35%;">Link de Login:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: none;">${loginUrl}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">E-mail de Acesso:</td>
            <td style="padding: 6px 0; color: #22C55E; font-weight: 700; font-family: monospace; font-size: 14px;">
              ${targetEmail}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Senha de Acesso:</td>
            <td style="padding: 6px 0; color: #FCD34D; font-weight: 700; font-family: monospace; font-size: 14px; letter-spacing: 0.5px;">
              ${passwordToDisplay}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Página Pública:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              <a href="${publicBookingUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: none;">/agendar/${orgSlug}</a>
            </td>
          </tr>
        </table>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #1E3A8A 0%, #06B6D4 100%); color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);">
          Acessar Painel Agora
        </a>
      </div>

      <!-- Security Notice -->
      <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <strong style="color: #FBBF24; font-size: 13px; display: block; margin-bottom: 4px;">
          🔒 Dica de Segurança:
        </strong>
        <p style="font-size: 12px; line-height: 1.5; color: #E2E8F0; margin: 0;">
          Você pode redefinir sua senha pessoal a qualquer momento através do menu <em>Configurações &gt; Minha Conta</em> ou utilizando a função <a href="${resetPassUrl}" target="_blank" rel="noopener noreferrer" style="color: #FBBF24; text-decoration: underline;">Esqueci minha senha</a> na tela de login.
        </p>
      </div>

      <!-- Public Booking Link Box -->
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px dashed #22C55E; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 600; color: #4ADE80; margin-bottom: 4px;">
          📅 Seu Link Público de Agendamento:
        </div>
        <p style="font-size: 12px; color: #CBD5E1; margin: 0 0 8px 0;">
          Disponibilize para seus pacientes e clientes marcarem horários online:
        </p>
        <a href="${publicBookingUrl}" target="_blank" rel="noopener noreferrer" style="color: #86EFAC; font-weight: 600; font-size: 13px; word-break: break-all;">
          ${publicBookingUrl}
        </a>
      </div>
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

      let mailSent = false
      let mailError = ''

      try {
        const mailMsg = new MailerMessage({
          from: {
            address: senderAddress,
            name: senderName,
          },
          to: [{ address: targetEmail }],
          subject: `Reenvio de credenciais de acesso - ${prodDisplayName} (${orgName})`,
          html: htmlBody,
        })

        $app.newMailClient().send(mailMsg)
        mailSent = true
      } catch (err) {
        mailSent = false
        mailError = err && err.message ? err.message : String(err)
        console.log('[superadmin/org/resend-credentials] erro ao enviar e-mail:', mailError)
      }

      if (!mailSent) {
        return e.json(500, {
          error: `Falha ao enviar e-mail para ${targetEmail}: ${mailError || 'Erro no serviço de e-mail.'}`,
        })
      }

      return e.json(200, {
        success: true,
        message: isNewGeneratedPassword
          ? `E-mail reenviado com sucesso para ${targetEmail}! Uma nova senha foi gerada e a senha anterior foi invalidada.`
          : `E-mail de credenciais reenviado com sucesso para ${targetEmail}!`,
        admin_email: targetEmail,
        new_password: passwordToDisplay,
        password_regenerated: isNewGeneratedPassword,
        login_url:
          '/login?org=' +
          encodeURIComponent(orgSlug) +
          '&brand=' +
          encodeURIComponent(orgProduct) +
          '&email=' +
          encodeURIComponent(targetEmail),
      })
    } catch (err) {
      console.log('[superadmin/org/resend-credentials] error:', err.message || err)
      return e.json(500, {
        error: err.message || 'Erro ao reenviar e-mail de credenciais pelo SuperAdmin.',
      })
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
        create_example_service = true,
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

        // 4.7 Criar Serviço Inicial Padrão se flag for true (padrão true para retrocompatibilidade)
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

          // 4.8 Vincular Profissional ao Serviço
          const profServCol = txApp.findCollectionByNameOrId('professional_services')
          const profServRecord = new Record(profServCol)
          profServRecord.set('organization_id', orgId)
          profServRecord.set('professional_id', profRecord.id)
          profServRecord.set('service_id', servRecord.id)
          txApp.save(profServRecord)
        }
      })

      // 5. Enviar e-mail de boas-vindas com credenciais automaticamente
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
          encodeURIComponent(chosenProduct) +
          '&email=' +
          encodeURIComponent(cleanAdminEmail)
        const publicBookingUrl = publicBaseUrl + '/agendar/' + finalSlug
        const resetPassUrl = publicBaseUrl + '/redefinir-senha'

        const prodDisplayName = chosenProduct === 'markaly' ? 'MARKALY' : 'AGYLI'
        const planDisplayName = resolvedPlanRecord
          ? resolvedPlanRecord.getString('name')
          : chosenProduct === 'markaly'
            ? 'Markaly Start'
            : 'Agyli Pro'

        const senderName =
          ($app.settings() && $app.settings().meta && $app.settings().meta.senderName) ||
          'Grupo CONTEK — Gestão & Tecnologia'
        const senderAddress =
          ($app.settings() && $app.settings().meta && $app.settings().meta.senderAddress) ||
          'suporte@contek.com.br'

        const htmlBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao ${prodDisplayName} - Suas credenciais de acesso</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0D1B2A; color: #F8FAFC;">
  <div style="max-width: 580px; margin: 0 auto; background: #1E293B; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);">
    
    <!-- Top Header -->
    <div style="background: linear-gradient(135deg, #0D1B2A 0%, #1E3A8A 50%, #06B6D4 100%); padding: 32px 28px; text-align: center; border-bottom: 2px solid #22C55E;">
      <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #67E8F9; margin-bottom: 12px;">
        Uma Solução Grupo CONTEK
      </div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">
        Bem-vindo(a) ao ${prodDisplayName}!
      </h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #E2E8F0; font-weight: 400;">
        Plataforma Inteligente de Gestão & Agendamento • Grupo CONTEK
      </p>
    </div>

    <!-- Content Body -->
    <div style="padding: 32px 28px;">
      <p style="font-size: 15px; line-height: 1.6; color: #F1F5F9; margin: 0 0 16px 0;">
        Olá, <strong>${finalAdminName}</strong>!
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 24px 0;">
        A sua empresa <strong>${cleanOrgName}</strong> foi cadastrada com sucesso no sistema <strong>${prodDisplayName}</strong> (Plano <strong>${planDisplayName}</strong>). Abaixo estão os seus dados oficiais de acesso ao painel de administração e o link público de agendamentos.
      </p>

      <!-- Credentials Card -->
      <div style="background: #0F172A; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #06B6D4; margin-bottom: 14px;">
          🔑 Suas Credenciais de Acesso
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #94A3B8; width: 35%;">Link de Login:</td>
            <td style="padding: 6px 0; color: #FFFFFF; font-weight: 600;">
              <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; text-decoration: none;">${loginUrl}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">E-mail de Acesso:</td>
            <td style="padding: 6px 0; color: #22C55E; font-weight: 700; font-family: monospace; font-size: 14px;">
              ${cleanAdminEmail}
            </td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #94A3B8;">Senha Provisória:</td>
            <td style="padding: 6px 0; color: #FCD34D; font-weight: 700; font-family: monospace; font-size: 14px; letter-spacing: 0.5px;">
              ${cleanAdminPassword}
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

      <!-- Action Button -->
      <div style="text-align: center; margin: 28px 0;">
        <a href="${loginUrl}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #1E3A8A 0%, #06B6D4 100%); color: #FFFFFF; font-weight: 700; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);">
          Acessar Painel Agora
        </a>
      </div>

      <!-- Important Security Notice -->
      <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #F59E0B; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <strong style="color: #FBBF24; font-size: 13px; display: block; margin-bottom: 4px;">
          🔒 Recomendação Importante de Segurança:
        </strong>
        <p style="font-size: 12px; line-height: 1.5; color: #E2E8F0; margin: 0;">
          Por segurança, recomendamos que altere sua senha no seu primeiro acesso através do menu <em>Configurações &gt; Minha Conta</em> ou utilizando a função <a href="${resetPassUrl}" target="_blank" rel="noopener noreferrer" style="color: #FBBF24; text-decoration: underline;">Esqueci minha senha</a> na tela de login.
        </p>
      </div>

      <!-- Public Booking Link Box -->
      <div style="background: rgba(34, 197, 94, 0.08); border: 1px dashed #22C55E; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 600; color: #4ADE80; margin-bottom: 4px;">
          📅 Seu Link Público de Agendamento Online:
        </div>
        <p style="font-size: 12px; color: #CBD5E1; margin: 0 0 8px 0;">
          Compartilhe este link com seus clientes via WhatsApp, Instagram ou site:
        </p>
        <a href="${publicBookingUrl}" target="_blank" rel="noopener noreferrer" style="color: #86EFAC; font-weight: 600; font-size: 13px; word-break: break-all;">
          ${publicBookingUrl}
        </a>
      </div>
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
        Mensagem gerada automaticamente pelo sistema Contek Agenda. Por favor, não responda diretamente a este e-mail.
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
          to: [{ address: cleanAdminEmail }],
          subject: `Bem-vindo(a) ao ${prodDisplayName} - Suas credenciais de acesso (${cleanOrgName})`,
          html: htmlBody,
        })

        $app.newMailClient().send(mailMsg)
        emailSent = true
      } catch (mailErr) {
        emailSent = false
        emailError = mailErr && mailErr.message ? mailErr.message : String(mailErr)
        console.log('[superadmin/org/create] Erro ao enviar e-mail de boas-vindas:', emailError)
      }

      return e.json(200, {
        success: true,
        message: emailSent
          ? `Empresa "${cleanOrgName}" cadastrada com sucesso! E-mail com credenciais enviado para ${cleanAdminEmail}.`
          : `Empresa "${cleanOrgName}" criada, mas houve uma falha no envio do e-mail: ${emailError || 'Verifique o serviço de e-mail.'}`,
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
          product: chosenProduct,
          login_url: `/login?org=${encodeURIComponent(finalSlug)}&brand=${encodeURIComponent(chosenProduct)}&email=${encodeURIComponent(cleanAdminEmail)}`,
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
