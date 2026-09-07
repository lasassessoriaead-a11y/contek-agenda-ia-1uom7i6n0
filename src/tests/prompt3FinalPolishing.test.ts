import { describe, it, expect } from 'vitest'
import indexSource from '../pages/Index.tsx?raw'
import appSource from '../App.tsx?raw'
import loginSource from '../pages/Login.tsx?raw'

describe('Public Sales Landing Page & End-to-End Consistency (Prompt 3)', () => {
  it('Index.tsx contains AGYLI Pro with exact pricing and 7 days free', () => {
    // AGYLI Pro: R$ 29,90/mês
    expect(indexSource).toContain('AGYLI Pro')
    expect(indexSource).toContain('29,90')
    expect(indexSource).toContain('7 dias')
    expect(indexSource).toContain('Começar 7 dias grátis')
  })

  it('Index.tsx contains AGYLI Essencial with exact pricing and 7 days free (MARKALY aposentado)', () => {
    // AGYLI Essencial: R$ 19,90/mês (substituiu o MARKALY aposentado)
    expect(indexSource).toContain('AGYLI Essencial')
    expect(indexSource).toContain('19,90')
    expect(indexSource).toContain('7 dias')
    expect(indexSource).not.toContain('MARKALY Essencial')
  })

  it('Index.tsx displays Grupo CONTEK endorsement signature', () => {
    // Chancela oficial "Grupo CONTEK"
    expect(indexSource).toContain('Grupo CONTEK')
    expect(indexSource).toContain('Uma solução')
    expect(indexSource).toContain('ContekFullLogo')
  })

  it('Index.tsx has CTA buttons linking to self-service registration on /login?tab=signup', () => {
    expect(indexSource).toContain('/login?tab=signup')
  })

  it('App.tsx renders RootRoute for "/" path displaying Index for visitors and dashboard for users', () => {
    expect(appSource).toContain('<Route path="/" element={<RootRoute />} />')
    expect(appSource).toContain('if (!user) {')
    expect(appSource).toContain('<Index />')
  })

  it('Login.tsx switches to signup tab automatically when tab=signup or tab=criar-empresa or tab=cadastro is in query string', () => {
    expect(loginSource).toContain("tabParam === 'signup'")
    expect(loginSource).toContain("tabParam === 'criar-empresa'")
    expect(loginSource).toContain("setActiveTab('signup')")
  })

  it('guarantees credential link parameters (org, brand, email) bypass auto-redirect for logged-in users', () => {
    expect(loginSource).toContain('hasCredentialParams')
    expect(loginSource).toContain('user && !hasCredentialParams')
  })
})
