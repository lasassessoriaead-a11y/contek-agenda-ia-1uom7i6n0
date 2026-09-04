/// <reference path="../pb_data/types.d.ts" />

// Sincroniza pagamentos vinculados a agendamentos exclusivamente no backend
// Regras financeiras centralizadas:
// 1. onRecordAfterCreateSuccess:
//    - Se criado como CANCELADO ou FALTOU: não gera pagamento
//    - Se criado como CONCLUÍDO: gera pagamento quitado (is_paid = true)
//    - Demais status (AGENDADO, CONFIRMADO, EM ATENDIMENTO): gera lançamento financeiro pendente (is_paid = false)
// 2. onRecordAfterUpdateSuccess:
//    - Se mudou para CANCELADO ou FALTOU: remove qualquer pagamento vinculado ao agendamento
//    - Se mudou para CONCLUÍDO: marca o pagamento vinculado como quitado (is_paid = true) ou cria se não existir
// 3. onRecordAfterDeleteSuccess:
//    - Remove pagamentos vinculados ao agendamento excluído

onRecordAfterCreateSuccess((e) => {
  const appt = e.record
  const apptId = appt.id
  const status = appt.getString('status')
  const orgId = appt.getString('organization_id')
  const price = appt.getFloat('price') || 0
  const clientId = appt.getString('client_id')
  const clientName = appt.getString('client_name_snapshot') || 'Cliente'

  // Se agendamento já nasce cancelado ou falta, não cria lançamento
  if (status === 'CANCELADO' || status === 'FALTOU') {
    e.next()
    return
  }

  try {
    // Evita duplicidade se já houver pagamento vinculado (ex: criado em transação de booking)
    const existing = $app.findRecordsByFilter(
      'payments',
      `appointment_id = "${apptId}"`,
      '-created',
      1,
      0,
    )
    if (existing.length === 0) {
      let servName = 'Serviço'
      try {
        const sId = appt.getString('service_id')
        if (sId) {
          const s = $app.findRecordById('services', sId)
          if (s) servName = s.getString('name') || 'Serviço'
        }
      } catch (_) {}

      const isCompleted = status === 'CONCLUÍDO'
      const paymentsCol = $app.findCollectionByNameOrId('payments')
      const pay = new Record(paymentsCol)
      pay.set('organization_id', orgId)
      pay.set('appointment_id', apptId)
      pay.set('client_id', clientId)
      pay.set('amount', price)
      pay.set('is_paid', isCompleted)
      pay.set(
        'payment_date',
        isCompleted ? appt.getString('date') || new Date().toISOString() : null,
      )
      pay.set('payment_method', isCompleted ? 'PIX' : 'Outro')
      pay.set('description', `${servName} - ${clientName}`)
      $app.save(pay)
    }
  } catch (err) {
    console.error('[payment_sync] Erro ao criar pagamento automático no create:', err)
  }

  e.next()
}, 'appointments')

onRecordAfterUpdateSuccess((e) => {
  const appt = e.record
  const apptId = appt.id
  const newStatus = appt.getString('status')
  const orgId = appt.getString('organization_id')

  if (newStatus === 'CANCELADO' || newStatus === 'FALTOU') {
    try {
      const relatedPayments = $app.findRecordsByFilter(
        'payments',
        `appointment_id = "${apptId}"`,
        '-created',
        50,
        0,
      )
      for (const pay of relatedPayments) {
        try {
          $app.delete(pay)
        } catch (delErr) {
          console.error(
            '[payment_sync] Erro ao deletar pagamento de agendamento cancelado/faltou:',
            delErr,
          )
        }
      }
    } catch (err) {
      console.error('[payment_sync] Erro ao buscar pagamentos para cancelamento:', err)
    }
  } else if (newStatus === 'CONCLUÍDO') {
    try {
      const relatedPayments = $app.findRecordsByFilter(
        'payments',
        `appointment_id = "${apptId}"`,
        '-created',
        50,
        0,
      )
      if (relatedPayments.length > 0) {
        for (const pay of relatedPayments) {
          if (!pay.getBool('is_paid')) {
            pay.set('is_paid', true)
            if (!pay.getString('payment_date')) {
              pay.set('payment_date', new Date().toISOString())
            }
            if (!pay.getString('payment_method') || pay.getString('payment_method') === 'Outro') {
              pay.set('payment_method', 'PIX')
            }
            $app.save(pay)
          }
        }
      } else {
        // Se foi marcado como CONCLUÍDO e não possuía nenhum pagamento vinculado, cria o pagamento quitado
        try {
          const paymentsCol = $app.findCollectionByNameOrId('payments')
          const pay = new Record(paymentsCol)
          pay.set('organization_id', orgId)
          pay.set('appointment_id', apptId)
          pay.set('client_id', appt.getString('client_id'))
          pay.set('amount', appt.getFloat('price') || 0)
          pay.set('is_paid', true)
          pay.set('payment_date', appt.getString('date') || new Date().toISOString())
          pay.set('payment_method', 'PIX')
          pay.set(
            'description',
            `Atendimento Concluído - ${appt.getString('client_name_snapshot') || 'Cliente'}`,
          )
          $app.save(pay)
        } catch (createErr) {
          console.error(
            '[payment_sync] Erro ao criar pagamento automático para concluído:',
            createErr,
          )
        }
      }
    } catch (err) {
      console.error('[payment_sync] Erro ao atualizar pagamento para concluído:', err)
    }
  }

  e.next()
}, 'appointments')

onRecordAfterDeleteSuccess((e) => {
  const appt = e.record
  const apptId = appt.id

  try {
    const relatedPayments = $app.findRecordsByFilter(
      'payments',
      `appointment_id = "${apptId}"`,
      '-created',
      50,
      0,
    )
    for (const pay of relatedPayments) {
      try {
        $app.delete(pay)
      } catch (delErr) {
        console.error('[payment_sync] Erro ao deletar pagamento de agendamento excluído:', delErr)
      }
    }
  } catch (err) {
    console.error('[payment_sync] Erro ao buscar pagamentos para agendamento excluído:', err)
  }

  e.next()
}, 'appointments')
