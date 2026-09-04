/// <reference path="../pb_data/types.d.ts" />

/**
 * Enforcement no backend para restrições por produto (MARKALY vs AGYLI).
 * Organizações MARKALY não têm acesso ao módulo financeiro (coleção payments).
 * Bloqueia inserções, atualizações ou exclusões de lançamentos financeiros com HTTP 403 e mensagem clara.
 */

onRecordCreateRequest((e) => {
  const record = e.record
  const orgId = record.getString('organization_id')
  if (!orgId) return e.next()

  try {
    const org = $app.findRecordById('organizations', orgId)
    const product = org.getString('product') || 'agyli'
    if (product === 'markaly') {
      return e.json(403, {
        error:
          'O módulo financeiro não está incluído no produto MARKALY. O registro de lançamentos e pagamentos é exclusivo do produto AGYLI.',
      })
    }
  } catch (err) {
    console.log('[product_enforcement] error loading org for payment create:', err)
  }

  return e.next()
}, 'payments')

onRecordUpdateRequest((e) => {
  const record = e.record
  const orgId = record.getString('organization_id')
  if (!orgId) return e.next()

  try {
    const org = $app.findRecordById('organizations', orgId)
    const product = org.getString('product') || 'agyli'
    if (product === 'markaly') {
      return e.json(403, {
        error:
          'O módulo financeiro não está incluído no produto MARKALY. A alteração de lançamentos é exclusiva do produto AGYLI.',
      })
    }
  } catch (err) {
    console.log('[product_enforcement] error loading org for payment update:', err)
  }

  return e.next()
}, 'payments')

onRecordListRequest((e) => {
  const user = e.auth
  if (!user) return e.next()
  if (user.getBool('is_super_admin')) return e.next()

  let orgId = user.getString('organization_id')
  if (!orgId) {
    try {
      const orgUser = $app.findFirstRecordByData('organization_users', 'user_id', user.id)
      if (orgUser) orgId = orgUser.getString('organization_id')
    } catch (_) {}
  }

  if (orgId) {
    try {
      const org = $app.findRecordById('organizations', orgId)
      const product = org.getString('product') || 'agyli'
      if (product === 'markaly') {
        return e.json(403, {
          error:
            'Acesso ao módulo financeiro bloqueado. O produto MARKALY não inclui relatórios nem lançamentos financeiros.',
        })
      }
    } catch (_) {}
  }

  return e.next()
}, 'payments')
