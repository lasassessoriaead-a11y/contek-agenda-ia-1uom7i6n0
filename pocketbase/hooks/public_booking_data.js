/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/backend/v1/public-booking-data', (e) => {
  const timeToMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0
    const parts = t.split(':')
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
  }

  const parseListField = (val) => {
    if (!val) return []
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'number') {
        try {
          const str = String.fromCharCode(...val)
          const parsed = JSON.parse(str)
          return Array.isArray(parsed) ? parsed : []
        } catch (_) {
          return []
        }
      }
      return val
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? parsed : []
      } catch (_) {
        return []
      }
    }
    return []
  }

  const parseObjField = (val) => {
    if (!val) return null
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'number') {
        try {
          const str = String.fromCharCode(...val)
          const parsed = JSON.parse(str)
          return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
        } catch (_) {
          return null
        }
      }
      return null
    }
    if (typeof val === 'object' && !Array.isArray(val)) return val
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
      } catch (_) {
        return null
      }
    }
    return null
  }

  try {
    const slug = e.requestInfo().query?.slug
    if (!slug) {
      return e.json(400, { error: 'O parâmetro slug é obrigatório.' })
    }

    // 1. Resolve organization by slug
    let org = null
    try {
      org = $app.findFirstRecordByData('organizations', 'slug', slug)
    } catch (_) {
      return e.json(404, { error: 'Organização não encontrada.' })
    }

    if (!org) {
      return e.json(404, { error: 'Organização não encontrada.' })
    }

    const orgId = org.id

    // 2. Fetch business_settings
    let settingsData = null
    try {
      const bizSettings = $app.findFirstRecordByData('business_settings', 'organization_id', orgId)
      if (bizSettings) {
        settingsData = {
          id: bizSettings.id,
          business_name: bizSettings.getString('business_name'),
          phone: bizSettings.getString('phone'),
          whatsapp: bizSettings.getString('whatsapp'),
          address: bizSettings.getString('address'),
          opening_time: bizSettings.getString('opening_time') || '08:00',
          closing_time: bizSettings.getString('closing_time') || '18:00',
          working_days: parseListField(bizSettings.get('working_days')),
          slot_interval_minutes: bizSettings.getInt('slot_interval_minutes') || 30,
          buffer_between_appointments: bizSettings.getInt('buffer_between_appointments') || 0,
          default_booking_message: bizSettings.getString('default_booking_message'),
          whatsapp_enabled: bizSettings.getBool('whatsapp_enabled'),
          whatsapp_phone_number: bizSettings.getString('whatsapp_phone_number'),
        }
      }
    } catch (_) {}

    // 3. Fetch active services (only safe public fields)
    const servicesRecords = $app.findRecordsByFilter(
      'services',
      `organization_id = "${orgId}" && active = true`,
      'name',
      100,
      0,
    )

    const services = servicesRecords.map((s) => ({
      id: s.id,
      name: s.getString('name'),
      description: s.getString('description'),
      duration: s.getInt('duration') || 30,
      price: s.getFloat('price') || 0,
      color: s.getString('color') || '#10b981',
      category: s.getString('category'),
    }))

    // 4. Fetch active professionals (including work shifts and date_exceptions)
    const profsRecords = $app.findRecordsByFilter(
      'professionals',
      `organization_id = "${orgId}" && active = true`,
      'name',
      100,
      0,
    )

    const professionals = profsRecords.map((p) => ({
      id: p.id,
      name: p.getString('name'),
      specialty: p.getString('specialty'),
      phone: p.getString('phone'),
      email: p.getString('email'),
      avatar: p.getString('avatar'),
      default_duration: p.getInt('default_duration') || 45,
      work_days: parseListField(p.get('work_days')),
      work_hours: parseObjField(p.get('work_hours')),
      work_shifts: parseListField(p.get('work_shifts')),
      date_exceptions: parseListField(p.get('date_exceptions')),
    }))

    // 5. Fetch professional_services mappings for this org
    const psRecords = $app.findRecordsByFilter(
      'professional_services',
      `organization_id = "${orgId}"`,
      '',
      300,
      0,
    )

    const professional_services = psRecords.map((ps) => ({
      id: ps.id,
      professional_id: ps.getString('professional_id'),
      service_id: ps.getString('service_id'),
    }))

    // 6. Fetch existing non-cancelled appointments for slot conflict calculation
    // Return ONLY professional_id, date, start_time, end_time (NO patient identity/phone)
    const apptsRecords = $app.findRecordsByFilter(
      'appointments',
      `organization_id = "${orgId}" && status != "CANCELADO"`,
      '-date',
      500,
      0,
    )

    const occupied_slots = apptsRecords.map((a) => ({
      professional_id: a.getString('professional_id'),
      date: (a.getString('date') || '').slice(0, 10),
      start_time: a.getString('start_time'),
      end_time: a.getString('end_time'),
    }))

    return e.json(200, {
      organization: {
        id: org.id,
        name: org.getString('name'),
        slug: org.getString('slug'),
        logo: org.getString('logo'),
        phone: org.getString('phone'),
        whatsapp: org.getString('whatsapp'),
        email: org.getString('email'),
        address: org.getString('address'),
        status: org.getString('status'),
      },
      settings: settingsData,
      services: services,
      professionals: professionals,
      professional_services: professional_services,
      occupied_slots: occupied_slots,
    })
  } catch (err) {
    return e.json(500, { error: err.message || 'Erro ao carregar dados de agendamento.' })
  }
})
