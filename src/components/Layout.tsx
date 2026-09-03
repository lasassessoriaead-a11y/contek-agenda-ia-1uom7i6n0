import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  Sparkles,
  DollarSign,
  Settings,
  Bot,
  LogOut,
  Menu,
  X,
  ExternalLink,
  PlusCircle,
  Building,
  Bell,
  CheckCircle2,
  CalendarDays,
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
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt'

export const Layout: React.FC = () => {
  const { user, organization, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Navigation menu EXACT ORDER as requested in prompt:
  // Dashboard, Agenda, Clientes, Profissionais, Serviços, Financeiro, Assistente IA, Configurações
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Agenda', path: '/agenda', icon: Calendar },
    { name: 'Clientes', path: '/clientes', icon: Users },
    { name: 'Profissionais', path: '/profissionais', icon: UserCheck },
    { name: 'Serviços', path: '/servicos', icon: CalendarDays },
    { name: 'Financeiro', path: '/financeiro', icon: DollarSign },
    { name: 'Assistente IA', path: '/assistente-ia', icon: Bot, isAi: true },
    { name: 'Configurações', path: '/configuracoes', icon: Settings },
  ]

  // Mobile Bottom Bar primary items
  const bottomNavItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Agenda', path: '/agenda', icon: Calendar },
    { name: 'Clientes', path: '/clientes', icon: Users },
    { name: 'Financeiro', path: '/financeiro', icon: DollarSign },
    { name: 'Mais', onClick: () => setMobileMenuOpen(true), icon: Menu },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const publicUrl = organization?.slug ? `/agendar/${organization.slug}` : null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased">
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-base tracking-tight text-slate-900">Contek</span>
                <span className="font-semibold text-xs px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono">
                  AGENDA IA
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[10px] text-slate-500 font-medium leading-none truncate max-w-[130px]">
                  {organization?.name || 'Carregando empresa...'}
                </p>
                {organization?.slug === 'contek-demo' && (
                  <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 text-[8px] font-bold">
                    DEMO
                  </span>
                )}
              </div>
            </div>
          </Link>
        </div>

        {/* Action Header Items */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* PWA Install Button */}
          <PwaInstallPrompt variant="button" />

          {publicUrl && (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="hidden lg:inline-flex border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-medium"
            >
              <Link to={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Link Público
              </Link>
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => navigate('/agenda?new=1')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm shadow-emerald-600/20"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Novo</span>
          </Button>

          {/* User Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9 border border-emerald-200">
                  <AvatarFallback className="bg-emerald-100 text-emerald-800 font-semibold text-xs">
                    {getInitials(user?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none text-slate-900">
                    {user?.name || 'Usuário'}
                  </p>
                  <p className="text-xs leading-none text-slate-500 truncate">{user?.email}</p>
                  <div className="pt-1 flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-700"
                    >
                      {user?.role || 'ADMINISTRADOR'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-emerald-200 text-emerald-700"
                    >
                      Multi-tenant OK
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/configuracoes')}>
                <Settings className="w-4 h-4 mr-2 text-slate-500" />
                Configurações da Empresa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/assistente-ia')}>
                <Bot className="w-4 h-4 mr-2 text-indigo-500" />
                Assistente IA Contek
              </DropdownMenuItem>
              {publicUrl && (
                <DropdownMenuItem onClick={() => window.open(publicUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2 text-emerald-600" />
                  Abrir Link Público
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* BODY WITH SIDEBAR + MAIN CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex md:w-64 flex-col bg-slate-900 text-slate-300 border-r border-slate-800 flex-shrink-0">
          {/* Org Header / Badge */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 flex-shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">
                  {organization?.name || 'Sua Empresa'}
                </p>
                <p className="text-[10px] text-emerald-400 font-mono">Tenant Ativo</p>
              </div>
            </div>
          </div>

          {/* Nav Items List */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive: active }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
                      active
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                      item.isAi &&
                        !active &&
                        'text-indigo-300 hover:text-indigo-200 hover:bg-indigo-950/40',
                    )
                  }
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 transition-transform group-hover:scale-110',
                      isActive ? 'text-white' : item.isAi ? 'text-indigo-400' : 'text-slate-400',
                    )}
                  />
                  <span>{item.name}</span>
                  {item.isAi && (
                    <span className="ml-auto text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                      IA
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>

          {/* Sidebar Footer Info */}
          <div className="p-3 border-t border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-slate-200">Contek Agenda IA V1</p>
                <p className="text-[10px] text-slate-400">
                  Desenvolvido por Contek Tecnologia e Consultoria
                </p>
              </div>
            </div>
            {/* Install Button inside desktop sidebar */}
            <PwaInstallPrompt
              variant="button"
              className="w-full justify-center bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-700/50"
            />
          </div>
        </aside>

        {/* MOBILE SLIDE-OVER MENU */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-slate-950/80 backdrop-blur-sm flex">
            <div className="w-4/5 max-w-xs bg-slate-900 text-slate-200 h-full p-4 flex flex-col justify-between shadow-2xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                      C
                    </div>
                    <div>
                      <p className="font-bold text-sm text-white">{organization?.name}</p>
                      <p className="text-[10px] text-emerald-400">Contek Agenda IA</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                        {item.isAi && (
                          <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-mono">
                            IA
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </nav>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-800">
                {publicUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs justify-start border-slate-700 text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      window.open(publicUrl, '_blank')
                    }}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-2 text-emerald-400" />
                    Página de Agendamento
                  </Button>
                )}
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
                  Sair do Sistema
                </Button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8 p-4 sm:p-6 lg:p-8 bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center justify-around py-2 px-1 shadow-lg">
        {bottomNavItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = item.path ? location.pathname === item.path : false

          if (item.onClick) {
            return (
              <button
                key={idx}
                type="button"
                onClick={item.onClick}
                className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-emerald-600 transition-colors"
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium mt-0.5">{item.name}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.path}
              to={item.path!}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-1 transition-colors',
                isActive ? 'text-emerald-600 font-semibold' : 'text-slate-500 hover:text-slate-800',
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium mt-0.5">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
export default Layout
