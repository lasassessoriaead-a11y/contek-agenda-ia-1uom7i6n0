/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Garantir que o SuperAdmin tem permissão de list/view/update/create em organizations
    try {
      const orgs = app.findCollectionByNameOrId('organizations')
      orgs.listRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= id))"
      orgs.viewRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= id))"
      orgs.updateRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= id))"
      app.save(orgs)
    } catch (err) {
      console.log('[migration 0016] Error updating organizations rules:', err)
    }

    // 2. Garantir que subscriptions permite super admin visualizar e gerenciar
    try {
      const subs = app.findCollectionByNameOrId('subscriptions')
      subs.listRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || organization_id = @request.auth.organization_id)"
      subs.viewRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || organization_id = @request.auth.organization_id)"
      app.save(subs)
    } catch (err) {
      console.log('[migration 0016] Error updating subscriptions rules:', err)
    }
  },
  (app) => {},
)
