/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const orgs = app.findCollectionByNameOrId('organizations')
    const orgUsersCol = app.findCollectionByNameOrId('organization_users')
    const profCol = app.findCollectionByNameOrId('professionals')
    const clientsCol = app.findCollectionByNameOrId('clients')
    const servicesCol = app.findCollectionByNameOrId('services')
    const profServicesCol = app.findCollectionByNameOrId('professional_services')
    const apptsCol = app.findCollectionByNameOrId('appointments')
    const paymentsCol = app.findCollectionByNameOrId('payments')
    const settingsCol = app.findCollectionByNameOrId('business_settings')

    // 1. Seed or find Organization "Contek Demo"
    let orgRecord
    try {
      orgRecord = app.findFirstRecordByData('organizations', 'slug', 'contek-demo')
    } catch (_) {
      orgRecord = new Record(orgs)
      orgRecord.set('name', 'Contek Estética & Saúde')
      orgRecord.set('slug', 'contek-demo')
      orgRecord.set('phone', '(11) 98765-4321')
      orgRecord.set('whatsapp', '(11) 98765-4321')
      orgRecord.set('email', 'contato@contekestetica.com.br')
      orgRecord.set('address', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP')
      orgRecord.set('status', 'active')
      orgRecord.set('plan_id', 'pro_v1')
      app.save(orgRecord)
    }
    const orgId = orgRecord.id

    // 2. Seed or update Business Settings
    let settingsRec
    try {
      settingsRec = app.findFirstRecordByData('business_settings', 'organization_id', orgId)
    } catch (_) {
      settingsRec = new Record(settingsCol)
      settingsRec.set('organization_id', orgId)
      settingsRec.set('business_name', 'Contek Estética & Saúde')
      settingsRec.set('phone', '(11) 98765-4321')
      settingsRec.set('whatsapp', '(11) 98765-4321')
      settingsRec.set('address', 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP')
      settingsRec.set('opening_time', '08:00')
      settingsRec.set('closing_time', '19:00')
      settingsRec.set('working_days', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      settingsRec.set('slot_interval_minutes', 30)
      settingsRec.set('buffer_between_appointments', 10)
      settingsRec.set(
        'default_booking_message',
        'Olá! Seu agendamento foi confirmado com sucesso na Contek Estética & Saúde.',
      )
      settingsRec.set('whatsapp_enabled', true)
      app.save(settingsRec)
    }

    // 3. Seed User luka2510@hotmail.com
    let userRec
    try {
      userRec = app.findAuthRecordByEmail('_pb_users_auth_', 'luka2510@hotmail.com')
    } catch (_) {
      userRec = new Record(users)
      userRec.setEmail('luka2510@hotmail.com')
      userRec.setPassword('Skip@Pass')
      userRec.setVerified(true)
      userRec.set('name', 'Lucas Silva (Administrador)')
      userRec.set('role', 'ADMINISTRADOR')
      userRec.set('phone', '(11) 98765-4321')
      userRec.set('organization_id', orgId)
      app.save(userRec)
    }

    // Ensure user has organization_id and role
    if (!userRec.getString('organization_id')) {
      userRec.set('organization_id', orgId)
      userRec.set('role', 'ADMINISTRADOR')
      app.save(userRec)
    }

    // Organization User link
    try {
      app.findFirstRecordByData('organization_users', 'user_id', userRec.id)
    } catch (_) {
      const ou = new Record(orgUsersCol)
      ou.set('organization_id', orgId)
      ou.set('user_id', userRec.id)
      ou.set('role', 'ADMINISTRADOR')
      app.save(ou)
    }

    // 4. Seed Professionals
    const prof1Data = {
      name: 'Dra. Camila Torres',
      specialty: 'Biomédica Esteta',
      phone: '(11) 99123-4567',
      email: 'camila@contekestetica.com.br',
      default_duration: 45,
      work_days: ['seg', 'ter', 'qua', 'qui', 'sex'],
      work_hours: { start: '08:30', end: '18:00', lunch_start: '12:00', lunch_end: '13:00' },
      active: true,
    }
    let prof1
    try {
      prof1 = app.findFirstRecordByData('professionals', 'name', prof1Data.name)
    } catch (_) {
      prof1 = new Record(profCol)
      prof1.set('organization_id', orgId)
      prof1.set('name', prof1Data.name)
      prof1.set('specialty', prof1Data.specialty)
      prof1.set('phone', prof1Data.phone)
      prof1.set('email', prof1Data.email)
      prof1.set('default_duration', prof1Data.default_duration)
      prof1.set('work_days', prof1Data.work_days)
      prof1.set('work_hours', prof1Data.work_hours)
      prof1.set('active', true)
      app.save(prof1)
    }

    const prof2Data = {
      name: 'Dr. Rafael Mendes',
      specialty: 'Nutricionista Clínico & Esportivo',
      phone: '(11) 99234-5678',
      email: 'rafael@contekestetica.com.br',
      default_duration: 60,
      work_days: ['ter', 'qua', 'qui', 'sex', 'sab'],
      work_hours: { start: '09:00', end: '19:00', lunch_start: '13:00', lunch_end: '14:00' },
      active: true,
    }
    let prof2
    try {
      prof2 = app.findFirstRecordByData('professionals', 'name', prof2Data.name)
    } catch (_) {
      prof2 = new Record(profCol)
      prof2.set('organization_id', orgId)
      prof2.set('name', prof2Data.name)
      prof2.set('specialty', prof2Data.specialty)
      prof2.set('phone', prof2Data.phone)
      prof2.set('email', prof2Data.email)
      prof2.set('default_duration', prof2Data.default_duration)
      prof2.set('work_days', prof2Data.work_days)
      prof2.set('work_hours', prof2Data.work_hours)
      prof2.set('active', true)
      app.save(prof2)
    }

    // 5. Seed Services
    const servicesList = [
      {
        name: 'Limpeza de Pele Profunda',
        desc: 'Higienização profunda com extração e máscara hidratante',
        dur: 60,
        price: 180,
        color: '#10b981',
        cat: 'Estética Facial',
      },
      {
        name: 'Aplicação de Toxina Botulínica',
        desc: 'Harmonização e suavização de linhas de expressão',
        dur: 45,
        price: 850,
        color: '#3b82f6',
        cat: 'Procedimentos Avançados',
      },
      {
        name: 'Consulta Nutricional Completa',
        desc: 'Avaliação por bioimpedância e plano alimentar individualizado',
        dur: 60,
        price: 250,
        color: '#8b5cf6',
        cat: 'Nutrição',
      },
      {
        name: 'Drenagem Linfática Corporal',
        desc: 'Massagem suave para redução de inchaço e retenção de líquidos',
        dur: 50,
        price: 150,
        color: '#f59e0b',
        cat: 'Estética Corporal',
      },
    ]

    const seededServices = []
    for (const s of servicesList) {
      let sRec
      try {
        sRec = app.findFirstRecordByData('services', 'name', s.name)
      } catch (_) {
        sRec = new Record(servicesCol)
        sRec.set('organization_id', orgId)
        sRec.set('name', s.name)
        sRec.set('description', s.desc)
        sRec.set('duration', s.dur)
        sRec.set('price', s.price)
        sRec.set('color', s.color)
        sRec.set('category', s.cat)
        sRec.set('active', true)
        app.save(sRec)
      }
      seededServices.push(sRec)
    }

    // Link professional_services
    if (seededServices.length >= 4) {
      // Prof 1 has services 0, 1, 3
      const p1Links = [seededServices[0], seededServices[1], seededServices[3]]
      for (const serv of p1Links) {
        try {
          const query = `organization_id = "${orgId}" && professional_id = "${prof1.id}" && service_id = "${serv.id}"`
          const exists = app.findRecordsByFilter('professional_services', query, '', 1, 0)
          if (!exists || exists.length === 0) {
            const ps = new Record(profServicesCol)
            ps.set('organization_id', orgId)
            ps.set('professional_id', prof1.id)
            ps.set('service_id', serv.id)
            app.save(ps)
          }
        } catch (_) {}
      }

      // Prof 2 has service 2 (Nutrição)
      try {
        const query = `organization_id = "${orgId}" && professional_id = "${prof2.id}" && service_id = "${seededServices[2].id}"`
        const exists = app.findRecordsByFilter('professional_services', query, '', 1, 0)
        if (!exists || exists.length === 0) {
          const ps = new Record(profServicesCol)
          ps.set('organization_id', orgId)
          ps.set('professional_id', prof2.id)
          ps.set('service_id', seededServices[2].id)
          app.save(ps)
        }
      } catch (_) {}
    }

    // 6. Seed Clients
    const clientsList = [
      {
        name: 'Mariana Albuquerque',
        phone: '(11) 97111-2233',
        email: 'mariana.alb@gmail.com',
        notes: 'Pele sensível, prefere atendimentos pela manhã.',
      },
      {
        name: 'Carlos Eduardo Souza',
        phone: '(11) 97222-3344',
        email: 'carlos.edu@outlook.com',
        notes: 'Objetivo: hipertrofia e reeducação alimentar.',
      },
      {
        name: 'Beatriz Helena Lima',
        phone: '(11) 97333-4455',
        email: 'beatriz.lima@yahoo.com.br',
        notes: 'Realizou toxina botulínica há 6 meses.',
      },
      {
        name: 'Fernando Ribeiro',
        phone: '(11) 97444-5566',
        email: 'fernando.rib@gmail.com',
        notes: 'Cliente pontual, gosta de confirmação por WhatsApp.',
      },
      {
        name: 'Juliana Mendes Costa',
        phone: '(11) 97555-6677',
        email: 'juliana.costa@gmail.com',
        notes: 'Pacote de drenagem linfática em andamento.',
      },
    ]

    const seededClients = []
    for (const c of clientsList) {
      let cRec
      try {
        cRec = app.findFirstRecordByData('clients', 'phone', c.phone)
      } catch (_) {
        cRec = new Record(clientsCol)
        cRec.set('organization_id', orgId)
        cRec.set('name', c.name)
        cRec.set('phone', c.phone)
        cRec.set('whatsapp', c.phone)
        cRec.set('email', c.email)
        cRec.set('notes', c.notes)
        app.save(cRec)
      }
      seededClients.push(cRec)
    }

    // 7. Seed Appointments & Payments for current dates
    const todayStr = new Date().toISOString().slice(0, 10)
    const now = new Date()

    const getShiftedDate = (days) => {
      const d = new Date(now)
      d.setDate(d.getDate() + days)
      return d.toISOString().slice(0, 10)
    }

    const sampleAppointments = [
      {
        clientIdx: 0,
        prof: prof1,
        servIdx: 0,
        date: todayStr,
        start: '09:00',
        end: '10:00',
        duration: 60,
        status: 'CONCLUÍDO',
        price: 180,
        notes: 'Procedimento realizado com sucesso',
        paid: true,
        method: 'PIX',
      },
      {
        clientIdx: 1,
        prof: prof2,
        servIdx: 2,
        date: todayStr,
        start: '10:30',
        end: '11:30',
        duration: 60,
        status: 'EM ATENDIMENTO',
        price: 250,
        notes: 'Primeira consulta nutricional',
        paid: true,
        method: 'Cartão',
      },
      {
        clientIdx: 2,
        prof: prof1,
        servIdx: 1,
        date: todayStr,
        start: '14:00',
        end: '14:45',
        duration: 45,
        status: 'CONFIRMADO',
        price: 850,
        notes: 'Retorno de aplicação',
        paid: false,
        method: 'PIX',
      },
      {
        clientIdx: 3,
        prof: prof1,
        servIdx: 0,
        date: todayStr,
        start: '16:00',
        end: '17:00',
        duration: 60,
        status: 'AGENDADO',
        price: 180,
        notes: 'Agendado via página online',
        paid: false,
        method: 'Dinheiro',
      },
      {
        clientIdx: 4,
        prof: prof1,
        servIdx: 3,
        date: getShiftedDate(-1),
        start: '11:00',
        end: '11:50',
        duration: 50,
        status: 'CONCLUÍDO',
        price: 150,
        notes: 'Sessão 3 de 5',
        paid: true,
        method: 'PIX',
      },
      {
        clientIdx: 1,
        prof: prof1,
        servIdx: 0,
        date: getShiftedDate(-2),
        start: '15:00',
        end: '16:00',
        duration: 60,
        status: 'FALTOU',
        price: 180,
        notes: 'Cliente não compareceu e não avisou',
        paid: false,
        method: 'Outro',
      },
      {
        clientIdx: 3,
        prof: prof2,
        servIdx: 2,
        date: getShiftedDate(1),
        start: '09:30',
        end: '10:30',
        duration: 60,
        status: 'CONFIRMADO',
        price: 250,
        notes: 'Acompanhamento nutricional',
        paid: false,
        method: 'Cartão',
      },
      {
        clientIdx: 0,
        prof: prof1,
        servIdx: 1,
        date: getShiftedDate(2),
        start: '14:30',
        end: '15:15',
        duration: 45,
        status: 'AGENDADO',
        price: 850,
        notes: 'Harmonização terço superior',
        paid: false,
        method: 'PIX',
      },
    ]

    for (const item of sampleAppointments) {
      const client = seededClients[item.clientIdx]
      const service = seededServices[item.servIdx]
      if (!client || !service || !item.prof) continue

      try {
        const q = `organization_id = "${orgId}" && client_id = "${client.id}" && date ~ "${item.date}" && start_time = "${item.start}"`
        const found = app.findRecordsByFilter('appointments', q, '', 1, 0)
        if (found && found.length > 0) continue
      } catch (_) {}

      const appt = new Record(apptsCol)
      appt.set('organization_id', orgId)
      appt.set('client_id', client.id)
      appt.set('professional_id', item.prof.id)
      appt.set('service_id', service.id)
      appt.set('date', item.date + ' 00:00:00.000Z')
      appt.set('start_time', item.start)
      appt.set('end_time', item.end)
      appt.set('duration', item.duration)
      appt.set('price', item.price)
      appt.set('status', item.status)
      appt.set('notes', item.notes)
      appt.set('client_name_snapshot', client.getString('name'))
      appt.set('client_phone_snapshot', client.getString('phone'))
      app.save(appt)

      // Create payment record
      const pay = new Record(paymentsCol)
      pay.set('organization_id', orgId)
      pay.set('appointment_id', appt.id)
      pay.set('client_id', client.id)
      pay.set('amount', item.price)
      pay.set('is_paid', item.paid)
      pay.set('payment_method', item.method)
      pay.set('payment_date', item.paid ? item.date + ' 12:00:00.000Z' : null)
      pay.set('description', `${service.getString('name')} - ${client.getString('name')}`)
      pay.set('notes', item.notes)
      app.save(pay)
    }
  },
  (app) => {
    // Seeds cleanup
  },
)
