import { ProductType } from '@/types'

export interface ProductBranding {
  id: ProductType
  name: string
  fullName: string
  tagline: string
  badgeText: string
  description: string
  colors: {
    primary: string
    primaryHover: string
    primaryLight: string
    primaryBg: string
    accent: string
    border: string
    badgeBg: string
    badgeText: string
  }
}

export const PRODUCTS_CONFIG: Record<ProductType, ProductBranding> = {
  agyli: {
    id: 'agyli',
    name: 'AGYLI',
    fullName: 'AGYLI Agenda & IA',
    tagline: 'Plataforma Completa com IA e Gestão Financeira',
    badgeText: 'AGYLI PRO',
    description:
      'Gestão integral com inteligência artificial, financeiro, agendamentos e automações.',
    colors: {
      primary: '#059669', // emerald-600
      primaryHover: '#10b981', // emerald-500
      primaryLight: '#d1fae5', // emerald-100
      primaryBg: '#064e3b', // emerald-900
      accent: '#6366f1', // indigo-500
      border: '#a7f3d0', // emerald-200
      badgeBg: '#ecfdf5',
      badgeText: '#065f46',
    },
  },
  markaly: {
    id: 'markaly',
    name: 'MARKALY',
    fullName: 'MARKALY Agendamento',
    tagline: 'Agendamento Simples, Rápido e Descomplicado',
    badgeText: 'MARKALY',
    description:
      'Focado no fluxo essencial de agendamento de consultas e serviços, rápido e intuitivo.',
    colors: {
      primary: '#0284c7', // sky-600
      primaryHover: '#0ea5e9', // sky-500
      primaryLight: '#e0f2fe', // sky-100
      primaryBg: '#0c4a6e', // sky-900
      accent: '#3b82f6', // blue-500
      border: '#bae6fd', // sky-200
      badgeBg: '#f0f9ff',
      badgeText: '#0369a1',
    },
  },
}

/**
 * Mapeamento de hostname para detecção multi-domínio futura.
 * Exemplo:
 * agyli.com.br -> agyli
 * app.markaly.com.br -> markaly
 */
export const DOMAIN_PRODUCT_MAP: Record<string, ProductType> = {
  'agyli.com.br': 'agyli',
  'app.agyli.com.br': 'agyli',
  'markaly.com.br': 'markaly',
  'app.markaly.com.br': 'markaly',
}

/**
 * Resolve o produto por hostname com fallback para o produto da organização ou padrão 'agyli'.
 */
export function resolveProductByDomain(
  hostname: string,
  fallbackProduct: ProductType = 'agyli',
): ProductType {
  const cleanHost = hostname.toLowerCase().split(':')[0]
  if (DOMAIN_PRODUCT_MAP[cleanHost]) {
    return DOMAIN_PRODUCT_MAP[cleanHost]
  }
  return fallbackProduct
}

export function getProductBranding(product: ProductType = 'agyli'): ProductBranding {
  return PRODUCTS_CONFIG[product] || PRODUCTS_CONFIG.agyli
}
