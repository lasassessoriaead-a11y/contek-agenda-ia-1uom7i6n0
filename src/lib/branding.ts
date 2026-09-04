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
    tagline: 'Agendar ficou simples.',
    badgeText: 'AGYLI PRO',
    description:
      'Mais tempo para o que realmente importa. Gestão com inteligência artificial, financeiro e agendamento inteligente.',
    colors: {
      primary: '#3B82F6', // Azul principal
      primaryHover: '#2563EB', // Azul escuro / hover ativo
      primaryLight: '#E0F2FE', // Azul claro (#E0F2FE)
      primaryBg: '#0F172A', // Azul-marinho (#0F172A)
      accent: '#8B5CF6', // Violeta (#8B5CF6)
      border: '#BFDBFE', // Azul suave borda
      badgeBg: '#EFF6FF',
      badgeText: '#1E40AF',
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
  'www.agyli.com.br': 'agyli',
  'markaly.com.br': 'markaly',
  'app.markaly.com.br': 'markaly',
  'www.markaly.com.br': 'markaly',
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
