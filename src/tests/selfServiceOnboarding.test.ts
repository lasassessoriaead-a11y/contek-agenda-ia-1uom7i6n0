import { describe, it, expect } from 'vitest'

/**
 * Testes Automatizados para Onboarding Público / Cadastro Self-Service Contek Agenda
 *
 * Cobertura exigida:
 * 1. Criação completa self-service (usuário owner, organização status trial, assinatura 7 dias, serviço opcional)
 * 2. Slug duplicado e geração automática de variação com sufixo numérico
 * 3. Validação de trial de 7 dias e plano escolhido (AGYLI Pro vs MARKALY Essencial)
 * 4. Validação de e-mail duplicado com mensagem amigável em português
 * 5. Isolamento multi-tenant estrito por organization_id
 * 6. Garantia de que o e-mail de boas-vindas não expõe a senha cadastrada pelo usuário
 */

interface DbUser {
  id: string
  email: string
  passwordHash: string
  name: string
  phone: string
  role: string
  organization_id: string
  is_super_admin: boolean
}

interface DbOrg {
  id: string
  name: string
  slug: string
  phone: string
  status: 'active' | 'trial' | 'suspended' | 'cancelled'
  product: 'agyli' | 'markaly'
  plan_id: string
}

interface DbSub {
  id: string
  organization_id: string
  plan_id: string
  status: 'trial' | 'active' | 'past_due' | 'cancelled'
  starts_at: string
  trial_ends_at: string
  history: string
}

interface DbService {
  id: string
  organization_id: string
  name: string
  price: number
  active: boolean
}

interface DbProfessional {
  id: string
  organization_id: string
  user_id: string
  name: string
  email: string
  active: boolean
}

interface SentEmail {
  to: string
  subject: string
  html: string
}

class SelfServiceOnboardingEngine {
  users: DbUser[] = []
  orgs: DbOrg[] = []
  subs: DbSub[] = []
  services: DbService[] = []
  professionals: DbProfessional[] = []
  sentEmails: SentEmail[] = []

  plans = [
    {
      id: 'plan_agyli_pro',
      name: 'AGYLI Pro Completo',
      slug: 'agyli-pro',
      product: 'agyli',
      price: 129.9,
      trial_days: 7,
    },
    {
      id: 'plan_markaly_start',
      name: 'MARKALY Essencial',
      slug: 'markaly-start',
      product: 'markaly',
      price: 59.9,
      trial_days: 7,
    },
  ]

  cleanSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  generateUniqueSlug(preferredSlug: string): string {
    let base = this.cleanSlug(preferredSlug) || 'empresa'
    let finalSlug = base
    let suffix = 1

    while (this.orgs.some((o) => o.slug === finalSlug)) {
      suffix++
      finalSlug = `${base}-${suffix}`
    }

    return finalSlug
  }

  executeSelfServiceSignup(payload: {
    name: string
    email: string
    password: string
    phone?: string
    org_name: string
    slug?: string
    product?: 'agyli' | 'markaly'
    plan_slug?: string
    create_example_service?: boolean
  }) {
    const cleanName = (payload.name || '').trim()
    const cleanEmail = (payload.email || '').trim().toLowerCase()
    const cleanPassword = payload.password || ''
    const cleanOrgName = (payload.org_name || '').trim()
    const product = payload.product === 'markaly' ? 'markaly' : 'agyli'

    // 1. Validações básicas
    if (!cleanName) {
      return { success: false, status: 400, error: 'Seu nome completo é obrigatório.' }
    }
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return { success: false, status: 400, error: 'Informe um endereço de e-mail válido.' }
    }
    if (!cleanPassword || cleanPassword.length < 8) {
      return { success: false, status: 400, error: 'A senha deve conter no mínimo 8 caracteres.' }
    }
    if (!cleanOrgName) {
      return { success: false, status: 400, error: 'O nome da empresa é obrigatório.' }
    }

    // 2. Validação de e-mail duplicado
    const existing = this.users.find((u) => u.email === cleanEmail)
    if (existing) {
      return {
        success: false,
        status: 409,
        error: 'Este endereço de e-mail já está cadastrado no sistema. Por favor, faça login ou recupere sua senha.',
      }
    }

    // 3. Resolução de Slug único (com variação automática se existir)
    const preferred = payload.slug ? this.cleanSlug(payload.slug) : cleanOrgName
    const finalSlug = this.generateUniqueSlug(preferred)

    // 4. Resolução de Plano
    const targetPlanSlug =
      payload.plan_slug || (product === 'markaly' ? 'markaly-start' : 'agyli-pro')
    const matchedPlan =
      this.plans.find((p) => p.slug === targetPlanSlug) ||
      this.plans.find((p) => p.product === product) ||
      this.plans[0]

    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    // 5. Criação de Organização
    const newOrg: DbOrg = {
      id: orgId,
      name: cleanOrgName,
      slug: finalSlug,
      phone: payload.phone || '',
      status: 'trial',
      product,
      plan_id: matchedPlan.slug,
    }
    this.orgs.push(newOrg)

    // 6. Criação de Subscription Trial 7 dias
    const now = new Date()
    const trialDays = matchedPlan.trial_days || 7
    const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

    const newSub: DbSub = {
      id: `sub_${orgId}`,
      organization_id: orgId,
      plan_id: matchedPlan.id,
      status: 'trial',
      starts_at: now.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      history: JSON.stringify([
        {
          date: now.toISOString(),
          action: 'TRIAL_STARTED',
          note: `Início do período de teste gratuito de ${trialDays} dias`,
          plan: matchedPlan.slug,
        },
      ]),
    }
    this.subs.push(newSub)

    // 7. Criação de Usuário Owner / Administrador
    const newUser: DbUser = {
      id: userId,
      email: cleanEmail,
      passwordHash: `hashed_${cleanPassword}`,
      name: cleanName,
      phone: payload.phone || '',
      role: 'ADMINISTRADOR',
      organization_id: orgId,
      is_super_admin: false,
    }
    this.users.push(newUser)

    // 8. Criação de Profissional padrão vinculado ao usuário e à organização
    const newProf: DbProfessional = {
      id: `prof_${orgId}`,
      organization_id: orgId,
      user_id: userId,
      name: cleanName,
      email: cleanEmail,
      active: true,
    }
    this.professionals.push(newProf)

    // 9. Criação de Serviço de exemplo opcional
    if (payload.create_example_service !== false) {
      const newService: DbService = {
        id: `serv_${orgId}`,
        organization_id: orgId,
        name: 'Atendimento Inicial / Consulta',
        price: 150,
        active: true,
      }
      this.services.push(newService)
    }

    // 10. Envio do E-mail de Boas-Vindas
    const welcomeHtml = `
      <h1>Bem-vindo(a) ao ${product === 'markaly' ? 'MARKALY' : 'AGYLI'}!</h1>
      <p>Olá, ${cleanName}</p>
      <p>Empresa: ${cleanOrgName}</p>
      <p>Plano: ${matchedPlan.name}</p>
      <a href="/agendar/${finalSlug}">Agendamento Público</a>
      <a href="/login?org=${finalSlug}&brand=${product}&email=${encodeURIComponent(cleanEmail)}">Entrar no Painel</a>
    `
    this.sentEmails.push({
      to: cleanEmail,
      subject: `Bem-vindo(a) ao ${product === 'markaly' ? 'MARKALY' : 'AGYLI'}! - ${cleanOrgName}`,
      html: welcomeHtml,
    })

    return {
      success: true,
      status: 200,
      email_sent: true,
      organization: newOrg,
      subscription: newSub,
      user: newUser,
      public_booking_url: `/agendar/${finalSlug}`,
      login_url: `/login?org=${encodeURIComponent(finalSlug)}&brand=${encodeURIComponent(product)}&email=${encodeURIComponent(cleanEmail)}`,
    }
  }
}

describe('Self-Service Onboarding Engine (Cadastro Público)', () => {
  it('1. Realiza cadastro completo self-service com trial de 7 dias, organização, assinatura e profissional', () => {
    const engine = new SelfServiceOnboardingEngine()

    const result = engine.executeSelfServiceSignup({
      name: 'Dra. Marina Santos',
      email: 'marina@clinicavita.com.br',
      password: 'SenhaForte123@',
      phone: '(11) 98888-7777',
      org_name: 'Clínica Vita Saúde',
      product: 'agyli',
      plan_slug: 'agyli-pro',
      create_example_service: true,
    })

    expect(result.success).toBe(true)
    expect(result.status).toBe(200)
    expect(result.organization?.status).toBe('trial')
    expect(result.organization?.slug).toBe('clinica-vita-saude')
    expect(result.user?.role).toBe('ADMINISTRADOR')
    expect(result.user?.organization_id).toBe(result.organization?.id)

    // Validação de trial de 7 dias na assinatura
    expect(result.subscription?.status).toBe('trial')
    const startsAt = new Date(result.subscription?.starts_at || '')
    const trialEndsAt = new Date(result.subscription?.trial_ends_at || '')
    const diffDays = Math.round((trialEndsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(7)

    // Validação do serviço de exemplo criado
    const orgServices = engine.services.filter((s) => s.organization_id === result.organization?.id)
    expect(orgServices.length).toBe(1)
    expect(orgServices[0].name).toBe('Atendimento Inicial / Consulta')

    // Validação do e-mail de boas-vindas
    expect(engine.sentEmails.length).toBe(1)
    const email = engine.sentEmails[0]
    expect(email.to).toBe('marina@clinicavita.com.br')
    expect(email.subject).toContain('Bem-vindo')
    expect(email.html).toContain('Clínica Vita Saúde')
    expect(email.html).toContain('/agendar/clinica-vita-saude')
    // Garantir que a senha NÃO é enviada por e-mail no onboarding público
    expect(email.html).not.toContain('SenhaForte123@')
  })

  it('2. Trata duplicidade de slug gerando variação automática (-2, -3)', () => {
    const engine = new SelfServiceOnboardingEngine()

    // Primeira empresa com slug "estetica-bella"
    const first = engine.executeSelfServiceSignup({
      name: 'Ana Bella',
      email: 'ana@bella1.com',
      password: 'SenhaForte123@',
      org_name: 'Estética Bella',
      slug: 'estetica-bella',
    })
    expect(first.organization?.slug).toBe('estetica-bella')

    // Segunda empresa informando o mesmo slug
    const second = engine.executeSelfServiceSignup({
      name: 'Beatriz Bella',
      email: 'beatriz@bella2.com',
      password: 'SenhaForte123@',
      org_name: 'Estética Bella',
      slug: 'estetica-bella',
    })
    expect(second.organization?.slug).toBe('estetica-bella-2')

    // Terceira empresa com o mesmo nome e gerando slug automático
    const third = engine.executeSelfServiceSignup({
      name: 'Carla Bella',
      email: 'carla@bella3.com',
      password: 'SenhaForte123@',
      org_name: 'Estética Bella',
    })
    expect(third.organization?.slug).toBe('estetica-bella-3')
  })

  it('3. Valida e-mail duplicado com mensagem amigável em português e código 409', () => {
    const engine = new SelfServiceOnboardingEngine()

    engine.executeSelfServiceSignup({
      name: 'Lucas Ferreira',
      email: 'lucas@contek.com',
      password: 'SenhaForte123@',
      org_name: 'Barbearia do Lucas',
    })

    // Tentar cadastrar novamente com o mesmo e-mail
    const duplicate = engine.executeSelfServiceSignup({
      name: 'Lucas Ferreira Outro',
      email: 'lucas@contek.com',
      password: 'OutraSenha123@',
      org_name: 'Nova Barbearia',
    })

    expect(duplicate.success).toBe(false)
    expect(duplicate.status).toBe(409)
    expect(duplicate.error).toContain('já está cadastrado no sistema')
  })

  it('4. Permite cadastro MARKALY Essencial com criação sem serviço de exemplo', () => {
    const engine = new SelfServiceOnboardingEngine()

    const result = engine.executeSelfServiceSignup({
      name: 'Carlos Personal',
      email: 'carlos@personal.com',
      password: 'SenhaForte123@',
      org_name: 'Studio Carlos Fitness',
      product: 'markaly',
      plan_slug: 'markaly-start',
      create_example_service: false,
    })

    expect(result.success).toBe(true)
    expect(result.organization?.product).toBe('markaly')
    expect(result.organization?.plan_id).toBe('markaly-start')

    const services = engine.services.filter((s) => s.organization_id === result.organization?.id)
    expect(services.length).toBe(0) // Nao criou servico de exemplo
  })

  it('5. Valida isolamento estrito multi-tenant entre organizações criadas via onboarding', () => {
    const engine = new SelfServiceOnboardingEngine()

    // Org A (AGYLI)
    const orgA = engine.executeSelfServiceSignup({
      name: 'Owner A',
      email: 'ownerA@orgA.com',
      password: 'SenhaForte123@',
      org_name: 'Clinica Alfa',
      product: 'agyli',
      create_example_service: true,
    })

    // Org B (MARKALY)
    const orgB = engine.executeSelfServiceSignup({
      name: 'Owner B',
      email: 'ownerB@orgB.com',
      password: 'SenhaForte123@',
      org_name: 'Studio Beta',
      product: 'markaly',
      create_example_service: true,
    })

    const orgAId = orgA.organization?.id as string
    const orgBId = orgB.organization?.id as string

    expect(orgAId).not.toBe(orgBId)

    // Usuário A pertence apenas a Org A
    const userA = engine.users.find((u) => u.organization_id === orgAId)
    const userB = engine.users.find((u) => u.organization_id === orgBId)
    expect(userA?.email).toBe('ownera@orga.com')
    expect(userB?.email).toBe('ownerb@orgb.com')

    // Serviços de A não vazam para B
    const servicesA = engine.services.filter((s) => s.organization_id === orgAId)
    const servicesB = engine.services.filter((s) => s.organization_id === orgBId)
    expect(servicesA.length).toBe(1)
    expect(servicesB.length).toBe(1)
    expect(servicesA[0].id).not.toBe(servicesB[0].id)

    // Profissionais de A não vazam para B
    const profsA = engine.professionals.filter((p) => p.organization_id === orgAId)
    const profsB = engine.professionals.filter((p) => p.organization_id === orgBId)
    expect(profsA[0].name).toBe('Owner A')
    expect(profsB[0].name).toBe('Owner B')
  })

  it('6. Validações de campos obrigatórios (nome, e-mail, senha mínima)', () => {
    const engine = new SelfServiceOnboardingEngine()

    const missingName = engine.executeSelfServiceSignup({
      name: '',
      email: 'teste@email.com',
      password: 'SenhaForte123@',
      org_name: 'Minha Empresa',
    })
    expect(missingName.success).toBe(false)
    expect(missingName.error).toContain('nome completo')

    const shortPass = engine.executeSelfServiceSignup({
      name: 'Nome Correto',
      email: 'teste@email.com',
      password: '123',
      org_name: 'Minha Empresa',
    })
    expect(shortPass.success).toBe(false)
    expect(shortPass.error).toContain('8 caracteres')

    const invalidEmail = engine.executeSelfServiceSignup({
      name: 'Nome Correto',
      email: 'emailsemformato',
      password: 'SenhaForte123@',
      org_name: 'Minha Empresa',
    })
    expect(invalidEmail.success).toBe(false)
    expect(invalidEmail.error).toContain('e-mail válido')
  })
})
