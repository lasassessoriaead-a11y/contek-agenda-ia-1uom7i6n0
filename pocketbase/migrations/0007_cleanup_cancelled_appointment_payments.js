migrate(
  (app) => {
    // 1. Remove qualquer pagamento vinculado a agendamentos com status CANCELADO ou FALTOU
    try {
      app
        .db()
        .newQuery(`
        DELETE FROM payments
        WHERE appointment_id IS NOT NULL
          AND appointment_id != ''
          AND appointment_id IN (
            SELECT id FROM appointments WHERE status = 'CANCELADO' OR status = 'FALTOU'
          )
      `)
        .execute()
    } catch (err) {
      console.log('[cleanup migration] Error deleting payments for cancelled/missed appts:', err)
    }
  },
  (app) => {
    // Reversão não aplicável para limpeza de pagamentos inválidos
  },
)
