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

    const planSlug = (org.getString('plan_id') || '').toLowerCase()
    let isEssencial = planSlug === 'agyli-essencial'
    if (!isEssencial) {
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + org.id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
          if (planRec && planRec.getString('slug') === 'agyli-essencial') {
            isEssencial = true
          }
        }
      } catch (_) {}
    }

    if (isEssencial) {
      return e.json(403, {
        error:
          'O módulo financeiro é exclusivo do plano AGYLI Pro. Faça upgrade para ter controle financeiro completo e comissões.',
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

    const planSlug = (org.getString('plan_id') || '').toLowerCase()
    let isEssencial = planSlug === 'agyli-essencial'
    if (!isEssencial) {
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + org.id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
          if (planRec && planRec.getString('slug') === 'agyli-essencial') {
            isEssencial = true
          }
        }
      } catch (_) {}
    }

    if (isEssencial) {
      return e.json(403, {
        error:
          'O módulo financeiro é exclusivo do plano AGYLI Pro. Faça upgrade para registrar e editar transações financeiras.',
      })
    }
  } catch (err) {
    console.log('[product_enforcement] error loading org for payment update:', err)
  }

  return e.next()
}, 'payments')

onRecordDeleteRequest((e) => {
  const record = e.record
  const orgId = record.getString('organization_id')
  if (!orgId) return e.next()

  try {
    const org = $app.findRecordById('organizations', orgId)
    const product = org.getString('product') || 'agyli'
    if (product === 'markaly') {
      return e.json(403, {
        error:
          'O módulo financeiro não está incluído no produto MARKALY. A exclusão de lançamentos é exclusiva do produto AGYLI.',
      })
    }

    const planSlug = (org.getString('plan_id') || '').toLowerCase()
    let isEssencial = planSlug === 'agyli-essencial'
    if (!isEssencial) {
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + org.id + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
          if (planRec && planRec.getString('slug') === 'agyli-essencial') {
            isEssencial = true
          }
        }
      } catch (_) {}
    }

    if (isEssencial) {
      return e.json(403, {
        error:
          'O módulo financeiro é exclusivo do plano AGYLI Pro. Faça upgrade para gerenciar o histórico financeiro.',
      })
    }
  } catch (err) {
    console.log('[product_enforcement] error loading org for payment delete:', err)
  }

  return e.next()
}, 'payments')

onRecordListRequest((e) => {
  const user = e.auth
  if (!user) return e.next()

  // 1. Tentar obter a organização alvo pelo query/filter da requisição ou pelo registro do usuário
  let targetOrgId = ''
  try {
    const rawFilter = e.requestInfo().query?.filter || ''
    const match = rawFilter.match(/organization_id\s*=\s*["']([^"']+)["']/)
    if (match && match[1]) {
      targetOrgId = match[1]
    }
  } catch (_) {}

  if (!targetOrgId) {
    targetOrgId = user.getString('organization_id')
  }

  if (!targetOrgId) {
    try {
      const orgUser = $app.findFirstRecordByData('organization_users', 'user_id', user.id)
      if (orgUser) targetOrgId = orgUser.getString('organization_id')
    } catch (_) {}
  }

  if (targetOrgId) {
    try {
      const org = $app.findRecordById('organizations', targetOrgId)
      const product = org.getString('product') || 'agyli'
      if (product === 'markaly') {
        return e.json(403, {
          error:
            'Acesso ao módulo financeiro bloqueado. O produto MARKALY não inclui relatórios nem lançamentos financeiros.',
        })
      }

      const planSlug = (org.getString('plan_id') || '').toLowerCase()
      let isEssencial = planSlug === 'agyli-essencial'
      if (!isEssencial) {
        try {
          const subs = $app.findRecordsByFilter(
            'subscriptions',
            'organization_id = "' + org.id + '"',
            '-created',
            1,
            0,
          )
          if (subs && subs.length > 0) {
            const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
            if (planRec && planRec.getString('slug') === 'agyli-essencial') {
              isEssencial = true
            }
          }
        } catch (_) {}
      }

      if (isEssencial) {
        return e.json(403, {
          error:
            'Acesso ao módulo financeiro bloqueado. O plano AGYLI Essencial é focado em agendamento para 1 profissional. Faça upgrade para o AGYLI Pro para gerenciar pagamentos e comissões.',
        })
      }
    } catch (_) {}
  }

  return e.next()
}, 'payments')

// Validação do limite de profissionais por plano (ex: 1 para AGYLI Essencial, 5 para AGYLI Pro)
onRecordCreateRequest((e) => {
  const record = e.record
  const orgId = record.getString('organization_id')
  if (!orgId) return e.next()

  try {
    const org = $app.findRecordById('organizations', orgId)
    let maxProfs = 5 // default Pro
    const planSlug = (org.getString('plan_id') || '').toLowerCase()

    if (planSlug === 'agyli-essencial') {
      maxProfs = 1
    } else {
      try {
        const subs = $app.findRecordsByFilter(
          'subscriptions',
          'organization_id = "' + orgId + '"',
          '-created',
          1,
          0,
        )
        if (subs && subs.length > 0) {
          const planRec = $app.findRecordById('plans', subs[0].getString('plan_id'))
          if (planRec) {
            const limit = planRec.getInt('max_professionals')
            if (limit > 0) maxProfs = limit
          }
        }
      } catch (_) {}
    }

    const currentCount = $app.countRecords('professionals', 'organization_id = "' + orgId + '"')
    if (currentCount >= maxProfs) {
      return e.json(403, {
        error:
          'Limite de profissionais atingido para o plano da sua empresa (máximo ' +
          maxProfs +
          ' profissional' +
          (maxProfs > 1 ? 'is' : '') +
          '). Faça upgrade para adicionar mais profissionais.',
      })
    }
  } catch (err) {
    console.log('[product_enforcement] error checking prof limit:', err)
  }

  return e.next()
}, 'professionals')
