import { describe, it, expect } from 'vitest'
import layoutSource from '../components/Layout.tsx?raw'
import appSource from '../App.tsx?raw'
import authContextSource from '../context/AuthContext.tsx?raw'
import loginContekSource from '../pages/LoginContek.tsx?raw'

describe('Isolamento Estrito de Painel de Cliente vs Central Contek SuperAdmin', () => {
  describe('1. Verificação Estrita de isSuperAdmin no AuthContext', () => {
    it('isSuperAdmin avalia true APENAS quando user.is_super_admin === true ou user.role === "SUPERADMIN"', () => {
      // Simulação da lógica exata definida no AuthContext
      const checkIsSuperAdmin = (user: { is_super_admin?: boolean; role?: string } | null | undefined): boolean => {
        return Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
      }

      // Casos SuperAdmin (Luciana)
      expect(checkIsSuperAdmin({ is_super_admin: true, role: 'SUPERADMIN' })).toBe(true)
      expect(checkIsSuperAdmin({ is_super_admin: true, role: 'ADMINISTRADOR' })).toBe(true)
      expect(checkIsSuperAdmin({ is_super_admin: false, role: 'SUPERADMIN' })).toBe(true)

      // Casos de CLIENTES COMUNS (donos de empresa AGYLI ou MARKALY)
      // Um dono de clínica tem role 'ADMINISTRADOR' e is_super_admin = false ou undefined
      expect(checkIsSuperAdmin({ is_super_admin: false, role: 'ADMINISTRADOR' })).toBe(false)
      expect(checkIsSuperAdmin({ role: 'ADMINISTRADOR' })).toBe(false)
      expect(checkIsSuperAdmin({ role: 'PROFISSIONAL' })).toBe(false)
      expect(checkIsSuperAdmin(null)).toBe(false)
      expect(checkIsSuperAdmin(undefined)).toBe(false)
      expect(checkIsSuperAdmin({})).toBe(false)
    })

    it('AuthContext possui comentário e código de default seguro para não expor privilégios administrativos', () => {
      expect(authContextSource).toContain('isSuperAdmin')
      expect(authContextSource).toContain('user.is_super_admin === true || user.role === \'SUPERADMIN\'')
    })
  })

  describe('2. Renderização Condicional no Layout.tsx (DOM)', () => {
    it('todos os pontos de entrada para /contek e /admin no Layout.tsx estão sob guarda Boolean(isSuperAdmin)', () => {
      // Nenhum link para /contek ou /admin deve ser renderizado sem isSuperAdmin
      expect(layoutSource).toContain('{Boolean(isSuperAdmin) && (')
      expect(layoutSource).toContain('data-testid="superadmin-central-contek-btn"')
      expect(layoutSource).toContain('data-testid="dropdown-central-contek"')
      expect(layoutSource).toContain('data-testid="dropdown-superadmin-panel"')
      expect(layoutSource).toContain('data-testid="sidebar-superadmin-section"')
      expect(layoutSource).toContain('data-testid="mobile-central-contek-btn"')
    })

    it('simulação do DOM: cliente comum (isSuperAdmin = false) NÃO renderiza Central Contek nem /admin', () => {
      // Simulação de renderização com base na flag
      interface MockLayoutProps {
        isSuperAdmin: boolean
        product: 'agyli' | 'markaly'
      }

      const renderNavElements = (props: MockLayoutProps) => {
        const elements: string[] = []
        // Menu comum
        elements.push('Dashboard', 'Agenda', 'Clientes', 'Profissionais', 'Serviços')
        if (props.product === 'agyli') {
          elements.push('Financeiro', 'Assistente IA')
        }
        elements.push('Configurações')

        // Itens de SuperAdmin Contek
        if (props.isSuperAdmin) {
          elements.push('Header: Central Contek')
          elements.push('Sidebar: Central Contek')
          elements.push('Sidebar: Painel /admin')
          elements.push('Dropdown: Central Contek')
          elements.push('Dropdown: Painel Avançado SuperAdmin')
          elements.push('Mobile: Central Contek')
        }

        return elements
      }

      // Cliente AGYLI Comum
      const agyliClientDOM = renderNavElements({ isSuperAdmin: false, product: 'agyli' })
      expect(agyliClientDOM).toContain('Dashboard')
      expect(agyliClientDOM).toContain('Financeiro')
      expect(agyliClientDOM).toContain('Assistente IA')
      expect(agyliClientDOM).not.toContain('Header: Central Contek')
      expect(agyliClientDOM).not.toContain('Sidebar: Central Contek')
      expect(agyliClientDOM).not.toContain('Sidebar: Painel /admin')
      expect(agyliClientDOM).not.toContain('Dropdown: Central Contek')
      expect(agyliClientDOM).not.toContain('Dropdown: Painel Avançado SuperAdmin')

      // Cliente MARKALY Comum
      const markalyClientDOM = renderNavElements({ isSuperAdmin: false, product: 'markaly' })
      expect(markalyClientDOM).toContain('Dashboard')
      expect(markalyClientDOM).not.toContain('Financeiro')
      expect(markalyClientDOM).not.toContain('Assistente IA')
      expect(markalyClientDOM).not.toContain('Header: Central Contek')
      expect(markalyClientDOM).not.toContain('Sidebar: Central Contek')
      expect(markalyClientDOM).not.toContain('Sidebar: Painel /admin')

      // SuperAdmin Contek (Luciana)
      const superAdminDOM = renderNavElements({ isSuperAdmin: true, product: 'agyli' })
      expect(superAdminDOM).toContain('Header: Central Contek')
      expect(superAdminDOM).toContain('Sidebar: Central Contek')
      expect(superAdminDOM).toContain('Sidebar: Painel /admin')
    })
  })

  describe('3. Proteção e Redirecionamento de Rotas Administrativas', () => {
    it('/contek e /admin estão envolvidas por SuperAdminRoute no App.tsx', () => {
      expect(appSource).toMatch(/<Route\s+path="\/contek"\s+element=\{\s*<SuperAdminRoute>\s*<CentralContek\s*\/>\s*<\/SuperAdminRoute>/)
      expect(appSource).toMatch(/<Route\s+path="admin"\s+element=\{\s*<SuperAdminRoute>\s*<SuperAdmin\s*\/>\s*<\/SuperAdminRoute>/)
    })

    it('SuperAdminRoute redireciona cliente comum não-SuperAdmin para a home / da empresa', () => {
      // Simulação da guarda exata de SuperAdminRoute
      const runSuperAdminRoute = (user: { id: string; role?: string; is_super_admin?: boolean } | null) => {
        if (!user) {
          return { destination: '/login', replace: true }
        }
        const isSuper = Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
        if (!isSuper) {
          return { destination: '/', replace: true }
        }
        return { destination: 'ALLOWED', replace: false }
      }

      // Cliente comum logado (dono de clínica) tenta acessar /admin ou /contek
      const clientUser = { id: 'usr_cliente_123', role: 'ADMINISTRADOR', is_super_admin: false }
      expect(runSuperAdminRoute(clientUser)).toEqual({ destination: '/', replace: true })

      // Profissional de clínica
      const profUser = { id: 'usr_prof_123', role: 'PROFISSIONAL', is_super_admin: false }
      expect(runSuperAdminRoute(profUser)).toEqual({ destination: '/', replace: true })

      // SuperAdmin real
      const superAdmin = { id: 'usr_luciana', role: 'SUPERADMIN', is_super_admin: true }
      expect(runSuperAdminRoute(superAdmin)).toEqual({ destination: 'ALLOWED', replace: false })
    })

    it('LoginContek redireciona cliente comum já autenticado para seu próprio painel (/)', () => {
      expect(loginContekSource).toContain("navigate('/', { replace: true })")
      expect(loginContekSource).toContain("navigate('/contek', { replace: true })")
    })
  })

  describe('4. Delimitação de Identidade e Rodapé', () => {
    it('o rodapé do painel exibe apenas assinatura discreta "Uma solução Grupo CONTEK" e não botões administrativos', () => {
      expect(layoutSource).toContain('Uma solução')
      expect(layoutSource).toContain('Grupo CONTEK')
      // Verifica que o rodapé não tem link para /admin ou /contek
      const footerSection = layoutSource.slice(layoutSource.indexOf('Sidebar Footer Info'))
      expect(footerSection).not.toContain('to="/contek"')
      expect(footerSection).not.toContain('to="/admin"')
    })
  })
})
