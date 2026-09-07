import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  Edit3,
  Calendar,
  Building2,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  FileText,
  CalendarDays,
  Send,
  Zap,
  Users,
  QrCode,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  ContekCharge,
  ContekSubscriptionItem,
  ContekFinanceOverviewResponse,
  ContekChargeStatus,
  ContekPaymentMethod,
} from '@/types'
import { ContekSymbol } from '@/components/ContekBranding'

export const FinanceiroContek: React.FC = () => {
  const { isSuperAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ContekFinanceOverviewResponse | null>(null)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ContekChargeStatus>('ALL')
  const [monthFilter, setMonthFilter] = useState<string>('ALL')
  const [orgFilter, setOrgFilter] = useState<string>('ALL')

  // Geração de cobranças do mês
  const [generatingMonth, setGeneratingMonth] = useState(false)
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [generateTargetMonth, setGenerateTargetMonth] = useState(() => {
    return new Date().toISOString().slice(0, 7) // YYYY-MM
  })

  // Modal de Visualização do Pix (QR Code + Copia e Cola)
  const [viewingPixCharge, setViewingPixCharge] = useState<ContekCharge | null>(null)
  const [copiedPix, setCopiedPix] = useState(false)
  const [generatingPixId, setGeneratingPixId] = useState<string | null>(null)

  // Auto setup do webhook da Woovi
  const [settingUpWebhook, setSettingUpWebhook] = useState(false)

  // Modal de Marcar como Paga
  const [payingCharge, setPayingCharge] = useState<ContekCharge | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [payMethod, setPayMethod] = useState<ContekPaymentMethod>('PIX')
  const [payDate, setPayDate] = useState<string>('')
  const [payNotes, setPayNotes] = useState<string>('')
  const [submittingPay, setSubmittingPay] = useState(false)

  // Modal de Criar / Editar Cobrança (com valor 100% editável)
  const [editingCharge, setEditingCharge] = useState<ContekCharge | null>(null)
  const [isCreateChargeOpen, setIsCreateChargeOpen] = useState(false)
  const [chargeOrgId, setChargeOrgId] = useState<string>('')
  const [chargeDescription, setChargeDescription] = useState<string>('')
  const [chargeAmount, setChargeAmount] = useState<string>('')
  const [chargeDueDate, setChargeDueDate] = useState<string>('')
  const [chargeStatus, setChargeStatus] = useState<ContekChargeStatus>('PENDENTE')
  const [chargeNotes, setChargeNotes] = useState<string>('')
  const [savingCharge, setSavingCharge] = useState(false)

  // Painel lateral de assinaturas
  const [isSubSheetOpen, setIsSubSheetOpen] = useState(false)
  const [selectedSubForAction, setSelectedSubForAction] = useState<ContekSubscriptionItem | null>(
    null,
  )
  const [subActionType, setSubActionType] = useState<
    'ACTIVATE_MANUAL' | 'EXTEND_TRIAL' | 'CANCEL_SUB' | null
  >(null)
  const [extendDaysInput, setExtendDaysInput] = useState<number>(7)
  const [subActionNotes, setSubActionNotes] = useState<string>('')
  const [submittingSubAction, setSubmittingSubAction] = useState(false)

  // Pix Automático Woovi
  const [enrollingSubId, setEnrollingSubId] = useState<string | null>(null)
  const [viewingPixAutoSub, setViewingPixAutoSub] = useState<ContekSubscriptionItem | null>(null)
  const [copiedPixAutoLink, setCopiedPixAutoLink] = useState(false)

  // Executar sweep manual de vencimentos
  const [runningSweep, setRunningSweep] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await pb.send<ContekFinanceOverviewResponse>(
        '/backend/v1/superadmin/finance/overview',
        { method: 'GET' },
      )
      setData(res)
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao carregar módulo financeiro da Contek.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isSuperAdmin) {
      loadData()
    }
  }, [isSuperAdmin, loadData])

  // Lista única de meses disponíveis para filtro
  const availableMonths = useMemo(() => {
    if (!data?.charges) return []
    const monthsSet = new Set<string>()
    data.charges.forEach((c) => {
      if (c.due_date && c.due_date.length >= 7) {
        monthsSet.add(c.due_date.slice(0, 7))
      }
    })
    // Adicionar mês atual se não existir
    monthsSet.add(new Date().toISOString().slice(0, 7))
    return Array.from(monthsSet).sort().reverse()
  }, [data?.charges])

  // Cobranças filtradas
  const filteredCharges = useMemo(() => {
    if (!data?.charges) return []
    return data.charges.filter((c) => {
      // Filtro status
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false

      // Filtro mês (YYYY-MM do due_date)
      if (monthFilter !== 'ALL') {
        const cMonth = (c.due_date || '').slice(0, 7)
        if (cMonth !== monthFilter) return false
      }

      // Filtro organização
      if (orgFilter !== 'ALL' && c.organization_id !== orgFilter) return false

      // Busca por nome ou slug
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        const orgName = (c.organization_name || '').toLowerCase()
        const desc = (c.description || '').toLowerCase()
        const plan = (c.plan_name || '').toLowerCase()
        if (!orgName.includes(term) && !desc.includes(term) && !plan.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [data?.charges, statusFilter, monthFilter, orgFilter, searchTerm])

  // Abrir modal de Nova Cobrança Avulsa
  const handleOpenCreateCharge = () => {
    const defaultOrg = data?.organizations?.[0]?.id || ''
    setChargeOrgId(defaultOrg)

    // Achar plano e valor da primeira org para pré-preencher
    const matchedSub = data?.subscriptions?.find((s) => s.organization_id === defaultOrg)
    setChargeAmount(matchedSub ? String(matchedSub.plan_price) : '29.90')
    setChargeDescription(
      matchedSub ? `Mensalidade ${matchedSub.plan_name}` : 'Cobrança Mensalidade Contek',
    )

    // Data de vencimento padrão: 10 dias a frente
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    setChargeDueDate(in10Days)
    setChargeStatus('PENDENTE')
    setChargeNotes('')
    setEditingCharge(null)
    setIsCreateChargeOpen(true)
  }

  // Quando o usuário seleciona uma empresa na criação manual, atualiza sugestão de valor (mas deixa editável)
  const handleOrgChangeOnCreate = (newOrgId: string) => {
    setChargeOrgId(newOrgId)
    const matchedSub = data?.subscriptions?.find((s) => s.organization_id === newOrgId)
    if (matchedSub) {
      setChargeAmount(String(matchedSub.plan_price))
      setChargeDescription(`Mensalidade ${matchedSub.plan_name}`)
    }
  }

  // Abrir modal de Edição de Cobrança (valor editável!)
  const handleOpenEditCharge = (charge: ContekCharge) => {
    setEditingCharge(charge)
    setChargeOrgId(charge.organization_id)
    setChargeAmount(String(charge.amount))
    setChargeDescription(charge.description || '')
    setChargeDueDate(charge.due_date ? charge.due_date.slice(0, 10) : '')
    setChargeStatus(charge.status)
    setChargeNotes(charge.notes || '')
    setIsCreateChargeOpen(true)
  }

  // Salvar criação / edição da cobrança (com valor livre)
  const handleSaveCharge = async (e: React.FormEvent) => {
    e.preventDefault()
    const numericAmount = parseFloat(chargeAmount.replace(',', '.'))
    if (isNaN(numericAmount) || numericAmount < 0) {
      toast.error('Informe um valor válido em reais (R$).')
      return
    }
    if (!chargeDueDate) {
      toast.error('Informe a data de vencimento.')
      return
    }

    setSavingCharge(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/finance/charge/save',
        {
          method: 'POST',
          body: {
            id: editingCharge ? editingCharge.id : undefined,
            organization_id: chargeOrgId,
            description: chargeDescription.trim(),
            amount: numericAmount,
            due_date: chargeDueDate,
            status: chargeStatus,
            notes: chargeNotes.trim(),
          },
        },
      )
      if (res.success) {
        toast.success(res.message || 'Cobrança salva com sucesso!')
        setIsCreateChargeOpen(false)
        setEditingCharge(null)
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar cobrança.')
    } finally {
      setSavingCharge(false)
    }
  }

  // Abrir modal de Marcar como Paga
  const handleOpenPayModal = (charge: ContekCharge) => {
    setPayingCharge(charge)
    setPayAmount(String(charge.amount))
    setPayMethod('PIX')
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayNotes('')
  }

  // Confirmar pagamento
  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payingCharge) return

    const numericAmount = parseFloat(payAmount.replace(',', '.'))
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.error('Informe um valor recebido válido.')
      return
    }

    setSubmittingPay(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/finance/charge/pay',
        {
          method: 'POST',
          body: {
            id: payingCharge.id,
            amount: numericAmount,
            payment_method: payMethod,
            paid_at: payDate,
            notes: payNotes.trim(),
          },
        },
      )
      if (res.success) {
        toast.success(res.message || 'Pagamento registrado com sucesso!')
        setPayingCharge(null)
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao registrar pagamento.')
    } finally {
      setSubmittingPay(false)
    }
  }

  // Cancelar cobrança
  const handleCancelCharge = async (charge: ContekCharge) => {
    const reason = window.prompt(
      `Confirma o cancelamento da cobrança de R$ ${charge.amount.toFixed(2)} para ${charge.organization_name}? Informe o motivo (opcional):`,
      'Acordo comercial / estorno',
    )
    if (reason === null) return // Clicou em cancelar

    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/finance/charge/cancel',
        {
          method: 'POST',
          body: {
            id: charge.id,
            reason: reason.trim(),
          },
        },
      )
      if (res.success) {
        toast.success(res.message || 'Cobrança cancelada.')
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao cancelar cobrança.')
    }
  }

  // Gerar cobranças do mês
  const handleGenerateMonthCharges = async () => {
    setGeneratingMonth(true)
    try {
      const res = await pb.send<{
        success: boolean
        message?: string
        created_count: number
        skipped_count: number
      }>('/backend/v1/superadmin/finance/generate-month', {
        method: 'POST',
        body: { target_month: generateTargetMonth },
      })
      if (res.success) {
        toast.success(res.message || 'Cobranças do mês geradas com sucesso!')
        setIsGenerateModalOpen(false)
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao gerar cobranças do mês.')
    } finally {
      setGeneratingMonth(false)
    }
  }

  // Executar sweep manual da automação diária
  const handleRunSweep = async () => {
    setRunningSweep(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/finance/run-check',
        { method: 'POST' },
      )
      if (res.success) {
        toast.success(res.message || 'Verificação diária concluída!')
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao rodar verificação financeira.')
    } finally {
      setRunningSweep(false)
    }
  }

  // Ações de Assinatura (painel lateral)
  const handleOpenSubAction = (
    sub: ContekSubscriptionItem,
    type: 'ACTIVATE_MANUAL' | 'EXTEND_TRIAL' | 'CANCEL_SUB',
  ) => {
    setSelectedSubForAction(sub)
    setSubActionType(type)
    setExtendDaysInput(7)
    setSubActionNotes('')
  }

  const handleConfirmSubAction = async () => {
    if (!selectedSubForAction || !subActionType) return
    setSubmittingSubAction(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string }>(
        '/backend/v1/superadmin/finance/subscription/action',
        {
          method: 'POST',
          body: {
            subscription_id: selectedSubForAction.id,
            action: subActionType,
            extend_days: extendDaysInput,
            notes: subActionNotes.trim(),
          },
        },
      )
      if (res.success) {
        toast.success(res.message || 'Ação executada com sucesso!')
        setSelectedSubForAction(null)
        setSubActionType(null)
        await loadData()
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao atualizar assinatura.')
    } finally {
      setSubmittingSubAction(false)
    }
  }

  // Gerar Pix avulso por cobrança
  const handleGeneratePixForCharge = async (charge: ContekCharge) => {
    setGeneratingPixId(charge.id)
    try {
      const res = await pb.send<{
        success: boolean
        message?: string
        error?: string
        charge?: {
          id: string
          pix_brcode?: string
          pix_qrcode_image?: string
        }
      }>('/backend/v1/superadmin/finance/charge/pix', {
        method: 'POST',
        body: { id: charge.id },
      })

      if (res.success) {
        toast.success(res.message || 'Código Pix gerado com sucesso!')
        await loadData()
        // Abrir automaticamente o modal do Pix gerado
        if (res.charge?.pix_brcode) {
          setViewingPixCharge({
            ...charge,
            pix_brcode: res.charge.pix_brcode,
            pix_qrcode_image: res.charge.pix_qrcode_image,
          })
        }
      } else {
        toast.error(
          res.error ||
            'Não foi possível gerar o Pix agora. A cobrança continua disponível em modo manual.',
        )
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error(
        'Não foi possível gerar o Pix agora — a cobrança segue em modo manual. Verifique a chave da Woovi caso necessário.',
      )
    } finally {
      setGeneratingPixId(null)
    }
  }

  // Copiar código Pix Copia e Cola
  const handleCopyPixCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedPix(true)
    toast.success('Código Pix copiado!')
    setTimeout(() => setCopiedPix(false), 2500)
  }

  // Ativar / Inscrever empresa no Pix Automático da Woovi
  const handleEnrollPixAutomatic = async (
    sub: ContekSubscriptionItem,
    journey: 'ONLY_RECURRENCY' | 'PAYMENT_ON_APPROVAL' = 'ONLY_RECURRENCY',
  ) => {
    setEnrollingSubId(sub.id)
    try {
      const res = await pb.send<{
        success: boolean
        message?: string
        error?: string
        subscription?: Partial<ContekSubscriptionItem>
      }>('/backend/v1/superadmin/finance/subscription/enroll-pix-automatic', {
        method: 'POST',
        body: {
          subscription_id: sub.id,
          journey,
        },
      })

      if (res.success) {
        toast.success(res.message || 'Pix Automático gerado com sucesso!')
        await loadData()

        const updatedSub: ContekSubscriptionItem = {
          ...sub,
          recurring_status: 'PENDING_AUTHORIZATION',
          recurring_journey: journey,
          recurring_link: res.subscription?.recurring_link || sub.recurring_link,
          recurring_emv: res.subscription?.recurring_emv || sub.recurring_emv,
          recurring_correlation_id:
            res.subscription?.recurring_correlation_id || sub.recurring_correlation_id,
        }
        setViewingPixAutoSub(updatedSub)
      } else {
        toast.error(res.error || 'Não foi possível gerar a autorização do Pix Automático.')
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao conectar com a Woovi para o Pix Automático.')
    } finally {
      setEnrollingSubId(null)
    }
  }

  // Copiar link de autorização do Pix Automático
  const handleCopyPixAutoLink = (link: string) => {
    navigator.clipboard.writeText(link)
    setCopiedPixAutoLink(true)
    toast.success('Link de autorização copiado!')
    setTimeout(() => setCopiedPixAutoLink(false), 2500)
  }

  // Conectar webhook da Woovi automaticamente
  const handleSetupWebhook = async () => {
    setSettingUpWebhook(true)
    try {
      const res = await pb.send<{ success: boolean; message?: string; error?: string }>(
        '/backend/v1/superadmin/finance/woovi/setup-webhook',
        { method: 'POST' },
      )
      if (res.success) {
        toast.success(res.message || 'Webhook configurado na Woovi com sucesso!')
      } else {
        toast.error(res.error || 'Falha ao configurar webhook na Woovi.')
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao conectar webhook da Woovi.')
    } finally {
      setSettingUpWebhook(false)
    }
  }

  // Formatação de valores e datas
  const formatMoney = (val?: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('pt-BR')
  }

  // Cálculo de dias restantes para o término do trial
  const getTrialDaysRemaining = (trialEndsAt?: string) => {
    if (!trialEndsAt) return null
    const end = new Date(trialEndsAt).getTime()
    const now = Date.now()
    const diffMs = end - now
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
    return diffDays
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6 font-['Poppins',sans-serif]">
        {/* HEADER EXECUTIVO CONTEK FINANCEIRO */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0D1B2A] text-white p-6 rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1 shadow-sm">
                <ContekSymbol size={20} glow />
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono text-[11px]">
                CONTEK FINANCEIRO
              </Badge>
              <span className="text-xs text-slate-300">
                Cobrança de Mensalidades AGYLI & MARKALY
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Financeiro Contek — Mensalidades</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              Gestão de cobranças, controle de vigência mensal, geração automatizada e
              acompanhamento de empresas ativas, períodos de teste (trials) e inadimplência.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetupWebhook}
                  disabled={settingUpWebhook}
                  className="border-emerald-600/40 text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 text-xs font-semibold"
                >
                  <Sparkles
                    className={`w-3.5 h-3.5 mr-1.5 text-emerald-400 ${settingUpWebhook ? 'animate-spin' : ''}`}
                  />
                  {settingUpWebhook ? 'Conectando...' : 'Conectar Webhook Woovi'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Registra automaticamente o endpoint de confirmação na Woovi para baixa automática
                  quando o Pix cair.
                </p>
              </TooltipContent>
            </Tooltip>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSubSheetOpen(true)}
              className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold bg-slate-900/60"
            >
              <Users className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Painel de Assinaturas
            </Button>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRunSweep}
                  disabled={runningSweep}
                  className="border-amber-500/40 text-amber-200 bg-amber-950/30 hover:bg-amber-900/40 text-xs font-semibold"
                >
                  <Zap
                    className={`w-3.5 h-3.5 mr-1.5 text-amber-400 ${runningSweep ? 'animate-spin' : ''}`}
                  />
                  Rodar Verificação
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Verifica trials vencidos, marca cobranças atrasadas e suspende inadimplentes 15d+
                </p>
              </TooltipContent>
            </Tooltip>

            <Button
              size="sm"
              onClick={handleOpenCreateCharge}
              className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Nova Cobrança
            </Button>

            <Button
              size="sm"
              onClick={() => setIsGenerateModalOpen(true)}
              className="bg-gradient-to-r from-[#1E3A8A] to-[#06B6D4] hover:from-[#1E3A8A]/90 hover:to-[#06B6D4]/90 text-white text-xs font-semibold shadow-md shadow-cyan-500/20"
            >
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
              Gerar cobranças do mês
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="text-slate-300 hover:text-white hover:bg-slate-800 h-9 w-9 p-0"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* CARTÕES DE RESUMO (MÉTRICAS CONTEK) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Receita mensal esperada */}
          <Card className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500 flex items-center justify-between">
                <span>Receita Mensal Esperada</span>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                  {data?.summary.subscriptions_active || 0} ativas
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-[#0D1B2A] flex items-center justify-between pt-1">
                <span>{formatMoney(data?.summary.expected_monthly_revenue)}</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-xs">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] text-slate-500">
              Soma das mensalidades vigentes das empresas ativas
            </CardContent>
          </Card>

          {/* Recebido no mês */}
          <Card className="border-emerald-200 shadow-sm bg-emerald-50/40 hover:border-emerald-300 transition-all">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-emerald-800 flex items-center justify-between">
                <span>Recebido no Mês</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                  PAGO
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-950 flex items-center justify-between pt-1">
                <span>{formatMoney(data?.summary.received_this_month)}</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <DollarSign className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] text-emerald-700">
              Total de mensalidades quitadas com sucesso
            </CardContent>
          </Card>

          {/* Em atraso */}
          <Card className="border-rose-200 shadow-sm bg-rose-50/40 hover:border-rose-300 transition-all">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-rose-800 flex items-center justify-between">
                <span>Em Atraso (Inadimplência)</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-mono">
                  ATRASADA
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-rose-950 flex items-center justify-between pt-1">
                <span>{formatMoney(data?.summary.overdue_amount)}</span>
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shadow-xs">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] text-rose-700">
              Cobranças com vencimento ultrapassado e não pagas
            </CardContent>
          </Card>

          {/* Assinaturas Ativas e Trials */}
          <Card className="border-cyan-200 shadow-sm bg-cyan-50/40 hover:border-cyan-300 transition-all">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs font-semibold text-[#0D1B2A] flex items-center justify-between">
                <span>Base de Assinaturas</span>
                <span className="text-[10px] bg-cyan-100 text-[#0D1B2A] px-1.5 py-0.5 rounded font-mono">
                  CONTEK
                </span>
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-[#0D1B2A] flex items-center justify-between pt-1">
                <span>
                  {data?.summary.subscriptions_active || 0}{' '}
                  <span className="text-sm font-normal text-slate-500">ativas</span>
                </span>
                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-[11px] text-slate-600 flex items-center justify-between">
              <span>{data?.summary.subscriptions_trial || 0} em período de teste (trial)</span>
              {Boolean(data?.summary.subscriptions_overdue) && (
                <span className="font-semibold text-rose-600">
                  {data?.summary.subscriptions_overdue} em atraso
                </span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ALERTA VISUAL DE TRIALS TERMINANDO EM ATÉ 3 DIAS */}
        {(() => {
          const urgentTrials = (data?.subscriptions || []).filter((s) => {
            if (s.status !== 'trial' || !s.trial_ends_at) return false
            const days = getTrialDaysRemaining(s.trial_ends_at)
            return days !== null && days <= 3 && days >= 0
          })

          if (urgentTrials.length === 0) return null

          return (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center shrink-0 font-bold">
                  ⚠️
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                    Atenção: {urgentTrials.length} empresa(s) com Trial vencendo em até 3 dias!
                  </h4>
                  <div className="text-xs text-amber-800 flex flex-wrap gap-2 mt-0.5">
                    {urgentTrials.map((ut) => {
                      const days = getTrialDaysRemaining(ut.trial_ends_at)
                      return (
                        <span
                          key={ut.id}
                          className="inline-flex items-center gap-1 font-semibold bg-white/70 px-2 py-0.5 rounded border border-amber-200"
                        >
                          <span>{ut.organization_name}</span>
                          <span className="text-amber-700 text-[11px]">
                            ({days === 0 ? 'Vence HOJE!' : `vence em ${days} dia(s)`} •{' '}
                            {formatDate(ut.trial_ends_at)})
                          </span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsSubSheetOpen(true)}
                className="shrink-0 border-amber-400 text-amber-950 bg-amber-100 hover:bg-amber-200 text-xs font-semibold"
              >
                Abrir Painel e Estender / Ativar
              </Button>
            </div>
          )
        })()}

        {/* TABELA DE COBRANÇAS COM FILTROS */}
        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-[#0D1B2A] flex items-center gap-2">
                  <span>Tabela de Cobranças de Mensalidades</span>
                  <Badge variant="outline" className="text-xs font-mono text-slate-500">
                    {filteredCharges.length} registros
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Valores editáveis, liquidação de pagamentos e histórico integrado à assinatura da
                  empresa.
                </CardDescription>
              </div>

              {/* Filtros em linha */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Busca */}
                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar empresa, plano..."
                    className="pl-8 text-xs h-9 bg-slate-50 border-slate-200"
                  />
                </div>

                {/* Filtro Status */}
                <Select
                  value={statusFilter}
                  onValueChange={(val: 'ALL' | ContekChargeStatus) => setStatusFilter(val)}
                >
                  <SelectTrigger className="w-36 text-xs h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os Status</SelectItem>
                    <SelectItem value="PENDENTE">🟡 PENDENTE</SelectItem>
                    <SelectItem value="PAGA">🟢 PAGA</SelectItem>
                    <SelectItem value="ATRASADA">🔴 ATRASADA</SelectItem>
                    <SelectItem value="CANCELADA">⚪ CANCELADA</SelectItem>
                  </SelectContent>
                </Select>

                {/* Filtro Mês */}
                <Select value={monthFilter} onValueChange={(val) => setMonthFilter(val)}>
                  <SelectTrigger className="w-36 text-xs h-9">
                    <SelectValue placeholder="Mês Vencimento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os Meses</SelectItem>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Filtro Empresa */}
                <Select value={orgFilter} onValueChange={(val) => setOrgFilter(val)}>
                  <SelectTrigger className="w-40 text-xs h-9">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as Empresas</SelectItem>
                    {(data?.organizations || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Resetar filtros */}
                {(statusFilter !== 'ALL' ||
                  monthFilter !== 'ALL' ||
                  orgFilter !== 'ALL' ||
                  searchTerm) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('ALL')
                      setMonthFilter('ALL')
                      setOrgFilter('ALL')
                      setSearchTerm('')
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 h-9"
                  >
                    Limpar
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Empresa / Produto
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">
                    Descrição / Plano
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Valor (R$)</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Vencimento</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600">Pagamento</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-600 text-right">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-slate-500">
                      <div className="w-6 h-6 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Carregando cobranças Contek...
                    </TableCell>
                  </TableRow>
                ) : filteredCharges.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-xs text-slate-500">
                      <p className="font-semibold text-slate-700">Nenhuma cobrança encontrada.</p>
                      <p className="text-slate-400 mt-1">
                        Clique em <strong>Gerar cobranças do mês</strong> para processar as
                        assinaturas ativas.
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCharges.map((charge) => {
                    const statusColorMap: Record<ContekChargeStatus, string> = {
                      PENDENTE: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
                      PAGA: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
                      ATRASADA: 'bg-rose-100 text-rose-800 border-rose-300 font-semibold',
                      CANCELADA: 'bg-slate-100 text-slate-600 border-slate-200',
                    }

                    return (
                      <TableRow key={charge.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Empresa / Produto */}
                        <TableCell className="py-3">
                          <div>
                            <div className="font-semibold text-sm text-[#0D1B2A] flex items-center gap-1.5">
                              <span>{charge.organization_name || 'Empresa'}</span>
                              {charge.product && (
                                <Badge
                                  className={
                                    charge.product === 'markaly'
                                      ? 'bg-sky-100 text-sky-800 border-sky-300 text-[10px] py-0 px-1.5'
                                      : 'bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-1.5'
                                  }
                                >
                                  {charge.product.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              /{charge.organization_slug || ''}
                            </div>
                          </div>
                        </TableCell>

                        {/* Descrição / Plano */}
                        <TableCell className="py-3">
                          <div className="text-xs text-slate-800 font-medium">
                            {charge.description || charge.plan_name || 'Mensalidade'}
                          </div>
                          {charge.notes && (
                            <div
                              className="text-[10px] text-slate-400 truncate max-w-xs"
                              title={charge.notes}
                            >
                              {charge.notes}
                            </div>
                          )}
                        </TableCell>

                        {/* Valor (R$) - com badge de editável */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-[#0D1B2A]">
                              {formatMoney(charge.amount)}
                            </span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCharge(charge)}
                                  className="text-slate-400 hover:text-cyan-700 p-0.5 rounded"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar valor ou vencimento desta cobrança</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>

                        {/* Vencimento */}
                        <TableCell className="py-3 text-xs font-mono text-slate-700">
                          {formatDate(charge.due_date)}
                        </TableCell>

                        {/* Status com Cores */}
                        <TableCell className="py-3">
                          <Badge className={`text-[11px] ${statusColorMap[charge.status] || ''}`}>
                            {charge.status}
                          </Badge>
                        </TableCell>

                        {/* Pagamento & Pix */}
                        <TableCell className="py-3 text-xs">
                          {charge.status === 'PAGA' ? (
                            <div>
                              <div className="font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{charge.payment_method || 'PIX'}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                em {formatDate(charge.paid_at)}
                              </div>
                            </div>
                          ) : charge.pix_brcode ? (
                            <div className="space-y-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setViewingPixCharge(charge)
                                  setCopiedPix(false)
                                }}
                                className="h-6 px-2 text-[11px] border-cyan-300 text-cyan-800 bg-cyan-50 hover:bg-cyan-100 font-semibold"
                              >
                                <QrCode className="w-3 h-3 mr-1 text-cyan-700" />
                                Ver QR Code Pix
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Modo manual</span>
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {charge.status !== 'PAGA' && charge.status !== 'CANCELADA' && (
                              <>
                                {/* Botão para Gerar ou Ver Pix */}
                                {charge.pix_brcode ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setViewingPixCharge(charge)
                                          setCopiedPix(false)
                                        }}
                                        className="h-7 px-2 text-xs font-semibold border-cyan-400 text-cyan-900 bg-cyan-50 hover:bg-cyan-100"
                                      >
                                        <QrCode className="w-3.5 h-3.5 mr-1 text-cyan-700" />
                                        Pix
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Exibir QR Code e código Pix copia e cola</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={generatingPixId === charge.id}
                                        onClick={() => handleGeneratePixForCharge(charge)}
                                        className="h-7 px-2 text-xs font-semibold border-cyan-300 text-cyan-800 hover:bg-cyan-50"
                                      >
                                        <QrCode
                                          className={`w-3.5 h-3.5 mr-1 text-cyan-600 ${generatingPixId === charge.id ? 'animate-spin' : ''}`}
                                        />
                                        {generatingPixId === charge.id ? 'Gerando...' : 'Gerar Pix'}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        Criar cobrança Pix via API da Woovi com QR Code e Copia e
                                        Cola
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      onClick={() => handleOpenPayModal(charge)}
                                      className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                      Marcar como Paga
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      Registrar pagamento manual e atualizar vigência da assinatura
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenEditCharge(charge)}
                                  className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Editar valor, data ou detalhes</p>
                              </TooltipContent>
                            </Tooltip>

                            {charge.status !== 'CANCELADA' && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCancelCharge(charge)}
                                    className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Cancelar cobrança</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* MODAL: PIX AUTOMÁTICO (LINK & QR CODE DE AUTORIZAÇÃO) */}
        <Dialog
          open={Boolean(viewingPixAutoSub)}
          onOpenChange={(open) => !open && setViewingPixAutoSub(null)}
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-600" />
                Autorização do Pix Automático
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Empresa: <strong>{viewingPixAutoSub?.organization_name}</strong> • Valor mensal:{' '}
                <strong className="text-emerald-700">
                  {formatMoney(viewingPixAutoSub?.plan_price)}/mês
                </strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-600" />
                  Como funciona a ativação:
                </p>
                <p className="text-[11px] text-cyan-800 leading-relaxed">
                  O cliente (ou o administrador da conta bancária da empresa) abre o link ou lê o QR
                  Code apenas <strong>UMA vez</strong> no celular/navegador para autorizar o débito
                  recorrente. A partir da confirmação, as próximas cobranças mensais são debitadas
                  automaticamente.
                </p>
              </div>

              {/* QR Code de Autorização */}
              {viewingPixAutoSub?.recurring_link && (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="w-48 h-48 bg-white border border-slate-300 rounded-lg p-2 flex items-center justify-center shadow-xs">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        viewingPixAutoSub.recurring_link,
                      )}`}
                      alt="QR Code de Autorização Pix Automático"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-2 font-medium">
                    Aponte a câmera para abrir o link de autorização
                  </span>
                </div>
              )}

              {/* Link de Autorização Copiável */}
              {viewingPixAutoSub?.recurring_link && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Link Direto de Autorização</span>
                    {copiedPixAutoLink && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copiado!
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={viewingPixAutoSub.recurring_link}
                      className="text-[11px] font-mono bg-slate-50 border-slate-200 h-9"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCopyPixAutoLink(viewingPixAutoSub.recurring_link || '')}
                      className={`shrink-0 ${
                        copiedPixAutoLink
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-[#0D1B2A] hover:bg-[#1E3A8A] text-white'
                      }`}
                    >
                      {copiedPixAutoLink ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Pix Copia e Cola (caso a Woovi retorne emv do mandato) */}
              {viewingPixAutoSub?.recurring_emv && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Código Pix Copia e Cola do Mandato
                  </Label>
                  <Textarea
                    readOnly
                    value={viewingPixAutoSub.recurring_emv}
                    rows={2}
                    className="text-[10px] font-mono bg-slate-50 border-slate-200 resize-none"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingPixAutoSub(null)}
                className="text-xs"
              >
                Fechar
              </Button>
              {viewingPixAutoSub?.recurring_link && (
                <Button
                  type="button"
                  size="sm"
                  asChild
                  className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  <a
                    href={viewingPixAutoSub.recurring_link}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Abrir Autorização ↗
                  </a>
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: QR CODE E PIX COPIA E COLA */}
        <Dialog
          open={Boolean(viewingPixCharge)}
          onOpenChange={(open) => !open && setViewingPixCharge(null)}
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <QrCode className="w-5 h-5 text-cyan-600" />
                Cobrança Pix — Woovi
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Empresa: <strong>{viewingPixCharge?.organization_name}</strong> • Valor:{' '}
                <strong className="text-emerald-700">
                  {formatMoney(viewingPixCharge?.amount)}
                </strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* QR Code Imagem ou Renderizador */}
              <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                {viewingPixCharge?.pix_qrcode_image ? (
                  <img
                    src={viewingPixCharge.pix_qrcode_image}
                    alt="QR Code Pix"
                    className="w-48 h-48 object-contain rounded-lg border border-slate-300 bg-white p-2 shadow-xs"
                  />
                ) : viewingPixCharge?.pix_brcode ? (
                  // Caso retorne brCode sem a URL da imagem da Woovi, usa gerador padrão do backend
                  <div className="w-48 h-48 bg-white border border-slate-300 rounded-lg p-2 flex items-center justify-center shadow-xs">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                        viewingPixCharge.pix_brcode,
                      )}`}
                      alt="QR Code Pix"
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-400">
                    QR Code não disponível
                  </div>
                )}
                <span className="text-[11px] text-slate-500 mt-2 font-medium">
                  Aponte a câmera do aplicativo do banco para escanear
                </span>
              </div>

              {/* Pix Copia e Cola */}
              {viewingPixCharge?.pix_brcode && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Pix copia e cola</span>
                    {copiedPix && (
                      <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Copiado!
                      </span>
                    )}
                  </Label>
                  <div className="flex gap-2">
                    <Textarea
                      readOnly
                      value={viewingPixCharge.pix_brcode}
                      rows={3}
                      className="text-[11px] font-mono bg-slate-50 border-slate-200 resize-none"
                    />
                    <Button
                      type="button"
                      onClick={() => handleCopyPixCode(viewingPixCharge.pix_brcode || '')}
                      className={`shrink-0 flex flex-col items-center justify-center h-auto px-3 ${
                        copiedPix
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-[#0D1B2A] hover:bg-[#1E3A8A] text-white'
                      }`}
                    >
                      {copiedPix ? (
                        <>
                          <Check className="w-4 h-4 mb-0.5" />
                          <span className="text-[10px] font-bold">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mb-0.5" />
                          <span className="text-[10px] font-bold">Copiar código</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Informações amigáveis de baixa automática */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Baixa Automática Integrada:
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Assim que o cliente realizar o pagamento pelo Pix no banco, o sistema receberá a
                  confirmação automática da Woovi e marcará a cobrança como <strong>
                    Paga
                  </strong>{' '}
                  imediatamente, renovando a vigência da assinatura.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingPixCharge(null)}
                className="text-xs"
              >
                Fechar
              </Button>
              {viewingPixCharge?.pix_brcode && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCopyPixCode(viewingPixCharge.pix_brcode || '')}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  Copiar código
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: GERAR COBRANÇAS DO MÊS */}
        <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-cyan-600" />
                Gerar Cobranças do Mês
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                O sistema percorre todas as empresas com assinatura ativa, cria a cobrança do mês
                com o vencimento no dia do aniversário de cada uma e atualiza a vigência (+30 dias).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Mês de Referência (YYYY-MM)
                </Label>
                <Input
                  type="month"
                  value={generateTargetMonth}
                  onChange={(e) => setGenerateTargetMonth(e.target.value)}
                  className="text-xs h-9 bg-slate-50"
                />
                <p className="text-[11px] text-slate-500">
                  Ex.: {generateTargetMonth} — Para assinaturas ativas que ainda não possuem
                  cobrança gerada.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Regras de Automação Aplicadas:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                  <li>
                    Vencimento no dia do mês correspondente ao aniversário de início (starts_at);
                  </li>
                  <li>Atualização da vigência mensal (current_period_ends_at) para +30 dias;</li>
                  <li>
                    Se a data de vencimento já passou e não há pagamento, é marcada como ATRASADA;
                  </li>
                  <li>Atrasos de 15+ dias suspendem automaticamente a organização no sistema.</li>
                </ul>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsGenerateModalOpen(false)}
                disabled={generatingMonth}
                className="text-xs"
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerateMonthCharges}
                disabled={generatingMonth}
                className="text-xs bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white font-semibold"
              >
                {generatingMonth ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                    Confirmar e Gerar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL: MARCAR COMO PAGA */}
        <Dialog
          open={Boolean(payingCharge)}
          onOpenChange={(open) => !open && setPayingCharge(null)}
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Registrar Pagamento de Mensalidade
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Empresa: <strong>{payingCharge?.organization_name}</strong> • Vencimento:{' '}
                {formatDate(payingCharge?.due_date)}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleConfirmPayment} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Valor Pago (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-semibold">
                    R$
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    className="pl-9 text-xs h-9 bg-slate-50 font-bold text-slate-900"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  O valor pode ser ajustado caso haja desconto ou acréscimo acordado.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Forma de Pagamento *
                  </Label>
                  <Select
                    value={payMethod}
                    onValueChange={(val: ContekPaymentMethod) => setPayMethod(val)}
                  >
                    <SelectTrigger className="text-xs h-9 bg-slate-50">
                      <SelectValue placeholder="Forma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Data do Pagamento *
                  </Label>
                  <Input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    className="text-xs h-9 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Observações (opcional)
                </Label>
                <Input
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Ex.: Comprovante enviado via WhatsApp"
                  className="text-xs h-9 bg-slate-50"
                />
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Efeito na Assinatura do Cliente:
                </p>
                <p className="text-[11px] text-emerald-800">
                  A assinatura será marcada como <strong>Ativa</strong>, a vigência será renovada em
                  +30 dias e a empresa reativada caso estivesse com pendência.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPayingCharge(null)}
                  disabled={submittingPay}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingPay}
                  className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                >
                  {submittingPay ? 'Salvando...' : 'Confirmar Pagamento'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL: CRIAR / EDITAR COBRANÇA (VALORES 100% EDITÁVEIS - REGRA DA USUÁRIA) */}
        <Dialog open={isCreateChargeOpen} onOpenChange={setIsCreateChargeOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-cyan-600" />
                {editingCharge ? 'Editar Cobrança' : 'Nova Cobrança de Mensalidade'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Os valores cobrados são livres e editáveis conforme a negociação com o cliente.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveCharge} className="space-y-4 pt-2">
              {/* Selecionar Empresa */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Empresa Cliente *</Label>
                <Select
                  value={chargeOrgId}
                  onValueChange={handleOrgChangeOnCreate}
                  disabled={Boolean(editingCharge)}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data?.organizations || []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name} ({o.product.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Descrição do Item *</Label>
                <Input
                  value={chargeDescription}
                  onChange={(e) => setChargeDescription(e.target.value)}
                  placeholder="Ex.: Mensalidade AGYLI Pro Completo"
                  className="text-xs h-9 bg-slate-50"
                  required
                />
              </div>

              {/* Valor Editável e Vencimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Valor a Cobrar *</span>
                    <span className="text-[10px] text-cyan-600 font-normal">Editável</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-semibold">
                      R$
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={chargeAmount}
                      onChange={(e) => setChargeAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="pl-9 text-xs h-9 bg-slate-50 font-bold text-slate-900 border-cyan-300 focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Data de Vencimento *
                  </Label>
                  <Input
                    type="date"
                    value={chargeDueDate}
                    onChange={(e) => setChargeDueDate(e.target.value)}
                    required
                    className="text-xs h-9 bg-slate-50 font-mono"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status da Cobrança</Label>
                <Select
                  value={chargeStatus}
                  onValueChange={(val: ContekChargeStatus) => setChargeStatus(val)}
                >
                  <SelectTrigger className="text-xs h-9 bg-slate-50">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">🟡 PENDENTE</SelectItem>
                    <SelectItem value="PAGA">🟢 PAGA</SelectItem>
                    <SelectItem value="ATRASADA">🔴 ATRASADA</SelectItem>
                    <SelectItem value="CANCELADA">⚪ CANCELADA</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Observações Internas</Label>
                <Input
                  value={chargeNotes}
                  onChange={(e) => setChargeNotes(e.target.value)}
                  placeholder="Ex.: Desconto de 10% aplicado no primeiro trimestre"
                  className="text-xs h-9 bg-slate-50"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateChargeOpen(false)}
                  disabled={savingCharge}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingCharge}
                  className="text-xs bg-[#0D1B2A] hover:bg-[#1E3A8A] text-white font-semibold"
                >
                  {savingCharge ? 'Salvando...' : 'Salvar Cobrança'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* PAINEL LATERAL DE ASSINATURAS POR EMPRESA (SHEET) */}
        <Sheet open={isSubSheetOpen} onOpenChange={setIsSubSheetOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl bg-slate-50 p-0 overflow-y-auto">
            <div className="p-6 bg-[#0D1B2A] text-white space-y-2 sticky top-0 z-10 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ContekSymbol size={20} />
                <SheetTitle className="text-white text-base font-bold">
                  Painel de Assinaturas Contek
                </SheetTitle>
              </div>
              <SheetDescription className="text-xs text-slate-300">
                Visão por empresa: produto, plano, status, vigência e controle de trials.
              </SheetDescription>
            </div>

            <div className="p-6 space-y-4">
              {(data?.subscriptions || []).map((sub) => {
                const daysRemaining = getTrialDaysRemaining(sub.trial_ends_at)
                const isTrialUrgent =
                  sub.status === 'trial' && daysRemaining !== null && daysRemaining <= 3

                const subStatusBadge: Record<string, string> = {
                  active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
                  trial: 'bg-amber-100 text-amber-800 border-amber-300',
                  overdue: 'bg-rose-100 text-rose-800 border-rose-300',
                  canceled: 'bg-slate-100 text-slate-600 border-slate-200',
                }

                const recStatus = sub.recurring_status || 'NOT_ENROLLED'
                const isEnrolling = enrollingSubId === sub.id

                return (
                  <Card
                    key={sub.id}
                    className={`border shadow-xs bg-white transition-all ${
                      isTrialUrgent ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold text-[#0D1B2A] flex items-center gap-1.5">
                            <span>{sub.organization_name}</span>
                            <Badge
                              className={
                                sub.product === 'markaly'
                                  ? 'bg-sky-100 text-sky-800 text-[10px]'
                                  : 'bg-emerald-100 text-emerald-800 text-[10px]'
                              }
                            >
                              {sub.product.toUpperCase()}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-xs text-slate-500 font-mono">
                            /{sub.organization_slug} • {sub.plan_name} (
                            {formatMoney(sub.plan_price)}/mês)
                          </CardDescription>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            className={`text-[10px] font-semibold ${subStatusBadge[sub.status] || ''}`}
                          >
                            {sub.status.toUpperCase()}
                          </Badge>
                          {recStatus === 'ACTIVE' && (
                            <Badge className="bg-emerald-500 text-white text-[9px] font-bold py-0 px-1.5 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              PIX AUTO ATIVO
                            </Badge>
                          )}
                          {recStatus === 'PENDING_AUTHORIZATION' && (
                            <Badge className="bg-amber-500 text-white text-[9px] font-bold py-0 px-1.5 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              AGUARDANDO AUTORIZAÇÃO
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3 pt-0 text-xs">
                      {/* Datas e Vigências */}
                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">Início</span>
                          <span className="text-slate-700">{formatDate(sub.starts_at)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase">
                            Vigência Atual
                          </span>
                          <span className="text-slate-700 font-semibold">
                            {formatDate(sub.current_period_ends_at)}
                          </span>
                        </div>
                      </div>

                      {/* Alerta de Trial */}
                      {sub.status === 'trial' && sub.trial_ends_at && (
                        <div
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                            isTrialUrgent
                              ? 'bg-amber-100/70 border-amber-300 text-amber-950 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div>
                            <span className="font-semibold block">Término do Trial:</span>
                            <span>{formatDate(sub.trial_ends_at)}</span>
                          </div>
                          <Badge
                            className={
                              isTrialUrgent
                                ? 'bg-amber-600 text-white font-bold text-[10px]'
                                : 'bg-slate-200 text-slate-700 text-[10px]'
                            }
                          >
                            {daysRemaining !== null
                              ? daysRemaining <= 0
                                ? 'Vence HOJE'
                                : `${daysRemaining} dia(s) restante(s)`
                              : '-'}
                          </Badge>
                        </div>
                      )}

                      {/* Seção Pix Automático Woovi */}
                      <div className="p-2.5 rounded-lg border bg-gradient-to-r from-slate-50 to-cyan-50/40 border-cyan-200/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#0D1B2A] flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                            Pix Automático Woovi (Recorrente)
                          </span>
                          {recStatus === 'ACTIVE' ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                              ● Ativa
                            </span>
                          ) : recStatus === 'PENDING_AUTHORIZATION' ? (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              ● Aguardando autorização
                            </span>
                          ) : recStatus === 'REJECTED' ? (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                              ● Recusada
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                              Não inscrita
                            </span>
                          )}
                        </div>

                        {recStatus === 'ACTIVE' ? (
                          <div className="text-[11px] text-emerald-800 space-y-1">
                            <p>
                              Cobrança mensal no débito programado no valor de{' '}
                              <strong>{formatMoney(sub.plan_price)}</strong>.
                            </p>
                            {sub.recurring_authorized_at && (
                              <p className="text-[10px] text-slate-500">
                                Autorizado em: {formatDate(sub.recurring_authorized_at)}
                              </p>
                            )}
                          </div>
                        ) : recStatus === 'PENDING_AUTHORIZATION' ? (
                          <div className="space-y-1.5">
                            <p className="text-[11px] text-amber-900 leading-tight">
                              Mandato gerado! Envie o link ou abra para autorizar a recorrência
                              mensal.
                            </p>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              {sub.recurring_link && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setViewingPixAutoSub(sub)}
                                  className="h-6 px-2 text-[10px] border-amber-300 bg-amber-100/60 text-amber-950 font-semibold"
                                >
                                  <QrCode className="w-3 h-3 mr-1 text-amber-800" />
                                  Ver Link / QR de Autorização
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isEnrolling}
                                onClick={() => handleEnrollPixAutomatic(sub)}
                                className="h-6 px-2 text-[10px] text-slate-600 hover:text-slate-900"
                              >
                                {isEnrolling ? 'Regerando...' : 'Regerar Mandato'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-[11px] text-slate-600 leading-tight">
                              Gera o mandato de autorização na Woovi. O titular confirma uma vez e
                              os débitos ocorrem automaticamente todo mês.
                            </p>
                            <Button
                              size="sm"
                              disabled={isEnrolling}
                              onClick={() => handleEnrollPixAutomatic(sub)}
                              className="h-7 px-2.5 text-[11px] bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-bold shadow-xs"
                            >
                              <Sparkles
                                className={`w-3 h-3 mr-1 ${isEnrolling ? 'animate-spin' : ''}`}
                              />
                              {isEnrolling ? 'Gerando na Woovi...' : 'Ativar Pix Automático'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação na Assinatura */}
                      <div className="pt-1 flex flex-wrap items-center gap-1.5">
                        {sub.status !== 'active' && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenSubAction(sub, 'ACTIVATE_MANUAL')}
                            className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ativar Manualmente
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenSubAction(sub, 'EXTEND_TRIAL')}
                          className="h-7 px-2 text-[11px] border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold"
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          Estender Trial
                        </Button>

                        {sub.status !== 'canceled' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSubAction(sub, 'CANCEL_SUB')}
                            className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>

        {/* MODAL: CONFIRMAR AÇÃO NA ASSINATURA */}
        <Dialog
          open={Boolean(selectedSubForAction)}
          onOpenChange={(open) => !open && setSelectedSubForAction(null)}
        >
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-[#0D1B2A]">
                {subActionType === 'ACTIVATE_MANUAL' && 'Ativar Assinatura Manualmente'}
                {subActionType === 'EXTEND_TRIAL' && 'Estender Período de Teste (Trial)'}
                {subActionType === 'CANCEL_SUB' && 'Cancelar Assinatura'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Empresa: <strong>{selectedSubForAction?.organization_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              {subActionType === 'EXTEND_TRIAL' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Quantidade de Dias Adicionais
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={extendDaysInput}
                    onChange={(e) => setExtendDaysInput(parseInt(e.target.value, 10) || 7)}
                    className="text-xs h-9 bg-slate-50 font-bold"
                  />
                  <p className="text-[11px] text-slate-500">
                    O término do trial será prorrogado a partir da data de vencimento atual.
                  </p>
                </div>
              )}

              {subActionType === 'ACTIVATE_MANUAL' && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  A assinatura passará para o status <strong>Ativa</strong> e uma vigência inicial
                  de 30 dias será atribuída. O cliente continuará com acesso total aos recursos do
                  seu plano.
                </p>
              )}

              {subActionType === 'CANCEL_SUB' && (
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                  Atenção: o cancelamento mudará a assinatura para <strong>Cancelada</strong> e
                  suspenderá o acesso operacional da empresa.
                </p>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Observação / Motivo</Label>
                <Input
                  value={subActionNotes}
                  onChange={(e) => setSubActionNotes(e.target.value)}
                  placeholder="Ex.: Cortesia concedida para testes complementares"
                  className="text-xs h-9 bg-slate-50"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedSubForAction(null)}
                disabled={submittingSubAction}
                className="text-xs"
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmSubAction}
                disabled={submittingSubAction}
                className="text-xs bg-[#0D1B2A] hover:bg-[#1E3A8A] text-white font-semibold"
              >
                {submittingSubAction ? 'Salvando...' : 'Confirmar Ação'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

export default FinanceiroContek
