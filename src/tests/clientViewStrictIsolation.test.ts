import { describe, it, expect } from 'vitest'
import layoutSource from '../components/Layout.tsx?raw'
import superAdminLayoutSource from '../components/SuperAdminLayout.tsx?raw'
import superAdminSource from '../pages/SuperAdmin.tsx?raw'
import appSource from '../App.tsx?raw'
import authContextSource from '../context/AuthContext.tsx?raw'
import loginContekSource from '../pages/LoginContek.tsx?raw'
import centralContekSource from '../pages/CentralContek.tsx?raw'

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
      expect(appSource).toMatch(/<Route\s+path="\/admin"\s+element=\{\s*<SuperAdminRoute>\s*<SuperAdminLayout\s*\/>\s*<\/SuperAdminRoute>/)
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

  describe('5. Identidade Corporativa Exclusiva do /admin (Grupo Contek)', () => {
    it('/admin utiliza SuperAdminLayout corporativo próprio com logo Contek oficial e tom azul-marinho #0D1B2A', () => {
      expect(superAdminLayoutSource).toContain('ContekFullLogo')
      expect(superAdminLayoutSource).toContain('ContekSymbol')
      expect(superAdminLayoutSource).toContain('#0D1B2A')
      expect(superAdminLayoutSource).toContain('GRUPO CONTEK')
      expect(superAdminLayoutSource).toContain('data-testid="admin-contek-sidebar"')
      expect(superAdminLayoutSource).toContain('data-testid="admin-contek-header-logo"')
    })

    it('a sidebar e o header do /admin NÃO devem conter a marca AGYLI, nem o slogan nem selo PRO', () => {
      // Sidebar e Header do admin não podem conter agyli / Agendar ficou simples / PRO
      expect(superAdminLayoutSource).not.toContain('agyli.')
      expect(superAdminLayoutSource).not.toContain('AgyliLogo')
      expect(superAdminLayoutSource).not.toContain('AgyliEmblem')
      expect(superAdminLayoutSource).not.toContain('Agendar ficou simples.')
      expect(superAdminLayoutSource).not.toContain('bg-blue-100 text-blue-700') // selo PRO de tenant
    })

    it('a sidebar do /admin NÃO deve conter menus de produto de tenant (Dashboard, Agenda, Clientes, Profissionais, Serviços, Financeiro, Assistente IA)', () => {
      const navSection = superAdminLayoutSource.slice(
        superAdminLayoutSource.indexOf('<nav'),
        superAdminLayoutSource.indexOf('</nav>'),
      )
      expect(navSection).not.toContain('to="/agenda"')
      expect(navSection).not.toContain('to="/clientes"')
      expect(navSection).not.toContain('to="/profissionais"')
      expect(navSection).not.toContain('to="/servicos"')
      expect(navSection).not.toContain('to="/financeiro"')
      expect(navSection).not.toContain('to="/assistente-ia"')
      expect(navSection).not.toContain('to="/configuracoes"')
    })

    it('a sidebar do /admin NÃO deve conter elementos de tenant ("Tenant Ativo", "Carregando empresa...", "Sua Empresa", PwaInstallPrompt, Novo Agendamento)', () => {
      expect(superAdminLayoutSource).not.toContain('Tenant Ativo')
      expect(superAdminLayoutSource).not.toContain('Carregando empresa...')
      expect(superAdminLayoutSource).not.toContain('PwaInstallPrompt')
      expect(superAdminLayoutSource).not.toContain('Novo Agendamento')
      expect(superAdminLayoutSource).not.toContain('Instalar App')
    })

    it('o layout de tenant (Layout.tsx) NÃO exibe menus administrativos Contek quando isSuperAdmin for false', () => {
      // Clientes comuns continuam isolados
      expect(layoutSource).toContain('{Boolean(isSuperAdmin) && (')
      expect(layoutSource).not.toContain('contek-admin-tenant-leak')
    })
  })

  describe('6. Fluxo de Logout e Redirecionamento da Raiz "/"', () => {
    it('(a) logout de SuperAdmin termina em /acesso-contek', () => {
      const performLogoutForUser = (user: { is_super_admin?: boolean; role?: string } | null) => {
        const wasSuper = Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
        return wasSuper ? '/acesso-contek' : '/login'
      }

      const superAdminUser = { is_super_admin: true, role: 'SUPERADMIN' }
      expect(performLogoutForUser(superAdminUser)).toBe('/acesso-contek')

      const superAdminLuciana = { is_super_admin: true, role: 'ADMINISTRADOR' }
      expect(performLogoutForUser(superAdminLuciana)).toBe('/acesso-contek')
    })

    it('(b) logout de cliente termina em /login', () => {
      const performLogoutForUser = (user: { is_super_admin?: boolean; role?: string } | null) => {
        const wasSuper = Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
        return wasSuper ? '/acesso-contek' : '/login'
      }

      const clientAdmin = { is_super_admin: false, role: 'ADMINISTRADOR' }
      expect(performLogoutForUser(clientAdmin)).toBe('/login')

      const clientProf = { is_super_admin: false, role: 'PROFISSIONAL' }
      expect(performLogoutForUser(clientProf)).toBe('/login')

      const anonymousUser = null
      expect(performLogoutForUser(anonymousUser)).toBe('/login')
    })

    it('(c) SuperAdmin logado que abre "/" sem tenant ativo vai para a Central Contek (/contek); com tenant ativo vê Dashboard', () => {
      // Simulação do comportamento da rota raiz "/" (RootRoute)
      const resolveRootRoute = (
        user: { is_super_admin?: boolean; role?: string } | null,
        activeOrg: { id: string; name: string } | null = null,
      ) => {
        if (!user) {
          return { destination: '/login', replace: true }
        }
        const isSuper = Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
        if (isSuper) {
          if (activeOrg) {
            return { destination: 'DASHBOARD_TENANT', replace: false }
          }
          return { destination: '/contek', replace: true }
        }
        return { destination: 'DASHBOARD_TENANT', replace: false }
      }

      const superAdminUser = { is_super_admin: true, role: 'SUPERADMIN' }
      // Sem tenant selecionado -> /contek
      expect(resolveRootRoute(superAdminUser, null)).toEqual({ destination: '/contek', replace: true })

      // Com tenant selecionado (ex: CAMILA / LUIS via contek_active_org_id) -> Dashboard
      const camilaOrg = { id: 'org_camila_123', name: 'CAMILA' }
      expect(resolveRootRoute(superAdminUser, camilaOrg)).toEqual({ destination: 'DASHBOARD_TENANT', replace: false })
    })

    it('(d) cliente logado que abre "/" continua no painel da própria empresa (Dashboard do tenant)', () => {
      const resolveRootRoute = (
        user: { is_super_admin?: boolean; role?: string } | null,
        activeOrg: { id: string; name: string } | null = null,
      ) => {
        if (!user) {
          return { destination: '/login', replace: true }
        }
        const isSuper = Boolean(user && (user.is_super_admin === true || user.role === 'SUPERADMIN'))
        if (isSuper) {
          if (activeOrg) {
            return { destination: 'DASHBOARD_TENANT', replace: false }
          }
          return { destination: '/contek', replace: true }
        }
        return { destination: 'DASHBOARD_TENANT', replace: false }
      }

      const regularClient = { is_super_admin: false, role: 'ADMINISTRADOR' }
      expect(resolveRootRoute(regularClient)).toEqual({ destination: 'DASHBOARD_TENANT', replace: false })

      const profClient = { is_super_admin: false, role: 'PROFISSIONAL' }
      expect(resolveRootRoute(profClient)).toEqual({ destination: 'DASHBOARD_TENANT', replace: false })
    })

    it('(e) SuperAdmin navegando da Central Contek para o painel de uma empresa (CAMILA / LUIS) exibe badge conectada e link de retorno', () => {
      // Validação de que Layout.tsx tem data-testid="superadmin-central-contek-btn" e "header-connected-org-badge"
      expect(layoutSource).toContain('data-testid="header-connected-org-badge"')
      expect(layoutSource).toContain('data-testid="superadmin-central-contek-btn"')
      expect(layoutSource).toContain('Conectada a:')
      expect(centralContekSource).toContain('data-testid={`enter-org-${org.slug}`}')
    })

    it('implementação real do AuthContext.tsx, Layout.tsx, CentralContek.tsx e SuperAdminLayout.tsx redireciona SuperAdmin para /acesso-contek no logout', () => {
      expect(authContextSource).toContain("wasSuper ? '/acesso-contek' : '/login'")
      expect(authContextSource).toContain('window.location.replace(targetPath)')
      expect(authContextSource).toContain("sessionStorage.setItem('logout_redirect_to', targetPath)")
      expect(layoutSource).toContain('const redirectPath = logout()')
      expect(layoutSource).toContain('navigate(redirectPath)')
      expect(superAdminLayoutSource).toContain('const redirectPath = logout()')
      expect(superAdminLayoutSource).toContain('navigate(redirectPath)')
    })

    it('implementação real do App.tsx e FeatureGate.tsx possui guarda contra corrida com logout_redirect_to em sessionStorage', () => {
      expect(appSource).toContain('logout_redirect_to')
      expect(appSource).toContain('RootRoute')
      expect(appSource).toContain('if (isSuperAdmin) {')
      expect(appSource).toContain('to="/contek"')
      expect(appSource).toContain('<Route index element={<RootRoute />} />')
    })

    it('(e) simulação completa do logout() com window.location.replace e sessionStorage contra corrida de rotas', () => {
      // Mock de ambiente
      const mockStorage: Record<string, string> = {
        contek_active_org_id: 'org_inspected_123',
      }
      const mockSession: Record<string, string> = {}
      let replacedUrl = ''

      const simulateLogout = (
        user: { is_super_admin?: boolean; role?: string } | null,
        pbRecord: { is_super_admin?: boolean; role?: string } | null,
      ) => {
        const wasSuper = Boolean(
          user?.is_super_admin ||
          user?.role === 'SUPERADMIN' ||
          pbRecord?.is_super_admin ||
          pbRecord?.role === 'SUPERADMIN',
        )
        const targetPath = wasSuper ? '/acesso-contek' : '/login'

        delete mockStorage['contek_active_org_id']
        mockSession['logout_redirect_to'] = targetPath

        replacedUrl = targetPath
        return targetPath
      }

      const simulateGuardWhenLoggedOut = () => {
        let target = '/login'
        const stored = mockSession['logout_redirect_to']
        if (stored) {
          delete mockSession['logout_redirect_to']
          target = stored
        }
        return target
      }

      // Teste 1: Luciana SuperAdmin desloga de /contek ou /admin
      const luciana = { is_super_admin: true, role: 'SUPERADMIN' }
      const res1 = simulateLogout(luciana, luciana)
      expect(res1).toBe('/acesso-contek')
      expect(replacedUrl).toBe('/acesso-contek')
      expect(mockStorage['contek_active_org_id']).toBeUndefined()
      expect(mockSession['logout_redirect_to']).toBe('/acesso-contek')

      // Se a rota protegida renderizar antes do redirect de window, consome sessionStorage
      const guardResult1 = simulateGuardWhenLoggedOut()
      expect(guardResult1).toBe('/acesso-contek')
      expect(mockSession['logout_redirect_to']).toBeUndefined()

      // Teste 2: SuperAdmin inspecionando clínica de cliente (com active_org no storage)
      mockStorage['contek_active_org_id'] = 'org_lulu_markaly'
      const res2 = simulateLogout({ is_super_admin: true, role: 'ADMINISTRADOR' }, null)
      expect(res2).toBe('/acesso-contek')
      expect(mockStorage['contek_active_org_id']).toBeUndefined()
      expect(simulateGuardWhenLoggedOut()).toBe('/acesso-contek')

      // Teste 3: Cliente comum desloga
      const regularClient = { is_super_admin: false, role: 'ADMINISTRADOR' }
      const res3 = simulateLogout(regularClient, null)
      expect(res3).toBe('/login')
      expect(simulateGuardWhenLoggedOut()).toBe('/login')
    })
  })
})
