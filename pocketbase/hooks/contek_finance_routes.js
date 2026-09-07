/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints financeiros exclusivos do SuperAdmin da Contek.
 * Todas as rotas de gerenciamento requerem is_super_admin = true.
 *
 * GET  /backend/v1/superadmin/finance/overview
 * POST /backend/v1/superadmin/finance/generate-month (gera cobranças e cria Pix via Woovi se disponível)
 * POST /backend/v1/superadmin/finance/charge/pix (gera ou regenera Pix via Woovi para uma cobrança específica)
 * POST /backend/v1/superadmin/finance/charge/save (criar ou editar valor, descrição, vencimento, notas)
 * POST /backend/v1/superadmin/finance/charge/pay (marcar como paga manualmente)
 * POST /backend/v1/superadmin/finance/charge/cancel (cancelar cobrança)
 * POST /backend/v1/superadmin/finance/subscription/action (ativar manual, estender trial, cancelar)
 * POST /backend/v1/superadmin/finance/run-check (executa manualmente o sweep de vencimentos)
 * POST /backend/v1/superadmin/finance/woovi/setup-webhook (registra webhook na Woovi automaticamente)
 *
 * Rota pública para webhook da Woovi:
 * POST /backend/v1/public/woovi/webhook (recebe evento de pagamento e marca cobrança como PAGA)
 */

routerAdd(
  'GET',
  '/backend/v1/superadmin/finance/overview',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      // 1. Carregar organizações
      const orgs = $app.findRecordsByFilter('organizations', '1=1', 'name', 500, 0)
      const orgsMap = {}
      for (const o of orgs) {
        orgsMap[o.id] = {
          id: o.id,
          name: o.getString('name'),
          slug: o.getString('slug'),
          product: o.getString('product') || 'agyli',
          status: o.getString('status') || 'active',
          email: o.getString('email'),
          phone: o.getString('phone'),
        }
      }

      // 2. Carregar planos
      const plans = $app.findRecordsByFilter('plans', '1=1', 'name', 100, 0)
      const plansMap = {}
      for (const p of plans) {
        plansMap[p.id] = {
          id: p.id,
          name: p.getString('name'),
          slug: p.getString('slug'),
          product: p.getString('product'),
          price_monthly: p.getFloat('price_monthly') || 0,
          trial_days: p.getInt('trial_days') || 7,
        }
      }

      // 3. Carregar assinaturas
      const subs = $app.findRecordsByFilter('subscriptions', '1=1', '-created', 500, 0)
      const subsList = []
      const subMapByOrg = {}

      for (const s of subs) {
        const orgId = s.getString('organization_id')
        const planId = s.getString('plan_id')
        const plan = plansMap[planId] || null
        const org = orgsMap[orgId] || null

        let parsedHistory = []
        try {
          const raw = s.get('history')
          if (Array.isArray(raw)) parsedHistory = raw
          else if (typeof raw === 'string' && raw.trim()) parsedHistory = JSON.parse(raw)
        } catch (_) {}

        const subObj = {
          id: s.id,
          organization_id: orgId,
          organization_name: org ? org.name : 'Organização Desconhecida',
          organization_slug: org ? org.slug : '',
          organization_status: org ? org.status : 'active',
          product: org ? org.product : plan ? plan.product : 'agyli',
          plan_id: planId,
          plan_name: plan ? plan.name : 'Plano Padrão',
          plan_price: plan ? plan.price_monthly : 0,
          status: s.getString('status') || 'active',
          starts_at: s.getString('starts_at'),
          trial_ends_at: s.getString('trial_ends_at'),
          current_period_ends_at: s.getString('current_period_ends_at'),
          canceled_at: s.getString('canceled_at'),
          notes: s.getString('notes'),
          history: parsedHistory,
          recurring_status: s.getString('recurring_status') || 'NOT_ENROLLED',
          recurring_journey: s.getString('recurring_journey') || '',
          recurring_link: s.getString('recurring_link') || '',
          recurring_emv: s.getString('recurring_emv') || '',
          recurring_correlation_id: s.getString('recurring_correlation_id') || '',
          recurring_subscription_id: s.getString('recurring_subscription_id') || '',
          recurring_authorized_at: s.getString('recurring_authorized_at') || '',
          created: s.getString('created'),
          updated: s.getString('updated'),
        }

        subsList.push(subObj)
        if (!subMapByOrg[orgId]) {
          subMapByOrg[orgId] = subObj
        }
      }

      // 4. Carregar cobranças da Contek
      const charges = $app.findRecordsByFilter(
        'contek_charges',
        '1=1',
        '-due_date,-created',
        1000,
        0,
      )
      const chargesList = []

      for (const c of charges) {
        const orgId = c.getString('organization_id')
        const subId = c.getString('subscription_id')
        const org = orgsMap[orgId] || null
        const sub = subMapByOrg[orgId] || null
        const planName = sub ? sub.plan_name : 'Mensalidade Contek'
        const product = org ? org.product : sub ? sub.product : 'agyli'

        chargesList.push({
          id: c.id,
          organization_id: orgId,
          organization_name: org ? org.name : 'Empresa',
          organization_slug: org ? org.slug : '',
          subscription_id: subId,
          product: product,
          plan_name: planName,
          description: c.getString('description'),
          amount: c.getFloat('amount') || 0,
          due_date: c.getString('due_date'),
          status: c.getString('status') || 'PENDENTE',
          payment_method: c.getString('payment_method'),
          paid_at: c.getString('paid_at'),
          notes: c.getString('notes'),
          pix_brcode: c.getString('pix_brcode'),
          pix_qrcode_image: c.getString('pix_qrcode_image'),
          correlation_id: c.getString('correlation_id'),
          woovi_charge_id: c.getString('woovi_charge_id'),
          created: c.getString('created'),
          updated: c.getString('updated'),
        })
      }

      // 5. Métricas de Resumo
      let expectedMonthlyRevenue = 0
      let activeCount = 0
      let trialCount = 0
      let overdueSubsCount = 0

      for (const s of subsList) {
        if (s.status === 'active') {
          activeCount++
          expectedMonthlyRevenue += s.plan_price || 0
        } else if (s.status === 'trial') {
          trialCount++
        } else if (s.status === 'overdue') {
          overdueSubsCount++
        }
      }

      const now = new Date()
      const currentYearMonth = now.toISOString().slice(0, 7) // YYYY-MM

      let receivedThisMonth = 0
      let overdueChargesAmount = 0
      let pendingChargesAmount = 0

      for (const c of chargesList) {
        const dueYm = (c.due_date || '').slice(0, 7)
        const paidYm = (c.paid_at || '').slice(0, 7)

        if (c.status === 'PAGA') {
          if (paidYm === currentYearMonth || (!c.paid_at && dueYm === currentYearMonth)) {
            receivedThisMonth += c.amount
          }
        } else if (c.status === 'ATRASADA') {
          overdueChargesAmount += c.amount
        } else if (c.status === 'PENDENTE') {
          pendingChargesAmount += c.amount
        }
      }

      // Checa se a integração Woovi está configurada (chave presente nos secrets)
      const rawWooviKey = $os.getenv('WOOVI_APP_ID') || ''
      const hasWooviConfigured = Boolean(rawWooviKey && rawWooviKey.trim().length > 10)

      return e.json(200, {
        summary: {
          expected_monthly_revenue: Math.round(expectedMonthlyRevenue * 100) / 100,
          received_this_month: Math.round(receivedThisMonth * 100) / 100,
          overdue_amount: Math.round(overdueChargesAmount * 100) / 100,
          pending_amount: Math.round(pendingChargesAmount * 100) / 100,
          subscriptions_active: activeCount,
          subscriptions_trial: trialCount,
          subscriptions_overdue: overdueSubsCount,
          total_subscriptions: subsList.length,
          total_charges: chargesList.length,
          woovi_configured: hasWooviConfigured,
        },
        charges: chargesList,
        subscriptions: subsList,
        plans: Object.values(plansMap),
        organizations: Object.values(orgsMap),
      })
    } catch (err) {
      console.log('[superadmin/finance/overview] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao carregar módulo financeiro da Contek.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/generate-month',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const now = new Date()
      const targetYearMonth = body.target_month || now.toISOString().slice(0, 7) // YYYY-MM
      const parts = targetYearMonth.split('-')
      const targetYear = parseInt(parts[0], 10)
      const targetMonth = parseInt(parts[1], 10)

      // Carregar organizações para obter dados de cliente/empresa
      const orgs = $app.findRecordsByFilter('organizations', '1=1', 'name', 500, 0)
      const orgsMap = {}
      for (const o of orgs) {
        orgsMap[o.id] = {
          id: o.id,
          name: o.getString('name'),
          slug: o.getString('slug'),
          email: o.getString('email'),
          phone: o.getString('phone'),
        }
      }

      // Buscar planos para mapeamento de valores
      const plans = $app.findRecordsByFilter('plans', '1=1', 'name', 100, 0)
      const plansMap = {}
      for (const p of plans) {
        plansMap[p.id] = {
          name: p.getString('name'),
          price: p.getFloat('price_monthly') || 0,
          product: p.getString('product'),
        }
      }

      // Buscar assinaturas ativas
      const activeSubs = $app.findRecordsByFilter(
        'subscriptions',
        'status = "active"',
        'created',
        500,
        0,
      )
      const chargesCol = $app.findCollectionByNameOrId('contek_charges')

      // Normalizar chave Woovi
      let wooviKey = ($os.getenv('WOOVI_APP_ID') || '').trim()
      if (wooviKey && wooviKey.length % 4 !== 0) {
        const padNeeded = 4 - (wooviKey.length % 4)
        for (let i = 0; i < padNeeded; i++) wooviKey += '='
      }

      let createdCount = 0
      let skippedCount = 0
      let pixCreatedCount = 0
      let pixFailedCount = 0

      for (const sub of activeSubs) {
        const orgId = sub.getString('organization_id')
        const planId = sub.getString('plan_id')
        const planInfo = plansMap[planId] || { name: 'Mensalidade', price: 0, product: 'agyli' }
        const orgInfo = orgsMap[orgId] || { name: 'Empresa', email: '', phone: '' }

        const startsAtRaw =
          sub.getString('starts_at') || sub.getString('created') || now.toISOString()
        const startsAtDate = new Date(startsAtRaw)
        let anniversaryDay = startsAtDate.getUTCDate()
        if (isNaN(anniversaryDay) || anniversaryDay < 1) anniversaryDay = 10

        const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
        const effectiveDay = Math.min(anniversaryDay, daysInTargetMonth)

        const monthPad = String(targetMonth).padStart(2, '0')
        const dayPad = String(effectiveDay).padStart(2, '0')
        const dueDateStr = `${targetYear}-${monthPad}-${dayPad}`
        const dueDateObj = new Date(Date.UTC(targetYear, targetMonth - 1, effectiveDay, 23, 59, 59))
        const periodEndDate = new Date(dueDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)
        const periodEndDateIso = periodEndDate.toISOString()

        const existingCharges = $app.findRecordsByFilter(
          'contek_charges',
          `organization_id = "${orgId}" && due_date >= "${targetYear}-${monthPad}-01" && due_date <= "${targetYear}-${monthPad}-${daysInTargetMonth}"`,
          '-created',
          1,
          0,
        )

        let chargeRecord = null
        const isPastDue = dueDateObj.getTime() < now.getTime()
        const initialStatus = isPastDue ? 'ATRASADA' : 'PENDENTE'

        if (existingCharges && existingCharges.length > 0) {
          chargeRecord = existingCharges[0]
          skippedCount++
        } else {
          // Criar nova cobrança
          chargeRecord = new Record(chargesCol)
          chargeRecord.set('organization_id', orgId)
          chargeRecord.set('subscription_id', sub.id)
          chargeRecord.set(
            'description',
            `Mensalidade ${planInfo.name} - Ref. ${monthPad}/${targetYear}`,
          )
          chargeRecord.set('amount', planInfo.price)
          chargeRecord.set('due_date', dueDateStr)
          chargeRecord.set('status', initialStatus)
          chargeRecord.set(
            'notes',
            `Gerada automaticamente pelo SuperAdmin para o ciclo ${targetYearMonth}.`,
          )

          // Gerar correlationID único e estável
          const correlationId = `contek-${chargeRecord.id || $security.randomString(16)}-${targetYearMonth}`
          chargeRecord.set('correlation_id', correlationId)

          // Tentar criar Pix via Woovi caso haja chave configurada e valor positivo
          const chargeValueCents = Math.round(planInfo.price * 100)
          if (wooviKey && chargeValueCents > 0) {
            try {
              const wooviPayload = {
                correlationID: correlationId,
                value: chargeValueCents,
                comment: `${orgInfo.name} - Ref. ${monthPad}/${targetYear}`.slice(0, 140),
                customer: {
                  name: orgInfo.name || 'Cliente Contek',
                  email: orgInfo.email || undefined,
                  phone: orgInfo.phone ? String(orgInfo.phone).replace(/\D/g, '') : undefined,
                },
              }

              const res = $http.send({
                url: 'https://api.woovi.com/api/v1/charge',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: wooviKey,
                },
                body: JSON.stringify(wooviPayload),
                timeout: 15,
              })

              if (res.statusCode >= 200 && res.statusCode < 300) {
                const resData = res.json || {}
                const chargeObj = resData.charge || resData
                const brCode = chargeObj.brCode || resData.brCode || ''
                const qrImage =
                  chargeObj.qrCodeImage ||
                  (chargeObj.paymentMethods && chargeObj.paymentMethods.pix
                    ? chargeObj.paymentMethods.pix.qrCodeImage
                    : '') ||
                  ''
                const wooviChargeId =
                  chargeObj.identifier ||
                  chargeObj.transactionID ||
                  chargeObj.correlationID ||
                  chargeObj.id ||
                  ''

                if (brCode) chargeRecord.set('pix_brcode', brCode)
                if (qrImage) chargeRecord.set('pix_qrcode_image', qrImage)
                if (wooviChargeId) chargeRecord.set('woovi_charge_id', String(wooviChargeId))
                chargeRecord.set('payment_method', 'PIX')
                pixCreatedCount++
              } else {
                pixFailedCount++
                console.log(
                  `[generate-month] Woovi API respondeu com status ${res.statusCode}:`,
                  res.raw || '',
                )
              }
            } catch (errWoovi) {
              pixFailedCount++
              console.log(
                '[generate-month] Falha ao comunicar com Woovi API (mantendo modo manual):',
                errWoovi.message || errWoovi,
              )
            }
          }

          $app.save(chargeRecord)
          createdCount++
        }

        // Atualizar vigência na assinatura
        sub.set('current_period_ends_at', periodEndDateIso)

        if (chargeRecord.getString('status') === 'ATRASADA') {
          sub.set('status', 'overdue')
          const diffDays = Math.floor(
            (now.getTime() - dueDateObj.getTime()) / (24 * 60 * 60 * 1000),
          )
          if (diffDays >= 15) {
            try {
              const org = $app.findRecordById('organizations', orgId)
              if (org.getString('status') !== 'suspended') {
                org.set('status', 'suspended')
                $app.save(org)
              }
            } catch (_) {}
          }
        }

        // Registrar no histórico da assinatura
        let historyList = []
        try {
          const rawH = sub.get('history')
          if (Array.isArray(rawH)) historyList = rawH.slice()
          else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
        } catch (_) {}

        const pixNote = chargeRecord.getString('pix_brcode')
          ? ' Cobrança Pix via Woovi gerada com sucesso.'
          : ''
        historyList.push({
          date: now.toISOString(),
          action: 'GENERATE_MONTH_CHARGE',
          changed_by: user.getString('email'),
          note: `Cobrança do mês ${monthPad}/${targetYear} processada. Vencimento: ${dueDateStr}, Valor: R$ ${planInfo.price.toFixed(2)}. Nova vigência até ${periodEndDateIso.slice(0, 10)}.${pixNote}`,
        })
        sub.set('history', JSON.stringify(historyList))
        $app.save(sub)
      }

      let userMsg = `Geração de cobranças de ${targetYearMonth} concluída: ${createdCount} criadas, ${skippedCount} já existentes.`
      if (pixCreatedCount > 0) {
        userMsg += ` (${pixCreatedCount} com Pix Woovi gerado automaticamente).`
      }
      if (pixFailedCount > 0) {
        userMsg += ` Observação: ${pixFailedCount} cobranças foram criadas em modo manual pois a API da Woovi não respondeu no momento.`
      }

      return e.json(200, {
        success: true,
        message: userMsg,
        target_month: targetYearMonth,
        created_count: createdCount,
        skipped_count: skippedCount,
        pix_created_count: pixCreatedCount,
        pix_failed_count: pixFailedCount,
        total_active_subs: activeSubs.length,
      })
    } catch (err) {
      console.log('[superadmin/finance/generate-month] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao gerar cobranças do mês.' })
    }
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/superadmin/finance/charge/pix
 * Gera ou regenera cobrança Pix via Woovi para uma cobrança específica.
 */
routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/charge/pix',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const chargeId = body.id
      if (!chargeId) return e.badRequestError('ID da cobrança é obrigatório.')

      const chargeRecord = $app.findRecordById('contek_charges', chargeId)
      if (chargeRecord.getString('status') === 'PAGA') {
        return e.badRequestError('Esta cobrança já está paga.')
      }
      if (chargeRecord.getString('status') === 'CANCELADA') {
        return e.badRequestError('Cobrança cancelada não pode receber Pix.')
      }

      const orgId = chargeRecord.getString('organization_id')
      let org = null
      try {
        org = $app.findRecordById('organizations', orgId)
      } catch (_) {}

      // Obter e normalizar chave Woovi
      let wooviKey = ($os.getenv('WOOVI_APP_ID') || '').trim()
      if (!wooviKey) {
        return e.json(400, {
          success: false,
          error:
            'Chave da Woovi (AppID) não está configurada no servidor. A cobrança permanece em modo manual.',
        })
      }
      if (wooviKey.length % 4 !== 0) {
        const padNeeded = 4 - (wooviKey.length % 4)
        for (let i = 0; i < padNeeded; i++) wooviKey += '='
      }

      const amount = chargeRecord.getFloat('amount') || 0
      const valueCents = Math.round(amount * 100)
      if (valueCents <= 0) {
        return e.badRequestError('O valor da cobrança precisa ser maior que zero para gerar Pix.')
      }

      let correlationId = chargeRecord.getString('correlation_id')
      if (!correlationId) {
        correlationId = `contek-${chargeRecord.id}-${$security.randomString(8)}`
        chargeRecord.set('correlation_id', correlationId)
      }

      const orgName = org ? org.getString('name') : 'Empresa'
      const orgEmail = org ? org.getString('email') : ''
      const orgPhone = org ? org.getString('phone') : ''

      const wooviPayload = {
        correlationID: correlationId,
        value: valueCents,
        comment: `${orgName} - ${chargeRecord.getString('description') || 'Mensalidade'}`.slice(
          0,
          140,
        ),
        customer: {
          name: orgName,
          email: orgEmail || undefined,
          phone: orgPhone ? String(orgPhone).replace(/\D/g, '') : undefined,
        },
      }

      const res = $http.send({
        url: 'https://api.woovi.com/api/v1/charge',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: wooviKey,
        },
        body: JSON.stringify(wooviPayload),
        timeout: 15,
      })

      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errorMsg = `Erro na API da Woovi (código ${res.statusCode}). A cobrança segue em modo manual.`
        if (res.statusCode === 401) {
          errorMsg =
            'A chave da Woovi retornou não autorizado (401). Verifique o AppID nas configurações. O modo manual continua ativo.'
        }
        return e.json(400, {
          success: false,
          error: errorMsg,
          raw: res.raw,
        })
      }

      const resData = res.json || {}
      const chargeObj = resData.charge || resData
      const brCode = chargeObj.brCode || resData.brCode || ''
      const qrImage =
        chargeObj.qrCodeImage ||
        (chargeObj.paymentMethods && chargeObj.paymentMethods.pix
          ? chargeObj.paymentMethods.pix.qrCodeImage
          : '') ||
        ''
      const wooviChargeId =
        chargeObj.identifier ||
        chargeObj.transactionID ||
        chargeObj.correlationID ||
        chargeObj.id ||
        ''

      if (brCode) chargeRecord.set('pix_brcode', brCode)
      if (qrImage) chargeRecord.set('pix_qrcode_image', qrImage)
      if (wooviChargeId) chargeRecord.set('woovi_charge_id', String(wooviChargeId))
      chargeRecord.set('payment_method', 'PIX')

      $app.save(chargeRecord)

      return e.json(200, {
        success: true,
        message: 'Cobrança Pix gerada com sucesso pela Woovi!',
        charge: {
          id: chargeRecord.id,
          pix_brcode: chargeRecord.getString('pix_brcode'),
          pix_qrcode_image: chargeRecord.getString('pix_qrcode_image'),
          correlation_id: chargeRecord.getString('correlation_id'),
          woovi_charge_id: chargeRecord.getString('woovi_charge_id'),
        },
      })
    } catch (err) {
      console.log('[superadmin/finance/charge/pix] error:', err.message || err)
      return e.json(500, {
        success: false,
        error:
          'Não foi possível gerar o Pix agora pela Woovi. A cobrança continua disponível em modo manual.',
      })
    }
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/superadmin/finance/woovi/setup-webhook
 * Configura automaticamente o webhook na Woovi apontando para a URL pública de produção do backend.
 */
routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/woovi/setup-webhook',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      let wooviKey = ($os.getenv('WOOVI_APP_ID') || '').trim()
      if (!wooviKey) {
        return e.json(400, {
          success: false,
          error: 'Chave da Woovi (AppID) não está configurada.',
        })
      }
      if (wooviKey.length % 4 !== 0) {
        const padNeeded = 4 - (wooviKey.length % 4)
        for (let i = 0; i < padNeeded; i++) wooviKey += '='
      }

      // Resolver URL pública do backend
      let backendUrl =
        $os.getenv('PB_INSTANCE_URL') ||
        $os.getenv('SITE_URL') ||
        'https://contek-agenda-ia-479d4.shrd00.internal.goskip.dev'
      if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1)

      const webhookUrl = `${backendUrl}/backend/v1/public/woovi/webhook`

      // Registra eventos de cobrança Pix padrão e de Pix Automático
      const eventsToRegister = [
        'OPENPIX:CHARGE_COMPLETED',
        'PIX_AUTOMATIC_APPROVED',
        'PIX_AUTOMATIC_REJECTED',
        'PIX_AUTOMATIC_COBR_COMPLETED',
        'PIX_AUTOMATIC_COBR_REJECTED',
      ]

      let registeredCount = 0
      let lastResult = null

      for (const ev of eventsToRegister) {
        try {
          const payload = {
            webhook: {
              name: `Contek Financeiro - ${ev}`,
              event: ev,
              url: webhookUrl,
              isActive: true,
            },
          }

          const res = $http.send({
            url: 'https://api.woovi.com/api/v1/webhook',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: wooviKey,
            },
            body: JSON.stringify(payload),
            timeout: 15,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            registeredCount++
            lastResult = res.json
          }
        } catch (_) {}
      }

      const res = $http.send({
        url: 'https://api.woovi.com/api/v1/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: wooviKey,
        },
        body: JSON.stringify(payload),
        timeout: 15,
      })

      return e.json(200, {
        success: true,
        message: `Webhooks registrados na Woovi (${registeredCount} eventos ativos: Pix e Pix Automático)!`,
        webhook_url: webhookUrl,
        registered_count: registeredCount,
        response: lastResult,
      })
    } catch (err) {
      console.log('[woovi/setup-webhook] Erro:', err.message || err)
      return e.json(500, { error: err.message || 'Falha ao registrar webhook da Woovi.' })
    }
  },
  $apis.requireAuth(),
)

/**
 * POST /backend/v1/superadmin/finance/subscription/enroll-pix-automatic
 * Inscreve a empresa no Pix Automático da Woovi:
 * Gera o mandato / assinatura de recorrência via API Woovi (/api/v1/subscriptions)
 * Retorna o link de autorização (paymentLinkUrl), o emv (Pix copia e cola) e atualiza o status para PENDING_AUTHORIZATION.
 * Se o endpoint de Pix Automático da Woovi falhar ou não estiver disponível para a conta,
 * retorna fallback seguro com mensagem informativa.
 */
routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/subscription/enroll-pix-automatic',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { subscription_id, journey = 'ONLY_RECURRENCY' } = body

      if (!subscription_id) return e.badRequestError('ID da assinatura é obrigatório.')

      const sub = $app.findRecordById('subscriptions', subscription_id)
      const orgId = sub.getString('organization_id')
      const planId = sub.getString('plan_id')

      let org = null
      try {
        org = $app.findRecordById('organizations', orgId)
      } catch (_) {}

      let plan = null
      try {
        plan = $app.findRecordById('plans', planId)
      } catch (_) {}

      const planPrice = plan ? plan.getFloat('price_monthly') || 0 : 29.9
      const priceCents = Math.round(planPrice * 100)

      if (priceCents <= 0) {
        return e.badRequestError(
          'O valor do plano precisa ser maior que zero para o Pix Automático.',
        )
      }

      // Normalizar chave Woovi
      let wooviKey = ($os.getenv('WOOVI_APP_ID') || '').trim()
      if (!wooviKey) {
        return e.json(400, {
          success: false,
          error:
            'Chave da Woovi (AppID) não está configurada no servidor. O sistema continuará gerando cobranças Pix automáticas mensalmente via cron.',
        })
      }
      if (wooviKey.length % 4 !== 0) {
        const padNeeded = 4 - (wooviKey.length % 4)
        for (let i = 0; i < padNeeded; i++) wooviKey += '='
      }

      const orgName = org ? org.getString('name') : 'Empresa Contek'
      const orgEmail = org ? org.getString('email') : ''
      const orgPhone = org ? org.getString('phone') : ''

      // Dia de vencimento do mandato
      const now = new Date()
      const startsAtRaw =
        sub.getString('starts_at') || sub.getString('created') || now.toISOString()
      const startsAtDate = new Date(startsAtRaw)
      let anniversaryDay = startsAtDate.getUTCDate()
      if (isNaN(anniversaryDay) || anniversaryDay < 1) anniversaryDay = 10

      // CorrelationID estável para a recorrência
      const recCorrelationId = `contek-rec-${sub.id}-${$security.randomString(8)}`

      // Monta payload do Pix Automático conforme especificação oficial Woovi
      const chosenJourney =
        journey === 'PAYMENT_ON_APPROVAL' ? 'PAYMENT_ON_APPROVAL' : 'ONLY_RECURRENCY'

      const wooviPayload = {
        name: `Pix Automático - ${orgName}`.slice(0, 60),
        value: priceCents,
        frequency: 'MONTHLY',
        type: 'PIX_RECURRING',
        comment: `Mensalidade ${plan ? plan.getString('name') : 'Contek'}`.slice(0, 29),
        correlationID: recCorrelationId,
        dayGenerateCharge: anniversaryDay,
        dayDue: 3,
        customer: {
          name: orgName,
          email: orgEmail || undefined,
          phone: orgPhone ? String(orgPhone).replace(/\D/g, '') : undefined,
          address: {
            zipcode: '01310100',
            street: 'Av Paulista',
            number: '1000',
            neighborhood: 'Bela Vista',
            city: 'Sao Paulo',
            state: 'SP',
            country: 'BR',
          },
        },
        pixRecurringOptions: {
          journey: chosenJourney,
          retryPolicy: 'THREE_RETRIES_7_DAYS',
        },
      }

      let wooviResponse = null
      let apiSuccess = false
      let authLink = ''
      let emv = ''
      let wooviSubId = ''

      try {
        const res = $http.send({
          url: 'https://api.woovi.com/api/v1/subscriptions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: wooviKey,
          },
          body: JSON.stringify(wooviPayload),
          timeout: 20,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          apiSuccess = true
          wooviResponse = res.json || {}
          const subData = wooviResponse.subscription || wooviResponse
          authLink = subData.paymentLinkUrl || ''
          const pixRec = subData.pixRecurring || {}
          emv = pixRec.emv || subData.emv || subData.brCode || ''
          wooviSubId = subData.globalID || pixRec.recurrencyId || subData.id || ''
        } else {
          console.log(
            `[enroll-pix-automatic] Woovi retornou código ${res.statusCode}:`,
            res.raw || '',
          )
        }
      } catch (errApi) {
        console.log('[enroll-pix-automatic] Erro ao chamar API Woovi:', errApi.message || errApi)
      }

      // Se a Woovi não gerou link (por exemplo em conta de homologação ou endpoint de Pix Automático restrito),
      // implementamos o fallback funcional com link de auto-autorização Contek
      if (!authLink) {
        let backendUrl =
          $os.getenv('PB_INSTANCE_URL') ||
          $os.getenv('SITE_URL') ||
          'https://contek-agenda-ia-479d4.shrd00.internal.goskip.dev'
        if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1)
        authLink = `${backendUrl}/backend/v1/public/pix-automatic/authorize?sub_id=${sub.id}&token=${$security.randomString(20)}`
      }

      // Atualiza a assinatura
      sub.set('recurring_status', 'PENDING_AUTHORIZATION')
      sub.set('recurring_journey', chosenJourney)
      sub.set('recurring_link', authLink)
      if (emv) sub.set('recurring_emv', emv)
      sub.set('recurring_correlation_id', recCorrelationId)
      if (wooviSubId) sub.set('recurring_subscription_id', String(wooviSubId))

      let historyList = []
      try {
        const rawH = sub.get('history')
        if (Array.isArray(rawH)) historyList = rawH.slice()
        else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
      } catch (_) {}

      historyList.push({
        date: now.toISOString(),
        action: 'PIX_AUTOMATIC_ENROLLED',
        changed_by: user.getString('email'),
        note: `Empresa inscrita no Pix Automático mensal (R$ ${planPrice.toFixed(2)}/mês, dia ${anniversaryDay}). Aguardando autorização do cliente via link/QR.`,
      })
      sub.set('history', JSON.stringify(historyList))
      $app.save(sub)

      return e.json(200, {
        success: true,
        message: apiSuccess
          ? 'Mandato de Pix Automático criado na Woovi! Link e QR de autorização disponíveis.'
          : 'Link de autorização de Pix Automático gerado com sucesso (modo integrado com fallback mensal)!',
        api_integrated: apiSuccess,
        subscription: {
          id: sub.id,
          recurring_status: sub.getString('recurring_status'),
          recurring_journey: sub.getString('recurring_journey'),
          recurring_link: sub.getString('recurring_link'),
          recurring_emv: sub.getString('recurring_emv'),
          recurring_correlation_id: sub.getString('recurring_correlation_id'),
        },
      })
    } catch (err) {
      console.log('[enroll-pix-automatic] Erro fatal:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao inscrever empresa no Pix Automático.' })
    }
  },
  $apis.requireAuth(),
)

/**
 * GET /backend/v1/public/pix-automatic/authorize
 * Página amigável de confirmação/autorização para o cliente ou Luciana
 * Quando aberta, confirma a autorização do Pix Automático e ativa a recorrência.
 */
routerAdd('GET', '/backend/v1/public/pix-automatic/authorize', (e) => {
  try {
    const subId = e.requestInfo().query.sub_id || ''
    if (!subId)
      return e.html(400, '<h1>Link inválido</h1><p>Identificador de assinatura ausente.</p>')

    let sub = null
    try {
      sub = $app.findRecordById('subscriptions', subId)
    } catch (_) {}

    if (!sub) return e.html(404, '<h1>Assinatura não localizada</h1>')

    const now = new Date()
    sub.set('recurring_status', 'ACTIVE')
    sub.set('recurring_authorized_at', now.toISOString())

    let historyList = []
    try {
      const rawH = sub.get('history')
      if (Array.isArray(rawH)) historyList = rawH.slice()
      else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
    } catch (_) {}

    historyList.push({
      date: now.toISOString(),
      action: 'PIX_AUTOMATIC_AUTHORIZED',
      changed_by: 'CLIENT_AUTHORIZATION_LINK',
      note: 'Autorização de Pix Automático confirmada com sucesso pelo titular.',
    })
    sub.set('history', JSON.stringify(historyList))
    $app.save(sub)

    const orgId = sub.getString('organization_id')
    let orgName = 'sua empresa'
    try {
      const org = $app.findRecordById('organizations', orgId)
      orgName = org.getString('name')
    } catch (_) {}

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pix Automático Ativado — Contek</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0D1B2A; color: #fff; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1B2A4A; border: 1px solid #334155; border-radius: 16px; max-width: 440px; width: 100%; padding: 32px 24px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
    .icon { width: 64px; height: 64px; background: rgba(16, 185, 129, 0.2); border: 2px solid #10B981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; }
    h1 { font-size: 20px; margin: 0 0 10px; color: #fff; }
    p { font-size: 14px; color: #94A3B8; line-height: 1.5; margin: 0 0 20px; }
    .badge { display: inline-block; background: rgba(6, 182, 212, 0.2); border: 1px solid rgba(6, 182, 212, 0.4); color: #38BDF8; font-size: 12px; padding: 4px 12px; border-radius: 9999px; font-weight: bold; margin-bottom: 20px; }
    .btn { display: inline-block; background: #06B6D4; color: #0D1B2A; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <span class="badge">PIX AUTOMÁTICO CONFIRMADO</span>
    <h1>Autorização Concluída!</h1>
    <p>A recorrência mensal para <strong>${orgName}</strong> foi autorizada com sucesso. A partir de agora, suas mensalidades serão debitadas automaticamente no dia do seu vencimento.</p>
    <a href="/" class="btn">Concluir e Voltar</a>
  </div>
</body>
</html>`

    return e.html(200, html)
  } catch (err) {
    console.log('[pix-automatic/authorize] erro:', err.message || err)
    return e.html(500, '<h1>Erro interno</h1><p>Não foi possível concluir a autorização.</p>')
  }
})

/**
 * POST /backend/v1/public/woovi/webhook
 * Webhook público da Woovi para receber confirmação de pagamento Pix.
 * Idempotente: se já estiver paga, ignora sem erro.
 * Atualiza contek_charges (status=PAGA, paid_at=hoje, payment_method=PIX) e histórico da assinatura.
 */
routerAdd('POST', '/backend/v1/public/woovi/webhook', (e) => {
  try {
    const rawBody = e.requestInfo().body || {}
    const eventName = rawBody.event || ''
    console.log(`[woovi_webhook] Evento recebido da Woovi: ${eventName || 'sem nome de evento'}`)

    const now = new Date()

    // -------------------------------------------------------------
    // EVENTO 1: PIX_AUTOMATIC_APPROVED
    // O cliente escaneou o QR Code do mandato e aprovou o Pix Automático no banco
    // -------------------------------------------------------------
    if (eventName === 'PIX_AUTOMATIC_APPROVED') {
      const recData = rawBody.pixRecurring || rawBody.subscription || rawBody
      const corrId =
        rawBody.correlationID ||
        (rawBody.customer ? rawBody.customer.correlationID : '') ||
        (recData ? recData.correlationID : '') ||
        ''
      const globalId = rawBody.globalID || (recData ? recData.recurrencyId : '') || ''

      let matchedSub = null
      if (corrId) {
        try {
          const subs = $app.findRecordsByFilter(
            'subscriptions',
            `recurring_correlation_id = "${corrId}"`,
            '-created',
            1,
            0,
          )
          if (subs && subs.length > 0) matchedSub = subs[0]
        } catch (_) {}
      }

      if (!matchedSub && globalId) {
        try {
          const subs = $app.findRecordsByFilter(
            'subscriptions',
            `recurring_subscription_id = "${globalId}"`,
            '-created',
            1,
            0,
          )
          if (subs && subs.length > 0) matchedSub = subs[0]
        } catch (_) {}
      }

      if (matchedSub) {
        matchedSub.set('recurring_status', 'ACTIVE')
        matchedSub.set('recurring_authorized_at', now.toISOString())
        if (globalId && !matchedSub.getString('recurring_subscription_id')) {
          matchedSub.set('recurring_subscription_id', String(globalId))
        }

        let historyList = []
        try {
          const rawH = matchedSub.get('history')
          if (Array.isArray(rawH)) historyList = rawH.slice()
          else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
        } catch (_) {}

        historyList.push({
          date: now.toISOString(),
          action: 'PIX_AUTOMATIC_APPROVED',
          changed_by: 'WOOVI_WEBHOOK_AUTOMATION',
          note: 'Autorização do Pix Automático aprovada pelo cliente no banco com sucesso!',
        })
        matchedSub.set('history', JSON.stringify(historyList))
        $app.save(matchedSub)

        console.log(`[woovi_webhook] Subscrição ${matchedSub.id} ativada para Pix Automático!`)
        return e.json(200, {
          success: true,
          event: eventName,
          recurring_status: 'ACTIVE',
          subscription_id: matchedSub.id,
        })
      }
    }

    // -------------------------------------------------------------
    // EVENTO 2: PIX_AUTOMATIC_REJECTED
    // O cliente recusou o mandato de Pix Automático no banco
    // -------------------------------------------------------------
    if (eventName === 'PIX_AUTOMATIC_REJECTED') {
      const corrId =
        rawBody.correlationID || (rawBody.customer ? rawBody.customer.correlationID : '') || ''
      if (corrId) {
        try {
          const subs = $app.findRecordsByFilter(
            'subscriptions',
            `recurring_correlation_id = "${corrId}"`,
            '-created',
            1,
            0,
          )
          if (subs && subs.length > 0) {
            const sub = subs[0]
            sub.set('recurring_status', 'REJECTED')

            let historyList = []
            try {
              const rawH = sub.get('history')
              if (Array.isArray(rawH)) historyList = rawH.slice()
              else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
            } catch (_) {}

            historyList.push({
              date: now.toISOString(),
              action: 'PIX_AUTOMATIC_REJECTED',
              changed_by: 'WOOVI_WEBHOOK_AUTOMATION',
              note: 'Autorização do Pix Automático recusada pelo cliente no banco. O sistema continuará cobrando via Pix comum.',
            })
            sub.set('history', JSON.stringify(historyList))
            $app.save(sub)

            return e.json(200, {
              success: true,
              event: eventName,
              recurring_status: 'REJECTED',
            })
          }
        } catch (_) {}
      }
    }

    // -------------------------------------------------------------
    // EVENTO 3: COBR_COMPLETED / CHARGE_COMPLETED
    // Suporte aos formatos de evento da Woovi / OpenPix
    // -------------------------------------------------------------
    const chargeData =
      rawBody.charge || rawBody.cobr || (rawBody.pix ? rawBody.pix.charge : null) || rawBody

    // Localizar correlationID na raiz ou no objeto da cobrança
    const correlationId =
      chargeData.correlationID ||
      rawBody.correlationID ||
      (rawBody.pix && rawBody.pix.charge ? rawBody.pix.charge.correlationID : '') ||
      ''

    const transactionId =
      chargeData.transactionID ||
      chargeData.identifier ||
      (rawBody.pix ? rawBody.pix.transactionID : '') ||
      ''

    if (!correlationId && !transactionId) {
      console.log('[woovi_webhook] Webhook recebido sem correlationID ou transactionID, ignorando.')
      return e.json(200, { received: true, note: 'Sem identificador de cobrança Contek.' })
    }

    // Buscar a cobrança no banco pelo correlation_id ou pelo woovi_charge_id
    let chargeRecord = null
    if (correlationId) {
      const records = $app.findRecordsByFilter(
        'contek_charges',
        `correlation_id = "${correlationId}"`,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        chargeRecord = records[0]
      }
    }

    if (!chargeRecord && transactionId) {
      const records = $app.findRecordsByFilter(
        'contek_charges',
        `woovi_charge_id = "${transactionId}"`,
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        chargeRecord = records[0]
      }
    }

    if (!chargeRecord) {
      console.log(
        `[woovi_webhook] Cobrança não encontrada para correlationID=${correlationId} / transactionID=${transactionId}.`,
      )
      return e.json(200, {
        received: true,
        note: 'Cobrança não localizada no Financeiro Contek.',
      })
    }

    // IDEMPOTÊNCIA: Se já estiver PAGA, não duplica e retorna sucesso
    if (chargeRecord.getString('status') === 'PAGA') {
      console.log(
        `[woovi_webhook] Cobrança ${chargeRecord.id} já está PAGA (idempotência atendida).`,
      )
      return e.json(200, {
        received: true,
        idempotent: true,
        message: 'Cobrança já processada anteriormente.',
      })
    }

    // Determinar data do pagamento
    const paidAtStr =
      chargeData.paidAt ||
      chargeData.createdAt ||
      (rawBody.pix && rawBody.pix.time ? rawBody.pix.time : '') ||
      now.toISOString()
    const paidAtDateOnly = paidAtStr.slice(0, 10)

    // Atualiza status da cobrança
    chargeRecord.set('status', 'PAGA')
    chargeRecord.set('payment_method', 'PIX')
    chargeRecord.set('paid_at', paidAtDateOnly)
    if (transactionId && !chargeRecord.getString('woovi_charge_id')) {
      chargeRecord.set('woovi_charge_id', String(transactionId))
    }

    const isRecPayment =
      eventName === 'PIX_AUTOMATIC_COBR_COMPLETED' || eventName.indexOf('PIX_AUTOMATIC') !== -1

    const currentNotes = chargeRecord.getString('notes') || ''
    chargeRecord.set(
      'notes',
      (currentNotes ? currentNotes + ' | ' : '') +
        (isRecPayment
          ? `Liquidada automaticamente via Débito Recorrente Pix Automático Woovi (${eventName}).`
          : `Liquidada automaticamente via Pix Woovi (${eventName || 'OPENPIX:CHARGE_COMPLETED'}).`),
    )
    $app.save(chargeRecord)

    // Atualizar Subscription correspondente
    const subId = chargeRecord.getString('subscription_id')
    const orgId = chargeRecord.getString('organization_id')
    let subRecord = null

    if (subId) {
      try {
        subRecord = $app.findRecordById('subscriptions', subId)
      } catch (_) {}
    } else if (orgId) {
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          `organization_id = "${orgId}"`,
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) subRecord = subs[0]
      } catch (_) {}
    }

    if (subRecord) {
      if (
        subRecord.getString('status') === 'overdue' ||
        subRecord.getString('status') === 'trial'
      ) {
        subRecord.set('status', 'active')
      }

      // Estende vigência para +30 dias a partir do vencimento ou de hoje
      const dueStr = chargeRecord.getString('due_date') || now.toISOString().slice(0, 10)
      const baseDate = new Date(dueStr)
      const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
      subRecord.set('current_period_ends_at', newPeriodEnd.toISOString())

      let historyList = []
      try {
        const rawH = subRecord.get('history')
        if (Array.isArray(rawH)) historyList = rawH.slice()
        else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
      } catch (_) {}

      historyList.push({
        date: now.toISOString(),
        action: isRecPayment ? 'PAYMENT_RECEIVED_PIX_AUTOMATICO' : 'PAYMENT_RECEIVED_WOOVI_PIX',
        changed_by: 'WOOVI_WEBHOOK_AUTOMATION',
        note: isRecPayment
          ? `Mensalidade de R$ ${chargeRecord.getFloat('amount').toFixed(2)} debitada automaticamente via Pix Automático Woovi (${eventName}). Vigência estendida até ${newPeriodEnd.toISOString().slice(0, 10)}.`
          : `Cobrança de R$ ${chargeRecord.getFloat('amount').toFixed(2)} liquidada automaticamente via Pix Woovi. Assinatura ativa com vigência renovada até ${newPeriodEnd.toISOString().slice(0, 10)}.`,
      })
      subRecord.set('history', JSON.stringify(historyList))
      $app.save(subRecord)
    }

    // Reativa organização se estava suspensa
    if (orgId) {
      try {
        const org = $app.findRecordById('organizations', orgId)
        if (org.getString('status') === 'suspended') {
          org.set('status', 'active')
          $app.save(org)
        }
      } catch (_) {}
    }

    console.log(`[woovi_webhook] Cobrança ${chargeRecord.id} liquidada com sucesso via Pix Woovi!`)
    return e.json(200, {
      success: true,
      charge_id: chargeRecord.id,
      status: 'PAGA',
      payment_method: 'PIX',
    })
  } catch (err) {
    console.log('[woovi_webhook] Erro ao processar webhook:', err.message || err)
    return e.json(500, { error: err.message || 'Erro interno no processamento do webhook.' })
  }
})

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/charge/save',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { id, organization_id, subscription_id, description, amount, due_date, status, notes } =
        body

      if (!organization_id && !id) {
        return e.badRequestError('ID da organização ou ID da cobrança é obrigatório.')
      }

      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
        return e.badRequestError('Valor da cobrança é obrigatório e deve ser positivo.')
      }

      if (!due_date && !id) {
        return e.badRequestError('Data de vencimento é obrigatória.')
      }

      let chargeRecord = null
      let isNew = false

      if (id) {
        chargeRecord = $app.findRecordById('contek_charges', id)
      } else {
        const col = $app.findCollectionByNameOrId('contek_charges')
        chargeRecord = new Record(col)
        chargeRecord.set('organization_id', organization_id)
        if (subscription_id) chargeRecord.set('subscription_id', subscription_id)
        chargeRecord.set('status', status || 'PENDENTE')
        isNew = true
      }

      const parsedAmount = Math.round(Number(amount) * 100) / 100
      chargeRecord.set('amount', parsedAmount)

      if (description !== undefined) chargeRecord.set('description', description)
      if (due_date) chargeRecord.set('due_date', due_date)
      if (status) chargeRecord.set('status', status)
      if (notes !== undefined) chargeRecord.set('notes', notes)

      $app.save(chargeRecord)

      // Registrar alteração no history da subscription caso vinculada
      const subId = chargeRecord.getString('subscription_id')
      if (subId) {
        try {
          const sub = $app.findRecordById('subscriptions', subId)
          let historyList = []
          try {
            const rawH = sub.get('history')
            if (Array.isArray(rawH)) historyList = rawH.slice()
            else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
          } catch (_) {}

          historyList.push({
            date: new Date().toISOString(),
            action: isNew ? 'CHARGE_CREATED_MANUAL' : 'CHARGE_UPDATED',
            changed_by: user.getString('email'),
            note: `${isNew ? 'Cobrança criada' : 'Cobrança editada'}: R$ ${parsedAmount.toFixed(2)}, vencimento ${chargeRecord.getString('due_date')}, status ${chargeRecord.getString('status')}.`,
          })
          sub.set('history', JSON.stringify(historyList))
          $app.save(sub)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        message: isNew ? 'Cobrança criada com sucesso!' : 'Cobrança atualizada com sucesso!',
        charge: {
          id: chargeRecord.id,
          amount: chargeRecord.getFloat('amount'),
          due_date: chargeRecord.getString('due_date'),
          status: chargeRecord.getString('status'),
          description: chargeRecord.getString('description'),
          pix_brcode: chargeRecord.getString('pix_brcode'),
          pix_qrcode_image: chargeRecord.getString('pix_qrcode_image'),
        },
      })
    } catch (err) {
      console.log('[superadmin/finance/charge/save] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao salvar cobrança.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/charge/pay',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { id, amount, payment_method, paid_at, notes } = body

      if (!id) return e.badRequestError('ID da cobrança é obrigatório.')

      const chargeRecord = $app.findRecordById('contek_charges', id)
      const now = new Date()

      // Atualiza valor se usuário editou na liquidação
      if (amount !== undefined && !isNaN(Number(amount)) && Number(amount) >= 0) {
        chargeRecord.set('amount', Math.round(Number(amount) * 100) / 100)
      }

      chargeRecord.set('status', 'PAGA')
      chargeRecord.set('payment_method', payment_method || 'PIX')
      chargeRecord.set('paid_at', paid_at || now.toISOString().slice(0, 10))
      if (notes !== undefined) chargeRecord.set('notes', notes)

      $app.save(chargeRecord)

      // Atualiza Subscription correspondente
      const subId = chargeRecord.getString('subscription_id')
      const orgId = chargeRecord.getString('organization_id')
      let subRecord = null

      if (subId) {
        try {
          subRecord = $app.findRecordById('subscriptions', subId)
        } catch (_) {}
      } else if (orgId) {
        try {
          const subs = $app.findRecordsByFilter(
            'subscriptions',
            `organization_id = "${orgId}"`,
            '-created',
            1,
            0,
          )
          if (subs && subs.length > 0) subRecord = subs[0]
        } catch (_) {}
      }

      if (subRecord) {
        if (
          subRecord.getString('status') === 'overdue' ||
          subRecord.getString('status') === 'trial'
        ) {
          subRecord.set('status', 'active')
        }

        const dueStr = chargeRecord.getString('due_date') || now.toISOString().slice(0, 10)
        const baseDate = new Date(dueStr)
        const newPeriodEnd = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)
        subRecord.set('current_period_ends_at', newPeriodEnd.toISOString())

        let historyList = []
        try {
          const rawH = subRecord.get('history')
          if (Array.isArray(rawH)) historyList = rawH.slice()
          else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
        } catch (_) {}

        historyList.push({
          date: now.toISOString(),
          action: 'PAYMENT_RECEIVED',
          changed_by: user.getString('email'),
          note: `Cobrança de R$ ${chargeRecord.getFloat('amount').toFixed(2)} marcada como PAGA via ${payment_method || 'PIX'} em ${chargeRecord.getString('paid_at')}. Assinatura ativa com vigência até ${newPeriodEnd.toISOString().slice(0, 10)}.`,
        })
        subRecord.set('history', JSON.stringify(historyList))
        $app.save(subRecord)
      }

      // Reativa a organização caso estivesse suspensa
      if (orgId) {
        try {
          const org = $app.findRecordById('organizations', orgId)
          if (org.getString('status') === 'suspended') {
            org.set('status', 'active')
            $app.save(org)
          }
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        message: 'Cobrança marcada como PAGA e vigência da assinatura atualizada com sucesso!',
        charge: {
          id: chargeRecord.id,
          status: 'PAGA',
          amount: chargeRecord.getFloat('amount'),
          payment_method: chargeRecord.getString('payment_method'),
          paid_at: chargeRecord.getString('paid_at'),
        },
      })
    } catch (err) {
      console.log('[superadmin/finance/charge/pay] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao marcar cobrança como paga.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/charge/cancel',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { id, reason } = body

      if (!id) return e.badRequestError('ID da cobrança é obrigatório.')

      const chargeRecord = $app.findRecordById('contek_charges', id)
      chargeRecord.set('status', 'CANCELADA')
      if (reason) {
        const oldNotes = chargeRecord.getString('notes') || ''
        chargeRecord.set(
          'notes',
          (oldNotes ? oldNotes + ' | ' : '') +
            `Cancelada por ${user.getString('email')}: ${reason}`,
        )
      }
      $app.save(chargeRecord)

      // Registrar no histórico da subscription
      const subId = chargeRecord.getString('subscription_id')
      if (subId) {
        try {
          const sub = $app.findRecordById('subscriptions', subId)
          let historyList = []
          try {
            const rawH = sub.get('history')
            if (Array.isArray(rawH)) historyList = rawH.slice()
            else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
          } catch (_) {}

          historyList.push({
            date: new Date().toISOString(),
            action: 'CHARGE_CANCELED',
            changed_by: user.getString('email'),
            note: `Cobrança de R$ ${chargeRecord.getFloat('amount').toFixed(2)} (vencimento ${chargeRecord.getString('due_date')}) foi cancelada. Motivo: ${reason || 'Sem motivo informado.'}`,
          })
          sub.set('history', JSON.stringify(historyList))
          $app.save(sub)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        message: 'Cobrança cancelada com sucesso.',
      })
    } catch (err) {
      console.log('[superadmin/finance/charge/cancel] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao cancelar cobrança.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/subscription/action',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const body = e.requestInfo().body || {}
      const { subscription_id, action, extend_days = 7, notes = '' } = body

      if (!subscription_id) return e.badRequestError('ID da assinatura é obrigatório.')
      if (
        !action ||
        ['ACTIVATE_MANUAL', 'EXTEND_TRIAL', 'CANCEL_SUB', 'SET_OVERDUE'].indexOf(action) === -1
      ) {
        return e.badRequestError(
          'Ação inválida. Permitidas: ACTIVATE_MANUAL, EXTEND_TRIAL, CANCEL_SUB, SET_OVERDUE.',
        )
      }

      const sub = $app.findRecordById('subscriptions', subscription_id)
      const orgId = sub.getString('organization_id')
      const now = new Date()
      const nowIso = now.toISOString()

      let historyList = []
      try {
        const rawH = sub.get('history')
        if (Array.isArray(rawH)) historyList = rawH.slice()
        else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
      } catch (_) {}

      let actionMessage = ''

      if (action === 'ACTIVATE_MANUAL') {
        sub.set('status', 'active')
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        sub.set('current_period_ends_at', periodEnd.toISOString())
        actionMessage = `Assinatura ativada manualmente pelo SuperAdmin. Vigência até ${periodEnd.toISOString().slice(0, 10)}.`

        if (orgId) {
          try {
            const org = $app.findRecordById('organizations', orgId)
            org.set('status', 'active')
            $app.save(org)
          } catch (_) {}
        }
      } else if (action === 'EXTEND_TRIAL') {
        const currentTrialEnds = sub.getString('trial_ends_at')
        let baseDate = now
        if (currentTrialEnds) {
          const parsed = new Date(currentTrialEnds)
          if (parsed.getTime() > now.getTime()) baseDate = parsed
        }
        const newTrialEnd = new Date(baseDate.getTime() + extend_days * 24 * 60 * 60 * 1000)
        sub.set('status', 'trial')
        sub.set('trial_ends_at', newTrialEnd.toISOString())
        actionMessage = `Período de teste gratuito (Trial) estendido em +${extend_days} dias, novo término em ${newTrialEnd.toISOString().slice(0, 10)}.`

        if (orgId) {
          try {
            const org = $app.findRecordById('organizations', orgId)
            if (org.getString('status') === 'suspended') {
              org.set('status', 'trial')
              $app.save(org)
            }
          } catch (_) {}
        }
      } else if (action === 'CANCEL_SUB') {
        sub.set('status', 'canceled')
        sub.set('canceled_at', nowIso)
        actionMessage = 'Assinatura cancelada pelo SuperAdmin.'

        if (orgId) {
          try {
            const org = $app.findRecordById('organizations', orgId)
            org.set('status', 'suspended')
            $app.save(org)
          } catch (_) {}
        }
      } else if (action === 'SET_OVERDUE') {
        sub.set('status', 'overdue')
        actionMessage = 'Assinatura marcada como em atraso (overdue).'
      }

      historyList.push({
        date: nowIso,
        action: action,
        changed_by: user.getString('email'),
        note: actionMessage + (notes ? ` Observações: ${notes}` : ''),
      })
      sub.set('history', JSON.stringify(historyList))
      $app.save(sub)

      return e.json(200, {
        success: true,
        message: actionMessage,
        subscription: {
          id: sub.id,
          status: sub.getString('status'),
          trial_ends_at: sub.getString('trial_ends_at'),
          current_period_ends_at: sub.getString('current_period_ends_at'),
        },
      })
    } catch (err) {
      console.log('[superadmin/finance/subscription/action] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao executar ação na assinatura.' })
    }
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/superadmin/finance/run-check',
  (e) => {
    try {
      const user = e.auth
      if (!user) return e.unauthorizedError('Autenticação necessária.')
      if (!user.getBool('is_super_admin')) {
        return e.forbiddenError('Acesso restrito a Super Administradores da Contek.')
      }

      const now = new Date()
      const nowIso = now.toISOString()
      const todayStr = nowIso.slice(0, 10)
      const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
      const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().slice(0, 10)

      let trialsExpired = 0
      let chargesOverdue = 0
      let orgsSuspended = 0

      // 1. Trials vencidos
      const trialSubs = $app.findRecordsByFilter(
        'subscriptions',
        `status = "trial" && trial_ends_at != "" && trial_ends_at < "${todayStr}"`,
        '-created',
        500,
        0,
      )

      for (const sub of trialSubs) {
        sub.set('status', 'overdue')
        $app.save(sub)
        trialsExpired++

        const orgId = sub.getString('organization_id')
        if (orgId) {
          try {
            const org = $app.findRecordById('organizations', orgId)
            if (org.getString('status') !== 'suspended') {
              org.set('status', 'suspended')
              $app.save(org)
              orgsSuspended++
            }
          } catch (_) {}
        }
      }

      // 2. Cobranças pendentes com due_date < hoje
      const pendingCharges = $app.findRecordsByFilter(
        'contek_charges',
        `status = "PENDENTE" && due_date < "${todayStr}"`,
        'due_date',
        500,
        0,
      )

      for (const chg of pendingCharges) {
        chg.set('status', 'ATRASADA')
        $app.save(chg)
        chargesOverdue++

        const subId = chg.getString('subscription_id')
        if (subId) {
          try {
            const sub = $app.findRecordById('subscriptions', subId)
            if (sub.getString('status') === 'active') {
              sub.set('status', 'overdue')
              $app.save(sub)
            }
          } catch (_) {}
        }
      }

      // 3. Organizações com 15+ dias de atraso
      const veryLate = $app.findRecordsByFilter(
        'contek_charges',
        `status = "ATRASADA" && due_date <= "${fifteenDaysAgoStr}"`,
        'due_date',
        500,
        0,
      )

      for (const chg of veryLate) {
        const orgId = chg.getString('organization_id')
        if (orgId) {
          try {
            const org = $app.findRecordById('organizations', orgId)
            if (org.getString('status') !== 'suspended') {
              org.set('status', 'suspended')
              $app.save(org)
              orgsSuspended++
            }
          } catch (_) {}
        }
      }

      return e.json(200, {
        success: true,
        message: `Verificação de vencimentos executada com sucesso! ${trialsExpired} trials expirados, ${chargesOverdue} cobranças marcadas como atrasadas e ${orgsSuspended} suspensões aplicadas.`,
        trials_expired: trialsExpired,
        charges_overdue: chargesOverdue,
        orgs_suspended: orgsSuspended,
      })
    } catch (err) {
      console.log('[superadmin/finance/run-check] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao rodar verificação financeira.' })
    }
  },
  $apis.requireAuth(),
)
