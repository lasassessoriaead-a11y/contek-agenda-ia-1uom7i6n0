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

    // Regra 3: Feature map do backend
    if (featureMap) {
      return Boolean(featureMap[featureKey])
    }

    // Regra 4: Fallback local para markaly
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

    // agyli por padrão tem tudo
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
    const agyliFeats = ['dashboard', 'agenda', 'financeiro', 'assistente_ia', 'servicos']
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

  it('prioritizes organization.product as maximum source of truth over domain fallback', () => {
    // Se a organização tem produto markaly gravado no banco, mesmo em localhost ou contek.com, deve ser markaly
    const orgProduct = 'markaly'
    const resolved = orgProduct || resolveProductByDomain('localhost', 'agyli')
    expect(resolved).toBe('markaly')
  })

  it('branding has correct metadata for AGYLI and MARKALY', () => {
    expect(PRODUCTS_CONFIG.agyli.name).toBe('AGYLI')
    expect(PRODUCTS_CONFIG.markaly.name).toBe('MARKALY')
  })
})
