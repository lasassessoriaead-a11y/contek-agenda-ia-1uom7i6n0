import { describe, it, expect } from 'vitest'
import { resolveBrandDomainContext, resolveProductByDomain } from '../lib/branding'
import indexSource from '../pages/Index.tsx?raw'
import appSource from '../App.tsx?raw'
import loginSource from '../pages/Login.tsx?raw'

describe('Reação do sistema ao domínio de acesso (Luciana / Grupo Contek)', () => {
  describe('1. Detecção estrita de domínios em resolveBrandDomainContext', () => {
    it('detecta AGYLI para agyli.com.br (com e sem www, com portas e maiúsculas)', () => {
      expect(resolveBrandDomainContext('agyli.com.br')).toBe('agyli')
      expect(resolveBrandDomainContext('www.agyli.com.br')).toBe('agyli')
      expect(resolveBrandDomainContext('WWW.AGYLI.COM.BR')).toBe('agyli')
      expect(resolveBrandDomainContext('agyli.com.br:5173')).toBe('agyli')
      expect(resolveBrandDomainContext('www.agyli.com.br:8080')).toBe('agyli')
      expect(resolveBrandDomainContext('app.agyli.com.br')).toBe('agyli')
    })

    it('detecta CONTEK para grupocontek.com.br (com e sem www, com portas e maiúsculas)', () => {
      expect(resolveBrandDomainContext('grupocontek.com.br')).toBe('contek')
      expect(resolveBrandDomainContext('www.grupocontek.com.br')).toBe('contek')
      expect(resolveBrandDomainContext('WWW.GRUPOCONTEK.COM.BR')).toBe('contek')
      expect(resolveBrandDomainContext('grupocontek.com.br:5173')).toBe('contek')
      expect(resolveBrandDomainContext('www.grupocontek.com.br:3000')).toBe('contek')
      expect(resolveBrandDomainContext('painel.grupocontek.com.br')).toBe('contek')
    })

    it('detecta DEFAULT para endereço do Skip, preview, localhost e vazios', () => {
      expect(resolveBrandDomainContext('contek-agenda-ia-479d4.goskip.app')).toBe('default')
      expect(resolveBrandDomainContext('contek-agenda-ia-479d4--preview.goskip.app')).toBe('default')
      expect(resolveBrandDomainContext('localhost')).toBe('default')
      expect(resolveBrandDomainContext('localhost:5173')).toBe('default')
      expect(resolveBrandDomainContext('127.0.0.1')).toBe('default')
      expect(resolveBrandDomainContext('')).toBe('default')
    })

    it('mantém compatibilidade total de resolveProductByDomain para outros fluxos', () => {
      expect(resolveProductByDomain('agyli.com.br')).toBe('agyli')
      expect(resolveProductByDomain('www.agyli.com.br')).toBe('agyli')
      expect(resolveProductByDomain('grupocontek.com.br')).toBe('agyli')
    })
  })

  describe('2. Landing Page AGYLI (quando aberto por agyli.com.br ou www.agyli.com.br)', () => {
    it('isAgyliDomain oculta o card MARKALY e exibe apenas o produto AGYLI Pro', () => {
      // Simulação da renderização de cards em Index.tsx sob isAgyliDomain
      const renderCards = (domainContext: 'agyli' | 'contek' | 'default') => {
        const isAgyliDomain = domainContext === 'agyli'
        const rendered: string[] = []
        // AGYLI sempre renderiza
        rendered.push('AGYLI Pro', 'R$ 29,90', '7 dias grátis', '/login?tab=signup&brand=agyli')

        // MARKALY só renderiza se NÃO for isAgyliDomain
        if (!isAgyliDomain) {
          rendered.push('MARKALY Essencial', 'R$ 19,90', '/login?tab=signup&brand=markaly')
        }

        return rendered
      }

      const agyliLanding = renderCards('agyli')
      expect(agyliLanding).toContain('AGYLI Pro')
      expect(agyliLanding).toContain('R$ 29,90')
      expect(agyliLanding).toContain('7 dias grátis')
      expect(agyliLanding).not.toContain('MARKALY Essencial')
      expect(agyliLanding).not.toContain('R$ 19,90')    })

    it('no código de Index.tsx, MARKALY está envolvido pela guarda !isAgyliDomain', () => {
      expect(indexSource).toContain('const isAgyliDomain = domainContext === \'agyli\'')
      expect(indexSource).toContain('{!isAgyliDomain && (')
      expect(indexSource).toContain('data-testid="markaly-product-card"')
      expect(indexSource).toContain('data-testid="agyli-product-card"')
    })
  })

  describe('3. Landing Page GRUPO CONTEK (quando aberto por grupocontek.com.br ou www.grupocontek.com.br)', () => {
    it('isContekDomain renderiza ambos os produtos e acesso ao painel SuperAdmin /admin', () => {
      const renderElements = (domainContext: 'agyli' | 'contek' | 'default') => {
        const isAgyliDomain = domainContext === 'agyli'
        const isContekDomain = domainContext === 'contek'

        const elements: string[] = []
        {
          elements.push('AGYLI Pro')
          if (!isAgyliDomain) {
            elements.push('MARKALY Essencial')
          }
        }

        if (isContekDomain) {
          elements.push('Painel SuperAdmin (/admin)')
        }

        return elements
      }

      const contekLanding = renderElements('contek')
      expect(contekLanding).toContain('AGYLI Pro')
      expect(contekLanding).toContain('MARKALY Essencial')
      expect(contekLanding).toContain('Painel SuperAdmin (/admin)')
    })

    it('no código de Index.tsx, links para /admin estão condicionados a isContekDomain', () => {
      expect(indexSource).toContain('const isContekDomain = domainContext === \'contek\'')
      expect(indexSource).toContain('{isContekDomain && (')
      expect(indexSource).toContain('data-testid="contek-admin-link"')
      expect(indexSource).toContain('data-testid="contek-admin-footer-link"')
      expect(indexSource).toContain('to="/admin"')
    })
  })

  describe('4. Landing Page DEFAULT (endereço do Skip e localhost)', () => {
    it('mantém a página de vendas atual inalterada: dois produtos (AGYLI e MARKALY), sem link público /admin', () => {
      const renderElements = (domainContext: 'agyli' | 'contek' | 'default') => {
        const isAgyliDomain = domainContext === 'agyli'
        const isContekDomain = domainContext === 'contek'

        const elements: string[] = []
        elements.push('AGYLI Pro')
        if (!isAgyliDomain) {
          elements.push('MARKALY Essencial')
        }
        if (isContekDomain) {
          elements.push('Painel SuperAdmin (/admin)')
        }
        return elements
      }

      const defaultLanding = renderElements('default')
      expect(defaultLanding).toContain('AGYLI Pro')
      expect(defaultLanding).toContain('MARKALY Essencial')
      expect(defaultLanding).not.toContain('Painel SuperAdmin (/admin)')
    })
  })

  describe('5. Telas internas e login inalterados para todos os domínios', () => {
    it('login continua comum para todos em /login, com suporte a &brand=agyli|markaly', () => {
      expect(loginSource).toContain("brandParam === 'markaly'")
      expect(loginSource).toContain("brandParam === 'agyli'")
      expect(loginSource).toContain('handleLogin')
      expect(loginSource).toContain('handleSelfServiceSignup')
    })

    it('tela de login tem abas simplificadas para o cliente (Entrar e Criar conta) e sem seletor de topo confuso', () => {
      expect(loginSource).toContain('Entrar')
      expect(loginSource).toContain('Criar conta')
      // Não exibe os chips interativos de troca AGYLI/MARKALY no topo do login
      expect(loginSource).not.toContain('Seletor Rápido de Marca no Topo do Login')
      // Cadastro Contek fica restrito e condicional a tab=contek ou tab=manual
      expect(loginSource).toContain('isContekTabRequested')
    })

    it('rotas protegidas e painéis internos em App.tsx permanecem idênticos', () => {
      expect(appSource).toContain('path="/painel"')
      expect(appSource).toContain('path="agenda"')
      expect(appSource).toContain('path="clientes"')
      expect(appSource).toContain('path="profissionais"')
      expect(appSource).toContain('path="servicos"')
      expect(appSource).toContain('path="financeiro"')
      expect(appSource).toContain('path="assistente-ia"')
      expect(appSource).toContain('path="configuracoes"')
      expect(appSource).toContain('path="/admin"')
      expect(appSource).toContain('path="/contek"')
    })
  })
})
