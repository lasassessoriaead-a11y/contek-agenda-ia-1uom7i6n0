/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const data = e.requestInfo().body || {}
  const profId = data.professional_id || e.record?.get('professional_id')
  const dateVal = data.date || e.record?.get('date')
  const startTime = data.start_time || e.record?.get('start_time')
  const endTime = data.end_time || e.record?.get('end_time')
  const orgId = data.organization_id || e.record?.get('organization_id')

  if (!profId || !dateVal || !startTime || !endTime) {
    e.next()
    return
  }

  // Check date string format e.g. "2025-05-10"
  const cleanDate = typeof dateVal === 'string' ? dateVal.slice(0, 10) : ''

  try {
    const filter = `professional_id = "${profId}" && status != "CANCELADO" && date ~ "${cleanDate}"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 50, 0)

    for (const appt of existing) {
      if (e.record && appt.id === e.record.id) continue
      const existStart = appt.getString('start_time')
      const existEnd = appt.getString('end_time')

      // Check overlap: (startTime < existEnd) && (endTime > existStart)
      if (startTime < existEnd && endTime > existStart) {
        throw new BadRequestError(
          `Conflito de horário para este profissional: já existe agendamento das ${existStart} às ${existEnd}.`,
        )
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err
    }
    // ignore query errors and let save proceed
  }

  e.next()
}, 'appointments')
