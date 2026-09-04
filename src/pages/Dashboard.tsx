import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Appointment, Client, Payment, Professional, Service } from '@/types'
import {
  Calendar,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  UserX,
  TrendingUp,
  Clock,
  ArrowUpRight,
  Plus,
  Bot,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts'
import { format, parseISO, isToday, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Dashboard: React.FC = () => {
  const { organization, user } = useAuth()
  const navigate = useNavigate()

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clientsCount, setClientsCount] = useState(0)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const orgId = organization?.id

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      // 1. Fetch appointments with expands
      const appts = await pb.collection('appointments').getFullList<Appointment>({
        filter: `organization_id = "${orgId}"`,
        sort: '-date,-start_time',
        expand: 'client_id,professional_id,service_id',
      })
      setAppointments(appts)

      // 2. Fetch clients count
      const clientsResult = await pb.collection('clients').getList(1, 1, {
        filter: `organization_id = "${orgId}"`,
      })
      setClientsCount(clientsResult.totalItems)

      // 3. Fetch payments with appointment expand to filter out cancelled/missed
      const pays = await pb.collection('payments').getFullList<Payment>({
        filter: `organization_id = "${orgId}"`,
        sort: '-created',
        expand: 'appointment_id',
      })
      setPayments(pays)
    } catch (err) {
      console.error('Error loading dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Realtime subscription for instant updates on bookings
    if (orgId) {
      const unsubAppts = pb.collection('appointments').subscribe('*', () => {
        loadData()
      })
      const unsubPays = pb.collection('payments').subscribe('*', () => {
        loadData()
      })
      return () => {
        unsubAppts.then((u) => u())
        unsubPays.then((u) => u())
      }
    }
  }, [orgId])

  // Calculated Metrics
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentMonthStr = new Date().toISOString().slice(0, 7) // YYYY-MM

  const todayAppointments = useMemo(() => {
    return appointments.filter((a) => a.date?.startsWith(todayStr))
  }, [appointments, todayStr])

  const upcomingTodayAppointments = useMemo(() => {
    return todayAppointments
      .filter(
        (a) =>
          a.status === 'AGENDADO' || a.status === 'CONFIRMADO' || a.status === 'EM ATENDIMENTO',
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  }, [todayAppointments])

  const completedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'CONCLUÍDO')
  }, [appointments])

  const cancelledAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'CANCELADO')
  }, [appointments])

  const missedAppointments = useMemo(() => {
    return appointments.filter((a) => a.status === 'FALTOU')
  }, [appointments])

  // Valid active payments (ignoring payments linked to cancelled or missed appointments)
  const validPayments = useMemo(() => {
    return payments.filter((p) => {
      const apptStatus = p.expand?.appointment_id?.status
      if (apptStatus === 'CANCELADO' || apptStatus === 'FALTOU') {
        return false
      }
      return true
    })
  }, [payments])

  // Financial calculations
  const todayRevenue = useMemo(() => {
    return validPayments
      .filter((p) => p.is_paid && p.payment_date?.startsWith(todayStr))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments, todayStr])

  const monthRevenue = useMemo(() => {
    return validPayments
      .filter((p) => p.is_paid && p.payment_date?.startsWith(currentMonthStr))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  }, [validPayments, currentMonthStr])

  // Status breakdown for Pie Chart
  const statusPieData = useMemo(() => {
    const counts: Record<string, number> = {
      Concluídos: completedAppointments.length,
      Agendados: appointments.filter((a) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO')
        .length,
      Faltas: missedAppointments.length,
      Cancelados: cancelledAppointments.length,
    }
    return [
      { name: 'Concluídos', value: counts.Concluídos, color: '#10b981' },
      { name: 'Agendados', value: counts.Agendados, color: '#3b82f6' },
      { name: 'Faltas', value: counts.Faltas, color: '#f59e0b' },
      { name: 'Cancelados', value: counts.Cancelados, color: '#ef4444' },
    ].filter((item) => item.value > 0)
  }, [appointments, completedAppointments, missedAppointments, cancelledAppointments])

  // Weekly Appointments & Revenue Chart
  const weeklyData = useMemo(() => {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const result = days.map((day) => ({ day, atendimentos: 0, faturamento: 0 }))

    appointments.forEach((a) => {
      try {
        const d = new Date(a.date)
        const dayIdx = d.getDay()
        result[dayIdx].atendimentos += 1
      } catch {
        /* intentionally ignored */
      }
    })

    validPayments.forEach((p) => {
      if (p.is_paid && p.payment_date) {
        try {
          const d = new Date(p.payment_date)
          const dayIdx = d.getDay()
          result[dayIdx].faturamento += p.amount
        } catch {
          /* intentionally ignored */
        }
      }
    })

    return result
  }, [appointments, validPayments])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMADO':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Confirmado</Badge>
        )
      case 'EM ATENDIMENTO':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Em Atendimento</Badge>
      case 'CONCLUÍDO':
        return <Badge className="bg-slate-100 text-slate-800 border-slate-300">Concluído</Badge>
      case 'CANCELADO':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">Cancelado</Badge>
      case 'FALTOU':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Faltou</Badge>
      default:
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Agendado</Badge>
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Painel Geral
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-slate-500">
              Visão consolidada da operação de{' '}
              <span className="font-semibold text-slate-700">
                {organization?.name || 'sua empresa'}
              </span>{' '}
              hoje, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
            </p>
            {organization?.slug === 'contek-demo' && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                Ambiente de Demonstração (DEMO)
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/agenda')}
            className="text-xs border-slate-300 hover:bg-slate-100"
          >
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
            Ver Agenda Completa
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/agenda?new=1')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Agendamento
          </Button>
        </div>
      </div>

      {/* AI SMART BANNER WIDGET */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Insight Contek Assistant IA</span>
              <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 text-[10px]">
                IA Contek
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Você tem <b>{todayAppointments.length} agendamentos</b> programados para hoje (
              {upcomingTodayAppointments.length} pendentes/em curso).
              {missedAppointments.length > 0 &&
                ` Dica: você registrou ${missedAppointments.length} falta(s) recente(s). Ative lembretes automáticos para diminuir faltas.`}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate('/assistente-ia')}
          className="relative z-10 bg-indigo-600 hover:bg-indigo-500 text-white text-xs whitespace-nowrap self-start sm:self-auto shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          Conversar com IA
        </Button>
      </div>

      {/* 8 PRIMARY STATS CARDS (clickable) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Card 1: Agendamentos Hoje */}
        <Card
          onClick={() => navigate('/agenda')}
          className="cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Agendamentos Hoje</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{todayAppointments.length}</div>
            <p className="text-[11px] text-emerald-600 font-medium flex items-center mt-1">
              <Clock className="w-3 h-3 mr-1" />
              {upcomingTodayAppointments.length} próximos hoje
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Faturamento do Dia */}
        <Card
          onClick={() => navigate('/financeiro')}
          className="cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Faturamento Hoje</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(todayRevenue)}</div>
            <p className="text-[11px] text-slate-500 mt-1">Valores pagos hoje</p>
          </CardContent>
        </Card>

        {/* Card 3: Faturamento do Mês */}
        <Card
          onClick={() => navigate('/financeiro')}
          className="cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Faturamento do Mês</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthRevenue)}</div>
            <p className="text-[11px] text-teal-600 font-medium mt-1">Mês corrente</p>
          </CardContent>
        </Card>

        {/* Card 4: Clientes Cadastrados */}
        <Card
          onClick={() => navigate('/clientes')}
          className="cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">
              Clientes Cadastrados
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{clientsCount}</div>
            <p className="text-[11px] text-slate-500 mt-1">Total na base da empresa</p>
          </CardContent>
        </Card>

        {/* Card 5: Atendimentos Realizados */}
        <Card
          onClick={() => navigate('/agenda')}
          className="cursor-pointer hover:border-emerald-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Realizados</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{completedAppointments.length}</div>
            <p className="text-[11px] text-green-600 font-medium mt-1">Status CONCLUÍDO</p>
          </CardContent>
        </Card>

        {/* Card 6: Cancelamentos */}
        <Card
          onClick={() => navigate('/agenda')}
          className="cursor-pointer hover:border-rose-300 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Cancelamentos</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{cancelledAppointments.length}</div>
            <p className="text-[11px] text-rose-600 font-medium mt-1">Status CANCELADO</p>
          </CardContent>
        </Card>

        {/* Card 7: Faltas */}
        <Card
          onClick={() => navigate('/agenda')}
          className="cursor-pointer hover:border-amber-300 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Faltas (No-Show)</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <UserX className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">{missedAppointments.length}</div>
            <p className="text-[11px] text-amber-600 font-medium mt-1">Status FALTOU</p>
          </CardContent>
        </Card>

        {/* Card 8: Próximos Atendimentos */}
        <Card
          onClick={() => navigate('/agenda')}
          className="cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all border-slate-200 bg-white"
        >
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500">Próximos Geral</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold text-slate-900">
              {
                appointments.filter((a) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO')
                  .length
              }
            </div>
            <p className="text-[11px] text-indigo-600 font-medium mt-1">Futuros na agenda</p>
          </CardContent>
        </Card>
      </div>

      {/* MIDDLE SECTION: AGENDA RESUMIDA DO DIA + CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AGENDA RESUMIDA DO DIA (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Agenda Resumida do Dia
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {todayAppointments.length} atendimentos programados para hoje
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="text-xs text-emerald-700 hover:text-emerald-800"
              >
                <Link to="/agenda">
                  Ver Tudo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {todayAppointments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-medium">Nenhum agendamento para hoje</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Crie um novo agendamento ou compartilhe seu link público.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate('/agenda?new=1')}
                    className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  >
                    Novo Agendamento
                  </Button>
                </div>
              ) : (
                todayAppointments.map((appt) => {
                  const clientName =
                    appt.expand?.client_id?.name || appt.client_name_snapshot || 'Cliente'
                  const profName = appt.expand?.professional_id?.name || 'Profissional'
                  const servName = appt.expand?.service_id?.name || 'Serviço'

                  return (
                    <div
                      key={appt.id}
                      onClick={() => navigate('/agenda')}
                      className="p-3 rounded-lg border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold text-center">
                          {appt.start_time}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            {clientName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {servName} • <span className="text-slate-700">{profName}</span> (
                            {appt.duration} min)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 hidden sm:inline">
                          {formatCurrency(appt.price)}
                        </span>
                        {getStatusBadge(appt.status)}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* WEEKLY ACTIVITY CHART */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Atendimentos por Dia da Semana
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Volume de agendamentos distribuídos ao longo dos dias
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        color: '#fff',
                        borderRadius: '8px',
                        border: 'none',
                      }}
                      formatter={(value) => [`${value} atendimentos`, 'Volume']}
                    />
                    <Bar dataKey="atendimentos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: STATS PIE + QUICK ACTIONS */}
        <div className="space-y-6">
          {/* COMPARECIMENTO X FALTAS PIE */}
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Comparecimento x Faltas / Status
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Distribuição geral de status dos agendamentos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 flex flex-col items-center">
              {statusPieData.length === 0 ? (
                <p className="text-xs text-slate-400 py-10">Sem agendamentos registrados ainda.</p>
              ) : (
                <>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {statusPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 w-full mt-2">
                    {statusPieData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-1.5 text-xs text-slate-600"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">{item.name}:</span>
                        <span className="font-semibold text-slate-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* PUBLIC BOOKING LINK WIDGET */}
          {organization?.slug && (
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Seu Link de Agendamento Online
                </CardTitle>
                <CardDescription className="text-xs text-emerald-800">
                  Divulgue no WhatsApp e Instagram para seus clientes agendarem sozinhos em 6
                  passos.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="p-2 rounded bg-white border border-emerald-200 text-xs font-mono text-emerald-950 truncate select-all">
                  {window.location.origin}/agendar/{organization.slug}
                </div>
                <Button
                  size="sm"
                  asChild
                  className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs"
                >
                  <Link to={`/agendar/${organization.slug}`} target="_blank">
                    <ArrowUpRight className="w-3.5 h-3.5 mr-1.5" />
                    Abrir Página Pública
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
export default Dashboard
