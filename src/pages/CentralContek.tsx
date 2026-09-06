import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Building2,
  Calendar,
  ExternalLink,
  LogIn,
  Search,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  Layers,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { AgyliLogo, AgyliEmblem } from '@/components/AgyliBranding'
import { MarkalyLogo, MarkalyEmblem } from '@/components/MarkalyBranding'
import { ProductType } from '@/types'

interface HubOrgItem {
  id: string
  name: string
  slug: string
  email?: string
  phone?: string
  product: ProductType
  status: 'active' | 'trial' | 'suspended'
  created: string
  counts: {
    clients: number
    appointments: number
    professionals: number
    users: number
  }
  subscription?: {
    id: string
    status: 'trial' | 'active' | 'overdue' | 'canceled'
    plan_id: string
    plan_name?: string
  } | null
}

interface HubOverviewResponse {
  summary: {
    total_organizations: number
    total_agyli: number
    total_markaly: number
    status_breakdown: {
      active: number
      trial: number
      suspended: number
    }
  }
  organizations: HubOrgItem[]
}

export const CentralContek: React.FC = () => {
  const navigate = useNavigate()
  const {
    user,
    isSuperAdmin,
    switchOrganization,
    logout,
    organization: currentActiveOrg,
  } = useAuth()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<HubOverviewResponse | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [enteringOrgId, setEnteringOrgId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pb.send<HubOverviewResponse>('/backend/v1/superadmin/overview', {
        method: 'GET',
      })
      setData(res)
    } catch (err: unknown) {
      console.error('Erro ao carregar dados na Central Contek:', err)
      toast.error('Não foi possível carregar os dados das empresas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      loadData()
    }
  }, [isSuperAdmin, loadData])

  const handleEnterOrg = async (org: { id: string; name: string }) => {
    setEnteringOrgId(org.id)
    try {
      await switchOrganization(org.id)
      toast.success(`Acessando painel de ${org.name}...`)
      navigate('/')
    } catch (err) {
      console.error(err)
      toast.error('Erro ao alternar para o painel desta empresa.')
    } finally {
      setEnteringOrgId(null)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Primeiro nome para saudação amigável ("Olá, Luciana")
  const firstName = useMemo(() => {
    if (!user?.name) return 'Administrador'
    const clean = user.name.trim()
    // Se for formato "Nome Sobrenome (Admin)" remove o parênteses
    const withoutParens = clean.split('(')[0].trim()
    return withoutParens.split(' ')[0] || 'Administrador'
  }, [user?.name])

  // Separação de organizações por produto
  const agyliOrgs = useMemo(() => {
    return (data?.organizations || []).filter((o) => o.product === 'agyli')
  }, [data?.organizations])

  const markalyOrgs = useMemo(() => {
    return (data?.organizations || []).filter((o) => o.product === 'markaly')
  }, [data?.organizations])

  // Filtragem pela busca rápida
  const filteredAgyli = useMemo(() => {
    if (!searchTerm.trim()) return agyliOrgs
    const term = searchTerm.toLowerCase().trim()
    return agyliOrgs.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.slug.toLowerCase().includes(term) ||
        (o.email && o.email.toLowerCase().includes(term)),
    )
  }, [agyliOrgs, searchTerm])

  const filteredMarkaly = useMemo(() => {
    if (!searchTerm.trim()) return markalyOrgs
    const term = searchTerm.toLowerCase().trim()
    return markalyOrgs.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.slug.toLowerCase().includes(term) ||
        (o.email && o.email.toLowerCase().includes(term)),
    )
  }, [markalyOrgs, searchTerm])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-['Poppins',sans-serif] flex flex-col">
        {/* CABEÇALHO DISCRETO E NEUTRO - IDENTIDADE CONTEK SÓBRIA */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Logo Contek - Fundo claro, limpo, sem gradientes pesados */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                <span className="font-extrabold text-base tracking-tight">C</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-slate-900">CONTEK</span>
                  <span className="text-[11px] font-medium text-slate-500 hidden sm:inline">
                    • Central de Sistemas
                  </span>
                  <Badge
                    variant="outline"
                    className="border-purple-300 bg-purple-50 text-purple-700 text-[10px] font-semibold px-1.5 py-0"
                  >
                    SuperAdmin
                  </Badge>
                </div>
                <span className="text-[10px] text-slate-400 leading-none">
                  Tecnologia e Consultoria
                </span>
              </div>
            </div>

            {/* Ações do Topo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Badge indicativo de organização ativa (se for MARKALY ou outra) */}
              {currentActiveOrg && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 font-medium hidden md:inline-flex items-center gap-1.5 ${
                      currentActiveOrg.product === 'markaly'
                        ? 'bg-[#FEF3E2] text-[#3B0764] border-orange-300'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        currentActiveOrg.product === 'markaly' ? 'bg-[#F97316]' : 'bg-blue-600'
                      }`}
                    />
                    <span>
                      Conectada a:{' '}
                      <strong className="font-bold uppercase">{currentActiveOrg.product}</strong> •{' '}
                      {currentActiveOrg.name}
                    </span>
                  </Badge>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className={`text-xs hidden sm:inline-flex ${
                          currentActiveOrg.product === 'markaly'
                            ? 'border-orange-300 text-[#3B0764] hover:bg-orange-50'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <Link to="/">
                          <Building2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                          Ir para {currentActiveOrg.name}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Abrir painel da empresa selecionada ({currentActiveOrg.name} •{' '}
                        {currentActiveOrg.product.toUpperCase()})
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs border-purple-200 text-purple-700 bg-purple-50/60 hover:bg-purple-100"
                  >
                    <Link to="/admin">
                      <Settings className="w-3.5 h-3.5 mr-1.5 text-purple-600" />
                      <span className="hidden sm:inline">Painel Completo /admin</span>
                      <span className="sm:hidden">Admin</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Abrir tela administrativa com tabela geral, criação de empresas e edição</p>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              >
                <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </header>

        {/* CONTEÚDO PRINCIPAL DA CENTRAL */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* BANNER DE BOAS-VINDAS / INTRODUÇÃO */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ambiente Super Administrador Contek</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Olá, {firstName}
                </h1>
                <p className="text-sm text-slate-600 max-w-2xl">
                  Bem-vinda à <b>Central Contek</b>. Aqui você tem visão completa e acesso direto a
                  todos os sistemas e às empresas que gerencia em cada produto.
                </p>
                <p className="text-xs text-slate-400 pt-0.5 font-medium">
                  Uma solução{' '}
                  <span className="text-slate-700 font-semibold">
                    Contek Tecnologia e Consultoria
                  </span>
                </p>
              </div>

              {/* Busca rápida */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar empresa ou slug..."
                    className="pl-8 text-xs h-9 bg-slate-50 border-slate-200 focus-visible:ring-slate-400"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={loadData}
                  disabled={loading}
                  className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50 h-9"
                >
                  <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
            </div>

            {/* Resumo rápido em pílulas */}
            {data && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 mt-5 border-t border-slate-100 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-[11px] block">Total de Empresas</span>
                  <span className="text-lg font-bold text-slate-900">
                    {data.summary.total_organizations}
                  </span>
                </div>
                <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                  <span className="text-blue-700 text-[11px] block font-medium">
                    Empresas AGYLI
                  </span>
                  <span className="text-lg font-bold text-blue-900">
                    {data.summary.total_agyli}
                  </span>
                </div>
                <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                  <span className="text-orange-700 text-[11px] block font-medium">
                    Empresas MARKALY
                  </span>
                  <span className="text-lg font-bold text-orange-900">
                    {data.summary.total_markaly}
                  </span>
                </div>
                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <span className="text-emerald-700 text-[11px] block font-medium">
                    Ativas / Em Operação
                  </span>
                  <span className="text-lg font-bold text-emerald-900">
                    {data.summary.status_breakdown.active}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* GRID DE PRODUTOS / SISTEMAS: AGYLI & MARKALY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ============================================================== */}
            {/* CARD DO SISTEMA AGYLI */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              {/* Header do Card com Branding Oficial AGYLI */}
              <div className="p-5 sm:p-6 border-b border-blue-50 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold">
                      <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                      <span>Solução Avançada de Gestão</span>
                    </div>

                    <div className="pt-1">
                      <AgyliLogo
                        height={34}
                        theme="light"
                        showSlogan={true}
                        showSignature={false}
                      />
                    </div>

                    <p className="text-xs text-slate-600 max-w-md pt-1">
                      Plataforma completa com agendamento inteligente, gestão financeira, assistente
                      IA e notificações via WhatsApp.
                    </p>
                  </div>

                  <AgyliEmblem size={44} className="flex-shrink-0 shadow-sm" />
                </div>

                {/* Ações principais do sistema AGYLI */}
                <div className="mt-4 pt-4 border-t border-blue-100/70 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    asChild
                    className="text-xs font-semibold bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white shadow-sm"
                  >
                    <Link to="/admin">
                      <span>Gerenciar Todas as Empresas AGYLI</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>

                  {/* Se houver empresa AGYLI cadastrada (ex.: LUIS ou Contek Estética), atalho direto em destaque */}
                  {agyliOrgs.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEnterOrg(agyliOrgs[0])}
                      disabled={enteringOrgId === agyliOrgs[0].id}
                      className="text-xs font-semibold border-blue-300 text-blue-700 bg-white hover:bg-blue-50 shadow-xs"
                    >
                      <LogIn
                        className={`w-3.5 h-3.5 mr-1.5 text-blue-600 ${enteringOrgId === agyliOrgs[0].id ? 'animate-spin' : ''}`}
                      />
                      <span>Ir direto para {agyliOrgs[0].name}</span>
                    </Button>
                  )}

                  <Badge variant="secondary" className="bg-blue-100/70 text-blue-800 text-[11px]">
                    {filteredAgyli.length} {filteredAgyli.length === 1 ? 'empresa' : 'empresas'}
                  </Badge>
                </div>
              </div>

              {/* Lista de Empresas AGYLI cadastradas */}
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                  <span>Empresas na Solução AGYLI</span>
                  <span className="text-[11px] font-normal text-slate-400 font-mono">
                    {filteredAgyli.length} de {agyliOrgs.length}
                  </span>
                </h2>

                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <div className="w-5 h-5 border-2 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando empresas...
                  </div>
                ) : filteredAgyli.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhuma empresa AGYLI encontrada {searchTerm ? 'com este filtro' : ''}.
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {filteredAgyli.map((org) => {
                      const isCurrent = currentActiveOrg?.id === org.id
                      const isEntering = enteringOrgId === org.id

                      return (
                        <div
                          key={org.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-blue-50/60 border-blue-200 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900 truncate">
                                {org.name}
                              </span>
                              {org.slug === 'contek-demo' && (
                                <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0">
                                  DEMO
                                </Badge>
                              )}
                              {isCurrent && (
                                <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0 font-medium">
                                  Painel Ativo
                                </Badge>
                              )}
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  org.status === 'active'
                                    ? 'bg-emerald-500'
                                    : org.status === 'trial'
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                }`}
                                title={`Status: ${org.status}`}
                              />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="font-mono text-slate-400">/{org.slug}</span>
                              <span>•</span>
                              <span>{org.counts.clients} clientes</span>
                              <span>•</span>
                              <span>{org.counts.appointments} agend.</span>
                            </div>
                          </div>

                          {/* Botões de Ação para cada empresa */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                            {/* Link Público de agendamento em nova aba */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`/agendar/${org.slug}`, '_blank')}
                                  className="h-8 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Abrir página pública de agendamento</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  /agendar/{org.slug}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            {/* Entrar no painel da empresa */}
                            <Button
                              size="sm"
                              onClick={() => handleEnterOrg(org)}
                              disabled={isEntering}
                              className={`h-8 px-2.5 text-xs font-semibold shadow-xs ${
                                isCurrent
                                  ? 'bg-blue-700 hover:bg-blue-800 text-white'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                              }`}
                            >
                              <LogIn
                                className={`w-3.5 h-3.5 mr-1 ${isEntering ? 'animate-spin' : ''}`}
                              />
                              <span>{isCurrent ? 'Abrir Painel' : 'Entrar'}</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ============================================================== */}
            {/* CARD DO SISTEMA MARKALY */}
            {/* ============================================================== */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              {/* Header do Card com Branding Oficial MARKALY */}
              <div className="p-5 sm:p-6 border-b border-orange-50 bg-gradient-to-br from-[#FEF3E2]/60 via-pink-50/20 to-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF3E2] text-[#3B0764] border border-orange-200 text-[11px] font-semibold">
                      <Sparkles className="w-3 h-3 text-[#F97316]" />
                      <span>Solução Essencial & Ágil</span>
                    </div>

                    <div className="pt-1">
                      <MarkalyLogo
                        height={34}
                        theme="light"
                        showSlogan={true}
                        showSignature={false}
                      />
                    </div>

                    <p className="text-xs text-slate-600 max-w-md pt-1">
                      Gestão essencial focada em agendamentos ágeis, clientes e serviços, com fluxo
                      simplificado e máxima praticidade.
                    </p>
                  </div>

                  <MarkalyEmblem size={44} className="flex-shrink-0 shadow-sm" />
                </div>

                {/* Ações principais do sistema MARKALY */}
                <div className="mt-4 pt-4 border-t border-orange-100/70 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    asChild
                    className="text-xs font-semibold bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 text-white shadow-sm"
                  >
                    <Link to="/admin">
                      <span>Gerenciar Empresas MARKALY</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Link>
                  </Button>

                  <Badge
                    variant="secondary"
                    className="bg-orange-100/70 text-orange-900 text-[11px]"
                  >
                    {filteredMarkaly.length} {filteredMarkaly.length === 1 ? 'empresa' : 'empresas'}
                  </Badge>
                </div>
              </div>

              {/* Lista de Empresas MARKALY cadastradas (ex: La Bela, Lulu) */}
              <div className="p-5 flex-1 flex flex-col">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
                  <span>Empresas na Solução MARKALY</span>
                  <span className="text-[11px] font-normal text-slate-400 font-mono">
                    {filteredMarkaly.length} de {markalyOrgs.length}
                  </span>
                </h2>

                {loading ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <div className="w-5 h-5 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando empresas...
                  </div>
                ) : filteredMarkaly.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Nenhuma empresa MARKALY encontrada {searchTerm ? 'com este filtro' : ''}.
                  </div>
                ) : (
                  <div className="space-y-2.5 flex-1">
                    {filteredMarkaly.map((org) => {
                      const isCurrent = currentActiveOrg?.id === org.id
                      const isEntering = enteringOrgId === org.id

                      return (
                        <div
                          key={org.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isCurrent
                              ? 'bg-orange-50/60 border-orange-200 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-orange-200 hover:bg-orange-50/20'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-xs text-slate-900 truncate">
                                {org.name}
                              </span>
                              {org.slug === 'contek-demo' && (
                                <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0">
                                  DEMO
                                </Badge>
                              )}
                              {isCurrent && (
                                <Badge className="bg-[#3B0764] text-white text-[9px] px-1.5 py-0 font-medium">
                                  Painel Ativo
                                </Badge>
                              )}
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  org.status === 'active'
                                    ? 'bg-emerald-500'
                                    : org.status === 'trial'
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                }`}
                                title={`Status: ${org.status}`}
                              />
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                              <span className="font-mono text-slate-400">/{org.slug}</span>
                              <span>•</span>
                              <span>{org.counts.clients} clientes</span>
                              <span>•</span>
                              <span>{org.counts.appointments} agend.</span>
                            </div>
                          </div>

                          {/* Botões de Ação para cada empresa MARKALY */}
                          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                            {/* Link Público de agendamento em nova aba */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(`/agendar/${org.slug}`, '_blank')}
                                  className="h-8 px-2 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">Abrir página pública de agendamento</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  /agendar/{org.slug}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            {/* Entrar no painel da empresa via switchOrganization oficial */}
                            <Button
                              size="sm"
                              onClick={() => handleEnterOrg(org)}
                              disabled={isEntering}
                              className={`h-8 px-2.5 text-xs font-semibold shadow-xs ${
                                isCurrent
                                  ? 'bg-[#3B0764] hover:bg-[#4C0D80] text-white'
                                  : 'bg-gradient-to-r from-[#F97316] to-[#EC4899] hover:opacity-95 text-white'
                              }`}
                            >
                              <LogIn
                                className={`w-3.5 h-3.5 mr-1 ${isEntering ? 'animate-spin' : ''}`}
                              />
                              <span>{isCurrent ? 'Abrir Painel' : 'Entrar'}</span>
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ATALHOS RÁPIDOS & RODAPÉ CONTEK */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-slate-900">Precisa cadastrar ou editar uma empresa?</p>
                <p className="text-slate-500">
                  Acesse o painel SuperAdmin avançado para criar novas clínicas, alterar planos ou
                  status.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="w-full sm:w-auto text-xs font-semibold border-purple-200 text-purple-700 hover:bg-purple-50"
            >
              <Link to="/admin">
                <span>Acessar Painel SuperAdmin (/admin)</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </main>

        {/* FOOTER OFICIAL CONTEK */}
        <footer className="bg-white border-t border-slate-200 py-4 px-4 sm:px-6 text-center text-xs text-slate-500 mt-auto">
          <p className="font-medium text-slate-700">Central Contek de Gestão Multi-Sistemas</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Uma solução{' '}
            <span className="text-slate-800 font-semibold">Contek Tecnologia e Consultoria</span>.
            Todos os direitos reservados.
          </p>
        </footer>
      </div>
    </TooltipProvider>
  )
}

export default CentralContek
