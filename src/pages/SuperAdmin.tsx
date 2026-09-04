import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  ShieldAlert,
  Building,
  Users,
  Calendar,
  Sparkles,
  Layers,
  Search,
  ExternalLink,
  Edit,
  Power,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { ProductType } from '@/types'

interface SuperAdminOrgItem {
  id: string
  name: string
  slug: string
  email?: string
  phone?: string
  product: ProductType
  status: 'active' | 'trial' | 'suspended'
  created: string
  updated: string
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
    starts_at?: string
    trial_ends_at?: string
    notes?: string
  } | null
}

interface SuperAdminOverviewResponse {
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
  plans: Array<{
    id: string
    name: string
    slug: string
    product: ProductType
    price: number
    trial_days?: number
    max_professionals?: number
  }>
  organizations: SuperAdminOrgItem[]
}

export const SuperAdmin: React.FC = () => {
  const { user, isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SuperAdminOverviewResponse | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [productFilter, setProductFilter] = useState<'all' | 'agyli' | 'markaly'>('all')

  // Modal de edição de organização
  const [editingOrg, setEditingOrg] = useState<SuperAdminOrgItem | null>(null)
  const [editProduct, setEditProduct] = useState<ProductType>('agyli')
  const [editStatus, setEditStatus] = useState<'active' | 'trial' | 'suspended'>('active')
  const [editPlanId, setEditPlanId] = useState<string>('')
  const [editSubStatus, setEditSubStatus] = useState<'trial' | 'active' | 'overdue' | 'canceled'>(
    'active',
  )
  const [editNotes, setEditNotes] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pb.send<SuperAdminOverviewResponse>('/backend/v1/superadmin/overview', {
        method: 'GET',
      })
      setData(res)
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao carregar dados do SuperAdmin. Verifique permissões.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      loadOverview()
    }
  }, [isSuperAdmin, loadOverview])

  const handleOpenEdit = (org: SuperAdminOrgItem) => {
    setEditingOrg(org)
    setEditProduct(org.product)
    setEditStatus(org.status)
    setEditPlanId(org.subscription?.plan_id || (data?.plans?.[0]?.id ?? ''))
    setEditSubStatus(org.subscription?.status || (org.status === 'trial' ? 'trial' : 'active'))
    setEditNotes(org.subscription?.notes || '')
  }

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrg) return

    setSavingEdit(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/org/update',
        {
          method: 'POST',
          body: {
            organization_id: editingOrg.id,
            product: editProduct,
            status: editStatus,
            plan_id: editPlanId,
            subscription_status: editSubStatus,
            notes: editNotes,
          },
        },
      )

      if (res.success) {
        toast.success(res.message || 'Organização atualizada com sucesso!')
        setEditingOrg(null)
        await loadOverview()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao atualizar organização pelo SuperAdmin.')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleToggleStatus = async (org: SuperAdminOrgItem) => {
    const newStatus = org.status === 'suspended' ? 'active' : 'suspended'
    const confirmMsg =
      newStatus === 'suspended'
        ? `Deseja suspender o acesso da empresa "${org.name}"?`
        : `Deseja reativar o acesso da empresa "${org.name}"?`

    if (!window.confirm(confirmMsg)) return

    try {
      await pb.send('/backend/v1/superadmin/org/update', {
        method: 'POST',
        body: {
          organization_id: org.id,
          status: newStatus,
          subscription_status: newStatus === 'suspended' ? 'canceled' : 'active',
        },
      })
      toast.success(`Status da empresa atualizado para: ${newStatus}`)
      await loadOverview()
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao alterar status da organização.')
    }
  }

  // Filtragem de organizações
  const filteredOrgs = (data?.organizations || []).filter((org) => {
    const matchesProduct = productFilter === 'all' || org.product === productFilter
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      org.name.toLowerCase().includes(term) ||
      org.slug.toLowerCase().includes(term) ||
      (org.email && org.email.toLowerCase().includes(term))
    return matchesProduct && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* HEADER SUPERADMIN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-[11px]">
              CONTEK ROOT ADMIN
            </Badge>
            <span className="text-xs text-slate-400">Multi-Produto AGYLI / MARKALY</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Painel SuperAdmin Contek</h1>
          <p className="text-xs text-slate-400 max-w-xl mt-1">
            Gestão centralizada de todas as organizações da base única, controle de produtos,
            planos, assinaturas e status operacional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs"
          >
            <Link to="/">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Voltar ao App
            </Link>
          </Button>

          <Button
            size="sm"
            onClick={loadOverview}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md"
          >
            <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium text-slate-500">
              Total de Empresas
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900 flex items-center justify-between">
              <span>{data?.summary.total_organizations || 0}</span>
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Building className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-slate-500">
            {data?.summary.status_breakdown.active || 0} ativas •{' '}
            {data?.summary.status_breakdown.trial || 0} trials
          </CardContent>
        </Card>

        <Card className="border-emerald-200 shadow-sm bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-emerald-800">
              Produto AGYLI (Completo)
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-950 flex items-center justify-between">
              <span>{data?.summary.total_agyli || 0}</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Sparkles className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-emerald-700">
            Com Financeiro + IA + WhatsApp
          </CardContent>
        </Card>

        <Card className="border-sky-200 shadow-sm bg-sky-50/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-sky-800">
              Produto MARKALY (Reduzido)
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-sky-950 flex items-center justify-between">
              <span>{data?.summary.total_markaly || 0}</span>
              <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
                <Layers className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-sky-700">
            Foco ágil em agendamento essencial
          </CardContent>
        </Card>

        <Card className="border-amber-200 shadow-sm bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-amber-800">
              Assinaturas em Trial
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-950 flex items-center justify-between">
              <span>{data?.summary.status_breakdown.trial || 0}</span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <Calendar className="w-4 h-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-amber-700">
            Período de testes gratuitos em andamento
          </CardContent>
        </Card>
      </div>

      {/* FILTER & LIST TABLE */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">
                Organizações Cadastradas
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Gerencie produto, plano e status operacional de cada tenant.
              </CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar empresa ou slug..."
                  className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
                />
              </div>

              <Select
                value={productFilter}
                onValueChange={(val: 'all' | 'agyli' | 'markaly') => setProductFilter(val)}
              >
                <SelectTrigger className="w-full sm:w-40 text-xs h-9">
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Produtos</SelectItem>
                  <SelectItem value="agyli">Apenas AGYLI</SelectItem>
                  <SelectItem value="markaly">Apenas MARKALY</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Empresa / Slug
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Produto</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">
                  Plano / Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-center">
                  Métricas (Clientes/Agend.)
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">Criada em</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Carregando organizações...
                  </TableCell>
                </TableRow>
              ) : filteredOrgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-xs text-slate-500">
                    Nenhuma organização encontrada com os filtros informados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrgs.map((org) => (
                  <TableRow key={org.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="py-3">
                      <div>
                        <div className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                          {org.name}
                          {org.slug === 'contek-demo' && (
                            <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0">
                              DEMO
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-400">/{org.slug}</span>
                          {org.email && <span>• {org.email}</span>}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <Badge
                        className={
                          org.product === 'markaly'
                            ? 'bg-sky-100 text-sky-800 hover:bg-sky-200 border-sky-300 font-semibold text-[11px]'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 font-semibold text-[11px]'
                        }
                      >
                        {org.product === 'markaly' ? 'MARKALY' : 'AGYLI'}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-800">
                          {org.subscription?.plan_name || 'Plano Padrão'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              org.status === 'active'
                                ? 'bg-emerald-500'
                                : org.status === 'trial'
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                            }`}
                          />
                          <span className="text-[11px] uppercase font-mono text-slate-600">
                            {org.status}
                          </span>
                          {org.subscription?.status && (
                            <span className="text-[10px] text-slate-400">
                              ({org.subscription.status})
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-center">
                      <div className="inline-flex items-center gap-2 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                        <span title="Total de Clientes">
                          👥 <b>{org.counts.clients}</b>
                        </span>
                        <span>•</span>
                        <span title="Total de Agendamentos">
                          📅 <b>{org.counts.appointments}</b>
                        </span>
                        <span>•</span>
                        <span title="Profissionais">
                          🩺 <b>{org.counts.professionals}</b>
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-xs text-slate-500 font-mono">
                      {new Date(org.created).toLocaleDateString('pt-BR')}
                    </TableCell>

                    <TableCell className="py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/agendar/${org.slug}`, '_blank')}
                          title="Abrir página pública de agendamento"
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(org)}
                          title="Editar produto, plano ou status"
                          className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(org)}
                          title={
                            org.status === 'suspended' ? 'Reativar Empresa' : 'Suspender Empresa'
                          }
                          className={`h-8 w-8 p-0 ${
                            org.status === 'suspended'
                              ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                              : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG DE EDIÇÃO DA ORGANIZAÇÃO */}
      <Dialog open={Boolean(editingOrg)} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Editar Empresa & Plano
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modificando configurações estruturais de <b>{editingOrg?.name}</b> (/
              {editingOrg?.slug}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveOrg} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Produto do Sistema (Multi-Produto)
              </Label>
              <Select value={editProduct} onValueChange={(val: ProductType) => setEditProduct(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agyli">AGYLI (Versão Completa - Todos os Módulos)</SelectItem>
                  <SelectItem value="markaly">
                    MARKALY (Versão Essencial - Sem Financeiro/IA)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500">
                Ao selecionar MARKALY, o backend e o menu bloqueiam imediatamente Financeiro e IA.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status da Empresa</Label>
                <Select
                  value={editStatus}
                  onValueChange={(val: 'active' | 'trial' | 'suspended') => setEditStatus(val)}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active (Ativa)</SelectItem>
                    <SelectItem value="trial">Trial (Período de Teste)</SelectItem>
                    <SelectItem value="suspended">Suspended (Suspensa)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status da Assinatura</Label>
                <Select
                  value={editSubStatus}
                  onValueChange={(val: 'trial' | 'active' | 'overdue' | 'canceled') =>
                    setEditSubStatus(val)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="overdue">Overdue (Atrasada)</SelectItem>
                    <SelectItem value="canceled">Canceled (Cancelada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Plano Vinculado</Label>
              <Select value={editPlanId} onValueChange={(val) => setEditPlanId(val)}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.plans || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.product.toUpperCase()}) - R$ {p.price}/mês
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Observações Administrativas
              </Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Ex: Concedido trial estendido ou cliente fechado via consultoria"
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingOrg(null)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingEdit}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md"
              >
                {savingEdit ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SuperAdmin
