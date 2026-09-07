/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')
    if (!col.fields.getByName('is_overlap')) {
      col.fields.add(new BoolField({ name: 'is_overlap' }))
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('appointments')
    if (col.fields.getByName('is_overlap')) {
      col.fields.removeByName('is_overlap')
      app.save(col)
    }
  },
)
