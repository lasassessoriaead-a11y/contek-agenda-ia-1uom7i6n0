/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Retirar leitura pública direta das coleções internas agora que o endpoint público existe
    const orgSecurityRule =
      "@request.auth.id != '' && @collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id"

    const collectionsToSecure = [
      'organizations',
      'services',
      'professionals',
      'appointments',
      'business_settings',
    ]

    for (const colName of collectionsToSecure) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        if (colName === 'organizations') {
          col.listRule =
            "@request.auth.id != '' && @collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= id"
          col.viewRule =
            "@request.auth.id != '' && @collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= id"
        } else {
          col.listRule = orgSecurityRule
          col.viewRule = orgSecurityRule
        }
        app.save(col)
      } catch (err) {
        console.log(`[migration 0011] Error updating rule for ${colName}:`, err)
      }
    }
  },
  (app) => {},
)
