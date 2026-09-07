/// <reference path="../pb_data/types.d.ts" />

/**
 * Endpoints financeiros exclusivos do SuperAdmin da Contek.
 * Todas as rotas requerem is_super_admin = true.
 *
 * GET  /backend/v1/superadmin/finance/overview
 * POST /backend/v1/superadmin/finance/generate-month
 * POST /backend/v1/superadmin/finance/charge/save (criar ou editar valor, descrição, vencimento, notas)
 * POST /backend/v1/superadmin/finance/charge/pay (marcar como paga)
 * POST /backend/v1/superadmin/finance/charge/cancel (cancelar cobrança)
 * POST /backend/v1/superadmin/finance/subscription/action (ativar manual, estender trial, cancelar)
 * POST /backend/v1/superadmin/finance/run-check (executa manualmente o sweep de vencimentos)
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
          created: c.getString('created'),
          updated: c.getString('updated'),
        })
      }

      // 5. Métricas de Resumo
      // Receita mensal esperada: soma das mensalidades das assinaturas ativas
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

      // Mês corrente (ex.: 2026-09)
      const now = new Date()
      const currentYearMonth = now.toISOString().slice(0, 7) // YYYY-MM

      let receivedThisMonth = 0
      let overdueChargesAmount = 0
      let pendingChargesAmount = 0

      for (const c of chargesList) {
        const dueYm = (c.due_date || '').slice(0, 7)
        const paidYm = (c.paid_at || '').slice(0, 7)

        if (c.status === 'PAGA') {
          // Se foi paga neste mês ou seu vencimento era deste mês
          if (paidYm === currentYearMonth || (!c.paid_at && dueYm === currentYearMonth)) {
            receivedThisMonth += c.amount
          }
        } else if (c.status === 'ATRASADA') {
          overdueChargesAmount += c.amount
        } else if (c.status === 'PENDENTE') {
          pendingChargesAmount += c.amount
        }
      }

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
      // target_month opcional no formato YYYY-MM. Se não enviado, usa o mês corrente.
      const now = new Date()
      const targetYearMonth = body.target_month || now.toISOString().slice(0, 7) // YYYY-MM
      const [yearStr, monthStr] = targetYearMonth.split('-')
      const targetYear = parseInt(yearStr, 10)
      const targetMonth = parseInt(monthStr, 10) // 1-12

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

      let createdCount = 0
      let updatedCount = 0
      let skippedCount = 0
      const generatedCharges = []

      for (const sub of activeSubs) {
        const orgId = sub.getString('organization_id')
        const planId = sub.getString('plan_id')
        const planInfo = plansMap[planId] || { name: 'Mensalidade', price: 0, product: 'agyli' }

        // Resolver dia do aniversário a partir de starts_at (ou created da sub)
        const startsAtRaw =
          sub.getString('starts_at') || sub.getString('created') || now.toISOString()
        const startsAtDate = new Date(startsAtRaw)
        let anniversaryDay = startsAtDate.getUTCDate()
        if (isNaN(anniversaryDay) || anniversaryDay < 1) anniversaryDay = 10

        // Calcular dia máximo válido no mês alvo (ex.: evitar 31 de fevereiro)
        const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
        const effectiveDay = Math.min(anniversaryDay, daysInTargetMonth)

        // Data de vencimento no formato YYYY-MM-DD
        const monthPad = String(targetMonth).padStart(2, '0')
        const dayPad = String(effectiveDay).padStart(2, '0')
        const dueDateStr = `${targetYear}-${monthPad}-${dayPad}`
        const dueDateObj = new Date(Date.UTC(targetYear, targetMonth - 1, effectiveDay, 23, 59, 59))

        // current_period_ends_at (+30 dias após o vencimento)
        const periodEndDate = new Date(dueDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)
        const periodEndDateIso = periodEndDate.toISOString()

        // Verificar se já existe cobrança para esta org/sub neste mês de vencimento
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
          // Já existe cobrança neste mês. Apenas atualiza vigência se necessário
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
          $app.save(chargeRecord)
          createdCount++
        }

        // Atualizar current_period_ends_at na assinatura
        sub.set('current_period_ends_at', periodEndDateIso)

        // Se o vencimento já passou e a cobrança é ATRASADA, mudar status da assinatura para overdue
        if (chargeRecord.getString('status') === 'ATRASADA') {
          sub.set('status', 'overdue')

          // Verificar atraso >= 15 dias para suspender organização
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

        historyList.push({
          date: now.toISOString(),
          action: 'GENERATE_MONTH_CHARGE',
          changed_by: user.getString('email'),
          note: `Cobrança do mês ${monthPad}/${targetYear} processada. Vencimento: ${dueDateStr}, Valor: R$ ${planInfo.price.toFixed(2)}. Nova vigência até ${periodEndDateIso.slice(0, 10)}.`,
        })
        sub.set('history', JSON.stringify(historyList))

        $app.save(sub)

        generatedCharges.push({
          id: chargeRecord.id,
          organization_id: orgId,
          amount: chargeRecord.getFloat('amount'),
          due_date: chargeRecord.getString('due_date'),
          status: chargeRecord.getString('status'),
        })
      }

      return e.json(200, {
        success: true,
        message: `Geração de cobranças de ${targetYearMonth} concluída: ${createdCount} criadas, ${skippedCount} já existentes.`,
        target_month: targetYearMonth,
        created_count: createdCount,
        skipped_count: skippedCount,
        total_active_subs: activeSubs.length,
      })
    } catch (err) {
      console.log('[superadmin/finance/generate-month] error:', err.message || err)
      return e.json(500, { error: err.message || 'Erro ao gerar cobranças do mês.' })
    }
  },
  $apis.requireAuth(),
)

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
        // Se a assinatura estava overdue, reativa para 'active'
        if (
          subRecord.getString('status') === 'overdue' ||
          subRecord.getString('status') === 'trial'
        ) {
          subRecord.set('status', 'active')
        }

        // Estende current_period_ends_at para +30 dias da data de vencimento da cobrança (ou de hoje)
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
        // Define vigência para +30 dias a partir de agora se estiver vazia
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        sub.set('current_period_ends_at', periodEnd.toISOString())
        actionMessage = `Assinatura ativada manualmente pelo SuperAdmin. Vigência até ${periodEnd.toISOString().slice(0, 10)}.`

        // Garantir que a organização esteja active
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

        // Se a org estava suspended, reativa para trial
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

        // Suspender organização
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
