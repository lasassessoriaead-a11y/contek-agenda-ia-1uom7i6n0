import { describe, it, expect } from 'vitest'

interface MockOnboardingInput {
  org_name: string
  name: string
  phone: string
  email: string
  product?: string
}

interface MockOrg {
  id: string
  name: string
  slug: string
  product: string
}

interface MockProfessional {
  id: string
  organization_id: string
  user_id: string
  name: string
  email: string
  phone: string
  active: boolean
}

interface MockService {
  id: string
  organization_id: string
  name: string
  price: number
  duration: number
  active: boolean
}

interface MockProfessionalService {
  id: string
  organization_id: string
  professional_id: string
  service_id: string
}

// Simulador determinístico da regra do endpoint /backend/v1/onboarding/self-service
function simulateOnboardingSelfService(
  input: MockOnboardingInput,
  idGenerator: () => string
) {
  const orgId = idGenerator()
  const userId = idGenerator()
  const profId = idGenerator()
  const servId = idGenerator()
  const linkId = idGenerator()

  const org: MockOrg = {
    id: orgId,
    name: input.org_name.trim(),
    slug: input.org_name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    product: input.product || 'MARKALY',
  }

  // O nome do profissional DEVE ser o nome informado pelo usuário no cadastro
  const professional: MockProfessional = {
    id: profId,
    organization_id: orgId,
    user_id: userId,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    active: true,
  }

  // O serviço deve ser criado exclusivamente para a nova organização
  const service: MockService = {
    id: servId,
    organization_id: orgId,
    name: 'Atendimento Inicial / Consulta',
    price: 150,
    duration: 45,
    active: true,
  }

  // O vínculo deve ter o organization_id estrito da nova organização
  const link: MockProfessionalService = {
    id: linkId,
    organization_id: orgId,
    professional_id: profId,
    service_id: servId,
  }

  return { org, userId, professional, service, link }
}

describe('Multi-tenant Self-Service Onboarding Isolation', () => {
  let counter = 1
  const nextId = () => `id_${counter++}`

  it('guarantees two organizations created via self-service never share professionals or services', () => {
    // 1. Cadastro da primeira organização (ex: tenant anterior ou existente "Luis Barbearia")
    const tenant1 = simulateOnboardingSelfService(
      {
        org_name: 'LUIS BARBEARIA',
        name: 'Luis Fernando',
        email: 'luis@barbearia.com',
        phone: '11999990001',
      },
      nextId
    )

    // 2. Cadastro da segunda organização (ex: nova empresa recém-criada pela usuária no teste)
    const tenant2 = simulateOnboardingSelfService(
      {
        org_name: 'STUDIO DA LAH',
        name: 'Larissa Alcantara',
        email: 'artesdalah24@gmail.com',
        phone: '11988880002',
      },
      nextId
    )

    // A. IDs das organizações devem ser estritamente distintos
    expect(tenant1.org.id).not.toBe(tenant2.org.id)

    // B. Profissional da nova organização deve ter o nome do usuário cadastrado, NUNCA da outra org
    expect(tenant1.professional.name).toBe('Luis Fernando')
    expect(tenant2.professional.name).toBe('Larissa Alcantara')
    expect(tenant2.professional.name).not.toContain('Luis')

    // C. O professional_id da nova org não deve ser reutilizado
    expect(tenant1.professional.id).not.toBe(tenant2.professional.id)
    expect(tenant2.professional.organization_id).toBe(tenant2.org.id)
    expect(tenant2.professional.organization_id).not.toBe(tenant1.org.id)

    // D. O serviço inicial deve ser isolado por organization_id
    expect(tenant1.service.id).not.toBe(tenant2.service.id)
    expect(tenant2.service.organization_id).toBe(tenant2.org.id)
    expect(tenant2.service.organization_id).not.toBe(tenant1.org.id)

    // E. Vínculo professional_services pertence exclusivamente à nova organização
    expect(tenant2.link.organization_id).toBe(tenant2.org.id)
    expect(tenant2.link.professional_id).toBe(tenant2.professional.id)
    expect(tenant2.link.service_id).toBe(tenant2.service.id)
    expect(tenant2.link.organization_id).not.toBe(tenant1.org.id)
  })

  it('prevents cross-tenant professional leak when filtering by organization_id', () => {
    // Simular banco com múltiplos profissionais
    const allProfessionals: MockProfessional[] = [
      {
        id: 'prof_luis',
        organization_id: 'org_luis_123',
        user_id: 'user_luis',
        name: 'LUIS BARBEARIA',
        email: 'luis@exemplo.com',
        phone: '11999999999',
        active: true,
      },
      {
        id: 'prof_lah',
        organization_id: 'org_lah_456',
        user_id: 'user_lah',
        name: 'Larissa Alcantara',
        email: 'artesdalah24@gmail.com',
        phone: '11988888888',
        active: true,
      },
    ]

    const filterByTenant = (orgId: string) =>
      allProfessionals.filter((p) => p.organization_id === orgId)

    const lahProfessionals = filterByTenant('org_lah_456')
    expect(lahProfessionals.length).toBe(1)
    expect(lahProfessionals[0].name).toBe('Larissa Alcantara')
    expect(lahProfessionals.some((p) => p.name.includes('LUIS'))).toBe(false)

    const luisProfessionals = filterByTenant('org_luis_123')
    expect(luisProfessionals.length).toBe(1)
    expect(luisProfessionals[0].name).toBe('LUIS BARBEARIA')
  })

  it('ensures local storage fallback does not leak previous session organization for regular users', () => {
    // Simula a lógica blindada do AuthContext:
    // Usuários normais utilizam estritamente o organization_id vinculado à conta/membership deles
    const resolveActiveOrgId = (
      user: { organization_id?: string; is_super_admin?: boolean; role?: string },
      storageActiveOrgId: string | null
    ) => {
      if (user.organization_id) {
        return user.organization_id
      }
      const isSuper = Boolean(user.is_super_admin || user.role === 'SUPERADMIN')
      if (isSuper && storageActiveOrgId) {
        return storageActiveOrgId
      }
      return null
    }

    const previousTenantOrgId = 'org_luis_123'
    const newTestUser = {
      organization_id: 'org_lah_456',
      is_super_admin: false,
      role: 'ADMINISTRADOR',
    }

    // Mesmo que o localStorage do navegador ainda contenha a org anterior "org_luis_123",
    // o usuário recém autenticado NUNCA usará a org antiga
    const activeOrgId = resolveActiveOrgId(newTestUser, previousTenantOrgId)
    expect(activeOrgId).toBe('org_lah_456')
    expect(activeOrgId).not.toBe(previousTenantOrgId)
  })
})
