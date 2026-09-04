/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Adicionar campo date_exceptions na coleção professionals (se não existir)
    const profCol = app.findCollectionByNameOrId('professionals')
    if (!profCol.fields.getByName('date_exceptions')) {
      profCol.fields.add(
        new JSONField({
          name: 'date_exceptions',
          required: false,
        }),
      )
      app.save(profCol)
    }

    // 2. Proteger professional_services com isolamento multi-tenant por organization_id
    // Garantir que organization_id seja preenchido em registros legados
    try {
      app
        .db()
        .newQuery(`
        UPDATE professional_services
        SET organization_id = (
          SELECT organization_id FROM professionals WHERE professionals.id = professional_services.professional_id
        )
        WHERE organization_id IS NULL OR organization_id = ''
      `)
        .execute()
    } catch (sqlErr) {
      console.log(
        '[migration 0010] Error backfilling professional_services organization_id:',
        sqlErr,
      )
    }

    const psCol = app.findCollectionByNameOrId('professional_services')
    const orgSecurityRule =
      "@request.auth.id != '' && @collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id"

    psCol.listRule = orgSecurityRule
    psCol.viewRule = orgSecurityRule
    psCol.createRule = orgSecurityRule
    psCol.updateRule = orgSecurityRule
    psCol.deleteRule = orgSecurityRule
    app.save(psCol)
  },
  (app) => {
    try {
      const profCol = app.findCollectionByNameOrId('professionals')
      if (profCol.fields.getByName('date_exceptions')) {
        profCol.fields.removeByName('date_exceptions')
        app.save(profCol)
      }
    } catch (_) {}
  },
)
