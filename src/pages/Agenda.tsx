import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import pb from '@/lib/pocketbase/client'
import type {
  Appointment,
  AppointmentStatus,
  Client,
  Payment,
  Professional,
  Service,
} from '@/types'
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
  Send,
  MessageSquare,
  Copy,
  ExternalLink,
  BellRing,
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
  const { organization, user, isProfessional } = useAuth()
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

  // Manual WhatsApp Modal state
  const [waModalOpen, setWaModalOpen] = useState(false)
  const [waTargetAppt, setWaTargetAppt] = useState<Appointment | null>(null)
  const [waMessageType, setWaMessageType] = useState<
    'CONFIRMATION_REQUEST' | 'CONFIRMATION_THANKS' | 'DAY_REMINDER'
  >('CONFIRMATION_REQUEST')
  const [waGeneratedText, setWaGeneratedText] = useState('')
  const [waLink, setWaLink] = useState('')
  const [generatingWa, setGeneratingWa] = useState(false)

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
    if (selectedProfFilter !== 'all') {
      setFormProfId(selectedProfFilter)
    } else if (professionals.length > 0) {
      setFormProfId(professionals[0].id)
    }
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

      // 1. Resolve or Create Client
      let targetClientId = formClientId
      const trimmedInputName = formClientName.trim()
      const trimmedInputPhone = formClientPhone.trim()

      if (!targetClientId) {
        if (!trimmedInputName || !trimmedInputPhone) {
          toast.error('Informe o nome e telefone do cliente.')
          setSavingAppt(false)
          return
        }

        // Check if client exists with same phone (matching raw or digits only)
        const digitsInput = trimmedInputPhone.replace(/\D/g, '')
        const existing = clients.find((c) => {
          const cPhoneDigits = (c.phone || '').replace(/\D/g, '')
          const cWaDigits = (c.whatsapp || '').replace(/\D/g, '')
          return (
            c.phone?.trim() === trimmedInputPhone ||
            c.whatsapp?.trim() === trimmedInputPhone ||
            (digitsInput && (cPhoneDigits === digitsInput || cWaDigits === digitsInput))
          )
        })

        if (existing) {
          targetClientId = existing.id
          // Se o nome informado for diferente, atualiza o cadastro do cliente para refletir o nome digitado
          if (trimmedInputName && existing.name !== trimmedInputName) {
            try {
              await pb.collection('clients').update(existing.id, {
                name: trimmedInputName,
              })
            } catch {
              /* ignore update error */
            }
          }
        } else {
          const newClient = await pb.collection('clients').create<Client>({
            organization_id: orgId,
            name: trimmedInputName,
            phone: trimmedInputPhone,
            whatsapp: trimmedInputPhone,
          })
          targetClientId = newClient.id
        }
      } else {
        // Se selecionou um cliente existente mas alterou o nome no formulário
        const selected = clients.find((c) => c.id === targetClientId)
        if (selected && trimmedInputName && selected.name !== trimmedInputName) {
          try {
            await pb.collection('clients').update(selected.id, {
              name: trimmedInputName,
            })
          } catch {
            /* ignore update error */
          }
        }
      }

      const cName = trimmedInputName || clients.find((c) => c.id === targetClientId)?.name || ''
      const cPhone = trimmedInputPhone || clients.find((c) => c.id === targetClientId)?.phone || ''

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

        // Sincronização financeira em caso de edição de status
        try {
          const relatedPayments = await pb
            .collection('payments')
            .getFullList<Payment>({ filter: `appointment_id = "${editApptId}"` })

          if (formStatus === 'CANCELADO' || formStatus === 'FALTOU') {
            for (const p of relatedPayments) {
              await pb.collection('payments').delete(p.id)
            }
          } else if (formStatus === 'CONCLUÍDO') {
            if (relatedPayments.length > 0) {
              for (const p of relatedPayments) {
                if (!p.is_paid) {
                  await pb.collection('payments').update(p.id, {
                    is_paid: true,
                    payment_date: p.payment_date || new Date().toISOString(),
                    payment_method:
                      p.payment_method && p.payment_method !== 'Outro' ? p.payment_method : 'PIX',
                  })
                }
              }
            } else {
              // Se foi editado diretamente para CONCLUÍDO e não tinha pagamento, cria como quitado
              const serv = services.find((s) => s.id === formServiceId)
              await pb.collection('payments').create({
                organization_id: orgId,
                appointment_id: editApptId,
                client_id: targetClientId,
                amount: formPrice,
                is_paid: true,
                payment_date: new Date().toISOString(),
                payment_method: 'PIX',
                description: `${serv?.name || 'Serviço'} - ${cName}`,
              })
            }
          }
        } catch (paySyncErr) {
          console.error('Erro ao sincronizar pagamento no update do agendamento:', paySyncErr)
        }

        toast.success('Agendamento atualizado com sucesso!')
      } else {
        const createdAppt = await pb.collection('appointments').create<Appointment>(apptData)

        // Create accompanying payment record APENAS se status não for CANCELADO ou FALTOU
        if (formStatus !== 'CANCELADO' && formStatus !== 'FALTOU') {
          try {
            const serv = services.find((s) => s.id === formServiceId)
            const isCompleted = formStatus === 'CONCLUÍDO'
            await pb.collection('payments').create({
              organization_id: orgId,
              appointment_id: createdAppt.id,
              client_id: targetClientId,
              amount: formPrice,
              is_paid: isCompleted,
              payment_date: isCompleted ? new Date().toISOString() : null,
              payment_method: isCompleted ? 'PIX' : 'Outro',
              description: `${serv?.name || 'Serviço'} - ${cName}`,
            })
          } catch {
            /* intentionally ignored */
          }
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

      // Regra Financeira:
      // - CANCELADO ou FALTOU: remove lançamentos vinculados imediatamente
      // - CONCLUÍDO: marca pagamento vinculado como quitado
      if (newStatus === 'CANCELADO' || newStatus === 'FALTOU') {
        try {
          const relatedPays = await pb
            .collection('payments')
            .getFullList<Payment>({ filter: `appointment_id = "${apptId}"` })
          for (const p of relatedPays) {
            await pb.collection('payments').delete(p.id)
          }
        } catch {
          /* intentionally ignored */
        }
      } else if (newStatus === 'CONCLUÍDO') {
        try {
          const relatedPays = await pb
            .collection('payments')
            .getFullList<Payment>({ filter: `appointment_id = "${apptId}"` })
          if (relatedPays.length > 0) {
            for (const p of relatedPays) {
              if (!p.is_paid) {
                await pb.collection('payments').update(p.id, {
                  is_paid: true,
                  payment_date: p.payment_date || new Date().toISOString(),
                  payment_method:
                    p.payment_method && p.payment_method !== 'Outro' ? p.payment_method : 'PIX',
                })
              }
            }
            toast.success('Faturamento registrado automaticamente!')
          } else {
            // Se não tinha pagamento vinculado, cria um quitado para a consulta concluída
            const appt = appointments.find((a) => a.id === apptId)
            if (appt && orgId) {
              const serv = services.find((s) => s.id === appt.service_id)
              const cName = appt.client_name_snapshot || appt.expand?.client_id?.name || 'Cliente'
              await pb.collection('payments').create({
                organization_id: orgId,
                appointment_id: appt.id,
                client_id: appt.client_id || null,
                amount: appt.price || 0,
                is_paid: true,
                payment_date: new Date().toISOString(),
                payment_method: 'PIX',
                description: `${serv?.name || 'Serviço'} - ${cName}`,
              })
              toast.success('Faturamento registrado automaticamente!')
            }
          }
        } catch {
          /* intentionally ignored */
        }
      }

      setDetailsSheetOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao atualizar status do agendamento.')
    }
  }

  // Open Manual WhatsApp Dispatch Modal
  const openManualWaModal = async (
    appt: Appointment,
    type: 'CONFIRMATION_REQUEST' | 'CONFIRMATION_THANKS' | 'DAY_REMINDER' = 'CONFIRMATION_REQUEST',
  ) => {
    setWaTargetAppt(appt)
    setWaMessageType(type)
    setWaModalOpen(true)
    setGeneratingWa(true)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/appointments/manual-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({
            appointment_id: appt.id,
            type: type,
            mark_as_sent: false,
          }),
        },
      )
      const data = await res.json()
      if (res.ok) {
        setWaGeneratedText(data.message_text || '')
        setWaLink(data.wa_link || '')
      } else {
        toast.error(data.error || 'Erro ao carregar template da mensagem.')
      }
    } catch (err) {
      console.error('Error generating manual WhatsApp text:', err)
      toast.error('Erro de conexão ao gerar mensagem.')
    } finally {
      setGeneratingWa(false)
    }
  }

  // Handle Mark as Sent & Open WhatsApp Web
  const handleConfirmManualSend = async (openTab: boolean = true) => {
    if (!waTargetAppt) return
    try {
      const res = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/appointments/manual-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: pb.authStore.token,
          },
          body: JSON.stringify({
            appointment_id: waTargetAppt.id,
            type: waMessageType,
            mark_as_sent: true,
          }),
        },
      )
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Mensagem registrada como enviada!')
        if (openTab && waLink) {
          window.open(waLink, '_blank', 'noopener,noreferrer')
        }
        setWaModalOpen(false)

        // Atualizar estado de selectedAppointment se estiver aberto
        setSelectedAppointment((prev) => {
          if (!prev || prev.id !== waTargetAppt.id) return prev
          const prevSent = parseNotificationsSent(prev.notifications_sent)
          return {
            ...prev,
            notifications_sent: {
              ...prevSent,
              [waMessageType]: new Date().toISOString(),
            },
          }
        })

        await loadData()
      } else {
        console.error('Erro ao registrar envio via manual-message:', data)
        toast.error(data.error || 'Erro ao registrar envio.')
      }
    } catch (err) {
      console.error('Erro de conexão ao comunicar com backend:', err)
      toast.error('Erro ao comunicar com backend.')
    }
  }

  // Delete Appointment
  const handleDeleteAppointment = async (apptId: string) => {
    if (!confirm('Tem certeza que deseja excluir permanentemente este agendamento?')) return
    try {
      // Exclui pagamentos vinculados para integridade financeira
      try {
        const relatedPays = await pb
          .collection('payments')
          .getFullList<Payment>({ filter: `appointment_id = "${apptId}"` })
        for (const p of relatedPays) {
          await pb.collection('payments').delete(p.id)
        }
      } catch {
        /* intentionally ignored */
      }

      await pb.collection('appointments').delete(apptId)
      toast.success('Agendamento excluído.')
      setDetailsSheetOpen(false)
      await loadData()
    } catch (err) {
      toast.error('Erro ao excluir agendamento.')
    }
  }

  // Filtered Appointments (para a visão do calendário/tabela conforme filtros selecionados)
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

  // Format short date in pt-BR: dd/MM
  const formatShortDate = (dateVal?: string) => {
    if (!dateVal) return ''
    try {
      const clean = dateVal.slice(0, 10)
      const parsed = parseISO(clean)
      return format(parsed, 'dd/MM')
    } catch {
      return dateVal.slice(0, 10)
    }
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

  // Helper to parse list fields safely
  const parseListField = <T = string,>(val: unknown): T[] => {
    if (!val) return []
    if (Array.isArray(val)) {
      if (val.length > 0 && typeof val[0] === 'number') {
        try {
          const str = String.fromCharCode(...(val as number[]))
          const parsed = JSON.parse(str)
          return Array.isArray(parsed) ? (parsed as T[]) : []
        } catch {
          return []
        }
      }
      return val as T[]
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? (parsed as T[]) : []
      } catch {
        return []
      }
    }
    return []
  }

  // Selected professional info when a single professional is filtered
  const singleFilteredProf = useMemo(() => {
    if (selectedProfFilter === 'all') return null
    return professionals.find((p) => p.id === selectedProfFilter) || null
  }, [selectedProfFilter, professionals])

  // Week days interval
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Month days interval
  const monthStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 })
  const monthEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 })
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Decode notifications_sent safely from record (string, object, byte array, etc.)
  const parseNotificationsSent = (raw: unknown): Record<string, string> => {
    if (!raw) return {}
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return typeof parsed === 'object' && parsed !== null ? parsed : {}
      } catch {
        return {}
      }
    }
    if (Array.isArray(raw)) {
      if (raw.length > 0 && typeof raw[0] === 'number') {
        try {
          const str = String.fromCharCode(...raw)
          const parsed = JSON.parse(str)
          return typeof parsed === 'object' && parsed !== null ? parsed : {}
        } catch {
          return {}
        }
      }
      return {}
    }
    if (typeof raw === 'object') {
      return raw as Record<string, string>
    }
    return {}
  }

  // Format sent timestamp nicely in pt-BR
  const formatSentTimestamp = (isoString?: string) => {
    if (!isoString) return ''
    try {
      const parsed = parseISO(isoString)
      if (isNaN(parsed.getTime())) {
        const d = new Date(isoString)
        if (isNaN(d.getTime())) return isoString
        return format(d, "dd/MM 'às' HH:mm", { locale: ptBR })
      }
      return format(parsed, "dd/MM 'às' HH:mm", { locale: ptBR })
    } catch {
      return isoString
    }
  }

  // Fila de notificações pendentes:
  // 1. CONFIRMAÇÃO: apenas agendamentos com status AGENDADO que ainda NÃO têm 'CONFIRMATION_REQUEST' enviado
  // 2. LEMBRETE NO DIA: agendamentos de HOJE com status CONFIRMADO ou AGENDADO que ainda NÃO têm 'DAY_REMINDER' enviado
  // Agendamentos CANCELADO, FALTOU, EM ATENDIMENTO ou CONCLUÍDO NUNCA entram em nenhuma fila.
  // IMPORTANTE: considera a base de agendamentos respeitando o filtro de profissional se houver, mas não o filtro de status da tela
  const pendingNotificationQueue = useMemo(() => {
    const todayYmd = format(new Date(), 'yyyy-MM-dd')

    const items: Array<{
      appointment: Appointment
      queueType: 'CONFIRMATION_REQUEST' | 'DAY_REMINDER'
      titleBadge: string
      dateLabel: string
    }> = []

    const candidateAppts = appointments.filter((a) => {
      if (selectedProfFilter !== 'all' && a.professional_id !== selectedProfFilter) {
        return false
      }
      return true
    })

    for (const appt of candidateAppts) {
      // Regras 3 e 4: CANCELADO, FALTOU, EM ATENDIMENTO, CONCLUÍDO saem de qualquer fila
      if (
        appt.status === 'CANCELADO' ||
        appt.status === 'FALTOU' ||
        appt.status === 'EM ATENDIMENTO' ||
        appt.status === 'CONCLUÍDO'
      ) {
        continue
      }

      const sentMap = parseNotificationsSent(appt.notifications_sent)
      const apptDateYmd = appt.date ? appt.date.slice(0, 10) : ''
      const isTodayAppt = apptDateYmd === todayYmd

      // Se for AGENDADO e ainda não enviou Pedido de Confirmação
      if (appt.status === 'AGENDADO' && !sentMap['CONFIRMATION_REQUEST']) {
        items.push({
          appointment: appt,
          queueType: 'CONFIRMATION_REQUEST',
          titleBadge: 'Confirmação',
          dateLabel: `${formatShortDate(appt.date)} às ${appt.start_time}`,
        })
      }
      // Se for de HOJE (AGENDADO ou CONFIRMADO) e ainda não enviou Lembrete do Dia
      else if (isTodayAppt && !sentMap['DAY_REMINDER']) {
        items.push({
          appointment: appt,
          queueType: 'DAY_REMINDER',
          titleBadge: 'Lembrete D-0',
          dateLabel: `Hoje às ${appt.start_time}`,
        })
      }
    }

    // Ordenar por data e horário de início
    return items.sort((a, b) => {
      const dateA = `${a.appointment.date?.slice(0, 10) || ''} ${a.appointment.start_time}`
      const dateB = `${b.appointment.date?.slice(0, 10) || ''} ${b.appointment.start_time}`
      return dateA.localeCompare(dateB)
    })
  }, [appointments, selectedProfFilter])

  return (
    <div className="space-y-4 max-w-7xl mx-auto w-full min-w-0">
      {/* TOP CONTROLS & HEADER */}
      <div className="flex flex-col gap-3 pb-3 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Navegação e Título */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="h-8 w-8 text-slate-700 hover:text-slate-900"
                aria-label="Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="text-xs font-semibold px-2.5 h-8 text-slate-700 hover:text-slate-900"
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="h-8 w-8 text-slate-700 hover:text-slate-900"
                aria-label="Próximo"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="min-w-0 flex-1">
              {/* Título compacto e responsivo */}
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                {viewMode === 'day' && (
                  <>
                    <span className="sm:hidden capitalize">
                      {format(currentDate, 'EEE, dd MMM yyyy', { locale: ptBR })}
                    </span>
                    <span className="hidden sm:inline capitalize">
                      {format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </>
                )}
                {viewMode === 'week' &&
                  `Semana: ${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM/yyyy')}`}
                {viewMode === 'month' && (
                  <span className="capitalize">
                    {format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                {dayAppointments.length} agendamentos visualizados
              </p>
            </div>
          </div>

          {/* View Mode Tabs */}
          <div className="shrink-0 self-start sm:self-auto">
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as 'day' | 'week' | 'month')}
              className="w-auto"
            >
              <TabsList className="bg-slate-200/80 p-0.5 h-8 sm:h-9">
                <TabsTrigger value="day" className="text-xs px-2.5 sm:px-3">
                  Dia
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs px-2.5 sm:px-3">
                  Semana
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-2.5 sm:px-3">
                  Mês
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Linha de Filtros e Botão Novo Agendamento */}
        <div className="flex flex-wrap items-center gap-2 w-full">
          {/* Professional filter */}
          <div className="flex-1 min-w-[140px] sm:max-w-[180px]">
            <Select value={selectedProfFilter} onValueChange={setSelectedProfFilter}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-xs bg-white">
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
          </div>

          {/* Status filter */}
          <div className="flex-1 min-w-[130px] sm:max-w-[160px]">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full h-8 sm:h-9 text-xs bg-white">
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
          </div>

          {/* Botão Agendar */}
          <Button
            size="sm"
            onClick={() => openCreateModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm h-8 sm:h-9 px-3 shrink-0 ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span>Agendar</span>
          </Button>
        </div>
      </div>

      {/* CORPO PRINCIPAL: LAYOUT LADO-A-LADO NO DESKTOP (XL/LG) E EMPILHADO NO MOBILE/TABLET */}
      <div className="flex flex-col lg:flex-row items-start gap-5 w-full min-w-0">
        {/* COLUNA PRINCIPAL DA AGENDA (GRADE) */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* 1. DAY VIEW */}
          {viewMode === 'day' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Horários de Atendimento
                  </span>
                  {singleFilteredProf && (
                    <div className="flex items-center gap-1">
                      {(() => {
                        const shifts = parseListField<{ start: string; end: string }>(
                          singleFilteredProf.work_shifts,
                        )
                        if (shifts && shifts.length > 0) {
                          return shifts.map((s, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-mono"
                            >
                              {s.start} - {s.end}
                            </Badge>
                          ))
                        }
                        return (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-mono"
                          >
                            {singleFilteredProf.work_hours?.start || '08:00'} -{' '}
                            {singleFilteredProf.work_hours?.end || '18:00'}
                          </Badge>
                        )
                      })()}
                    </div>
                  )}
                </div>
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
                      <div className="w-16 sm:w-20 p-2 sm:p-2.5 bg-slate-50/50 border-r border-slate-100 text-xs font-mono font-semibold text-slate-600 flex items-center justify-center shrink-0">
                        {time}
                      </div>

                      {/* Slot content */}
                      <div className="flex-1 p-1.5 flex flex-wrap gap-2 items-center min-w-0">
                        {apptsAtSlot.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => openCreateModal(currentDate, time)}
                            className="w-full h-full py-2 px-3 text-left text-xs text-slate-300 group-hover:text-emerald-700 rounded transition-colors flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
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
                                className="flex-1 min-w-[240px] sm:min-w-[280px] p-2.5 rounded-lg border-l-4 border bg-white shadow-xs hover:shadow transition-all cursor-pointer flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs text-slate-900 truncate">
                                      {clientName}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                      {appt.start_time} - {appt.end_time} ({appt.duration}min)
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {servName} •{' '}
                                    <span className="text-slate-700 font-medium">{profName}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
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
              <div className="grid grid-cols-7 min-w-[700px] divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
                {weekDays.map((day) => {
                  const isCurr = isToday(day)
                  return (
                    <div
                      key={day.toISOString()}
                      className={`p-2.5 sm:p-3 text-center ${isCurr ? 'bg-emerald-50 text-emerald-950 font-bold' : 'text-slate-700'}`}
                    >
                      <p className="text-[11px] sm:text-xs font-medium uppercase tracking-wider">
                        {format(day, 'EEE', { locale: ptBR })}
                      </p>
                      <p className="text-base sm:text-lg font-bold">{format(day, 'dd')}</p>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-7 min-w-[700px] divide-x divide-slate-100 min-h-[500px]">
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
                            <div className="font-semibold text-slate-900 truncate">
                              {clientName}
                            </div>
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
                      className={`min-h-[80px] sm:min-h-[90px] p-1.5 transition-colors cursor-pointer hover:bg-slate-50 ${
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
        </div>

        {/* SIDEBAR LATERAL NO DESKTOP / CARD ABAIXO NO MOBILE: CONFIRMAÇÃO RÁPIDA & LEMBRETES PENDENTES */}
        {pendingNotificationQueue.length > 0 && (
          <div className="w-full lg:w-80 shrink-0 bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <BellRing className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Confirmação & Lembretes</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] bg-white text-amber-800 border-amber-300 shrink-0"
              >
                {pendingNotificationQueue.length} pendente(s)
              </Badge>
            </div>

            <p className="text-[11px] text-amber-800 leading-snug">
              Envios pendentes (pedidos de confirmação e lembretes de hoje não disparados). Dispare
              via WhatsApp com um clique:
            </p>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
              {pendingNotificationQueue.slice(0, 6).map((item) => {
                const appt = item.appointment
                const cName =
                  appt.expand?.client_id?.name || appt.client_name_snapshot || 'Paciente'

                return (
                  <div
                    key={`${appt.id}-${item.queueType}`}
                    className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-amber-200 shadow-xs hover:border-amber-300 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-xs text-slate-800 truncate leading-tight">
                          {cName}
                        </p>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1 py-0 h-4 bg-amber-100 text-amber-900 font-semibold"
                        >
                          {item.titleBadge}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5 whitespace-nowrap">
                        {item.dateLabel}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openManualWaModal(appt, item.queueType)}
                      className="h-7 px-2.5 text-[11px] text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 font-semibold shrink-0"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      <span>Enviar</span>
                    </Button>
                  </div>
                )
              })}
            </div>

            {pendingNotificationQueue.length > 6 && (
              <p className="text-[11px] text-amber-800 font-medium text-center pt-1">
                +{pendingNotificationQueue.length - 6} outros envios na fila
              </p>
            )}
          </div>
        )}
      </div>

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

              {/* WHATSAPP MANUAL DISPATCH BUTTON */}
              {(() => {
                const apptSentMap = parseNotificationsSent(selectedAppointment.notifications_sent)
                const reqSentAt = apptSentMap['CONFIRMATION_REQUEST']
                const remSentAt = apptSentMap['DAY_REMINDER']
                const thanksSentAt = apptSentMap['CONFIRMATION_THANKS']

                return (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        Comunicação WhatsApp
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-white border-emerald-300 text-emerald-800"
                      >
                        Modo Manual / Imediato
                      </Badge>
                    </div>

                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Envie confirmação ou lembrete via WhatsApp com templates dinâmicos.
                      Notificações já registradas exibem status e data de envio.
                    </p>

                    {/* STATUS DE DISPAROS JÁ REALIZADOS */}
                    <div className="space-y-1.5 bg-white/80 p-2.5 rounded-lg border border-emerald-200/80 text-xs">
                      {/* D-1 Pedido de Confirmação */}
                      <div className="flex items-center justify-between gap-2 py-0.5">
                        <span className="text-[11px] font-medium text-slate-700">
                          1. Confirmação (D-1):
                        </span>
                        {reqSentAt ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-medium flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Enviado em {formatSentTimestamp(reqSentAt)}</span>
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openManualWaModal(selectedAppointment, 'CONFIRMATION_REQUEST')
                              }
                              className="h-6 px-1.5 text-[10px] text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60 font-semibold"
                              title="Reenviar Confirmação"
                            >
                              Reenviar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              openManualWaModal(selectedAppointment, 'CONFIRMATION_REQUEST')
                            }
                            className="h-6 px-2.5 text-[11px] bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Pedir Confirmação
                          </Button>
                        )}
                      </div>

                      {/* D-0 Lembrete no Dia */}
                      <div className="flex items-center justify-between gap-2 py-0.5 border-t border-emerald-100 pt-1">
                        <span className="text-[11px] font-medium text-slate-700">
                          2. Lembrete no Dia (D-0):
                        </span>
                        {remSentAt ? (
                          <div className="flex items-center gap-1.5">
                            <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-medium flex items-center gap-1">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Enviado em {formatSentTimestamp(remSentAt)}</span>
                            </Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openManualWaModal(selectedAppointment, 'DAY_REMINDER')}
                              className="h-6 px-1.5 text-[10px] text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100/60 font-semibold"
                              title="Reenviar Lembrete"
                            >
                              Reenviar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openManualWaModal(selectedAppointment, 'DAY_REMINDER')}
                            className="h-6 px-2.5 text-[11px] border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-semibold"
                          >
                            <BellRing className="w-3 h-3 mr-1" />
                            Enviar Lembrete
                          </Button>
                        )}
                      </div>

                      {/* Agradecimento pós-confirmação (se aplicável) */}
                      {thanksSentAt && (
                        <div className="flex items-center justify-between gap-2 py-0.5 border-t border-emerald-100 pt-1">
                          <span className="text-[11px] font-medium text-slate-700">
                            3. Agradecimento:
                          </span>
                          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 text-[10px] font-medium flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>Enviado em {formatSentTimestamp(thanksSentAt)}</span>
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}

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
                Preencha os detalhes do atendimento. Validação de conflitos e isolamento
                multi-tenant são aplicados.
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

      {/* MODAL DE ENVIO MANUAL DE WHATSAPP (MODO DE EMERGÊNCIA / SEM CREDENCIAIS) */}
      <Dialog open={waModalOpen} onOpenChange={setWaModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Enviar Mensagem WhatsApp para o Paciente
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Dispare com um clique no WhatsApp Web ou aplicativo oficial, usando os templates
              dinâmicos cadastrados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs">
            {/* Escolha do tipo de mensagem */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Tipo de Notificação</Label>
              <Select
                value={waMessageType}
                onValueChange={(val) => {
                  const t = val as 'CONFIRMATION_REQUEST' | 'CONFIRMATION_THANKS' | 'DAY_REMINDER'
                  setWaMessageType(t)
                  if (waTargetAppt) openManualWaModal(waTargetAppt, t)
                }}
              >
                <SelectTrigger className="text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONFIRMATION_REQUEST">
                    1. Pedido de Confirmação (1 dia antes - D-1)
                  </SelectItem>
                  <SelectItem value="CONFIRMATION_THANKS">
                    2. Agradecimento (Pós-Confirmação)
                  </SelectItem>
                  <SelectItem value="DAY_REMINDER">3. Lembrete no Dia (Hoje - D-0)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preview do texto gerado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Texto Gerado (com dados reais):
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(waGeneratedText)
                    toast.success('Texto copiado para a área de transferência!')
                  }}
                  className="h-7 text-[11px] text-emerald-700 hover:text-emerald-800"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copiar Texto
                </Button>
              </div>
              <Textarea
                value={waGeneratedText}
                onChange={(e) => {
                  setWaGeneratedText(e.target.value)
                  const rawPhone = (
                    waTargetAppt?.expand?.client_id?.phone ||
                    waTargetAppt?.client_phone_snapshot ||
                    ''
                  ).replace(/\D/g, '')
                  const clean = rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`
                  setWaLink(`https://wa.me/${clean}?text=${encodeURIComponent(e.target.value)}`)
                }}
                disabled={generatingWa}
                className="text-xs font-mono h-32 resize-none leading-relaxed"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-slate-600 text-[11px]">
              <p>
                <b>Paciente:</b>{' '}
                {waTargetAppt?.expand?.client_id?.name || waTargetAppt?.client_name_snapshot}
              </p>
              <p>
                <b>Telefone:</b>{' '}
                {waTargetAppt?.expand?.client_id?.phone ||
                  waTargetAppt?.client_phone_snapshot ||
                  'Não informado'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleConfirmManualSend(false)}
              className="text-xs border-slate-300 text-slate-700"
            >
              Apenas Marcar como Enviado
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleConfirmManualSend(true)}
              disabled={generatingWa}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Abrir WhatsApp e Registrar Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default Agenda
