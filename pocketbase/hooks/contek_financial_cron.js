/// <reference path="../pb_data/types.d.ts" />

/**
 * Cron diário para automação financeira da Contek:
 * Executa todos os dias às 03:00 UTC (00:00 Horário de Brasília)
 *
 * 1. Cobrança Automática Mensal (Pix Automático / Pix Recorrente):
 *    Verifica assinaturas ativas cujo ciclo mensal está vencendo ou iniciando hoje/neste mês.
 *    - Não duplica se já existir cobrança criada para o mês.
 *    - Se a assinatura possui Pix Automático ATIVO (`recurring_status = 'ACTIVE'`),
 *      marca a origem como automática ("Débito recorrente Pix Automático Woovi").
 *    - Se não inscrita ou pendente, gera cobrança Pix avulsa (QR Code + Copia e Cola) via Woovi.
 *
 * 2. Verificar trials vencidos:
 *    Se trial_ends_at < hoje (UTC/dia atual) e status da assinatura ainda for 'trial':
 *    - Atualiza assinatura para 'overdue'
 *    - Atualiza organização para 'suspended'
 *    - Registra no history da assinatura
 *
 * 3. Marcar cobranças vencidas como ATRASADA:
 *    Para cobranças com status 'PENDENTE' cujo due_date < hoje (data sem hora):
 *    - Atualiza status da cobrança para 'ATRASADA'
 *    - Atualiza assinatura correspondente para 'overdue' (se ainda não cancelada)
 *
 * 4. Suspender organizações com 15+ dias de atraso:
 *    Se houver cobrança ATRASADA com due_date <= hoje - 15 dias:
 *    - Atualiza organização para 'suspended'
 *    - Atualiza assinatura para 'overdue'
 *    - Registra no history da assinatura
 */
cronAdd('contek_financial_daily_check', '0 3 * * *', () => {
  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const todayStr = nowIso.slice(0, 10) // YYYY-MM-DD
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth() + 1
    const currentDay = now.getUTCDate()
    const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`

    // 15 dias atrás
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().slice(0, 10)

    console.log(`[contek_financial_cron] Iniciando rotina diária em ${todayStr}`)

    // ----------------------------------------------------
    // 0. COBRANÇA AUTOMÁTICA MENSAL (PIX AUTOMÁTICO / PIX RECORRENTE)
    // ----------------------------------------------------
    try {
      const activeSubs = $app.findRecordsByFilter(
        'subscriptions',
        'status = "active"',
        'created',
        500,
        0,
      )

      // Carregar planos para preços
      const plans = $app.findRecordsByFilter('plans', '1=1', 'name', 100, 0)
      const plansMap = {}
      for (const p of plans) {
        plansMap[p.id] = {
          name: p.getString('name'),
          price: p.getFloat('price_monthly') || 0,
        }
      }

      // Normalizar chave Woovi
      let wooviKey = ($os.getenv('WOOVI_APP_ID') || '').trim()
      if (wooviKey && wooviKey.length % 4 !== 0) {
        const padNeeded = 4 - (wooviKey.length % 4)
        for (let i = 0; i < padNeeded; i++) wooviKey += '='
      }

      const chargesCol = $app.findCollectionByNameOrId('contek_charges')
      const daysInCurrentMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate()
      const monthPad = String(currentMonth).padStart(2, '0')

      for (const sub of activeSubs) {
        try {
          const orgId = sub.getString('organization_id')
          const planId = sub.getString('plan_id')
          const planInfo = plansMap[planId] || { name: 'Mensalidade Contek', price: 29.9 }

          // Verificar dia de vencimento (aniversário da assinatura)
          const startsAtRaw = sub.getString('starts_at') || sub.getString('created') || nowIso
          const startsAtDate = new Date(startsAtRaw)
          let anniversaryDay = startsAtDate.getUTCDate()
          if (isNaN(anniversaryDay) || anniversaryDay < 1) anniversaryDay = 10
          const effectiveDay = Math.min(anniversaryDay, daysInCurrentMonth)
          const dayPad = String(effectiveDay).padStart(2, '0')
          const dueDateStr = `${currentYear}-${monthPad}-${dayPad}`

          // NÃO DUPLICAR: Checar se já existe cobrança gerada para a organização neste mês
          const existing = $app.findRecordsByFilter(
            'contek_charges',
            `organization_id = "${orgId}" && due_date >= "${currentYear}-${monthPad}-01" && due_date <= "${currentYear}-${monthPad}-${daysInCurrentMonth}"`,
            '-created',
            1,
            0,
          )

          if (existing && existing.length > 0) {
            // Cobrança já existe para este mês — skip idempotente
            continue
          }

          // Se faltam 5 dias ou menos para o vencimento, ou se hoje é o dia / já passou, gera a cobrança
          if (currentDay >= effectiveDay - 5) {
            let org = null
            try {
              org = $app.findRecordById('organizations', orgId)
            } catch (_) {}
            const orgName = org ? org.getString('name') : 'Empresa Contek'
            const orgEmail = org ? org.getString('email') : ''
            const orgPhone = org ? org.getString('phone') : ''

            const recStatus = sub.getString('recurring_status') || 'NOT_ENROLLED'
            const isPixAutoActive = recStatus === 'ACTIVE'

            const chargeRecord = new Record(chargesCol)
            chargeRecord.set('organization_id', orgId)
            chargeRecord.set('subscription_id', sub.id)
            chargeRecord.set(
              'description',
              `Mensalidade ${planInfo.name} - Ref. ${monthPad}/${currentYear}`,
            )
            chargeRecord.set('amount', planInfo.price)
            chargeRecord.set('due_date', dueDateStr)
            chargeRecord.set('status', 'PENDENTE')
            chargeRecord.set(
              'notes',
              isPixAutoActive
                ? `Cobrança mensal gerada automaticamente via Pix Automático Woovi (débito programado para ${dueDateStr}). Origem: automática.`
                : `Cobrança mensal gerada automaticamente pelo sistema Contek. Origem: automática.`,
            )

            const correlationId = `contek-cron-${chargeRecord.id || $security.randomString(16)}-${currentYearMonth}`
            chargeRecord.set('correlation_id', correlationId)

            // Criar Pix via Woovi se houver chave e valor > 0
            const chargeValueCents = Math.round(planInfo.price * 100)
            if (wooviKey && chargeValueCents > 0) {
              try {
                const wooviPayload = {
                  correlationID: correlationId,
                  value: chargeValueCents,
                  comment: `${orgName} - Ref. ${monthPad}/${currentYear}`.slice(0, 140),
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
                }
              } catch (errPix) {
                console.log(
                  `[contek_financial_cron] Falha ao comunicar com Woovi para org ${orgId}:`,
                  errPix,
                )
              }
            }

            $app.save(chargeRecord)

            // Registrar no histórico da assinatura
            let historyList = []
            try {
              const rawH = sub.get('history')
              if (Array.isArray(rawH)) historyList = rawH.slice()
              else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
            } catch (_) {}

            historyList.push({
              date: nowIso,
              action: 'MONTHLY_CHARGE_AUTOMATIC',
              changed_by: 'CRON_AUTOMATION',
              note: `Cobrança mensal de R$ ${planInfo.price.toFixed(2)} (vencimento ${dueDateStr}) gerada automaticamente. ${isPixAutoActive ? 'Canal: Pix Automático ativo.' : 'Canal: Pix mensal comum.'}`,
            })
            sub.set('history', JSON.stringify(historyList))
            $app.save(sub)

            console.log(
              `[contek_financial_cron] Cobrança automática gerada para org ${orgName} (R$ ${planInfo.price.toFixed(2)}, vencimento ${dueDateStr}).`,
            )
          }
        } catch (errActiveSub) {
          console.log(
            `[contek_financial_cron] Erro ao processar cobrança da sub ${sub.id}:`,
            errActiveSub,
          )
        }
      }
    } catch (errCronCharges) {
      console.log(
        '[contek_financial_cron] Erro na geração automática de cobranças:',
        errCronCharges,
      )
    }

    // ----------------------------------------------------
    // 1. VERIFICAR TRIALS VENCIDOS
    // ----------------------------------------------------
    try {
      const trialSubs = $app.findRecordsByFilter(
        'subscriptions',
        `status = "trial" && trial_ends_at != "" && trial_ends_at < "${todayStr}"`,
        '-created',
        500,
        0,
      )

      for (const sub of trialSubs) {
        try {
          const orgId = sub.getString('organization_id')
          sub.set('status', 'overdue')

          let historyList = []
          try {
            const rawH = sub.get('history')
            if (Array.isArray(rawH)) historyList = rawH.slice()
            else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
          } catch (_) {}

          historyList.push({
            date: nowIso,
            action: 'TRIAL_EXPIRED_OVERDUE',
            changed_by: 'CRON_AUTOMATION',
            note: 'Período de teste gratuito expirou sem ativação paga. Assinatura vencida e organização suspensa.',
          })
          sub.set('history', JSON.stringify(historyList))
          $app.save(sub)

          if (orgId) {
            try {
              const org = $app.findRecordById('organizations', orgId)
              if (org.getString('status') !== 'suspended') {
                org.set('status', 'suspended')
                $app.save(org)
                console.log(
                  `[contek_financial_cron] Organização ${org.getString('name')} (${orgId}) suspensa por trial expirado.`,
                )
              }
            } catch (errOrg) {
              console.log(`[contek_financial_cron] Erro ao suspender org ${orgId}:`, errOrg)
            }
          }
        } catch (errSub) {
          console.log(`[contek_financial_cron] Erro ao processar sub ${sub.id}:`, errSub)
        }
      }
    } catch (errTrial) {
      console.log('[contek_financial_cron] Erro ao buscar trials vencidos:', errTrial)
    }

    // ----------------------------------------------------
    // 2. MARCAR COBRANÇAS VENCIDAS COMO ATRASADA
    // ----------------------------------------------------
    try {
      const pendingCharges = $app.findRecordsByFilter(
        'contek_charges',
        `status = "PENDENTE" && due_date < "${todayStr}"`,
        'due_date',
        500,
        0,
      )

      for (const charge of pendingCharges) {
        try {
          charge.set('status', 'ATRASADA')
          $app.save(charge)

          const subId = charge.getString('subscription_id')
          const orgId = charge.getString('organization_id')

          if (subId) {
            try {
              const sub = $app.findRecordById('subscriptions', subId)
              if (sub.getString('status') === 'active') {
                sub.set('status', 'overdue')

                let historyList = []
                try {
                  const rawH = sub.get('history')
                  if (Array.isArray(rawH)) historyList = rawH.slice()
                  else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
                } catch (_) {}

                historyList.push({
                  date: nowIso,
                  action: 'CHARGE_OVERDUE',
                  changed_by: 'CRON_AUTOMATION',
                  note: `Mensalidade vencida em ${charge.getString('due_date')} não paga. Status alterado para atrasado.`,
                })
                sub.set('history', JSON.stringify(historyList))
                $app.save(sub)
              }
            } catch (_) {}
          } else if (orgId) {
            // Se não tem subscription_id direto, tenta achar pela organização
            try {
              const subs = $app.findRecordsByFilter(
                'subscriptions',
                `organization_id = "${orgId}"`,
                '-created',
                1,
                0,
              )
              if (subs && subs.length > 0 && subs[0].getString('status') === 'active') {
                subs[0].set('status', 'overdue')
                $app.save(subs[0])
              }
            } catch (_) {}
          }
        } catch (errChg) {
          console.log(`[contek_financial_cron] Erro ao atualizar cobrança ${charge.id}:`, errChg)
        }
      }
    } catch (errPending) {
      console.log(
        '[contek_financial_cron] Erro ao buscar cobranças pendentes vencidas:',
        errPending,
      )
    }

    // ----------------------------------------------------
    // 3. SUSPENDER ORGANIZAÇÕES COM 15+ DIAS DE ATRASO
    // ----------------------------------------------------
    try {
      const veryLateCharges = $app.findRecordsByFilter(
        'contek_charges',
        `status = "ATRASADA" && due_date <= "${fifteenDaysAgoStr}"`,
        'due_date',
        500,
        0,
      )

      for (const charge of veryLateCharges) {
        try {
          const orgId = charge.getString('organization_id')
          if (!orgId) continue

          const org = $app.findRecordById('organizations', orgId)
          if (org.getString('status') !== 'suspended') {
            org.set('status', 'suspended')
            $app.save(org)
            console.log(
              `[contek_financial_cron] Organização ${org.getString('name')} (${orgId}) suspensa por 15+ dias de inadimplência (vencimento: ${charge.getString('due_date')}).`,
            )

            // Atualizar histórico da subscription
            try {
              const subId = charge.getString('subscription_id')
              let sub = null
              if (subId) {
                sub = $app.findRecordById('subscriptions', subId)
              } else {
                const subs = $app.findRecordsByFilter(
                  'subscriptions',
                  `organization_id = "${orgId}"`,
                  '-created',
                  1,
                  0,
                )
                if (subs && subs.length > 0) sub = subs[0]
              }

              if (sub) {
                sub.set('status', 'overdue')
                let historyList = []
                try {
                  const rawH = sub.get('history')
                  if (Array.isArray(rawH)) historyList = rawH.slice()
                  else if (typeof rawH === 'string' && rawH.trim()) historyList = JSON.parse(rawH)
                } catch (_) {}

                historyList.push({
                  date: nowIso,
                  action: 'ORG_SUSPENDED_15_DAYS_OVERDUE',
                  changed_by: 'CRON_AUTOMATION',
                  note: `Empresa suspensa automaticamente devido a 15+ dias de inadimplência da mensalidade com vencimento em ${charge.getString('due_date')}.`,
                })
                sub.set('history', JSON.stringify(historyList))
                $app.save(sub)
              }
            } catch (_) {}
          }
        } catch (errLate) {
          console.log(`[contek_financial_cron] Erro ao suspender org com atraso 15d+:`, errLate)
        }
      }
    } catch (errFifteen) {
      console.log('[contek_financial_cron] Erro na verificação de 15+ dias de atraso:', errFifteen)
    }

    console.log('[contek_financial_cron] Verificação diária concluída com sucesso.')
  } catch (errGlobal) {
    console.log('[contek_financial_cron Fatal Error]:', errGlobal)
  }
})
