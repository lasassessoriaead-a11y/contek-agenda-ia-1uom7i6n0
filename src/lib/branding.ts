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
    fullName: 'MARKALY Gestão & Agendamento',
    tagline: 'Organizar hoje, crescer sempre.',
    badgeText: 'MARKALY',
    description:
      'A MARKALY é a solução completa para gestão de agendamentos, clientes e serviços, com praticidade, controle e resultados reais.',
    colors: {
      primary: '#F97316', // Laranja principal
      primaryHover: '#EA580C', // Laranja hover
      primaryLight: '#FEF3E2', // Bege claro oficial
      primaryBg: '#3B0764', // Roxo escuro oficial
      accent: '#EC4899', // Rosa / Coral secundária
      border: '#FDE68A', // Tom suave de borda
      badgeBg: '#FEF3E2', // Bege claro
      badgeText: '#3B0764', // Roxo escuro
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
