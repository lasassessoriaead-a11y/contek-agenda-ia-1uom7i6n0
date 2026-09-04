import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Payment, PaymentMethod, Client, Appointment } from '@/types'
import {
  DollarSign,
  Plus,
  TrendingUp,
  CheckCircle2,
  Clock,
  Filter,
  CreditCard,
  Banknote,
  QrCode,
  HelpCircle,
  Edit2,
  Trash2,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { toast } from 'sonner'
import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Financeiro: React.FC = () => {
  const { organization } = useAuth()
  const orgId = organization?.id

  const [payments, setPayments] = useState<Payment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  // Form State
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(150)
  const [isPaid, setIsPaid] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX')
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [clientId, setClientId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [paysRes, clientsRes] = await Promise.all([
        pb.collection('payments').getFullList<Payment>({
          filter: `organization_id = "${orgId}"`,
          sort: '-created',
          expand: 'client_id,appointment_id',
        }),
        pb.collection('clients').getFullList<Client>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
      ])
      setPayments(paysRes)
      setClients(clientsRes)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orgId])

  // Valid active payments: ignora lançamentos vinculados a consultas canceladas ou faltosas
  const validPayments = useMemo(() => {
    return payments.filter((p) => {
      const apptStatus = p.expand?.appointment_id?.status
      if (apptStatus === 'CANCELADO' || apptStatus === 'FALTOU') {
        return false
      }
      return true
    })
  }, [payments])

  // Summary Metrics
  const todayStr = new Date().toISOString().slice(0, 10)
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)

  const faturamentoDiario = useMemo(() => {
    return validPayments
      .filter((p) => p.is_paid && p.payment_date?.startsWith(todayStr))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments, todayStr])

  const faturamentoSemanal = useMemo(() => {
    return validPayments
      .filter((p) => {
        if (!p.is_paid || !p.payment_date) return false
        const d = parseISO(p.payment_date)
        return isWithinInterval(d, { start: weekStart, end: weekEnd })
      })
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments, weekStart, weekEnd])

  const faturamentoMensal = useMemo(() => {
    return validPayments
      .filter((p) => {
        if (!p.is_paid || !p.payment_date) return false
        const d = parseISO(p.payment_date)
        return isWithinInterval(d, { start: monthStart, end: monthEnd })
      })
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments, monthStart, monthEnd])

  const valoresRecebidos = useMemo(() => {
    return validPayments.filter((p) => p.is_paid).reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments])

  const valoresPendentes = useMemo(() => {
    return validPayments
      .filter((p) => !p.is_paid)
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments])

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return validPayments.filter((p) => {
      if (statusFilter === 'paid' && !p.is_paid) return false
      if (statusFilter === 'pending' && p.is_paid) return false
      if (methodFilter !== 'all' && p.payment_method !== methodFilter) return false
      return true
    })
  }, [validPayments, statusFilter, methodFilter])

  const openCreateModal = () => {
    setIsEditing(false)
    setEditId(null)
    setDescription('')
    setAmount(150)
    setIsPaid(true)
    setPaymentMethod('PIX')
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
    setClientId('')
    setNotes('')
    setModalOpen(true)
  }

  const openEditModal = (pay: Payment) => {
    setIsEditing(true)
    setEditId(pay.id)
    setDescription(pay.description || '')
    setAmount(pay.amount)
    setIsPaid(pay.is_paid)
    setPaymentMethod(pay.payment_method || 'PIX')
    setPaymentDate(
      pay.payment_date ? pay.payment_date.slice(0, 10) : format(new Date(), 'yyyy-MM-dd'),
    )
    setClientId(pay.client_id || '')
    setNotes(pay.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !amount) {
      toast.error('Informe o valor.')
      return
    }

    setSaving(true)
    try {
      const data = {
        organization_id: orgId,
        description: description.trim() || 'Atendimento / Serviço',
        amount: Number(amount),
        is_paid: isPaid,
        payment_method: paymentMethod,
        payment_date: isPaid ? paymentDate + ' 12:00:00.000Z' : null,
        client_id: clientId || null,
        notes: notes.trim(),
      }

      if (isEditing && editId) {
        await pb.collection('payments').update(editId, data)
        toast.success('Lançamento atualizado!')
      } else {
        await pb.collection('payments').create(data)
        toast.success('Lançamento financeiro registrado!')
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao salvar lançamento financeiro.')
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePaid = async (pay: Payment) => {
    try {
      const newPaid = !pay.is_paid
      await pb.collection('payments').update(pay.id, {
        is_paid: newPaid,
        payment_date: newPaid ? new Date().toISOString() : null,
        payment_method: pay.payment_method || 'PIX',
      })
      toast.success(newPaid ? 'Marcado como PAGO!' : 'Marcado como PENDENTE.')
      await loadData()
    } catch (err) {
      toast.error('Erro ao atualizar status do pagamento.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este lançamento?')) return
    try {
      await pb.collection('payments').delete(id)
      toast.success('Lançamento removido.')
      await loadData()
    } catch (err) {
      toast.error('Erro ao remover lançamento.')
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  const getMethodIcon = (method?: PaymentMethod) => {
    switch (method) {
      case 'PIX':
        return <QrCode className="w-3.5 h-3.5 text-teal-600" />
      case 'Dinheiro':
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />
      case 'Cartão':
        return <CreditCard className="w-3.5 h-3.5 text-blue-600" />
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-600" />
            Financeiro Simples
          </h1>
          <p className="text-xs text-slate-500">
            Controle de recebimentos e valores pendentes atrelados aos atendimentos da empresa.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo Lançamento
        </Button>
      </div>

      {/* 5 KEY FINANCIAL METRIC CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Faturamento Diário */}
        <Card className="border-slate-200 bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Faturamento Hoje
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(faturamentoDiario)}
            </div>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Valores pagos hoje</p>
          </CardContent>
        </Card>

        {/* Faturamento Semanal */}
        <Card className="border-slate-200 bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Faturamento Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-slate-900">
              {formatCurrency(faturamentoSemanal)}
            </div>
            <p className="text-[10px] text-teal-600 font-medium mt-0.5">Semana atual</p>
          </CardContent>
        </Card>

        {/* Faturamento Mensal */}
        <Card className="border-slate-200 bg-white">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Faturamento Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-emerald-700">
              {formatCurrency(faturamentoMensal)}
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Mês corrente</p>
          </CardContent>
        </Card>

        {/* Valores Recebidos (Total) */}
        <Card className="border-slate-200 bg-emerald-50/40">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Total Recebido
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-emerald-950">
              {formatCurrency(valoresRecebidos)}
            </div>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Recebidos e quitados</p>
          </CardContent>
        </Card>

        {/* Valores Pendentes (Total) */}
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="p-3.5 pb-1">
            <CardTitle className="text-[11px] font-medium text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              Valores Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-xl font-bold text-amber-950">
              {formatCurrency(valoresPendentes)}
            </div>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">A receber / pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER BAR & TRANSACTIONS TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-semibold text-slate-700">Filtrar Lançamentos:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white">
                <SelectValue placeholder="Forma de Pagto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Formas</SelectItem>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="Cartão">Cartão</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">Nenhum lançamento financeiro</p>
            <p className="text-xs text-slate-400 mt-1">
              Conclua agendamentos ou crie lançamentos para registrar pagamentos.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Descrição / Atendimento</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Forma de Pagto</th>
                  <th className="py-3 px-4">Data Pagto</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredPayments.map((pay) => {
                  const clientName = pay.expand?.client_id?.name || '-'

                  return (
                    <tr key={pay.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {pay.description || 'Atendimento'}
                        {pay.notes && (
                          <p className="text-[10px] text-slate-400 font-normal truncate max-w-xs">
                            {pay.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{clientName}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-medium">
                          {getMethodIcon(pay.payment_method)}
                          <span>{pay.payment_method || 'Outro'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {pay.payment_date ? format(parseISO(pay.payment_date), 'dd/MM/yyyy') : '-'}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                        {formatCurrency(pay.amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(pay)}
                          className="cursor-pointer"
                        >
                          <Badge
                            className={
                              pay.is_paid
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                            }
                          >
                            {pay.is_paid ? 'PAGO' : 'PENDENTE'}
                          </Badge>
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(pay)}
                          className="text-xs h-7 px-2 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(pay.id)}
                          className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar Lançamento' : 'Novo Lançamento Financeiro'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Registro de faturamento atrelado ao atendimento. Formas de pagamento: PIX, Dinheiro,
                Cartão, Outro.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Descrição *</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Consulta Nutricional, Procedimento Facial..."
                  required
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Valor (R$) *</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Forma de Pagamento</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Cliente (opcional)</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue placeholder="Vincular cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum / Avulso</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Data do Pagamento</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status do Pagamento</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={isPaid ? 'default' : 'outline'}
                    onClick={() => setIsPaid(true)}
                    className={
                      isPaid ? 'bg-emerald-600 text-white text-xs flex-1' : 'text-xs flex-1'
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Pago
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!isPaid ? 'default' : 'outline'}
                    onClick={() => setIsPaid(false)}
                    className={
                      !isPaid ? 'bg-amber-600 text-white text-xs flex-1' : 'text-xs flex-1'
                    }
                  >
                    <Clock className="w-3.5 h-3.5 mr-1" />
                    Pendente
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {saving ? 'Salvando...' : isEditing ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Financeiro
