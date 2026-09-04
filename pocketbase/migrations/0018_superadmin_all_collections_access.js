/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Garantir que o SuperAdmin tem acesso irrestrito às coleções operacionais do tenant
    // (business_settings, services, professionals, appointments, professional_services, clients, payments, organization_users)
    const orgSecurityRuleWithSuperAdmin =
      "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"

    const collectionsToUpdate = [
      'business_settings',
      'services',
      'professionals',
      'appointments',
      'professional_services',
    ]

    for (const colName of collectionsToUpdate) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = orgSecurityRuleWithSuperAdmin
        col.viewRule = orgSecurityRuleWithSuperAdmin
        col.createRule = orgSecurityRuleWithSuperAdmin
        col.updateRule = orgSecurityRuleWithSuperAdmin
        col.deleteRule = orgSecurityRuleWithSuperAdmin
        app.save(col)
      } catch (err) {
        console.log(`[migration 0018] Error updating rule for ${colName}:`, err)
      }
    }

    // 2. Garantir que clients e payments também tenham list/view/update/create/delete com bypass de superadmin
    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      clientsCol.listRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      clientsCol.viewRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      clientsCol.createRule = '' // criação pública de agendamento pode criar cliente
      clientsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      clientsCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      app.save(clientsCol)
    } catch (err) {
      console.log('[migration 0018] Error updating clients rule:', err)
    }

    try {
      const paymentsCol = app.findCollectionByNameOrId('payments')
      paymentsCol.listRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      paymentsCol.viewRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      paymentsCol.createRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      paymentsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      paymentsCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      app.save(paymentsCol)
    } catch (err) {
      console.log('[migration 0018] Error updating payments rule:', err)
    }

    try {
      const orgUsersCol = app.findCollectionByNameOrId('organization_users')
      orgUsersCol.listRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      orgUsersCol.viewRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      orgUsersCol.createRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      orgUsersCol.updateRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      orgUsersCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.is_super_admin = true || (@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id))"
      app.save(orgUsersCol)
    } catch (err) {
      console.log('[migration 0018] Error updating organization_users rule:', err)
    }
  },
  (app) => {},
)
