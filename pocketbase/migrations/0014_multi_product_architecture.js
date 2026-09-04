/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Campo `product` em organizations
    const orgs = app.findCollectionByNameOrId('organizations')
    if (!orgs.fields.getByName('product')) {
      orgs.fields.add(
        new SelectField({
          name: 'product',
          values: ['agyli', 'markaly'],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(orgs)
    }

    // 2. Campo `is_super_admin` em users
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('is_super_admin')) {
      users.fields.add(
        new BoolField({
          name: 'is_super_admin',
          required: false,
        }),
      )
      app.save(users)
    }

    const orgId = orgs.id

    // 3. Coleção `product_features`
    // Define módulos liberados para cada produto do sistema
    try {
      app.findCollectionByNameOrId('product_features')
    } catch (_) {
      const productFeatures = new Collection({
        name: 'product_features',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null, // superuser apenas
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'product',
            type: 'select',
            values: ['agyli', 'markaly'],
            maxSelect: 1,
            required: true,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'features', type: 'json' }, // lista/objeto de features liberadas
          { name: 'is_active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_product_features_prod ON product_features (product)'],
      })
      app.save(productFeatures)
    }

    // 4. Coleção `plans`
    try {
      app.findCollectionByNameOrId('plans')
    } catch (_) {
      const plans = new Collection({
        name: 'plans',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'slug', type: 'text', required: true },
          {
            name: 'product',
            type: 'select',
            values: ['agyli', 'markaly'],
            maxSelect: 1,
            required: true,
          },
          { name: 'price_monthly', type: 'number', required: false },
          { name: 'trial_days', type: 'number', required: false },
          { name: 'max_professionals', type: 'number', required: false },
          { name: 'modules_included', type: 'json' },
          { name: 'description', type: 'text' },
          { name: 'active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_plans_slug ON plans (slug)'],
      })
      app.save(plans)
    }

    const plansCol = app.findCollectionByNameOrId('plans')
    const plansId = plansCol.id

    // 5. Coleção `subscriptions`
    try {
      app.findCollectionByNameOrId('subscriptions')
    } catch (_) {
      const subscriptions = new Collection({
        name: 'subscriptions',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (@request.auth.is_super_admin = true || organization_id = @request.auth.organization_id)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.is_super_admin = true || organization_id = @request.auth.organization_id)",
        createRule: null, // Criado via server hooks ou SuperAdmin
        updateRule: null,
        deleteRule: null,
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
            name: 'plan_id',
            type: 'relation',
            required: true,
            collectionId: plansId,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            values: ['trial', 'active', 'overdue', 'canceled'],
            maxSelect: 1,
            required: true,
          },
          { name: 'trial_ends_at', type: 'date' },
          { name: 'starts_at', type: 'date' },
          { name: 'current_period_ends_at', type: 'date' },
          { name: 'canceled_at', type: 'date' },
          { name: 'notes', type: 'text' },
          { name: 'history', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_subscriptions_org ON subscriptions (organization_id)',
          'CREATE INDEX idx_subscriptions_status ON subscriptions (status)',
        ],
      })
      app.save(subscriptions)
    }
  },
  (app) => {
    try {
      const sub = app.findCollectionByNameOrId('subscriptions')
      app.delete(sub)
    } catch (_) {}
    try {
      const p = app.findCollectionByNameOrId('plans')
      app.delete(p)
    } catch (_) {}
    try {
      const pf = app.findCollectionByNameOrId('product_features')
      app.delete(pf)
    } catch (_) {}
  },
)
