/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/backend/v1/public-booking', (e) => {
  const body = e.requestInfo().body || {}
  const {
    org_slug,
    service_id,
    professional_id,
    date,
    start_time,
    client_name,
    client_phone,
    client_email,
    notes,
  } = body

  if (
    !org_slug ||
    !service_id ||
    !professional_id ||
    !date ||
    !start_time ||
    !client_name ||
    !client_phone
  ) {
    return e.json(400, { error: 'Todos os campos obrigatórios devem ser preenchidos.' })
  }

  try {
    // 1. Resolve organization
    const org = $app.findFirstRecordByData('organizations', 'slug', org_slug)
    const orgId = org.id

    // 2. Fetch service & professional
    const service = $app.findCollectionByNameOrId('services')
    const servRecord = $app.findRecordById('services', service_id)
    const profRecord = $app.findRecordById('professionals', professional_id)

    const duration = servRecord.getInt('duration') || 30
    const price = servRecord.getFloat('price') || 0

    // Calculate end_time
    const parts = start_time.split(':')
    const startHour = parseInt(parts[0], 10)
    const startMin = parseInt(parts[1], 10)
    const totalMinutes = startHour * 60 + startMin + duration
    const endH = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0')
    const endM = (totalMinutes % 60).toString().padStart(2, '0')
    const end_time = `${endH}:${endM}`

    // 3. Conflict check
    const cleanDate = typeof date === 'string' ? date.slice(0, 10) : ''
    const filter = `professional_id = "${professional_id}" && status != "CANCELADO" && date ~ "${cleanDate}"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 50, 0)
    for (const appt of existing) {
      const existStart = appt.getString('start_time')
      const existEnd = appt.getString('end_time')
      if (start_time < existEnd && end_time > existStart) {
        return e.json(409, {
          error: `Horário indisponível. Já existe atendimento agendado entre ${existStart} e ${existEnd}.`,
        })
      }
    }

    // 4. Find or create client for this organization
    const cleanPhone = client_phone.trim()
    let clientRecord = null
    try {
      const clientFilter = `organization_id = "${orgId}" && phone = "${cleanPhone}"`
      const foundClients = $app.findRecordsByFilter('clients', clientFilter, '', 1, 0)
      if (foundClients && foundClients.length > 0) {
        clientRecord = foundClients[0]
      }
    } catch (_) {}

    if (!clientRecord) {
      const clientsCol = $app.findCollectionByNameOrId('clients')
      clientRecord = new Record(clientsCol)
      clientRecord.set('organization_id', orgId)
      clientRecord.set('name', client_name.trim())
      clientRecord.set('phone', cleanPhone)
      clientRecord.set('whatsapp', cleanPhone)
      if (client_email) clientRecord.set('email', client_email.trim())
      if (notes) clientRecord.set('notes', `Origem: Agendamento Online. ${notes}`)
      $app.save(clientRecord)
    }

    // 5. Create Appointment
    const apptsCol = $app.findCollectionByNameOrId('appointments')
    const apptRecord = new Record(apptsCol)
    apptRecord.set('organization_id', orgId)
    apptRecord.set('client_id', clientRecord.id)
    apptRecord.set('professional_id', professional_id)
    apptRecord.set('service_id', service_id)
    apptRecord.set('date', cleanDate + ' 00:00:00.000Z')
    apptRecord.set('start_time', start_time)
    apptRecord.set('end_time', end_time)
    apptRecord.set('duration', duration)
    apptRecord.set('price', price)
    apptRecord.set('status', 'AGENDADO')
    apptRecord.set('notes', notes || 'Agendado via página pública')
    apptRecord.set('client_name_snapshot', client_name.trim())
    apptRecord.set('client_phone_snapshot', cleanPhone)
    $app.save(apptRecord)

    // 6. Create initial unpaid payment record
    const paymentsCol = $app.findCollectionByNameOrId('payments')
    const payRecord = new Record(paymentsCol)
    payRecord.set('organization_id', orgId)
    payRecord.set('appointment_id', apptRecord.id)
    payRecord.set('client_id', clientRecord.id)
    payRecord.set('amount', price)
    payRecord.set('is_paid', false)
    payRecord.set('payment_method', 'Outro')
    payRecord.set('description', `${servRecord.getString('name')} - ${client_name}`)
    $app.save(payRecord)

    return e.json(200, {
      success: true,
      appointment_id: apptRecord.id,
      client_id: clientRecord.id,
      date: cleanDate,
      start_time: start_time,
      end_time: end_time,
      service_name: servRecord.getString('name'),
      professional_name: profRecord.getString('name'),
      price: price,
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao processar agendamento.' })
  }
})
