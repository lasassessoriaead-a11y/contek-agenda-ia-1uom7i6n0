/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const profCol = app.findCollectionByNameOrId('professionals')
    if (!profCol.fields.getByName('work_shifts')) {
      profCol.fields.add(
        new JSONField({
          name: 'work_shifts',
          required: false,
        }),
      )
    }
    app.save(profCol)
  },
  (app) => {
    const profCol = app.findCollectionByNameOrId('professionals')
    const field = profCol.fields.getByName('work_shifts')
    if (field) {
      profCol.fields.removeByName('work_shifts')
      app.save(profCol)
    }
  },
)
