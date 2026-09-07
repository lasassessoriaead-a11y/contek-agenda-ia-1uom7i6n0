/// <reference path="../pb_data/types.d.ts" />

/**
 * Cron diário para automação financeira da Contek:
 * Executa todos os dias às 03:00 UTC (00:00 Horário de Brasília)
 *
 * 1. Verificar trials vencidos:
 *    Se trial_ends_at < hoje (UTC/dia atual) e status da assinatura ainda for 'trial':
 *    - Atualiza assinatura para 'overdue'
 *    - Atualiza organização para 'suspended'
 *    - Registra no history da assinatura
 *
 * 2. Marcar cobranças vencidas como ATRASADA:
 *    Para cobranças com status 'PENDENTE' cujo due_date < hoje (data sem hora):
 *    - Atualiza status da cobrança para 'ATRASADA'
 *    - Atualiza assinatura correspondente para 'overdue' (se ainda não cancelada)
 *
 * 3. Suspender organizações com 15+ dias de atraso:
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

    // 15 dias atrás
    const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    const fifteenDaysAgoStr = fifteenDaysAgo.toISOString().slice(0, 10)

    console.log(`[contek_financial_cron] Iniciando verificação diária em ${todayStr}`)

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
