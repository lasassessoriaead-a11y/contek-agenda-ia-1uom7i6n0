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

      // Helper to parse list fields safely
      const parseList = (val) => {
        if (!val) return []
        if (Array.isArray(val)) {
          if (val.length > 0 && typeof val[0] === 'number') {
            try {
              const str = String.fromCharCode(...val)
              const p = JSON.parse(str)
              return Array.isArray(p) ? p : []
            } catch (_) {
              return []
            }
          }
          return val
        }
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val)
            return Array.isArray(p) ? p : []
          } catch (_) {
            return []
          }
        }
        return []
      }

      const parseObj = (val) => {
        if (!val) return null
        if (Array.isArray(val)) {
          if (val.length > 0 && typeof val[0] === 'number') {
            try {
              const str = String.fromCharCode(...val)
              const p = JSON.parse(str)
              return typeof p === 'object' && !Array.isArray(p) ? p : null
            } catch (_) {
              return null
            }
          }
          return null
        }
        if (typeof val === 'object' && !Array.isArray(val)) return val
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val)
            return typeof p === 'object' && !Array.isArray(p) ? p : null
          } catch (_) {
            return null
          }
        }
        return null
      }

      // Check organization working days if orgId is available
      if (orgId) {
        try {
          const bizSettings = $app.findFirstRecordByData(
            'business_settings',
            'organization_id',
            orgId,
          )
          if (bizSettings && cleanDate) {
            const orgDays = parseList(bizSettings.get('working_days'))
            if (orgDays.length > 0) {
              const partsDate = cleanDate.split('-')
              const y = parseInt(partsDate[0], 10)
              const m = parseInt(partsDate[1], 10)
              const d = parseInt(partsDate[2], 10)
              const dayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
              const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
              const dayKey = dayMap[dayIdx]
              if (!orgDays.includes(dayKey)) {
                throw new BadRequestError(
                  'O estabelecimento não abre no dia da semana selecionado.',
                )
              }
            }
          }
        } catch (orgErr) {
          if (orgErr instanceof BadRequestError) throw orgErr
        }
      }

      // Check professional date exceptions / folgas
      const profExceptions = parseList(prof.get('date_exceptions'))
      if (profExceptions.length > 0 && cleanDate) {
        const hasDateException = profExceptions.some((exc) => {
          const excStr = typeof exc === 'string' ? exc.slice(0, 10) : ''
          return excStr === cleanDate
        })
        if (hasDateException) {
          throw new BadRequestError(
            `Data indisponível: o profissional possui registro de folga ou recesso no dia ${cleanDate}.`,
          )
        }
      }

      // Check professional working days
      const profWorkDays = parseList(prof.get('work_days'))
      if (profWorkDays.length > 0 && cleanDate) {
        const partsDate = cleanDate.split('-')
        const y = parseInt(partsDate[0], 10)
        const m = parseInt(partsDate[1], 10)
        const d = parseInt(partsDate[2], 10)
        const dayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
        const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']
        const dayKey = dayMap[dayIdx]
        if (!profWorkDays.includes(dayKey)) {
          throw new BadRequestError('O profissional não atende no dia da semana selecionado.')
        }
      }

      // Check multiple work shifts or fallback to work_hours
      // Check professional date exceptions / folgas
      const profExceptionsUpdate = parseList(prof.get('date_exceptions'))
      if (profExceptionsUpdate.length > 0 && cleanDate) {
        const hasDateException = profExceptionsUpdate.some((exc) => {
          const excStr = typeof exc === 'string' ? exc.slice(0, 10) : ''
          return excStr === cleanDate
        })
        if (hasDateException) {
          throw new BadRequestError(
            `Data indisponível: o profissional possui registro de folga ou recesso no dia ${cleanDate}.`,
          )
        }
      }

      const rawShifts = parseList(prof.get('work_shifts'))
      let activeShifts = []
      if (rawShifts && rawShifts.length > 0) {
        for (const s of rawShifts) {
          if (s && s.start && s.end) {
            activeShifts.push({
              start: s.start,
              end: s.end,
              startMin: timeToMinutes(s.start),
              endMin: timeToMinutes(s.end),
            })
          }
        }
      }

      const workHours = parseObj(prof.get('work_hours'))
      if (activeShifts.length === 0 && workHours && workHours.start && workHours.end) {
        activeShifts.push({
          start: workHours.start,
          end: workHours.end,
          startMin: timeToMinutes(workHours.start),
          endMin: timeToMinutes(workHours.end),
        })
      }

      if (activeShifts.length > 0) {
        const fitsInShift = activeShifts.some(
          (sh) => newStartMin >= sh.startMin && newEndMin <= sh.endMin,
        )
        if (!fitsInShift) {
          const shiftTexts = activeShifts.map((sh) => `${sh.start} às ${sh.end}`).join(', ')
          throw new BadRequestError(
            `Horário fora dos turnos de atendimento do profissional (${shiftTexts}).`,
          )
        }
      }

      if (workHours && workHours.lunch_start && workHours.lunch_end) {
        const lStart = timeToMinutes(workHours.lunch_start)
        const lEnd = timeToMinutes(workHours.lunch_end)
        if (lEnd > lStart && newStartMin < lEnd && newEndMin > lStart) {
          throw new BadRequestError(
            `Horário coincide com o intervalo do profissional (${workHours.lunch_start} às ${workHours.lunch_end}).`,
          )
        }
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    const filter = `professional_id = "${profId}" && status != "CANCELADO"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 200, 0)

    for (const appt of existing) {
      if (e.record && appt.id === e.record.id) continue
      const apptDateStr = (appt.getString('date') || '').slice(0, 10)
      if (apptDateStr !== cleanDate) continue

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

      const parseObj = (val) => {
        if (!val) return null
        if (Array.isArray(val)) {
          if (val.length > 0 && typeof val[0] === 'number') {
            try {
              const str = String.fromCharCode(...val)
              const p = JSON.parse(str)
              return typeof p === 'object' && !Array.isArray(p) ? p : null
            } catch (_) {
              return null
            }
          }
          return null
        }
        if (typeof val === 'object' && !Array.isArray(val)) return val
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val)
            return typeof p === 'object' && !Array.isArray(p) ? p : null
          } catch (_) {
            return null
          }
        }
        return null
      }

      // Helper to parse list fields safely
      const parseList = (val) => {
        if (!val) return []
        if (Array.isArray(val)) {
          if (val.length > 0 && typeof val[0] === 'number') {
            try {
              const str = String.fromCharCode(...val)
              const p = JSON.parse(str)
              return Array.isArray(p) ? p : []
            } catch (_) {
              return []
            }
          }
          return val
        }
        if (typeof val === 'string') {
          try {
            const p = JSON.parse(val)
            return Array.isArray(p) ? p : []
          } catch (_) {
            return []
          }
        }
        return []
      }

      const rawShifts = parseList(prof.get('work_shifts'))
      let activeShifts = []
      if (rawShifts && rawShifts.length > 0) {
        for (const s of rawShifts) {
          if (s && s.start && s.end) {
            activeShifts.push({
              start: s.start,
              end: s.end,
              startMin: timeToMinutes(s.start),
              endMin: timeToMinutes(s.end),
            })
          }
        }
      }

      const workHours = parseObj(prof.get('work_hours'))
      if (activeShifts.length === 0 && workHours && workHours.start && workHours.end) {
        activeShifts.push({
          start: workHours.start,
          end: workHours.end,
          startMin: timeToMinutes(workHours.start),
          endMin: timeToMinutes(workHours.end),
        })
      }

      if (activeShifts.length > 0) {
        const fitsInShift = activeShifts.some(
          (sh) => newStartMin >= sh.startMin && newEndMin <= sh.endMin,
        )
        if (!fitsInShift) {
          const shiftTexts = activeShifts.map((sh) => `${sh.start} às ${sh.end}`).join(', ')
          throw new BadRequestError(
            `Horário fora dos turnos de atendimento do profissional (${shiftTexts}).`,
          )
        }
      }

      if (workHours && workHours.lunch_start && workHours.lunch_end) {
        const lStart = timeToMinutes(workHours.lunch_start)
        const lEnd = timeToMinutes(workHours.lunch_end)
        if (lEnd > lStart && newStartMin < lEnd && newEndMin > lStart) {
          throw new BadRequestError(
            `Horário coincide com o intervalo do profissional (${workHours.lunch_start} às ${workHours.lunch_end}).`,
          )
        }
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  try {
    const filter = `professional_id = "${profId}" && status != "CANCELADO"`
    const existing = $app.findRecordsByFilter('appointments', filter, '', 200, 0)

    for (const appt of existing) {
      if (e.record && appt.id === e.record.id) continue
      const apptDateStr = (appt.getString('date') || '').slice(0, 10)
      if (apptDateStr !== cleanDate) continue

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
