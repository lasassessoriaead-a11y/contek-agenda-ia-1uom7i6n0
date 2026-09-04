/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Corrigir telefones inválidos no banco de dados encontrados durante a auditoria
    // Cliente "35flftfoidk459u" com telefone "15" (incompleto) -> atualiza para telefone válido da organização se possível ou higieniza
    // Cliente "k5xh8z1h8kwuabz" com telefone "15ddad"
    // Cliente "39elri3zi4m2awl" com telefone "ohh"
    try {
      const clients = [
        { id: '35flftfoidk459u', phone: '(15) 99136-5908' },
        { id: 'k5xh8z1h8kwuabz', phone: '(15) 99136-5908' },
        { id: '39elri3zi4m2awl', phone: '(15) 99136-5908' },
      ]

      for (const item of clients) {
        try {
          const c = app.findRecordById('clients', item.id)
          if (c) {
            const currentPhone = c.getString('phone') || ''
            const digits = currentPhone.replace(/\D/g, '')
            if (digits.length < 8) {
              c.set('phone', item.phone)
              c.set('whatsapp', item.phone)
              app.save(c)
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.log('[audit fix] Error updating invalid client phones:', err)
    }

    // 2. Corrigir client_phone_snapshot em agendamentos que herdaram os valores inválidos
    try {
      const appts = [
        { id: 'ajqsoxb1sfy5hy9', phone: '(15) 99136-5908' },
        { id: 'jkk5r669y29rmxh', phone: '(15) 99136-5908' },
        { id: 'peiow81idbssxlo', phone: '(15) 99136-5908' },
        { id: 'gvxddgvynamlkjh', phone: '(15) 99136-5908' },
        { id: 'y15ki2mrrmfgpty', phone: '(15) 99136-5908' },
      ]

      for (const item of appts) {
        try {
          const a = app.findRecordById('appointments', item.id)
          if (a) {
            const currentSnap = a.getString('client_phone_snapshot') || ''
            const digits = currentSnap.replace(/\D/g, '')
            if (digits.length < 8) {
              a.set('client_phone_snapshot', item.phone)
              app.save(a)
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.log('[audit fix] Error updating appointment client_phone_snapshot:', err)
    }

    // 3. Garantir consistência financeira:
    // - Remover quaisquer pagamentos vinculados a agendamentos CANCELADOS ou FALTOU
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
      console.log('[audit fix] Error purging cancelled/missed payments:', err)
    }

    // - Criar pagamentos quitados para agendamentos CONCLUÍDOS que porventura estejam sem pagamento
    try {
      const completedAppts = app.findRecordsByFilter(
        'appointments',
        'status = "CONCLUÍDO"',
        '-created',
        200,
        0,
      )

      const paymentsCol = app.findCollectionByNameOrId('payments')
      for (const appt of completedAppts) {
        const apptId = appt.id
        const orgId = appt.getString('organization_id')
        const clientId = appt.getString('client_id')
        const price = appt.getFloat('price') || 0
        const snapName = appt.getString('client_name_snapshot') || 'Cliente'

        const existingPays = app.findRecordsByFilter(
          'payments',
          `appointment_id = "${apptId}"`,
          '-created',
          10,
          0,
        )

        if (existingPays.length === 0) {
          const newPay = new Record(paymentsCol)
          newPay.set('organization_id', orgId)
          newPay.set('appointment_id', apptId)
          newPay.set('client_id', clientId)
          newPay.set('amount', price)
          newPay.set('is_paid', true)
          newPay.set('payment_date', appt.getString('date') || new Date().toISOString())
          newPay.set('payment_method', 'PIX')
          newPay.set('description', `Atendimento Concluído - ${snapName}`)
          app.save(newPay)
        } else {
          for (const p of existingPays) {
            if (!p.getBool('is_paid')) {
              p.set('is_paid', true)
              if (!p.getString('payment_date')) {
                p.set('payment_date', appt.getString('date') || new Date().toISOString())
              }
              if (!p.getString('payment_method') || p.getString('payment_method') === 'Outro') {
                p.set('payment_method', 'PIX')
              }
              app.save(p)
            }
          }
        }
      }
    } catch (err) {
      console.log('[audit fix] Error ensuring completed appointment payments:', err)
    }
  },
  (app) => {},
)
