/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Update users auth collection with fields if missing
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('role')) {
      users.fields.add(
        new SelectField({
          name: 'role',
          values: ['ADMINISTRADOR', 'PROFISSIONAL', 'SUPERADMIN'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!users.fields.getByName('phone')) {
      users.fields.add(
        new TextField({
          name: 'phone',
          required: false,
        }),
      )
    }
    app.save(users)

    // 2. organizations collection
    const organizations = new Collection({
      name: 'organizations',
      type: 'base',
      listRule: '', // Public read by slug for booking, authenticated write
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true },
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        { name: 'phone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'address', type: 'text' },
        { name: 'plan_id', type: 'text' }, // v1 placeholder
        { name: 'status', type: 'select', values: ['active', 'trial', 'suspended'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_organizations_slug ON organizations (slug)'],
    })
    app.save(organizations)

    const orgId = organizations.id

    // 3. Add organization_id to users now that organizations collection exists
    if (!users.fields.getByName('organization_id')) {
      users.fields.add(
        new RelationField({
          name: 'organization_id',
          collectionId: orgId,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(users)
    }

    // 4. organization_users (junction for user-organization multi-membership / roles)
    const orgUsers = new Collection({
      name: 'organization_users',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'role',
          type: 'select',
          values: ['ADMINISTRADOR', 'PROFISSIONAL'],
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_org_users_org_user ON organization_users (organization_id, user_id)',
      ],
    })
    app.save(orgUsers)

    // 5. professionals
    const professionals = new Collection({
      name: 'professionals',
      type: 'base',
      listRule: '', // Public can list professionals for booking
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'specialty', type: 'text' }, // especialidade/função
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        {
          name: 'avatar',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'default_duration', type: 'number' }, // in minutes
        { name: 'work_days', type: 'json' }, // ["seg", "ter", "qua", "qui", "sex", "sab"]
        { name: 'work_hours', type: 'json' }, // { start: "08:00", end: "18:00", lunch_start: "12:00", lunch_end: "13:00" }
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_professionals_org ON professionals (organization_id)'],
    })
    app.save(professionals)
    const profId = professionals.id

    // 6. clients
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: '', // Allow create during public booking
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'phone', type: 'text', required: true },
        { name: 'whatsapp', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'birth_date', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_clients_org_phone ON clients (organization_id, phone)'],
    })
    app.save(clients)
    const clientId = clients.id

    // 7. services
    const services = new Collection({
      name: 'services',
      type: 'base',
      listRule: '', // Public booking can view active services
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'duration', type: 'number', required: true }, // in minutes
        { name: 'price', type: 'number', required: true },
        { name: 'color', type: 'text' }, // hex tag
        { name: 'category', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_services_org ON services (organization_id)'],
    })
    app.save(services)
    const serviceId = services.id

    // 8. professional_services (relation linking professionals to services they provide)
    const profServices = new Collection({
      name: 'professional_services',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'professional_id',
          type: 'relation',
          required: true,
          collectionId: profId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'service_id',
          type: 'relation',
          required: true,
          collectionId: serviceId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prof_serv ON professional_services (organization_id, professional_id, service_id)',
      ],
    })
    app.save(profServices)

    // 9. appointments (core agenda table)
    // Status: AGENDADO, CONFIRMADO, EM ATENDIMENTO, CONCLUÍDO, CANCELADO, FALTOU
    const appointments = new Collection({
      name: 'appointments',
      type: 'base',
      listRule: '', // Allow public checking of occupied slots for the organization
      viewRule: '',
      createRule: '', // Public booking allowed
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'client_id',
          type: 'relation',
          required: true,
          collectionId: clientId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'professional_id',
          type: 'relation',
          required: true,
          collectionId: profId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'service_id',
          type: 'relation',
          required: true,
          collectionId: serviceId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'date', type: 'date', required: true }, // ISO string YYYY-MM-DD
        { name: 'start_time', type: 'text', required: true }, // HH:mm format e.g. "09:00"
        { name: 'end_time', type: 'text', required: true }, // HH:mm format e.g. "10:00"
        { name: 'duration', type: 'number', required: true }, // minutes
        { name: 'price', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['AGENDADO', 'CONFIRMADO', 'EM ATENDIMENTO', 'CONCLUÍDO', 'CANCELADO', 'FALTOU'],
          maxSelect: 1,
          required: true,
        },
        { name: 'notes', type: 'text' },
        { name: 'client_name_snapshot', type: 'text' },
        { name: 'client_phone_snapshot', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_appointments_org_date ON appointments (organization_id, date)',
        'CREATE INDEX idx_appointments_prof_date ON appointments (professional_id, date)',
      ],
    })
    app.save(appointments)
    const appointmentId = appointments.id

    // 10. payments (financial records tied to appointments / general services)
    // Payment methods: PIX, Dinheiro, Cartão, Outro
    const payments = new Collection({
      name: 'payments',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'appointment_id',
          type: 'relation',
          required: false,
          collectionId: appointmentId,
          maxSelect: 1,
        },
        {
          name: 'client_id',
          type: 'relation',
          required: false,
          collectionId: clientId,
          maxSelect: 1,
        },
        { name: 'amount', type: 'number', required: true },
        { name: 'is_paid', type: 'bool' },
        {
          name: 'payment_method',
          type: 'select',
          values: ['PIX', 'Dinheiro', 'Cartão', 'Outro'],
          maxSelect: 1,
        },
        { name: 'payment_date', type: 'date' },
        { name: 'description', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_payments_org_date ON payments (organization_id, payment_date)'],
    })
    app.save(payments)

    // 11. business_settings (company configurations)
    const businessSettings = new Collection({
      name: 'business_settings',
      type: 'base',
      listRule: '', // Public booking reads working hours / interval
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'business_name', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'opening_time', type: 'text' }, // e.g. "08:00"
        { name: 'closing_time', type: 'text' }, // e.g. "19:00"
        { name: 'working_days', type: 'json' }, // ["seg", "ter", "qua", "qui", "sex", "sab"]
        { name: 'slot_interval_minutes', type: 'number' }, // default 15 or 30 mins
        { name: 'buffer_between_appointments', type: 'number' }, // interval between services in mins
        { name: 'default_booking_message', type: 'text' },
        { name: 'whatsapp_enabled', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_business_settings_org ON business_settings (organization_id)',
      ],
    })
    app.save(businessSettings)
  },
  (app) => {
    const collections = [
      'business_settings',
      'payments',
      'appointments',
      'professional_services',
      'services',
      'clients',
      'professionals',
      'organization_users',
      'organizations',
    ]

    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
