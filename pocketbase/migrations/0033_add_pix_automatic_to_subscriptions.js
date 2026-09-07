/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('subscriptions')

    if (!col.fields.getByName('recurring_status')) {
      col.fields.add(
        new SelectField({
          name: 'recurring_status',
          values: ['NOT_ENROLLED', 'PENDING_AUTHORIZATION', 'ACTIVE', 'CANCELED', 'REJECTED'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_journey')) {
      col.fields.add(
        new TextField({
          name: 'recurring_journey',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_link')) {
      col.fields.add(
        new TextField({
          name: 'recurring_link',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_emv')) {
      col.fields.add(
        new TextField({
          name: 'recurring_emv',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_correlation_id')) {
      col.fields.add(
        new TextField({
          name: 'recurring_correlation_id',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_subscription_id')) {
      col.fields.add(
        new TextField({
          name: 'recurring_subscription_id',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('recurring_authorized_at')) {
      col.fields.add(
        new DateField({
          name: 'recurring_authorized_at',
          required: false,
        }),
      )
    }

    app.save(col)

    try {
      col.addIndex('idx_subscriptions_rec_corr', false, 'recurring_correlation_id', '')
      app.save(col)
    } catch (_) {}

    try {
      col.addIndex('idx_subscriptions_rec_status', false, 'recurring_status', '')
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('subscriptions')
      try {
        col.removeIndex('idx_subscriptions_rec_corr')
      } catch (_) {}
      try {
        col.removeIndex('idx_subscriptions_rec_status')
      } catch (_) {}

      const fieldNames = [
        'recurring_status',
        'recurring_journey',
        'recurring_link',
        'recurring_emv',
        'recurring_correlation_id',
        'recurring_subscription_id',
        'recurring_authorized_at',
      ]

      for (const fn of fieldNames) {
        const f = col.fields.getByName(fn)
        if (f) col.fields.removeById(f.id)
      }
      app.save(col)
    } catch (_) {}
  },
)
