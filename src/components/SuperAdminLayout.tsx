import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Shield,
  Building2,
  RefreshCw,
  PlusCircle,
  HelpCircle,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ContekFullLogo, ContekSymbol, ContekSymbolVector } from '@/components/ContekBranding'

interface SuperAdminLayoutProps {
  onRefresh?: () => void
  onOpenCreate?: () => void
}

export const SuperAdminLayout: React.FC<SuperAdminLayoutProps> = ({ onRefresh, onOpenCreate }) => {
  const { user, logout, organization: currentActiveOrg } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    const redirectPath = logout()
    navigate(redirectPath)
  }

  const getInitials = (name?: string) => {
    if (!name) return 'SA'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const navItems = [
    {
      name: 'Gestão de Empresas (/admin)',
      path: '/admin',
      icon: Settings,
      description: 'Organizações, produtos e planos',
    },
    {
      name: 'Central Contek (Hub)',
      path: '/contek',
      icon: Sparkles,
      description: 'Visão executiva de sistemas',
    },
  ]

  return (
    <div className="min-h-screen flex flex-col antialiased bg-slate-50 text-slate-900 font-['Poppins',sans-serif]">
      {/* TOP HEADER SUPERADMIN CONTEK */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Logo Corporativo Oficial Grupo CONTEK */}
          <Link
            to="/contek"
            className="flex items-center gap-2.5 group"
            data-testid="admin-contek-header-logo"
          >
            <div className="hidden sm:block">
              <ContekFullLogo height={36} theme="light" />
            </div>
            <div className="sm:hidden flex items-center gap-2">
              <ContekSymbol size={32} />
              <span className="text-sm font-extrabold text-[#0D1B2A] tracking-tight">CONTEK</span>
            </div>
            <Badge
              variant="outline"
              className="border-cyan-300 bg-cyan-50/70 text-[#06B6D4] text-[10px] font-semibold px-2 py-0.5 rounded-full"
            >
              SuperAdmin
            </Badge>
          </Link>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Se houver empresa previamente inspecionada */}
          {currentActiveOrg && (
            <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] text-slate-600 border border-slate-200">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>
                Última empresa inspecionada:{' '}
                <strong className="text-slate-800">{currentActiveOrg.name}</strong>
              </span>
            </div>
          )}

          {/* Botão Central Contek */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/contek')}
            className="border-cyan-300 text-[#0D1B2A] bg-cyan-50/70 hover:bg-cyan-100 text-xs font-semibold"
            data-testid="admin-top-central-contek-btn"
          >
            <ContekSymbol size={14} className="mr-1.5" />
            <span className="hidden sm:inline">Central Contek</span>
            <span className="sm:hidden">Central</span>
          </Button>

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full p-0 border border-slate-200 hover:border-cyan-400"
              >
                <Avatar className="h-9 w-9 border border-slate-200">
                  <AvatarFallback className="font-semibold text-xs bg-[#0D1B2A] text-white">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none text-slate-900">
                    {user?.name || 'SuperAdmin Contek'}
                  </p>
                  <p className="text-xs leading-none text-slate-500 truncate">{user?.email}</p>
                  <div className="pt-1 flex items-center gap-1.5">
                    <Badge className="text-[10px] px-1.5 py-0 bg-[#0D1B2A] text-cyan-300 border border-cyan-500/30 font-mono">
                      SUPERADMIN ROOT
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/contek')}
                className="text-[#0D1B2A] focus:text-[#06B6D4] focus:bg-cyan-50 font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2 text-cyan-600" />
                Central Contek (Hub de Sistemas)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate('/admin')}
                className="text-slate-700 focus:text-slate-900"
              >
                <Settings className="w-4 h-4 mr-2 text-slate-500" />
                Painel SuperAdmin (/admin)
              </DropdownMenuItem>
              {currentActiveOrg && (
                <DropdownMenuItem
                  onClick={() => navigate('/')}
                  className="text-slate-600 focus:text-slate-900"
                >
                  <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                  Ir ao Painel de {currentActiveOrg.name}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair do SuperAdmin
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* BODY WITH CONTEK SIDEBAR + MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* DESKTOP SIDEBAR CONTEK - Fundo sóbrio azul-marinho #0D1B2A */}
        <aside
          className="hidden md:flex md:w-64 flex-col flex-shrink-0 border-r bg-[#0D1B2A] text-slate-300 border-slate-800 shadow-lg"
          data-testid="admin-contek-sidebar"
        >
          {/* Top Brand & Platform Info */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2.5 pt-1">
              <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1.5 shadow-sm">
                <ContekSymbol size={26} glow />
              </div>
              <div className="min-w-0">
                <h2 className="font-extrabold text-sm text-white tracking-tight leading-tight">
                  GRUPO CONTEK
                </h2>
                <p className="text-[10px] text-cyan-400 font-medium tracking-wide">
                  PAINEL SUPERADMIN
                </p>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] uppercase font-mono tracking-wider">Ambiente</span>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Produção Corporativa Contek
                </span>
              </div>
              <p className="text-slate-400 text-[10px]">
                Base unificada de organizações AGYLI e MARKALY.
              </p>
            </div>
          </div>

          {/* Navigation Items (apenas navegação própria da plataforma Contek) */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            <div className="px-2 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Gestão da Plataforma
            </div>

            <NavLink
              to="/admin"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group',
                  isActive
                    ? 'bg-gradient-to-r from-[#1E3A8A] to-[#06B6D4] text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                )
              }
              data-testid="sidebar-admin-link"
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <div className="flex flex-col text-left">
                <span>Painel /admin</span>
                <span className="text-[10px] font-normal text-slate-400 group-hover:text-slate-300">
                  Todas as Empresas
                </span>
              </div>
            </NavLink>

            <NavLink
              to="/contek"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group',
                  isActive
                    ? 'bg-gradient-to-r from-[#1E3A8A] to-[#06B6D4] text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                )
              }
              data-testid="sidebar-central-hub-link"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <div className="flex flex-col text-left">
                <span>Central Contek</span>
                <span className="text-[10px] font-normal text-slate-400 group-hover:text-slate-300">
                  Hub de Sistemas
                </span>
              </div>
              <span className="ml-auto text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-mono border border-purple-500/30">
                HUB
              </span>
            </NavLink>

            {/* Ações de Gestão Rápida */}
            <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ações Rápidas
              </div>

              {onOpenCreate && (
                <button
                  type="button"
                  onClick={onOpenCreate}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200 transition-colors"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>Nova Empresa</span>
                </button>
              )}

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span>Atualizar Base</span>
                </button>
              )}

              {currentActiveOrg && (
                <Link
                  to="/"
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-blue-300 hover:bg-blue-950/40 hover:text-blue-200 transition-colors"
                >
                  <Building2 className="w-4 h-4 text-blue-400" />
                  <span>Abrir {currentActiveOrg.name}</span>
                </Link>
              )}
            </div>
          </nav>

          {/* Sidebar Footer Contek Oficial */}
          <div className="p-3 border-t border-slate-800 text-xs space-y-2 bg-slate-950/40">
            <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300">
              <div className="flex items-center gap-2">
                <ContekSymbol size={16} />
                <span className="text-[11px] font-bold text-white">Grupo CONTEK</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Tecnologia e Consultoria</p>
              <p className="text-[9px] text-slate-400 mt-1">
                Gestão exclusiva de administradores corporativos.
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full text-xs justify-start text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 h-8"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sair do Sistema
            </Button>
          </div>
        </aside>

        {/* MOBILE SLIDE-OVER CONTEK */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm flex">
            <div className="w-4/5 max-w-xs h-full p-4 flex flex-col justify-between shadow-2xl bg-[#0D1B2A] text-slate-200">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ContekSymbol size={28} />
                    <div>
                      <p className="font-bold text-sm text-white">GRUPO CONTEK</p>
                      <p className="text-[10px] text-cyan-400">SuperAdmin Multi-Produto</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold',
                      location.pathname === '/admin'
                        ? 'bg-gradient-to-r from-[#1E3A8A] to-[#06B6D4] text-white'
                        : 'text-slate-300 hover:bg-slate-800',
                    )}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Painel SuperAdmin (/admin)</span>
                  </Link>
                  <Link
                    to="/contek"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold',
                      location.pathname === '/contek'
                        ? 'bg-gradient-to-r from-[#1E3A8A] to-[#06B6D4] text-white'
                        : 'text-slate-300 hover:bg-slate-800',
                    )}
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Central Contek (Hub)</span>
                  </Link>
                </nav>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    handleLogout()
                  }}
                  className="w-full text-xs justify-start text-rose-400 hover:bg-rose-950/30 hover:text-rose-300"
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sair do SuperAdmin
                </Button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 min-w-0 overflow-y-auto pb-12 p-4 sm:p-6 lg:p-8 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SuperAdminLayout
