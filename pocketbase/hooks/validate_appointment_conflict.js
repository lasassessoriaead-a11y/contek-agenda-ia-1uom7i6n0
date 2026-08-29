/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0
    const parts = t.split(':')
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  const data = e.requestInfo().body || {}
  const profId = data.professional_id || (e.record ? e.record.get('professional_id') : null)
  const dateVal = data.date || (e.record ? e.record.get('date') : null)
  const startTime = data.start_time || (e.record ? e.record.get('start_time') : null)
  const endTime = data.end_time || (e.record ? e.record.get('end_time') : null)
  const orgId = data.organization_id || (e.record ? e.record.get('organization_id') : null)
  const status = data.status || (e.record ? e.record.get('status') : 'AGENDADO')

  if (status === 'CANCELADO') {
    e.next()
    return
  }

  if (!profId || !dateVal || !startTime || !endTime) {
    e.next()
    return
  }

  const authRecord = e.auth
  if (authRecord && authRecord.get('organization_id')) {
    const userOrgId = authRecord.get('organization_id')
    if (orgId && orgId !== userOrgId) {
      throw new BadRequestError('Operação não permitida: organização divergente do usuário logado.')
    }
  }

  const cleanDate = typeof dateVal === 'string' ? dateVal.slice(0, 10) : ''
  const newStartMin = timeToMinutes(startTime)
  const newEndMin = timeToMinutes(endTime)

  if (newEndMin <= newStartMin) {
    throw new BadRequestError('O horário de término deve ser posterior ao horário de início.')
  }

  try {
    const prof = $app.findRecordById('professionals', profId)
    if (prof) {
      if (prof.getBool('active') === false) {
        throw new BadRequestError('O profissional selecionado está inativo para agendamentos.')
      }

      const workHours = prof.get('work_hours')
      if (workHours && typeof workHours === 'object') {
        const pStart = workHours.start ? timeToMinutes(workHours.start) : 8 * 60
        const pEnd = workHours.end ? timeToMinutes(workHours.end) : 19 * 60
        if (newStartMin < pStart || newEndMin > pEnd) {
          throw new BadRequestError(
            `Horário fora do expediente do profissional (${workHours.start || '08:00'} às ${workHours.end || '18:00'}).`,
          )
        }
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    const filter = `professional_id = "${profId}" && status != "CANCELADO" && date ~ "${cleanDate}"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 100, 0)

    for (const appt of existing) {
      if (e.record && appt.id === e.record.id) continue

      const existStart = appt.getString('start_time')
      const existEnd = appt.getString('end_time')
      const existStartMin = timeToMinutes(existStart)
      const existEndMin = timeToMinutes(existEnd)

      if (newStartMin < existEndMin && newEndMin > existStartMin) {
        throw new BadRequestError(
          `Conflito de horário para este profissional: já existe agendamento das ${existStart} às ${existEnd}.`,
        )
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err
    }
  }

  e.next()
}, 'appointments')

onRecordUpdateRequest((e) => {
  const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0
    const parts = t.split(':')
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  const data = e.requestInfo().body || {}
  const profId = data.professional_id || (e.record ? e.record.get('professional_id') : null)
  const dateVal = data.date || (e.record ? e.record.get('date') : null)
  const startTime = data.start_time || (e.record ? e.record.get('start_time') : null)
  const endTime = data.end_time || (e.record ? e.record.get('end_time') : null)
  const orgId = data.organization_id || (e.record ? e.record.get('organization_id') : null)
  const status = data.status || (e.record ? e.record.get('status') : 'AGENDADO')

  if (status === 'CANCELADO') {
    e.next()
    return
  }

  if (!profId || !dateVal || !startTime || !endTime) {
    e.next()
    return
  }

  const authRecord = e.auth
  if (authRecord && authRecord.get('organization_id')) {
    const userOrgId = authRecord.get('organization_id')
    if (orgId && orgId !== userOrgId) {
      throw new BadRequestError('Operação não permitida: organização divergente do usuário logado.')
    }
  }

  const cleanDate = typeof dateVal === 'string' ? dateVal.slice(0, 10) : ''
  const newStartMin = timeToMinutes(startTime)
  const newEndMin = timeToMinutes(endTime)

  if (newEndMin <= newStartMin) {
    throw new BadRequestError('O horário de término deve ser posterior ao horário de início.')
  }

  try {
    const prof = $app.findRecordById('professionals', profId)
    if (prof) {
      if (prof.getBool('active') === false) {
        throw new BadRequestError('O profissional selecionado está inativo para agendamentos.')
      }

      const workHours = prof.get('work_hours')
      if (workHours && typeof workHours === 'object') {
        const pStart = workHours.start ? timeToMinutes(workHours.start) : 8 * 60
        const pEnd = workHours.end ? timeToMinutes(workHours.end) : 19 * 60
        if (newStartMin < pStart || newEndMin > pEnd) {
          throw new BadRequestError(
            `Horário fora do expediente do profissional (${workHours.start || '08:00'} às ${workHours.end || '18:00'}).`,
          )
        }
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    const filter = `professional_id = "${profId}" && status != "CANCELADO" && date ~ "${cleanDate}"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 100, 0)

    for (const appt of existing) {
      if (e.record && appt.id === e.record.id) continue

      const existStart = appt.getString('start_time')
      const existEnd = appt.getString('end_time')
      const existStartMin = timeToMinutes(existStart)
      const existEndMin = timeToMinutes(existEnd)

      if (newStartMin < existEndMin && newEndMin > existStartMin) {
        throw new BadRequestError(
          `Conflito de horário para este profissional: já existe agendamento das ${existStart} às ${existEnd}.`,
        )
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) {
      throw err
    }
  }

  e.next()
}, 'appointments')
