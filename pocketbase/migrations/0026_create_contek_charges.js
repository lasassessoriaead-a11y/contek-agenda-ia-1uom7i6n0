/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const orgsCol = app.findCollectionByNameOrId('organizations')
    const subsCol = app.findCollectionByNameOrId('subscriptions')

    // Regra estrita: apenas SuperAdmin (@request.auth.is_super_admin = true) pode listar, visualizar, criar, atualizar ou deletar cobranças Contek.
    // Clientes de empresas não têm permissão nenhuma de listar ou ver esta coleção (isolamento absoluto).
    const superAdminOnlyRule = "@request.auth.id != '' && @request.auth.is_super_admin = true"

    const contekCharges = new Collection({
      name: 'contek_charges',
      type: 'base',
      listRule: superAdminOnlyRule,
      viewRule: superAdminOnlyRule,
      createRule: superAdminOnlyRule,
      updateRule: superAdminOnlyRule,
      deleteRule: superAdminOnlyRule,
      fields: [
        {
          name: 'organization_id',
          type: 'relation',
          required: true,
          collectionId: orgsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'subscription_id',
          type: 'relation',
          required: false,
          collectionId: subsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'description',
          type: 'text',
          required: false,
        },
        {
          name: 'amount',
          type: 'number',
          required: true,
          min: 0,
        },
        {
          name: 'due_date',
          type: 'date',
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA'],
          maxSelect: 1,
        },
        {
          name: 'payment_method',
          type: 'select',
          required: false,
          values: ['PIX', 'Dinheiro', 'Cartão', 'Transferência', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'paid_at',
          type: 'date',
          required: false,
        },
        {
          name: 'notes',
          type: 'text',
          required: false,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_contek_charges_org ON contek_charges (organization_id)',
        'CREATE INDEX idx_contek_charges_status ON contek_charges (status)',
        'CREATE INDEX idx_contek_charges_due_date ON contek_charges (due_date)',
        'CREATE INDEX idx_contek_charges_sub ON contek_charges (subscription_id)',
      ],
    })

    app.save(contekCharges)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contek_charges')
      app.delete(col)
    } catch (_) {}
  },
)
