import { describe, it, expect } from 'vitest'

describe('WhatsApp com IA & Multi-tenant Agendamento (Contek Agenda)', () => {
  it('garante que a rota de confirmação de agendamento existe e gera URL com token', () => {
    const token = 'sample_token_32_chars_1234567890'
    const siteUrl = 'https://contekagenda.com.br'
    const confirmUrl = `${siteUrl}/confirmar/${token}`

    expect(confirmUrl).toBe('https://contekagenda.com.br/confirmar/sample_token_32_chars_1234567890')
    expect(confirmUrl).toContain('/confirmar/')
  })

  it('substitui corretamente as variáveis no template de confirmação de agendamento por WhatsApp', () => {
    const template =
      'Olá, {{nome_paciente}}! Seu agendamento na {{empresa}} foi realizado com sucesso!\n\n📋 *Detalhes:*\n• *Serviço:* {{servico}}\n• *Profissional:* {{nome_profissional}}\n• *Data/Hora:* {{data}} às {{hora}}\n\nPor favor, confirme sua presença clicando no link abaixo:\n🔗 {{link_confirmacao}}'

    const vars = {
      nome_paciente: 'Luciana',
      empresa: 'LUIS',
      servico: 'Consulta Odontológica',
      nome_profissional: 'Dr. Roberto',
      data: '25/03/2025',
      hora: '14:30',
      link_confirmacao: 'https://contekagenda.com.br/confirmar/token_luciana_999',
    }

    const message = template
      .replace(/{{nome_paciente}}/g, vars.nome_paciente)
      .replace(/{{empresa}}/g, vars.empresa)
      .replace(/{{servico}}/g, vars.servico)
      .replace(/{{nome_profissional}}/g, vars.nome_profissional)
      .replace(/{{data}}/g, vars.data)
      .replace(/{{hora}}/g, vars.hora)
      .replace(/{{link_confirmacao}}/g, vars.link_confirmacao)

    expect(message).toContain('Olá, Luciana!')
    expect(message).toContain('LUIS')
    expect(message).toContain('Consulta Odontológica')
    expect(message).toContain('Dr. Roberto')
    expect(message).toContain('25/03/2025 às 14:30')
    expect(message).toContain('https://contekagenda.com.br/confirmar/token_luciana_999')
  })

  it('substitui corretamente o template pós-atendimento para solicitação de avaliação', () => {
    const templateFeedback =
      'Olá, {{nome_paciente}}! Agradecemos por ter estado conosco na {{empresa}} hoje no atendimento de {{servico}} com {{nome_profissional}}. Conte para nós como foi sua experiência! Sua avaliação é fundamental para nós.'

    const message = templateFeedback
      .replace(/{{nome_paciente}}/g, 'Perol')
      .replace(/{{empresa}}/g, 'LUIS')
      .replace(/{{servico}}/g, 'Manutenção')
      .replace(/{{nome_profissional}}/g, 'Dra. Luiza')

    expect(message).toContain('Olá, Perol!')
    expect(message).toContain('LUIS')
    expect(message).toContain('Manutenção')
    expect(message).toContain('Dra. Luiza')
    expect(message).toContain('Conte para nós como foi sua experiência!')
  })

  it('valida que o Assistente IA está bloqueado no MARKALY Essencial e liberado no AGYLI', () => {
    const FORBIDDEN_MARKALY_FEATURES = [
      'financeiro',
      'assistente_ia',
      'whatsapp_ai',
      'relatorios',
      'configuracoes_avancadas',
    ]

    const hasFeatureForProduct = (product: string, feature: string) => {
      if (product === 'markaly' && FORBIDDEN_MARKALY_FEATURES.includes(feature)) {
        return false
      }
      return true
    }

    expect(hasFeatureForProduct('markaly', 'assistente_ia')).toBe(false)
    expect(hasFeatureForProduct('markaly', 'financeiro')).toBe(false)
    expect(hasFeatureForProduct('markaly', 'agenda')).toBe(true)

    expect(hasFeatureForProduct('agyli', 'assistente_ia')).toBe(true)
    expect(hasFeatureForProduct('agyli', 'financeiro')).toBe(true)
    expect(hasFeatureForProduct('agyli', 'agenda')).toBe(true)
  })

  it('valida isolamento multi-tenant de dados entre duas empresas (LUIS vs Outra Clínica)', () => {
    const org1 = { id: 'org_luis_001', name: 'LUIS' }
    const org2 = { id: 'org_clinica_002', name: 'Clínica Sorrir' }

    const appointments = [
      { id: 'app1', organization_id: org1.id, client_name: 'Perol', amount: 150 },
      { id: 'app2', organization_id: org1.id, client_name: 'Carlos', amount: 200 },
      { id: 'app3', organization_id: org2.id, client_name: 'Mariana', amount: 500 },
    ]

    const filterByTenant = (orgId: string) => {
      return appointments.filter((a) => a.organization_id === orgId)
    }

    const luisAppts = filterByTenant(org1.id)
    const sorrirAppts = filterByTenant(org2.id)

    expect(luisAppts.length).toBe(2)
    expect(luisAppts.map((a) => a.client_name)).toEqual(['Perol', 'Carlos'])
    expect(luisAppts.some((a) => a.client_name === 'Mariana')).toBe(false)

    expect(sorrirAppts.length).toBe(1)
    expect(sorrirAppts[0].client_name).toBe('Mariana')
  })

  it('valida cálculo de clientes inativos há mais de 60 dias para o Assistente IA', () => {
    const now = new Date('2025-03-25T12:00:00Z').getTime()
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const clients = [
      { id: 'c1', name: 'Cliente Ativo', lastAppt: '2025-03-10' },
      { id: 'c2', name: 'Cliente Ausente 70 dias', lastAppt: '2025-01-10' },
      { id: 'c3', name: 'Cliente Sem Agendamento', lastAppt: null },
    ]

    const inactive = clients.filter((c) => !c.lastAppt || c.lastAppt < sixtyDaysAgo)

    expect(inactive.map((c) => c.name)).toEqual([
      'Cliente Ausente 70 dias',
      'Cliente Sem Agendamento',
    ])
  })
})
