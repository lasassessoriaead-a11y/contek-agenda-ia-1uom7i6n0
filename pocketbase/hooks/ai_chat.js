/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'POST',
  '/backend/v1/ai-chat',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const userRecord = e.auth
      const userId = userRecord?.id
      if (!userId || !userRecord) return e.unauthorizedError('Autenticação necessária.')
      if (!body.message?.trim()) return e.badRequestError('Mensagem é obrigatória.')

      // 1. Resolve organization_id strictly server-side from authenticated user record
      let orgId = userRecord.getString('organization_id')
      if (!orgId) {
        try {
          const orgUser = $app.findFirstRecordByData('organization_users', 'user_id', userId)
          if (orgUser) {
            orgId = orgUser.getString('organization_id')
          }
        } catch (_) {}
      }

      if (!orgId) {
        return e.badRequestError('Organização não identificada para este usuário.')
      }

      // 2. Fetch organization info
      let orgName = 'Minha Empresa'
      let orgSlug = ''
      try {
        const orgRecord = $app.findRecordById('organizations', orgId)
        orgName = orgRecord.getString('name') || 'Minha Empresa'
        orgSlug = orgRecord.getString('slug') || ''
      } catch (_) {}

      // 3. Query tenant data with STRICT filter organization_id = orgId
      const clients = $app.findRecordsByFilter(
        'clients',
        'organization_id = "' + orgId + '"',
        '-created',
        100,
        0,
      )

      const appointments = $app.findRecordsByFilter(
        'appointments',
        'organization_id = "' + orgId + '"',
        '-date,-start_time',
        100,
        0,
      )

      const services = $app.findRecordsByFilter(
        'services',
        'organization_id = "' + orgId + '"',
        'name',
        50,
        0,
      )

      const payments = $app.findRecordsByFilter(
        'payments',
        'organization_id = "' + orgId + '"',
        '-created',
        100,
        0,
      )

      const professionals = $app.findRecordsByFilter(
        'professionals',
        'organization_id = "' + orgId + '"',
        'name',
        50,
        0,
      )

      // 4. Compute summaries strictly for this tenant
      const clientCount = clients.length
      const clientMap = {}
      for (const c of clients) {
        clientMap[c.id] = c.getString('name')
      }

      const clientApptCounts = {}
      let totalAppointments = appointments.length
      let confirmedCount = 0
      let completedCount = 0
      let cancelledCount = 0
      let missedCount = 0

      for (const a of appointments) {
        const cId = a.getString('client_id')
        const snapName = a.getString('client_name_snapshot')
        const name = cId && clientMap[cId] ? clientMap[cId] : snapName || 'Cliente'
        clientApptCounts[name] = (clientApptCounts[name] || 0) + 1

        const st = a.getString('status')
        if (st === 'CONFIRMADO') confirmedCount++
        else if (st === 'CONCLUÍDO') completedCount++
        else if (st === 'CANCELADO') cancelledCount++
        else if (st === 'FALTOU') missedCount++
      }

      const frequentClients = Object.keys(clientApptCounts)
        .map((name) => {
          return { name: name, count: clientApptCounts[name] }
        })
        .sort((a, b) => b.count - a.count)

      const invalidApptIds = {}
      for (const a of appointments) {
        const st = a.getString('status')
        if (st === 'CANCELADO' || st === 'FALTOU') {
          invalidApptIds[a.id] = true
        }
      }

      let totalRevenue = 0
      let paidPaymentsCount = 0
      for (const p of payments) {
        const pApptId = p.getString('appointment_id')
        if (pApptId && invalidApptIds[pApptId]) {
          continue
        }
        if (p.getBool('is_paid')) {
          totalRevenue += p.getInt('amount') || 0
          paidPaymentsCount++
        }
      }

      const serviceNames = services.map((s) => {
        return s.getString('name') + ' (R$ ' + s.getInt('price') + ')'
      })

      const profNames = professionals.map((pr) => {
        const pName = pr.getString('name')
        const spec = pr.getString('specialty')
        return spec ? `${pName} (${spec})` : pName
      })

      const clientListSample = clients.slice(0, 15).map((c) => {
        const p = c.getString('phone') || c.getString('whatsapp') || ''
        return c.getString('name') + (p ? ' (' + p + ')' : '')
      })

      // Build isolated organization context block
      let tenantContext = '[DADOS REAIS E EXCLUSIVOS DA ORGANIZAÇÃO DO USUÁRIO LOGADO]\n'
      tenantContext += 'Empresa: ' + orgName + ' (slug: ' + orgSlug + ')\n'
      tenantContext += 'Total de clientes cadastrados: ' + clientCount + '\n'
      if (clientCount === 0) {
        tenantContext += 'Lista de clientes: NENHUM cliente cadastrado nesta organização ainda.\n'
      } else {
        tenantContext += 'Clientes cadastrados: ' + clientListSample.join(', ') + '\n'
      }

      if (frequentClients.length > 0) {
        tenantContext +=
          'Clientes com mais atendimentos/agendamentos na empresa: ' +
          frequentClients
            .slice(0, 5)
            .map((f) => f.name + ' (' + f.count + ' agendamento(s))')
            .join(', ') +
          '\n'
      } else {
        tenantContext +=
          'Clientes mais frequentes: NENHUM histórico de agendamento por clientes ainda.\n'
      }

      tenantContext +=
        'Agendamentos totais: ' +
        totalAppointments +
        ' (Concluídos: ' +
        completedCount +
        ', Confirmados: ' +
        confirmedCount +
        ', Faltas: ' +
        missedCount +
        ', Cancelados: ' +
        cancelledCount +
        ')\n'
      tenantContext +=
        'Faturamento total pago: R$ ' +
        totalRevenue.toFixed(2) +
        ' (' +
        paidPaymentsCount +
        ' pagamentos confirmados)\n'
      tenantContext +=
        'Serviços cadastrados: ' + (serviceNames.length ? serviceNames.join(', ') : 'Nenhum') + '\n'
      tenantContext +=
        'Profissionais cadastrados no sistema: ' +
        (profNames.length ? profNames.join(', ') : 'Nenhum') +
        '\n'
      tenantContext +=
        'AVISO DO SISTEMA: Para adicionar novos profissionais, serviços ou clientes no banco de dados, o usuário deve utilizar os respectivos menus na plataforma. Você não deve simular ou prometer que executou cadastros diretamente.\n'
      tenantContext += '[FIM DOS DADOS DA ORGANIZAÇÃO]\n\n'
      tenantContext += 'Pergunta do usuário: ' + body.message.trim()

      console.log(
        '[AI CHAT] Processing chat for user=' +
          userId +
          ', org=' +
          orgName +
          ' (' +
          orgId +
          '), clients=' +
          clientCount +
          ', appts=' +
          totalAppointments,
      )

      const result = $ai.agent('contek-assistant').chat({
        user_id: userId,
        conversation_id: body.conversation_id || null,
        message: tenantContext,
      })

      console.log(
        '[AI CHAT REPLY SUCCESS] org=' +
          orgName +
          ' response_preview=' +
          (result.content ? result.content.slice(0, 100) : 'empty'),
      )

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: result.content,
        citations: result.citations,
        message_id: result.message_id,
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Assistente IA temporariamente indisponível.' })
      }
      if (err instanceof SkipAiAgentsError) {
        const status = err.status || 500
        return e.json(status, {
          error: status >= 500 ? 'Falha na solicitação do assistente' : err.message,
        })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, {
          error: status >= 500 ? 'IA temporariamente indisponível' : err.message,
        })
      }
      return e.json(500, { error: err.message || 'Erro interno ao processar chat com IA.' })
    }
  },
  $apis.requireAuth(),
)
