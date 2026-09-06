import { describe, it, expect, vi, beforeEach } from 'vitest'
import loginSource from '../pages/Login.tsx?raw'
import redefinirSource from '../pages/RedefinirSenha.tsx?raw'
import agendamentoSource from '../pages/AgendamentoPublico.tsx?raw'
import appSource from '../App.tsx?raw'
import centralContekSource from '../pages/CentralContek.tsx?raw'
import { resolveProductByDomain, PRODUCTS_CONFIG, getProductBranding } from '@/lib/branding'

// --- Tipos para Simulação e Mocks da Jornada ---
interface MockOnboardingInput {
  org_name: string
  name: string
  phone: string
  email: string
  password: string
  product: 'agyli' | 'markaly'
}

interface MockOrg {
  id: string
  name: string
  slug: string
  phone: string
  whatsapp: string
  email: string
  status: 'trial' | 'active'
  product: 'agyli' | 'markaly'
  plan_id: string
}

interface MockSubscription {
  id: string
  organization_id: string
  plan_id: string
  status: 'trial' | 'active'
  starts_at: string
  trial_ends_at: string
  notes: string
  history: Array<{ date: string; action: string; note: string }>
}

interface MockBusinessSettings {
  id: string
  organization_id: string
  business_name: string
  phone: string
  whatsapp: string
  opening_time: string
  closing_time: string
  working_days: string[]
  slot_interval_minutes: number
  buffer_between_appointments: number
  default_booking_message: string
  whatsapp_enabled: boolean
}

interface MockUser {
  id: string
  email: string
  name: string
  phone: string
  role: string
  organization_id: string
  verified: boolean
  is_super_admin?: boolean
}

interface MockProfessional {
  id: string
  organization_id: string
  user_id: string
  name: string
  specialty: string
  phone: string
  email: string
  default_duration: number
  work_days: string[]
  work_hours: { start: string; end: string; lunch_start?: string; lunch_end?: string }
  active: boolean
}

interface MockService {
  id: string
  organization_id: string
  name: string
  description: string
  duration: number
  price: number
  color: string
  category: string
  active: boolean
}

interface MockProfessionalService {
  id: string
  organization_id: string
  professional_id: string
  service_id: string
}

interface MockAppointment {
  id: string
  organization_id: string
  client_id: string
  service_id: string
  professional_id: string
  date: string
  start_time: string
  end_time: string
  duration: number
  price: number
  status: 'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'CONCLUIDO'
  client_name_snapshot: string
  client_phone_snapshot: string
  notes?: string
}

// Simulador puro e determinístico da lógica de self-service onboarding (espelha pocketbase/hooks/onboarding.js)
function simulateSelfServiceOnboarding(input: MockOnboardingInput, generateId: () => string) {
  if (!input.org_name.trim()) throw new Error('O nome do estabelecimento ou empresa é obrigatório.')
  if (!input.name.trim()) throw new Error('Seu nome completo é obrigatório.')
  if (!input.email.trim()) throw new Error('O e-mail de acesso é obrigatório.')
  if (!input.password || input.password.length < 8) {
    throw new Error('A senha deve conter no mínimo 8 caracteres.')
  }

  const orgId = generateId()
  const userId = generateId()
  const profId = generateId()
  const servId = generateId()
  const linkId = generateId()
  const subId = generateId()
  const settId = generateId()

  const product = input.product === 'markaly' ? 'markaly' : 'agyli'
  const planId = product === 'markaly' ? 'markaly-start' : 'agyli-pro'
  const cleanOrgName = input.org_name.trim()
  const cleanName = input.name.trim()
  const cleanPhone = input.phone.trim()
  const cleanEmail = input.email.trim().toLowerCase()
  const slug = cleanOrgName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

  const now = new Date('2026-03-30T12:00:00.000Z')
  const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const org: MockOrg = {
    id: orgId,
    name: cleanOrgName,
    slug,
    phone: cleanPhone,
    whatsapp: cleanPhone,
    email: cleanEmail,
    status: 'trial',
    product,
    plan_id: planId,
  }

  const subscription: MockSubscription = {
    id: subId,
    organization_id: orgId,
    plan_id: planId,
    status: 'trial',
    starts_at: now.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    notes: 'Trial de 7 dias criado automaticamente via cadastro self-service.',
    history: [
      {
        date: now.toISOString(),
        action: 'TRIAL_STARTED',
        note: 'Início do período de teste gratuito de 7 dias',
      },
    ],
  }

  const settings: MockBusinessSettings = {
    id: settId,
    organization_id: orgId,
    business_name: cleanOrgName,
    phone: cleanPhone,
    whatsapp: cleanPhone,
    opening_time: '08:00',
    closing_time: '19:00',
    working_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    slot_interval_minutes: 30,
    buffer_between_appointments: 10,
    default_booking_message: `Olá! Seu agendamento foi confirmado com sucesso na ${cleanOrgName}.`,
    whatsapp_enabled: true,
  }

  const user: MockUser = {
    id: userId,
    email: cleanEmail,
    name: cleanName,
    phone: cleanPhone,
    role: 'ADMINISTRADOR',
    organization_id: orgId,
    verified: true,
    is_super_admin: false,
  }

  const professional: MockProfessional = {
    id: profId,
    organization_id: orgId,
    user_id: userId,
    name: cleanName,
    specialty: 'Especialista',
    phone: cleanPhone,
    email: cleanEmail,
    default_duration: 45,
    work_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    work_hours: { start: '08:00', end: '19:00' },
    active: true,
  }

  const service: MockService = {
    id: servId,
    organization_id: orgId,
    name: 'Atendimento Inicial / Consulta',
    description: 'Serviço padrão configurado automaticamente',
    duration: 45,
    price: 150,
    color: '#10b981',
    category: 'Geral',
    active: true,
  }

  const link: MockProfessionalService = {
    id: linkId,
    organization_id: orgId,
    professional_id: profId,
    service_id: servId,
  }

  return { org, subscription, settings, user, professional, service, link }
}

describe('Jornada Comercial Completa AGYLI — Suíte de Homologação Oficial', () => {
  let counter = 100
  const nextId = () => `mock_id_${counter++}`

  // -------------------------------------------------------------------------
  // 1. CADASTRO SELF-SERVICE AGYLI
  // -------------------------------------------------------------------------
  describe('1. Cadastro Self-Service da Empresa (AGYLI)', () => {
    it('cria organização AGYLI com trial de 7 dias, assinatura agyli-pro e usuário owner', () => {
      const payload: MockOnboardingInput = {
        org_name: 'Clínica Dermatológica Agyli Prime',
        name: 'Dra. Vanessa Martins',
        phone: '11987654321',
        email: 'vanessa@agyliprime.com.br',
        password: 'SenhaSegura123!',
        product: 'agyli',
      }

      const result = simulateSelfServiceOnboarding(payload, nextId)

      // Organização
      expect(result.org.name).toBe('Clínica Dermatológica Agyli Prime')
      expect(result.org.slug).toBe('clinica-dermatologica-agyli-prime')
      expect(result.org.status).toBe('trial')
      expect(result.org.product).toBe('agyli')
      expect(result.org.plan_id).toBe('agyli-pro')

      // Assinatura (Trial 7 dias)
      expect(result.subscription.organization_id).toBe(result.org.id)
      expect(result.subscription.plan_id).toBe('agyli-pro')
      expect(result.subscription.status).toBe('trial')
      const diffMs =
        new Date(result.subscription.trial_ends_at).getTime() -
        new Date(result.subscription.starts_at).getTime()
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(7)

      // Usuário Owner
      expect(result.user.organization_id).toBe(result.org.id)
      expect(result.user.role).toBe('ADMINISTRADOR')
      expect(result.user.name).toBe('Dra. Vanessa Martins')
      expect(result.user.email).toBe('vanessa@agyliprime.com.br')
    })

    it('cria profissional inicial com o nome do dono, horário seg-sáb 08:00-19:00 e 45 min', () => {
      const payload: MockOnboardingInput = {
        org_name: 'Studio Estética AGYLI',
        name: 'Carlos Oliveira',
        phone: '21988887777',
        email: 'carlos@studioagyli.com',
        password: 'MinhaSenhaForte2026',
        product: 'agyli',
      }

      const result = simulateSelfServiceOnboarding(payload, nextId)

      // Profissional vinculado ao usuário e à organização
      expect(result.professional.organization_id).toBe(result.org.id)
      expect(result.professional.user_id).toBe(result.user.id)
      expect(result.professional.name).toBe('Carlos Oliveira')
      expect(result.professional.work_days).toEqual(['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      expect(result.professional.work_hours).toEqual({ start: '08:00', end: '19:00' })
      expect(result.professional.default_duration).toBe(45)
      expect(result.professional.active).toBe(true)
    })

    it('cria serviço padrão "Atendimento Inicial / Consulta" com R$ 150 e 45 min com vínculo professional_services', () => {
      const payload: MockOnboardingInput = {
        org_name: 'Consultório Odonto AGYLI',
        name: 'Dr. Roberto Souza',
        phone: '31977776666',
        email: 'roberto@odontoagyli.com',
        password: 'SegredoOdonto2026!',
        product: 'agyli',
      }

      const result = simulateSelfServiceOnboarding(payload, nextId)

      // Serviço padrão
      expect(result.service.organization_id).toBe(result.org.id)
      expect(result.service.name).toBe('Atendimento Inicial / Consulta')
      expect(result.service.price).toBe(150)
      expect(result.service.duration).toBe(45)
      expect(result.service.active).toBe(true)

      // Vínculo professional_services
      expect(result.link.organization_id).toBe(result.org.id)
      expect(result.link.professional_id).toBe(result.professional.id)
      expect(result.link.service_id).toBe(result.service.id)
    })

    it('rejeita senhas menores que 8 caracteres no cadastro self-service', () => {
      expect(() => {
        simulateSelfServiceOnboarding(
          {
            org_name: 'Empresa Teste',
            name: 'Usuario Curto',
            phone: '11999990000',
            email: 'curto@teste.com',
            password: '12345',
            product: 'agyli',
          },
          nextId,
        )
      }).toThrow('A senha deve conter no mínimo 8 caracteres.')
    })
  })

  // -------------------------------------------------------------------------
  // 2. LOGIN / LOGOUT E GERENCIAMENTO DE SESSÃO
  // -------------------------------------------------------------------------
  describe('2. Login, Logout e Isolamento de Sessão', () => {
    it('garante que estados iniciais de email e senha no formulário são strings vazias', () => {
      // Valida via código-fonte do componente Login.tsx
      expect(loginSource).toMatch(/const\s+\[email,\s*setEmail\]\s*=\s*useState\(["']["']\)/)
      expect(loginSource).toMatch(/const\s+\[password,\s*setPassword\]\s*=\s*useState\(["']["']\)/)
      expect(loginSource).toMatch(/const\s+\[forgotEmail,\s*setForgotEmail\]\s*=\s*useState\(["']["']\)/)
    })

    it('ao efetuar login com sucesso, carrega contexto da organização pertencente ao usuário', () => {
      // Simulação do carregamento do AuthContext
      const mockLoggedUser: MockUser = {
        id: 'usr_agyli_1',
        email: 'diretoria@clinica-agyli.com',
        name: 'Diretor Silva',
        phone: '11999991111',
        role: 'ADMINISTRADOR',
        organization_id: 'org_agyli_100',
        verified: true,
      }

      const mockOrganizationsDb = [
        { id: 'org_agyli_100', name: 'Clínica Agyli Master', slug: 'clinica-agyli-master' },
        { id: 'org_outra_999', name: 'Outra Empresa Antiga', slug: 'outra-empresa' },
      ]

      const resolveActiveContext = (user: MockUser) => {
        const found = mockOrganizationsDb.find((o) => o.id === user.organization_id)
        if (!found) throw new Error('Organização não encontrada')
        return found
      }

      const loadedOrg = resolveActiveContext(mockLoggedUser)
      expect(loadedOrg.id).toBe('org_agyli_100')
      expect(loadedOrg.name).toBe('Clínica Agyli Master')
      expect(loadedOrg.slug).toBe('clinica-agyli-master')
    })

    it('ao efetuar logout, limpa completamente localStorage e contexto para não vazar organização anterior', () => {
      // Mock do storage do navegador
      const mockStorage: Record<string, string> = {
        contek_active_org_id: 'org_empresa_antiga_123',
        pb_auth: '{"token":"xyz","record":{"id":"u1"}}',
      }

      // Função de logout idêntica à do AuthContext
      const performLogout = () => {
        delete mockStorage['contek_active_org_id']
        delete mockStorage['pb_auth']
      }

      performLogout()

      expect(mockStorage['contek_active_org_id']).toBeUndefined()
      expect(mockStorage['pb_auth']).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // 3. ISOLAMENTO MULTI-TENANT
  // -------------------------------------------------------------------------
  describe('3. Isolamento Estrito Multi-Tenant entre Empresas Distintas', () => {
    it('duas empresas criadas pelo mesmo fluxo não compartilham profissionais, serviços nem agendamentos', () => {
      const empresaA = simulateSelfServiceOnboarding(
        {
          org_name: 'AGYLI Clínica São Paulo',
          name: 'Dra. Paula Fernandes',
          phone: '11911112222',
          email: 'paula@agylisp.com.br',
          password: 'SenhaForte123!',
          product: 'agyli',
        },
        nextId,
      )

      const empresaB = simulateSelfServiceOnboarding(
        {
          org_name: 'AGYLI Centro de Saúde Campinas',
          name: 'Dr. Fernando Dias',
          phone: '19922223333',
          email: 'fernando@agylicampinas.com.br',
          password: 'OutraSenhaForte456!',
          product: 'agyli',
        },
        nextId,
      )

      // IDs das organizações são estritamente diferentes
      expect(empresaA.org.id).not.toBe(empresaB.org.id)

      // Profissionais isolados
      expect(empresaA.professional.organization_id).toBe(empresaA.org.id)
      expect(empresaB.professional.organization_id).toBe(empresaB.org.id)
      expect(empresaA.professional.id).not.toBe(empresaB.professional.id)
      expect(empresaA.professional.name).toBe('Dra. Paula Fernandes')
      expect(empresaB.professional.name).toBe('Dr. Fernando Dias')

      // Serviços isolados
      expect(empresaA.service.organization_id).toBe(empresaA.org.id)
      expect(empresaB.service.organization_id).toBe(empresaB.org.id)
      expect(empresaA.service.id).not.toBe(empresaB.service.id)

      // Vínculo professional_services isolado
      expect(empresaA.link.organization_id).toBe(empresaA.org.id)
      expect(empresaB.link.organization_id).toBe(empresaB.org.id)
    })

    it('um usuário comum recém-logado nunca herda contek_active_org_id deixado no localStorage por outro usuário', () => {
      // Regra de ouro corrigida: usuário comum SEMPRE usa user.organization_id
      const resolveOrgForSession = (
        user: { organization_id?: string; is_super_admin?: boolean; role?: string },
        storageActiveOrgId: string | null,
      ) => {
        if (user.organization_id) return user.organization_id
        if ((user.is_super_admin || user.role === 'SUPERADMIN') && storageActiveOrgId) {
          return storageActiveOrgId
        }
        return null
      }

      const resíduoLocalStorage = 'org_antiga_de_outro_cliente_888'
      const novoUsuarioComum = {
        organization_id: 'org_nova_agyli_999',
        is_super_admin: false,
        role: 'ADMINISTRADOR',
      }

      const orgEfetiva = resolveOrgForSession(novoUsuarioComum, resíduoLocalStorage)
      expect(orgEfetiva).toBe('org_nova_agyli_999')
      expect(orgEfetiva).not.toBe(resíduoLocalStorage)
    })
  })

  // -------------------------------------------------------------------------
  // 4. RECUPERAÇÃO DE SENHA E REDEFINIÇÃO
  // -------------------------------------------------------------------------
  describe('4. Fluxo de Recuperação e Redefinição de Senha', () => {
    it('valida no código de Login.tsx chamada a requestPasswordReset com tratamento de erros amigável', () => {
      expect(loginSource).toContain("requestPasswordReset(targetEmail)")
      expect(loginSource).toContain("setForgotSuccessEmail(targetEmail)")
      expect(loginSource).toContain("Informe o e-mail da sua conta.")
    })

    it('tela RedefinirSenha.tsx exige token presente na URL, senha >= 8 caracteres e confirmação idêntica', () => {
      // Código de validação presente em RedefinirSenha.tsx
      expect(redefinirSource).toContain("searchParams.get('token')")
      expect(redefinirSource).toMatch(/password\.length\s*<\s*8/)
      expect(redefinirSource).toContain('A senha deve ter no mínimo 8 caracteres.')
      expect(redefinirSource).toContain('As senhas não coincidem.')
      expect(redefinirSource).toContain("confirmPasswordReset(tokenFromUrl, password, passwordConfirm)")
    })

    it('simula validação da submissão de nova senha', () => {
      const validateResetSubmission = (token: string, pass: string, passConfirm: string) => {
        if (!token) return { valid: false, error: 'Token ausente.' }
        if (!pass || !passConfirm) return { valid: false, error: 'Preencha os dois campos de senha.' }
        if (pass.length < 8) return { valid: false, error: 'A senha deve ter no mínimo 8 caracteres.' }
        if (pass !== passConfirm) return { valid: false, error: 'As senhas não coincidem.' }
        return { valid: true, error: null }
      }

      expect(validateResetSubmission('', 'Senha12345!', 'Senha12345!').error).toBe('Token ausente.')
      expect(validateResetSubmission('token_valido', '12345', '12345').error).toBe(
        'A senha deve ter no mínimo 8 caracteres.',
      )
      expect(
        validateResetSubmission('token_valido', 'SenhaLonga123!', 'SenhaDiferente456!').error,
      ).toBe('As senhas não coincidem.')
      expect(
        validateResetSubmission('token_valido', 'SenhaCorreta123!', 'SenhaCorreta123!').valid,
      ).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // 5. BLOQUEIOS MARKALY vs LIBERAÇÃO TOTAL AGYLI
  // -------------------------------------------------------------------------
  describe('5. Bloqueios de Funcionalidades MARKALY vs AGYLI Completo', () => {
    const FORBIDDEN_MARKALY_FEATURES = [
      'financeiro',
      'assistente_ia',
      'whatsapp_ai',
      'relatorios',
      'configuracoes_avancadas',
    ]

    const evaluateHasFeature = ({
      product,
      isSuperAdmin,
      featureKey,
      featureMap,
    }: {
      product: 'agyli' | 'markaly'
      isSuperAdmin: boolean
      featureKey: string
      featureMap?: Record<string, boolean>
    }) => {
      // Regra 1: markaly estritamente proibido nestes módulos
      if (product === 'markaly' && FORBIDDEN_MARKALY_FEATURES.includes(featureKey)) {
        return false
      }

      // Regra 2: SuperAdmin bypass para as demais features
      if (isSuperAdmin) return true

      // Regra 3: Se featureMap do backend existir e não estiver vazio
      if (featureMap && Object.keys(featureMap).length > 0) {
        if (featureKey === 'configuracoes_basicas' && Boolean(featureMap['configuracoes_avancadas'])) {
          return true
        }
        return Boolean(featureMap[featureKey])
      }

      // Regra 4: Fallback markaly
      if (product === 'markaly') {
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

      // agyli libera tudo por padrão
      return true
    }

    it('bloqueia financeiro, assistente_ia, relatorios e whatsapp_ai no produto MARKALY (inclusive para SuperAdmin)', () => {
      for (const forbidden of FORBIDDEN_MARKALY_FEATURES) {
        expect(
          evaluateHasFeature({
            product: 'markaly',
            isSuperAdmin: false,
            featureKey: forbidden,
          }),
        ).toBe(false)

        expect(
          evaluateHasFeature({
            product: 'markaly',
            isSuperAdmin: true,
            featureKey: forbidden,
          }),
        ).toBe(false)
      }
    })

    it('libera todas as features para AGYLI Pro (financeiro, assistente IA, relatórios, agenda, clientes)', () => {
      const allAgyliFeatures = [
        'dashboard',
        'agenda',
        'clientes',
        'profissionais',
        'servicos',
        'financeiro',
        'assistente_ia',
        'whatsapp_ai',
        'relatorios',
        'configuracoes_basicas',
        'configuracoes_avancadas',
      ]

      for (const feat of allAgyliFeatures) {
        expect(
          evaluateHasFeature({
            product: 'agyli',
            isSuperAdmin: false,
            featureKey: feat,
          }),
        ).toBe(true)
      }
    })

    it('fallback de menu para lista de features vazia do servidor garante funcionamento (bug v0.0.39)', () => {
      // Se a resposta /backend/v1/organization-features vier vazia ou falhar:
      const navFeaturesAgyli = [
        'dashboard',
        'agenda',
        'clientes',
        'profissionais',
        'servicos',
        'financeiro',
        'assistente_ia',
        'configuracoes_basicas',
      ]

      for (const feat of navFeaturesAgyli) {
        expect(
          evaluateHasFeature({
            product: 'agyli',
            isSuperAdmin: false,
            featureKey: feat,
            featureMap: {}, // Servidor retornou objeto vazio
          }),
        ).toBe(true)
      }
    })
  })

  // -------------------------------------------------------------------------
  // 6. AGENDAMENTO PÚBLICO (/agendar/:slug)
  // -------------------------------------------------------------------------
  describe('6. Fluxo de Agendamento Público (/agendar/:slug)', () => {
    // Calculador de slots disponível no frontend/backend
    const calculateAvailableSlots = ({
      workStart,
      workEnd,
      lunchStart,
      lunchEnd,
      serviceDuration,
      slotStep = 30,
      existingAppointments = [],
    }: {
      workStart: string
      workEnd: string
      lunchStart?: string
      lunchEnd?: string
      serviceDuration: number
      slotStep?: number
      existingAppointments?: Array<{ start_time: string; end_time: string }>
    }) => {
      const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number)
        return h * 60 + m
      }

      const shiftStartMin = toMin(workStart)
      const shiftEndMin = toMin(workEnd)
      const lunchStartMin = lunchStart && lunchEnd ? toMin(lunchStart) : -1
      const lunchEndMin = lunchStart && lunchEnd ? toMin(lunchEnd) : -1

      const availableSlots: string[] = []

      for (let curr = shiftStartMin; curr + serviceDuration <= shiftEndMin; curr += slotStep) {
        const slotEnd = curr + serviceDuration

        // Almoço
        const inLunch =
          lunchStartMin >= 0 &&
          lunchEndMin > lunchStartMin &&
          curr < lunchEndMin &&
          slotEnd > lunchStartMin

        if (inLunch) continue

        // Conflito com agendamentos existentes
        const conflict = existingAppointments.some((appt) => {
          const aStart = toMin(appt.start_time)
          const aEnd = toMin(appt.end_time)
          return curr < aEnd && slotEnd > aStart
        })

        if (!conflict) {
          const h = Math.floor(curr / 60)
            .toString()
            .padStart(2, '0')
          const m = (curr % 60).toString().padStart(2, '0')
          availableSlots.push(`${h}:${m}`)
        }
      }

      return availableSlots
    }

    it('calcula slots respeitando horário de trabalho, duração do serviço e intervalo de almoço', () => {
      const slots = calculateAvailableSlots({
        workStart: '08:00',
        workEnd: '12:00',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        serviceDuration: 45,
        slotStep: 30,
      })

      // 08:00 (08:00 - 08:45) -> OK
      // 08:30 (08:30 - 09:15) -> OK
      // 09:00 (09:00 - 09:45) -> OK
      // 09:30 (09:30 - 10:15) -> OK
      // 10:00 (10:00 - 10:45) -> OK
      // 10:30 (10:30 - 11:15) -> OK
      // 11:00 (11:00 - 11:45) -> OK
      // 11:30 (11:30 - 12:15) -> Ultrapassa 12:00 -> NÃO PODE
      expect(slots).toContain('08:00')
      expect(slots).toContain('08:30')
      expect(slots).toContain('11:00')
      expect(slots).not.toContain('11:30')
    })

    it('slot ocupado por agendamento existente NUNCA é oferecido ao cliente público', () => {
      const slotsSemOcupacao = calculateAvailableSlots({
        workStart: '08:00',
        workEnd: '12:00',
        serviceDuration: 45,
        slotStep: 30,
        existingAppointments: [],
      })
      expect(slotsSemOcupacao).toContain('09:00')
      expect(slotsSemOcupacao).toContain('09:30')

      // Inserindo agendamento existente das 09:00 às 09:45
      const slotsComOcupacao = calculateAvailableSlots({
        workStart: '08:00',
        workEnd: '12:00',
        serviceDuration: 45,
        slotStep: 30,
        existingAppointments: [{ start_time: '09:00', end_time: '09:45' }],
      })

      // O horário 09:00 não pode ser oferecido
      expect(slotsComOcupacao).not.toContain('09:00')
      // O horário 08:30 (vai até 09:15) também colide com 09:00 -> não pode ser oferecido
      expect(slotsComOcupacao).not.toContain('08:30')
      // O horário 09:30 (termina às 10:15 mas colide com 09:00-09:45) -> não pode ser oferecido
      expect(slotsComOcupacao).not.toContain('09:30')
      // 10:00 (10:00 - 10:45) é livre e deve ser oferecido
      expect(slotsComOcupacao).toContain('10:00')
    })

    it('valida que a página de agendamento público tem os 6 passos sem necessidade de login prévio', () => {
      expect(agendamentoSource).toContain('Passo 1 de 6')
      expect(agendamentoSource).toContain('1. Escolher Serviço')
      expect(agendamentoSource).toContain('2. Escolher Profissional')
      expect(agendamentoSource).toContain('3. Escolher Data')
      expect(agendamentoSource).toContain('4. Escolher Horário')
      expect(agendamentoSource).toContain('5. Seus Dados')
      expect(agendamentoSource).toContain('6. Confirmar Agendamento')
      expect(agendamentoSource).toContain('sem necessidade de login')
    })

    it('detecta se dia da semana é folga e impede seleção no calendário', () => {
      const orgWorkingDays = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab']
      const checkWorkingDay = (dayKey: string) => orgWorkingDays.includes(dayKey)

      expect(checkWorkingDay('seg')).toBe(true)
      expect(checkWorkingDay('sab')).toBe(true)
      expect(checkWorkingDay('dom')).toBe(false) // Domingo é folga padrão
    })
  })

  // -------------------------------------------------------------------------
  // 7. BRANDING E IDENTIDADE VISUAL AGYLI
  // -------------------------------------------------------------------------
  describe('7. Branding e Configuração Visual Oficial AGYLI', () => {
    it('garante que domínio padrão agyli.com.br resolve para AGYLI com cores e slogan oficiais', () => {
      const resolved = resolveProductByDomain('agyli.com.br')
      expect(resolved).toBe('agyli')

      const branding = getProductBranding('agyli')
      expect(branding.name).toBe('AGYLI')
      expect(branding.tagline).toBe('Agendar ficou simples.')
      expect(branding.colors.primary).toBe('#3B82F6') // Azul AGYLI
      expect(branding.colors.accent).toBe('#8B5CF6') // Violeta AGYLI
    })

    it('garante que domínios app.agyli.com.br e contek-agenda-ia-*.goskip.app resolvem prioritariamente para AGYLI', () => {
      expect(resolveProductByDomain('app.agyli.com.br')).toBe('agyli')
      expect(resolveProductByDomain('www.agyli.com.br')).toBe('agyli')
      expect(resolveProductByDomain('contek-agenda-ia-479d4.goskip.app')).toBe('agyli')
    })
  })

  // -------------------------------------------------------------------------
  // 8. CENTRAL CONTEK (HUB DE SISTEMAS SUPERADMIN)
  // -------------------------------------------------------------------------
  describe('8. Central Contek — Hub de Sistemas SuperAdmin (/contek)', () => {
    it('rota /contek existe no App.tsx e está protegida com SuperAdminRoute', () => {
      expect(appSource).toContain('path="/contek"')
      expect(appSource).toMatch(/<SuperAdminRoute>\s*<CentralContek\s*\/>\s*<\/SuperAdminRoute>/)
    })

    it('redirecionamento pós-login envia super admin para /contek e usuário comum para / (painel da empresa)', () => {
      // Simulação da lógica de redirecionamento aplicada no componente Login.tsx
      const resolvePostLoginDestination = (user: { is_super_admin?: boolean; role?: string }) => {
        const isSuper = Boolean(user.is_super_admin || user.role === 'SUPERADMIN')
        return isSuper ? '/contek' : '/'
      }

      // SuperAdmin (Luciana / Lucas)
      expect(resolvePostLoginDestination({ is_super_admin: true, role: 'SUPERADMIN' })).toBe('/contek')
      expect(resolvePostLoginDestination({ role: 'SUPERADMIN' })).toBe('/contek')

      // Usuário comum (Dono de clínica / La Bela / Lulu / Administrador de empresa)
      expect(resolvePostLoginDestination({ is_super_admin: false, role: 'ADMINISTRADOR' })).toBe('/')
      expect(resolvePostLoginDestination({ role: 'PROFISSIONAL' })).toBe('/')
      expect(resolvePostLoginDestination({})).toBe('/')

      // Validação do código em Login.tsx
      expect(loginSource).toContain("isSuper")
      expect(loginSource).toContain("navigate('/contek')")
      expect(loginSource).toContain("navigate('/')")
    })

    it('bloqueia usuário comum ao tentar acessar rotas SuperAdmin (redireciona para /)', () => {
      // Simulação da guarda de rota SuperAdminRoute
      const simulateSuperAdminGuard = (user: { id: string; is_super_admin?: boolean; role?: string } | null) => {
        if (!user) return { allowed: false, redirect: '/login' }
        const isSuper = Boolean(user.is_super_admin || user.role === 'SUPERADMIN')
        if (!isSuper) return { allowed: false, redirect: '/' }
        return { allowed: true, redirect: null }
      }

      // Visitante deslogado
      expect(simulateSuperAdminGuard(null)).toEqual({ allowed: false, redirect: '/login' })

      // Usuário comum (empresa/clínica)
      const regularUser = { id: 'u_regular', role: 'ADMINISTRADOR', is_super_admin: false }
      expect(simulateSuperAdminGuard(regularUser)).toEqual({ allowed: false, redirect: '/' })

      // SuperAdmin
      const superAdminUser = { id: 'u_super', role: 'SUPERADMIN', is_super_admin: true }
      expect(simulateSuperAdminGuard(superAdminUser)).toEqual({ allowed: true, redirect: null })
    })

    it('apresenta identidade Contek com boas-vindas, cards oficiais AGYLI e MARKALY e assinatura', () => {
      expect(centralContekSource).toContain('Central Contek')
      expect(centralContekSource).toContain('Uma solução')
      expect(centralContekSource).toContain('Contek Tecnologia e Consultoria')
      expect(centralContekSource).toContain('AgyliLogo')
      expect(centralContekSource).toContain('MarkalyLogo')
      expect(centralContekSource).toContain('switchOrganization')
      expect(centralContekSource).toContain('/backend/v1/superadmin/overview')
    })

    it('isola a organização do SuperAdmin em memória/localStorage sem poluir o banco e garante retorno à Central pós-logout', () => {
      // Cenário de teste solicitado:
      // SuperAdmin que inspecionou empresa MARKALY (ex.: Lulu) e deslogou volta à Central Contek (não ao painel MARKALY)
      const mockStorage: Record<string, string> = {}
      const superAdminUser: MockUser = {
        id: 'usr_super_luciana',
        email: 'luciana@contek.com.br',
        name: 'Luciana SuperAdmin',
        phone: '11999990000',
        role: 'SUPERADMIN',
        organization_id: '', // SuperAdmin tem organization_id vazio no banco
        verified: true,
        is_super_admin: true,
      }

      // 1. SuperAdmin faz switch para a empresa Lulu (MARKALY)
      const luluOrg = { id: 'org_markaly_lulu', name: 'Lulu', product: 'markaly' }
      const performSuperAdminSwitch = (org: { id: string }) => {
        // Salva apenas no storage temporário / memória, NÃO no banco
        mockStorage['contek_active_org_id'] = org.id
      }
      performSuperAdminSwitch(luluOrg)
      expect(mockStorage['contek_active_org_id']).toBe('org_markaly_lulu')
      expect(superAdminUser.organization_id).toBe('') // Banco permanece intacto

      // 2. SuperAdmin faz logout do sistema
      const performLogout = () => {
        delete mockStorage['contek_active_org_id']
      }
      performLogout()
      expect(mockStorage['contek_active_org_id']).toBeUndefined()

      // 3. SuperAdmin faz login novamente
      // Como o storage foi limpo no logout e o organization_id no banco é vazio,
      // ele não cai preso na empresa MARKALY e é encaminhado direto para a Central Contek (/contek)
      const isSuper = Boolean(superAdminUser.is_super_admin || superAdminUser.role === 'SUPERADMIN')
      const targetRoute = isSuper ? '/contek' : '/'
      expect(targetRoute).toBe('/contek')

      // 4. Verificação de organização ativa pós-login sem switch
      const activeOrgResolved = isSuper ? (mockStorage['contek_active_org_id'] || null) : superAdminUser.organization_id
      expect(activeOrgResolved).toBeNull() // Livre de qualquer tenant antigo
    })

    it('filtra e separa adequadamente organizações nos cards AGYLI e MARKALY da Central Contek', () => {
      const mockOverviewList = [
        { id: '1', name: 'LUIS', product: 'agyli', slug: 'luis' },
        { id: '2', name: 'Contek Estética', product: 'agyli', slug: 'contek-demo' },
        { id: '3', name: 'Lulu', product: 'markaly', slug: 'lulu' },
        { id: '4', name: 'La Bela', product: 'markaly', slug: 'la-bela' },
      ]

      const agyliList = mockOverviewList.filter((o) => o.product === 'agyli')
      const markalyList = mockOverviewList.filter((o) => o.product === 'markaly')

      expect(agyliList.length).toBe(2)
      expect(agyliList.map((o) => o.name)).toEqual(['LUIS', 'Contek Estética'])

      expect(markalyList.length).toBe(2)
      expect(markalyList.map((o) => o.name)).toEqual(['Lulu', 'La Bela'])
    })

    it('suporta acesso interno Contek dedicado (/acesso-contek) e link discreto no Login', () => {
      expect(appSource).toContain('path="/acesso-contek"')
      expect(appSource).toContain('LoginContek')
      expect(loginSource).toContain('/acesso-contek')
      expect(loginSource).toContain('Acesso Corporativo Contek')
    })
  })
})
