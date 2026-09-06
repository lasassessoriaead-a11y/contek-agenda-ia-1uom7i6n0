/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // 1. Limpar users.organization_id de qualquer conta SuperAdmin para que não fique
    // "amarrada" permanentemente no banco a nenhuma empresa que tenha inspecionado.
    try {
      const superAdmins = app.findRecordsByFilter(
        'users',
        'is_super_admin = true || role = "SUPERADMIN"',
        '',
        100,
        0,
      )
      for (const su of superAdmins) {
        if (su.getString('organization_id')) {
          su.set('organization_id', '')
          app.save(su)
        }
      }
    } catch (err) {
      console.log('[migration 0023] clean superadmin organization_id:', err)
    }
  },
  (app) => {},
)
