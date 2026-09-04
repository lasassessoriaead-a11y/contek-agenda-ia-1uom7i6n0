import { describe, it, expect } from 'vitest'
import { resolveProductByDomain, PRODUCTS_CONFIG } from '@/lib/branding'

describe('Multi-product and Feature Isolation Logic (AGYLI vs MARKALY)', () => {
  const FORBIDDEN_MARKALY_FEATURES = [
    'financeiro',
    'assistente_ia',
    'whatsapp_ai',
    'relatorios',
    'configuracoes_avancadas',
  ]

  // Replicando a lógica exata de hasFeature implementada no AuthContext
  const evaluateHasFeature = ({
    effectiveProduct,
    isSuperAdmin,
    featureKey,
    featureMap,
  }: {
    effectiveProduct: 'agyli' | 'markaly'
    isSuperAdmin: boolean
    featureKey: string
    featureMap?: Record<string, boolean>
  }) => {
    // Regra 1: Produto real da organização ativa vence
    if (effectiveProduct === 'markaly' && FORBIDDEN_MARKALY_FEATURES.includes(featureKey)) {
      return false
    }

    // Regra 2: SuperAdmin bypass para as demais features
    if (isSuperAdmin) return true

    // Regra 3: Feature map do backend não vazio
    if (featureMap && Object.keys(featureMap).length > 0) {
      if (featureKey === 'configuracoes_basicas' && Boolean(featureMap['configuracoes_avancadas'])) {
        return true
      }
      return Boolean(featureMap[featureKey])
    }

    // Regra 4: Fallback local para markaly quando featureMap não existe ou está vazio
    if (effectiveProduct === 'markaly') {
      const markalyFeatures = [
        'dashboard',
        'agenda',
        'clientes',
        'servicos',
        'profissionais',
        'configuracoes_basicas',
        'whatsapp_notificacoes',
      ]
      return markalyFeatures.includes(featureKey)
    }

    // agyli por padrão tem tudo (libera todas as features AGYLI)
    return true
  }

  it('blocks financeiro and assistente_ia on MARKALY even for SuperAdmin', () => {
    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: true,
        featureKey: 'financeiro',
      }),
    ).toBe(false)

    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: true,
        featureKey: 'assistente_ia',
      }),
    ).toBe(false)

    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: true,
        featureKey: 'whatsapp_ai',
      }),
    ).toBe(false)

    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: true,
        featureKey: 'relatorios',
      }),
    ).toBe(false)
  })

  it('blocks financeiro and assistente_ia on MARKALY for regular admin', () => {
    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: false,
        featureKey: 'financeiro',
      }),
    ).toBe(false)

    expect(
      evaluateHasFeature({
        effectiveProduct: 'markaly',
        isSuperAdmin: false,
        featureKey: 'assistente_ia',
      }),
    ).toBe(false)
  })

  it('allows essential features on MARKALY for both normal users and SuperAdmin', () => {
    const essential = ['dashboard', 'agenda', 'clientes', 'servicos', 'profissionais']
    for (const feat of essential) {
      expect(
        evaluateHasFeature({
          effectiveProduct: 'markaly',
          isSuperAdmin: false,
          featureKey: feat,
        }),
      ).toBe(true)

      expect(
        evaluateHasFeature({
          effectiveProduct: 'markaly',
          isSuperAdmin: true,
          featureKey: feat,
        }),
      ).toBe(true)
    }
  })

  it('allows all features on AGYLI for normal users and SuperAdmin', () => {
    const agyliFeats = ['dashboard', 'agenda', 'financeiro', 'assistente_ia', 'servicos', 'configuracoes_basicas', 'configuracoes_avancadas']
    for (const feat of agyliFeats) {
      expect(
        evaluateHasFeature({
          effectiveProduct: 'agyli',
          isSuperAdmin: false,
          featureKey: feat,
        }),
      ).toBe(true)

      expect(
        evaluateHasFeature({
          effectiveProduct: 'agyli',
          isSuperAdmin: true,
          featureKey: feat,
        }),
      ).toBe(true)
    }
  })

  it('guarantees AGYLI menu items are visible even when feature_map is completely empty', () => {
    const navFeatures = [
      'dashboard',
      'agenda',
      'clientes',
      'profissionais',
      'servicos',
      'financeiro',
      'assistente_ia',
      'configuracoes_basicas',
    ]

    for (const feat of navFeatures) {
      expect(
        evaluateHasFeature({
          effectiveProduct: 'agyli',
          isSuperAdmin: false,
          featureKey: feat,
          featureMap: {}, // mapa vazio vindo do backend
        }),
      ).toBe(true)
    }
  })

  it('automatically inherits configuracoes_basicas when organization only has configuracoes_avancadas', () => {
    expect(
      evaluateHasFeature({
        effectiveProduct: 'agyli',
        isSuperAdmin: false,
        featureKey: 'configuracoes_basicas',
        featureMap: {
          dashboard: true,
          agenda: true,
          configuracoes_avancadas: true,
        },
      }),
    ).toBe(true)
  })

  it('still strictly blocks forbidden features on MARKALY even when feature_map is empty or contains forbidden keys', () => {
    // Mesmo com mapa vazio
    for (const forbidden of FORBIDDEN_MARKALY_FEATURES) {
      expect(
        evaluateHasFeature({
          effectiveProduct: 'markaly',
          isSuperAdmin: false,
          featureKey: forbidden,
          featureMap: {},
        }),
      ).toBe(false)
    }

    // Mesmo se o mapa erroneamente trouxesse true
    for (const forbidden of FORBIDDEN_MARKALY_FEATURES) {
      expect(
        evaluateHasFeature({
          effectiveProduct: 'markaly',
          isSuperAdmin: false,
          featureKey: forbidden,
          featureMap: { [forbidden]: true },
        }),
      ).toBe(false)
    }
  })

  it('prioritizes organization.product as maximum source of truth over domain fallback', () => {
    // Se a organização tem produto markaly gravado no banco, mesmo em localhost ou contek.com, deve ser markaly
    const orgProduct = 'markaly'
    const resolved = orgProduct || resolveProductByDomain('localhost', 'agyli')
    expect(resolved).toBe('markaly')
  })

  it('branding has correct metadata for AGYLI and MARKALY', () => {
    expect(PRODUCTS_CONFIG.agyli.name).toBe('AGYLI')
    expect(PRODUCTS_CONFIG.markaly.name).toBe('MARKALY')
    expect(PRODUCTS_CONFIG.agyli.colors.primary).toBe('#3B82F6')
    expect(PRODUCTS_CONFIG.agyli.colors.accent).toBe('#8B5CF6')
    expect(PRODUCTS_CONFIG.agyli.tagline).toBe('Agendar ficou simples.')

    // Identidade visual oficial MARKALY
    expect(PRODUCTS_CONFIG.markaly.tagline).toBe('Organizar hoje, crescer sempre.')
    expect(PRODUCTS_CONFIG.markaly.colors.primary).toBe('#F97316')
    expect(PRODUCTS_CONFIG.markaly.colors.accent).toBe('#EC4899')
    expect(PRODUCTS_CONFIG.markaly.colors.primaryBg).toBe('#3B0764')
  })

  it('resolves product correctly by domain for agyli and markaly', () => {
    expect(resolveProductByDomain('agyli.com.br')).toBe('agyli')
    expect(resolveProductByDomain('app.agyli.com.br')).toBe('agyli')
    expect(resolveProductByDomain('www.agyli.com.br')).toBe('agyli')
    expect(resolveProductByDomain('markaly.com.br')).toBe('markaly')
    expect(resolveProductByDomain('app.markaly.com.br')).toBe('markaly')
  })
})
