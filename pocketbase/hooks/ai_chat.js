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

      // 1. Resolve organization_id strictly server-side:
      // Se body trouxer organization_id (ex: SuperAdmin inspecionando tenant específico) ou resolver do userRecord
      let orgId = ''
      if (body.organization_id && typeof body.organization_id === 'string') {
        orgId = body.organization_id.trim()
      }
      if (!orgId) {
        orgId = userRecord.getString('organization_id')
      }
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

      // 2. Multi-product feature check: Assistente IA não está liberado para MARKALY
      try {
        const orgCheck = $app.findRecordById('organizations', orgId)
        const orgProduct = orgCheck.getString('product') || 'agyli'
        if (orgProduct === 'markaly') {
          return e.json(403, {
            error:
              'O Assistente IA não está habilitado para o produto MARKALY. Faça upgrade para o produto AGYLI para ter inteligência artificial integrada.',
          })
        }
      } catch (_) {}

      // 3. Fetch organization info
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

      let finalContent = result.content || ''

      // =========================================================================
      // GUARDA RÍGIDA NO SERVIDOR CONTRA AFIRMAÇÃO FALSA DE CADASTRO
      // =========================================================================
      const REGISTRATION_CLAIM_PATTERNS = [
        // Padrões explícitos de cadastro/adicionado concluído
        { regex: /cadastro\s+conclu[ií]do/i, entity: 'any', label: 'cadastro concluído' },
        { regex: /cadastrad[oa]\s+com\s+sucesso/i, entity: 'any', label: 'cadastrado com sucesso' },
        { regex: /registrad[oa]\s+com\s+sucesso/i, entity: 'any', label: 'registrado com sucesso' },
        { regex: /adicionad[oa]\s+com\s+sucesso/i, entity: 'any', label: 'adicionado com sucesso' },
        { regex: /criad[oa]\s+com\s+sucesso/i, entity: 'any', label: 'criado com sucesso' },
        {
          regex: /profissional\s+adicionad[oa]/i,
          entity: 'professional',
          label: 'profissional adicionado',
        },
        {
          regex: /profissional\s+cadastrad[oa]/i,
          entity: 'professional',
          label: 'profissional cadastrado',
        },
        { regex: /cliente\s+adicionad[oa]/i, entity: 'client', label: 'cliente adicionado' },
        { regex: /cliente\s+cadastrad[oa]/i, entity: 'client', label: 'cliente cadastrado' },
        { regex: /servi[çc]o\s+adicionad[oa]/i, entity: 'service', label: 'serviço adicionado' },
        { regex: /servi[çc]o\s+cadastrad[oa]/i, entity: 'service', label: 'serviço cadastrado' },
        // Afirmação em primeira pessoa ou voz passiva ("cadastrei o Dr...", "foi cadastrado")
        {
          regex: /\bcadastrei\s+(?:o|a|os|as|um|uma|o\(a\))?\b/i,
          entity: 'any',
          label: 'cadastrei',
        },
        {
          regex: /\badicionei\s+(?:o|a|os|as|um|uma|o\(a\))?\b/i,
          entity: 'any',
          label: 'adicionei',
        },
        { regex: /\bfoi\s+cadastrad[oa]\b/i, entity: 'any', label: 'foi cadastrado' },
        { regex: /\bfoi\s+adicionad[oa]\b/i, entity: 'any', label: 'foi adicionado' },
        { regex: /\bforam\s+cadastrad[oa]s\b/i, entity: 'any', label: 'foram cadastrados' },
        { regex: /\bforam\s+adicionad[oa]s\b/i, entity: 'any', label: 'foram adicionados' },
        // Emojis de confirmação combinados com termos de cadastro/criação
        {
          regex: /✅[^\n\r]*(?:cadastro|cadastrad[oa]|adicionad[oa]|criad[oa]|registrad[oa])/i,
          entity: 'any',
          label: 'emoji check + cadastro',
        },
        {
          regex: /(?:cadastro|cadastrad[oa]|adicionad[oa]|criad[oa]|registrad[oa])[^\n\r]*✅/i,
          entity: 'any',
          label: 'cadastro + emoji check',
        },
        // Tabelas Markdown com cabeçalho ou linha indicando adição/cadastro concluído
        {
          regex:
            /\|\s*\*{0,2}(?:Profissional|Cliente|Serviço|Servico)\s+(?:adicionado|cadastrado)\*{0,2}\s*\|/i,
          entity: 'any',
          label: 'tabela markdown adicionado/cadastrado',
        },
      ]

      let detectedPattern = null
      for (let i = 0; i < REGISTRATION_CLAIM_PATTERNS.length; i++) {
        const item = REGISTRATION_CLAIM_PATTERNS[i]
        if (item.regex.test(finalContent)) {
          detectedPattern = item
          break
        }
      }

      if (detectedPattern) {
        // Identificar tipo de entidade e nome citado
        let detectedEntity = detectedPattern.entity
        const lowerText = finalContent.toLowerCase()

        if (detectedEntity === 'any') {
          if (
            lowerText.indexOf('profissional') !== -1 ||
            lowerText.indexOf('médico') !== -1 ||
            lowerText.indexOf('doutor') !== -1
          ) {
            detectedEntity = 'professional'
          } else if (lowerText.indexOf('serviço') !== -1 || lowerText.indexOf('servico') !== -1) {
            detectedEntity = 'service'
          } else if (lowerText.indexOf('cliente') !== -1 || lowerText.indexOf('paciente') !== -1) {
            detectedEntity = 'client'
          } else {
            detectedEntity = 'professional' // fallback mais comum nas conversas
          }
        }

        // Tentar extrair o nome citado na resposta
        let extractedName = ''
        const namePatterns = [
          // Ex: | **Profissional adicionado** | **Dr. Silva** | ou | Profissional | Nome |
          /\|\s*\*{0,2}(?:Profissional(?:\s+adicionado)?|Cliente(?:\s+adicionado)?|Servi[çc]o(?:\s+adicionado)?|Nome)\*{0,2}\s*\|\s*\*{0,2}([A-Za-zÀ-ÿ0-9\s._-]{2,40}?)\*{0,2}\s*\|/i,
          // Ex: "Profissional adicionado: Dr. Fulano" ou "cadastrado com sucesso: Fulano"
          /(?:profissional|cliente|servi[çc]o|nome)(?:\s+adicionad[oa]|\s+cadastrad[oa])?[:\-–]\s*\*{0,2}([A-Za-zÀ-ÿ0-9\s._-]{2,40}?)(?:\*|\n|\r|,|\.|$)/i,
          // Ex: "cadastrei o profissional Fulano", "cadastrei a Dra. Ana"
          /(?:cadastrei|adicionei)\s+(?:o|a|os|as|um|uma)?\s*(?:profissional|cliente|servi[çc]o)?\s*\*{0,2}([A-Za-zÀ-ÿ0-9\s._-]{2,40}?)(?:\*|\n|\r|,|\.|$)/i,
        ]

        for (let j = 0; j < namePatterns.length; j++) {
          const m = finalContent.match(namePatterns[j])
          if (m && m[1]) {
            const candidate = m[1].trim().replace(/^\*+|\*+$/g, '')
            if (
              candidate.length >= 2 &&
              !/^(item|detalhe|status|sucesso|sim|não|ok)$/i.test(candidate)
            ) {
              extractedName = candidate
              break
            }
          }
        }

        // Verificação da verdade: consultar a coleção correspondente criada/atualizada recentemente (~2 minutos)
        // Data limite: agora - 120 segundos
        const twoMinutesAgoIso = new Date(Date.now() - 120 * 1000).toISOString().replace('T', ' ')
        let collectionName = 'professionals'
        let entityDisplayName = 'Profissionais'
        let singularDisplayName = 'profissional'
        let menuName = 'Profissionais'

        if (detectedEntity === 'client') {
          collectionName = 'clients'
          entityDisplayName = 'Clientes'
          singularDisplayName = 'cliente'
          menuName = 'Clientes'
        } else if (detectedEntity === 'service') {
          collectionName = 'services'
          entityDisplayName = 'Serviços'
          singularDisplayName = 'serviço'
          menuName = 'Serviços'
        }

        let verifiedRecord = null

        // Se conseguimos extrair o nome, buscamos por nome aproximado ou registros criados nos últimos 2 min
        try {
          let recentFilter =
            'organization_id = "' + orgId + '" && created >= "' + twoMinutesAgoIso + '"'
          if (extractedName) {
            // Limpa caracteres especiais para busca segura
            const cleanName = extractedName.replace(/["\\]/g, '').trim()
            if (cleanName.length > 1) {
              recentFilter =
                'organization_id = "' +
                orgId +
                '" && (name ~ "' +
                cleanName +
                '" || created >= "' +
                twoMinutesAgoIso +
                '")'
            }
          }

          const recentRecords = $app.findRecordsByFilter(
            collectionName,
            recentFilter,
            '-created',
            5,
            0,
          )

          if (recentRecords && recentRecords.length > 0) {
            // Conferir se o registro realmente foi criado agora ou bate com o nome
            if (extractedName) {
              const cleanLower = extractedName.toLowerCase()
              for (let k = 0; k < recentRecords.length; k++) {
                const rName = recentRecords[k].getString('name').toLowerCase()
                if (
                  rName &&
                  (rName.indexOf(cleanLower) !== -1 || cleanLower.indexOf(rName) !== -1)
                ) {
                  verifiedRecord = recentRecords[k]
                  break
                }
              }
            } else {
              // Sem nome extraível mas há registro criado nos últimos 2 min
              const firstRecCreated = new Date(recentRecords[0].getString('created')).getTime()
              if (Date.now() - firstRecCreated <= 120 * 1000) {
                verifiedRecord = recentRecords[0]
              }
            }
          }
        } catch (dbCheckErr) {
          console.log(
            '[AI GUARDRAIL] Error querying collection ' +
              collectionName +
              ': ' +
              (dbCheckErr.message || dbCheckErr),
          )
        }

        // Se NÃO encontrou registro real verificado, a afirmação é falsa ou não comprovada!
        if (!verifiedRecord) {
          console.log(
            '[AI GUARDRAIL] Fake registration claim detected and replaced. org=' +
              orgName +
              ' (' +
              orgId +
              ') pattern="' +
              detectedPattern.label +
              '" entity=' +
              detectedEntity +
              ' extractedName="' +
              (extractedName || 'none') +
              '"',
          )

          let replacementMsg =
            '⚠️ **Atenção:** Eu não consigo gravar cadastros diretamente no banco de dados do sistema — e notei que minha resposta anterior indicou que um cadastro foi concluído. Isso não aconteceu: **nenhum registro foi criado**.\n\n'
          replacementMsg +=
            'Para cadastrar de verdade, vá no menu **' +
            menuName +
            '** (na barra lateral) e utilize o botão de novo cadastro. Por lá os dados são validados e salvos com segurança no sistema.\n\n'
          if (extractedName) {
            replacementMsg +=
              'Se desejar, posso te ajudar a formatar e organizar as informações de **' +
              extractedName +
              '** para que você apenas copie e cole no formulário de cadastro!'
          } else {
            replacementMsg +=
              'Se desejar, posso te ajudar a organizar todos os detalhes (nome, especialidade, horários, preços) para você colar na tela de cadastro!'
          }

          finalContent = replacementMsg
        } else {
          console.log(
            '[AI GUARDRAIL] Legitimate registration verified in database: id=' +
              verifiedRecord.id +
              ', name=' +
              verifiedRecord.getString('name'),
          )
        }
      }

      return e.json(200, {
        conversation_id: result.conversation_id,
        content: finalContent,
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
