/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('contek_charges')

    if (!col.fields.getByName('pix_brcode')) {
      col.fields.add(
        new TextField({
          name: 'pix_brcode',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('pix_qrcode_image')) {
      col.fields.add(
        new TextField({
          name: 'pix_qrcode_image',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('correlation_id')) {
      col.fields.add(
        new TextField({
          name: 'correlation_id',
          required: false,
        }),
      )
    }

    if (!col.fields.getByName('woovi_charge_id')) {
      col.fields.add(
        new TextField({
          name: 'woovi_charge_id',
          required: false,
        }),
      )
    }

    app.save(col)

    // Adiciona índice em correlation_id para busca rápida e segura no webhook
    try {
      col.addIndex('idx_contek_charges_correlation_id', false, 'correlation_id', '')
      app.save(col)
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('contek_charges')
      col.removeIndex('idx_contek_charges_correlation_id')
      const f1 = col.fields.getByName('pix_brcode')
      if (f1) col.fields.removeById(f1.id)
      const f2 = col.fields.getByName('pix_qrcode_image')
      if (f2) col.fields.removeById(f2.id)
      const f3 = col.fields.getByName('correlation_id')
      if (f3) col.fields.removeById(f3.id)
      const f4 = col.fields.getByName('woovi_charge_id')
      if (f4) col.fields.removeById(f4.id)
      app.save(col)
    } catch (_) {}
  },
)
