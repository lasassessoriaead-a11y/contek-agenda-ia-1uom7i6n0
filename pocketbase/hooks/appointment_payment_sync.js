/// <reference path="../pb_data/types.d.ts" />

// Sincroniza pagamentos vinculados a agendamentos quando o status do agendamento muda
// Regra financeira:
// - CANCELADO ou FALTOU: remove qualquer pagamento vinculado ao agendamento
// - CONCLUÍDO: marca o pagamento vinculado como pago (is_paid = true)
// - Se o agendamento for excluído: remove pagamentos vinculados
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
