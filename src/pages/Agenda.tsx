import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type { Appointment, AppointmentStatus, Client, Professional, Service } from '@/types'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  User,
  Scissors,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  CalendarDays,
  UserX,
  Play,
  RotateCcw,
  Edit2,
  Trash2,
  Search,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  parseISO,
  addMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const Agenda: React.FC = () => {
  const { organization, user, isProfessional, settings } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day')
  const [currentDate, setCurrentDate] = useState<Date>(new Date())

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedProfFilter, setSelectedProfFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Selected Appointment for Details Slide-over
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false)

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editApptId, setEditApptId] = useState<string | null>(null)

  // Form states
  const [formClientId, setFormClientId] = useState('')
  const [formClientName, setFormClientName] = useState('')
  const [formClientPhone, setFormClientPhone] = useState('')
  const [formProfId, setFormProfId] = useState('')
  const [formServiceId, setFormServiceId] = useState('')
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formDuration, setFormDuration] = useState(45)
  const [formPrice, setFormPrice] = useState(150)
  const [formStatus, setFormStatus] = useState<AppointmentStatus>('AGENDADO')
  const [formNotes, setFormNotes] = useState('')
  const [savingAppt, setSavingAppt] = useState(false)

  const orgId = organization?.id

  // Load all dependencies
  const loadData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [apptsRes, profsRes, servsRes, clientsRes] = await Promise.all([
        pb.collection('appointments').getFullList<Appointment>({
          filter: `organization_id = "${orgId}"`,
          sort: 'date,start_time',
          expand: 'client_id,professional_id,service_id',
        }),
        pb.collection('professionals').getFullList<Professional>({
          filter: `organization_id = "${orgId}" && active = true`,
          sort: 'name',
        }),
        pb.collection('services').getFullList<Service>({
          filter: `organization_id = "${orgId}" && active = true`,
          sort: 'name',
        }),
        pb.collection('clients').getFullList<Client>({
          filter: `organization_id = "${orgId}"`,
          sort: 'name',
        }),
      ])

      setAppointments(apptsRes)
      setProfessionals(profsRes)
      setServices(servsRes)
      setClients(clientsRes)

      // Set default form values
      if (profsRes.length > 0 && !formProfId) {
        setFormProfId(profsRes[0].id)
      }
      if (servsRes.length > 0 && !formServiceId) {
        setFormServiceId(servsRes[0].id)
        setFormDuration(servsRes[0].duration || 45)
        setFormPrice(servsRes[0].price || 150)
      }
    } catch (err) {
      console.error('Error loading agenda data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [orgId])

  // Check query param for new appointment trigger (e.g. ?new=1)
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openCreateModal()
      setSearchParams({})
    }
  }, [searchParams])

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return
    const unsub = pb.collection('appointments').subscribe('*', () => {
      loadData()
    })
    return () => {
      unsub.then((u) => u())
    }
  }, [orgId])

  // Handle service selection change in form to auto-update duration & price
  const handleServiceChange = (serviceId: string) => {
    setFormServiceId(serviceId)
    const serv = services.find((s) => s.id === serviceId)
    if (serv) {
      setFormDuration(serv.duration || 45)
      setFormPrice(serv.price || 0)
    }
  }

  // Calculate End Time
  const calculateEndTime = (start: string, durationMin: number) => {
    try {
      const [h, m] = start.split(':').map(Number)
      const total = h * 60 + m + durationMin
      const endH = Math.floor(total / 60)
        .toString()
        .padStart(2, '0')
      const endM = (total % 60).toString().padStart(2, '0')
      return `${endH}:${endM}`
    } catch {
      return start
    }
  }

  // Open Create Modal
  const openCreateModal = (defaultDate?: Date, defaultTime?: string) => {
    setIsEditing(false)
    setEditApptId(null)
    setFormClientId('')
    setFormClientName('')
    setFormClientPhone('')
    setFormDate(format(defaultDate || currentDate, 'yyyy-MM-dd'))
    setFormStartTime(defaultTime || '09:00')
    setFormStatus('AGENDADO')
    setFormNotes('')
    if (services.length > 0) {
      handleServiceChange(services[0].id)
    }
    setModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = (appt: Appointment) => {
    setIsEditing(true)
    setEditApptId(appt.id)
    setFormClientId(appt.client_id)
    setFormClientName(appt.expand?.client_id?.name || appt.client_name_snapshot || '')
    setFormClientPhone(appt.expand?.client_id?.phone || appt.client_phone_snapshot || '')
    setFormProfId(appt.professional_id)
    setFormServiceId(appt.service_id)
    setFormDate(appt.date ? appt.date.slice(0, 10) : format(currentDate, 'yyyy-MM-dd'))
    setFormStartTime(appt.start_time)
    setFormDuration(appt.duration)
    setFormPrice(appt.price)
    setFormStatus(appt.status)
    setFormNotes(appt.notes || '')
    setDetailsSheetOpen(false)
    setModalOpen(true)
  }

  // Save Appointment (Create or Update)
  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !formProfId || !formServiceId || !formDate || !formStartTime) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }

    setSavingAppt(true)
    try {
      const endTime = calculateEndTime(formStartTime, formDuration)
      const buffer = settings?.buffer_between_appointments || 0
      const [newStartH, newStartM] = formStartTime.split(':').map(Number)
      const [newEndH, newEndM] = endTime.split(':').map(Number)
      const newStart = newStartH * 60 + newStartM
      const newEnd = newEndH * 60 + newEndM

      const hasConflict = appointments.some((appt) => {
        if (appt.id === editApptId) return false
        if (appt.professional_id !== formProfId) return false
        if (!appt.date?.startsWith(formDate)) return false
        if (appt.status === 'CANCELADO') return false

        const [existingStartH, existingStartM] = appt.start_time.split(':').map(Number)
        const [existingEndH, existingEndM] = appt.end_time.split(':').map(Number)
        const existingStart = existingStartH * 60 + existingStartM
        const existingEnd = existingEndH * 60 + existingEndM

        return newStart < existingEnd + buffer && newEnd + buffer > existingStart
      })

      if (hasConflict) {
        toast.error('Conflito de horário: este profissional já possui atendimento nesse período.')
        return
      }

      // 1. Resolve or Create Client
      let targetClientId = formClientId
      if (!targetClientId) {
        if (!formClientName.trim() || !formClientPhone.trim()) {
          toast.error('Informe o nome e telefone do cliente.')
          setSavingAppt(false)
          return
        }

        // Check if client exists with same phone
        const existing = clients.find((c) => c.phone.trim() === formClientPhone.trim())
        if (existing) {
          targetClientId = existing.id
        } else {
          const newClient = await pb.collection('clients').create<Client>({
            organization_id: orgId,
            name: formClientName.trim(),
            phone: formClientPhone.trim(),
            whatsapp: formClientPhone.trim(),
          })
          targetClientId = newClient.id
        }
      }

      const clientRec = clients.find((c) => c.id === targetClientId)
      const cName = clientRec ? clientRec.name : formClientName.trim()
      const cPhone = clientRec ? clientRec.phone : formClientPhone.trim()

      const apptData = {
        organization_id: orgId,
        client_id: targetClientId,
        professional_id: formProfId,
        service_id: formServiceId,
        date: formDate + ' 00:00:00.000Z',
        start_time: formStartTime,
        end_time: endTime,
        duration: formDuration,
        price: formPrice,
        status: formStatus,
        notes: formNotes,
        client_name_snapshot: cName,
        client_phone_snapshot: cPhone,
      }

      if (isEditing && editApptId) {
        await pb.collection('appointments').update(editApptId, apptData)
        toast.success('Agendamento atualizado com sucesso!')
      } else {
        const createdAppt = await pb.collection('appointments').create<Appointment>(apptData)

        // Create accompanying payment record
        try {
          const serv = services.find((s) => s.id === formServiceId)
          await pb.collection('payments').create({
            organization_id: orgId,
            appointment_id: createdAppt.id,
            client_id: targetClientId,
            amount: formPrice,
            is_paid: false,
            payment_method: 'Outro',
            description: `${serv?.name || 'Serviço'} - ${cName}`,
          })
        } catch {
          /* intentionally ignored */
        }

        toast.success('Agendamento cadastrado com sucesso!')
      }

      setModalOpen(false)
      await loadData()
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Erro ao salvar agendamento.'
      toast.error(msg)
    } finally {
      setSavingAppt(false)
    }
  }

  // Quick Status Actions
  const handleUpdateStatus = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      await pb.collection('appointments').update(apptId, { status: newStatus })
      toast.success(`Status atualizado para ${newStatus}`)

      setDetailsSheetOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao atualizar status do agendamento.')
    }
  }

  // Delete Appointment
  const handleDeleteAppointment = async (apptId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este agendamento?')) return
    try {
      await pb.collection('appointments').delete(apptId)
      toast.success('Agendamento excluído.')
      setDetailsSheetOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao excluir agendamento.')
    }
  }

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (selectedProfFilter !== 'all' && a.professional_id !== selectedProfFilter) {
        return false
      }
      if (statusFilter !== 'all' && a.status !== statusFilter) {
        return false
      }
      return true
    })
  }, [appointments, selectedProfFilter, statusFilter])

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'day') setCurrentDate((d) => subDays(d, 1))
    else if (viewMode === 'week') setCurrentDate((d) => subDays(d, 7))
    else setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }

  const handleNext = () => {
    if (viewMode === 'day') setCurrentDate((d) => addDays(d, 1))
    else if (viewMode === 'week') setCurrentDate((d) => addDays(d, 7))
    else setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'AGENDADO':
        return <Badge className="bg-slate-100 text-slate-800 border-slate-300">Agendado</Badge>
      case 'CONFIRMADO':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Confirmado</Badge>
        )
      case 'EM ATENDIMENTO':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Em Atendimento</Badge>
      case 'CONCLUÍDO':
        return <Badge className="bg-slate-800 text-white">Concluído</Badge>
      case 'CANCELADO':
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">Cancelado</Badge>
      case 'FALTOU':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Faltou</Badge>
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  // Generate hourly time slots for Day View (08:00 to 20:00)
  const timeSlots = [
    '08:00',
    '08:30',
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '11:30',
    '12:00',
    '12:30',
    '13:00',
    '13:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '17:00',
    '17:30',
    '18:00',
    '18:30',
    '19:00',
    '19:30',
  ]

  const dateStr = format(currentDate, 'yyyy-MM-dd')
  const dayAppointments = filteredAppointments.filter((a) => a.date?.startsWith(dateStr))

  // Week days interval
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Month days interval
  const monthStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
  const monthEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* TOP CONTROLS & HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
            <Button variant="ghost" size="icon" onClick={handlePrev} className="h-8 w-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="text-xs font-semibold px-2.5 h-8"
            >
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNext} className="h-8 w-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 capitalize">
              {viewMode === 'day' && format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              {viewMode === 'week' &&
                `Semana: ${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM/yyyy')}`}
              {viewMode === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {dayAppointments.length} agendamentos visualizados
            </p>
          </div>
        </div>

        {/* View Switcher & Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Professional filter */}
          <Select value={selectedProfFilter} onValueChange={setSelectedProfFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs bg-white">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Profissionais</SelectItem>
              {professionals.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="AGENDADO">Agendado</SelectItem>
              <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
              <SelectItem value="EM ATENDIMENTO">Em Atendimento</SelectItem>
              <SelectItem value="CONCLUÍDO">Concluído</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
              <SelectItem value="FALTOU">Faltou</SelectItem>
            </SelectContent>
          </Select>

          {/* View Mode Tabs */}
          <Tabs
            value={viewMode}
            onValueChange={(v) => setViewMode(v as 'day' | 'week' | 'month')}
            className="w-auto"
          >
            <TabsList className="bg-slate-200/80 p-0.5 h-9">
              <TabsTrigger value="day" className="text-xs px-3">
                Dia
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">
                Mês
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            size="sm"
            onClick={() => openCreateModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm h-9"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agendar
          </Button>
        </div>
      </div>

      {/* 1. DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Horários de Atendimento</span>
            <span className="text-xs text-slate-500">Clique em um horário para agendar</span>
          </div>

          <div className="divide-y divide-slate-100">
            {timeSlots.map((time) => {
              const apptsAtSlot = dayAppointments.filter((a) => a.start_time === time)

              return (
                <div
                  key={time}
                  className="flex items-stretch min-h-[56px] hover:bg-slate-50/60 transition-colors group"
                >
                  {/* Time label */}
                  <div className="w-20 p-2.5 bg-slate-50/50 border-r border-slate-100 text-xs font-mono font-semibold text-slate-600 flex items-center justify-center flex-shrink-0">
                    {time}
                  </div>

                  {/* Slot content */}
                  <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center">
                    {apptsAtSlot.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => openCreateModal(currentDate, time)}
                        className="w-full h-full py-2 px-3 text-left text-xs text-slate-300 group-hover:text-emerald-700 rounded transition-colors flex items-center gap-1.5 opacity-0 group-hover:opacity-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Disponível — Clique para agendar às {time}</span>
                      </button>
                    ) : (
                      apptsAtSlot.map((appt) => {
                        const clientName =
                          appt.expand?.client_id?.name || appt.client_name_snapshot || 'Cliente'
                        const profName = appt.expand?.professional_id?.name || 'Profissional'
                        const servName = appt.expand?.service_id?.name || 'Serviço'
                        const servColor = appt.expand?.service_id?.color || '#10b981'

                        return (
                          <div
                            key={appt.id}
                            onClick={() => {
                              setSelectedAppointment(appt)
                              setDetailsSheetOpen(true)
                            }}
                            style={{ borderLeftColor: servColor }}
                            className="flex-1 min-w-[280px] p-2.5 rounded-lg border-l-4 border bg-white shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-900">
                                  {clientName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {appt.start_time} - {appt.end_time} ({appt.duration}min)
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {servName} •{' '}
                                <span className="text-slate-700 font-medium">{profName}</span>
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800 hidden sm:inline">
                                {formatCurrency(appt.price)}
                              </span>
                              {getStatusBadge(appt.status)}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 2. WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[800px] divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
            {weekDays.map((day) => {
              const isCurr = isToday(day)
              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center ${isCurr ? 'bg-emerald-50 text-emerald-950 font-bold' : 'text-slate-700'}`}
                >
                  <p className="text-xs font-medium uppercase tracking-wider">
                    {format(day, 'EEE', { locale: ptBR })}
                  </p>
                  <p className="text-lg font-bold">{format(day, 'dd')}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-7 min-w-[800px] divide-x divide-slate-100 min-h-[500px]">
            {weekDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const appts = filteredAppointments.filter((a) => a.date?.startsWith(dayStr))

              return (
                <div
                  key={dayStr}
                  className="p-1.5 space-y-1.5 hover:bg-slate-50/40 transition-colors"
                >
                  {appts.map((appt) => {
                    const clientName =
                      appt.expand?.client_id?.name || appt.client_name_snapshot || 'Cliente'
                    const servColor = appt.expand?.service_id?.color || '#10b981'

                    return (
                      <div
                        key={appt.id}
                        onClick={() => {
                          setSelectedAppointment(appt)
                          setDetailsSheetOpen(true)
                        }}
                        style={{ borderLeftColor: servColor }}
                        className="p-2 rounded border-l-4 border bg-white shadow-xs text-xs cursor-pointer hover:shadow-md transition-all"
                      >
                        <div className="font-mono text-[10px] font-bold text-slate-700">
                          {appt.start_time} - {appt.end_time}
                        </div>
                        <div className="font-semibold text-slate-900 truncate">{clientName}</div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {appt.expand?.service_id?.name}
                        </div>
                        <div className="mt-1">{getStatusBadge(appt.status)}</div>
                      </div>
                    )
                  })}

                  <button
                    type="button"
                    onClick={() => openCreateModal(day)}
                    className="w-full py-1 text-center text-[10px] text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
                  >
                    + Agendar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3. MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50 text-center py-2 text-xs font-semibold text-slate-600">
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {monthDays.map((day) => {
              const dayStr = format(day, 'yyyy-MM-dd')
              const appts = filteredAppointments.filter((a) => a.date?.startsWith(dayStr))
              const isCurr = isToday(day)
              const isCurrentMonth = day.getMonth() === currentDate.getMonth()

              return (
                <div
                  key={dayStr}
                  onClick={() => {
                    setCurrentDate(day)
                    setViewMode('day')
                  }}
                  className={`min-h-[90px] p-1.5 transition-colors cursor-pointer hover:bg-slate-50 ${
                    !isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        isCurr ? 'bg-emerald-600 text-white' : ''
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {appts.length > 0 && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full">
                        {appts.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-hidden">
                    {appts.slice(0, 2).map((a) => (
                      <div
                        key={a.id}
                        className="text-[10px] bg-slate-100 text-slate-800 px-1 py-0.5 rounded truncate font-medium"
                      >
                        {a.start_time} {a.expand?.client_id?.name || a.client_name_snapshot}
                      </div>
                    ))}
                    {appts.length > 2 && (
                      <p className="text-[9px] text-slate-400 font-medium">
                        +{appts.length - 2} mais
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* APPOINTMENT DETAILS SLIDE-OVER SHEET */}
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedAppointment && (
            <div className="space-y-6 pt-4">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  {getStatusBadge(selectedAppointment.status)}
                  <span className="text-xs font-mono font-bold text-slate-600">
                    ID: {selectedAppointment.id.slice(0, 8)}
                  </span>
                </div>
                <SheetTitle className="text-xl text-slate-900 pt-2">
                  {selectedAppointment.expand?.client_id?.name ||
                    selectedAppointment.client_name_snapshot}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  {selectedAppointment.expand?.service_id?.name} com{' '}
                  {selectedAppointment.expand?.professional_id?.name}
                </SheetDescription>
              </SheetHeader>

              {/* Data Cards */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    Data:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedAppointment.date
                      ? format(parseISO(selectedAppointment.date), "dd 'de' MMMM 'de' yyyy", {
                          locale: ptBR,
                        })
                      : '-'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    Horário:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedAppointment.start_time} às {selectedAppointment.end_time} (
                    {selectedAppointment.duration} minutos)
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-slate-400" />
                    Valor do Serviço:
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatCurrency(selectedAppointment.price)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Telefone do Cliente:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedAppointment.expand?.client_id?.phone ||
                      selectedAppointment.client_phone_snapshot ||
                      'Não informado'}
                  </span>
                </div>

                {selectedAppointment.notes && (
                  <div className="pt-2">
                    <span className="text-slate-500 block mb-1">Observações:</span>
                    <p className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 italic">
                      "{selectedAppointment.notes}"
                    </p>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS (MUDANÇA DE STATUS) */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ações de Status
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedAppointment.id, 'CONFIRMADO')}
                    className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Confirmar
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedAppointment.id, 'EM ATENDIMENTO')}
                    className="text-xs border-blue-300 text-blue-800 hover:bg-blue-50"
                  >
                    <Play className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Em Atendimento
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedAppointment.id, 'CONCLUÍDO')}
                    className="text-xs border-slate-800 text-slate-900 bg-slate-100 hover:bg-slate-200 font-semibold"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Concluir Atendimento
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateStatus(selectedAppointment.id, 'FALTOU')}
                    className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50"
                  >
                    <UserX className="w-3.5 h-3.5 mr-1 text-amber-600" />
                    Marcar Falta
                  </Button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateStatus(selectedAppointment.id, 'CANCELADO')}
                  className="w-full text-xs border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Cancelar Agendamento
                </Button>
              </div>

              {/* EDIT / DELETE ACTIONS */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditModal(selectedAppointment)}
                  className="flex-1 text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                  Editar Dados / Remarcar
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteAppointment(selectedAppointment.id)}
                  className="text-rose-600 hover:bg-rose-50 text-xs"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE / EDIT APPOINTMENT MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveAppointment}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {isEditing ? 'Editar / Remarcar Agendamento' : 'Novo Agendamento'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Preencha os detalhes do atendimento. O sistema impede conflitos conhecidos de horário.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-xs">
              {/* Client Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Cliente *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={formClientId}
                    onValueChange={(val) => {
                      setFormClientId(val)
                      const c = clients.find((item) => item.id === val)
                      if (c) {
                        setFormClientName(c.name)
                        setFormClientPhone(c.phone)
                      }
                    }}
                  >
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue placeholder="Selecionar cliente cadastrado..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Novo Cliente Manual --</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    placeholder="Nome do Cliente"
                    value={formClientName}
                    onChange={(e) => {
                      setFormClientName(e.target.value)
                      if (formClientId) setFormClientId('')
                    }}
                    required
                    className="text-xs"
                  />
                </div>

                {!formClientId && (
                  <div className="pt-1">
                    <Input
                      placeholder="Telefone / WhatsApp do Cliente"
                      value={formClientPhone}
                      onChange={(e) => setFormClientPhone(e.target.value)}
                      required
                      className="text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Service & Professional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Serviço *</Label>
                  <Select value={formServiceId} onValueChange={handleServiceChange} required>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue placeholder="Escolha o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({formatCurrency(s.price)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Profissional *</Label>
                  <Select value={formProfId} onValueChange={setFormProfId} required>
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue placeholder="Escolha o profissional" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.specialty || 'Especialista'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date & Start Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Data *</Label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Horário Inicial *</Label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Duration & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Duração (min)</Label>
                  <Input
                    type="number"
                    value={formDuration}
                    onChange={(e) => setFormDuration(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Valor (R$)</Label>
                  <Input
                    type="number"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Status</Label>
                  <Select
                    value={formStatus}
                    onValueChange={(v) => setFormStatus(v as AppointmentStatus)}
                  >
                    <SelectTrigger className="text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AGENDADO">AGENDADO</SelectItem>
                      <SelectItem value="CONFIRMADO">CONFIRMADO</SelectItem>
                      <SelectItem value="EM ATENDIMENTO">EM ATENDIMENTO</SelectItem>
                      <SelectItem value="CONCLUÍDO">CONCLUÍDO</SelectItem>
                      <SelectItem value="CANCELADO">CANCELADO</SelectItem>
                      <SelectItem value="FALTOU">FALTOU</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Observações / Instruções
                </Label>
                <Textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex: cliente prefere atendimento sem barulho..."
                  className="text-xs h-20 resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingAppt}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
              >
                {savingAppt
                  ? 'Salvando...'
                  : isEditing
                    ? 'Atualizar Agendamento'
                    : 'Confirmar Agendamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Agenda