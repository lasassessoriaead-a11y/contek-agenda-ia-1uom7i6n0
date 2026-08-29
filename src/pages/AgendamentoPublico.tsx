import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import type {
  Organization,
  Service,
  Professional,
  ProfessionalService,
  BusinessSettings,
  Appointment,
} from '@/types'
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  CheckCircle2,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Scissors,
  Check,
  Building,
  MapPin,
  CalendarCheck,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format, addDays, isBefore, startOfToday, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const AgendamentoPublico: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()

  const [org, setOrg] = useState<Organization | null>(null)
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [profServices, setProfServices] = useState<ProfessionalService[]>([])
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [errorNotFound, setErrorNotFound] = useState(false)

  // 6 STEPS OF PUBLIC BOOKING:
  // Step 1: Escolher serviço
  // Step 2: Escolher profissional quando aplicável
  // Step 3: Escolher data
  // Step 4: Visualizar somente horários disponíveis
  // Step 5: Informar nome e telefone
  // Step 6: Confirmar (e depois tela de sucesso)
  const [currentStep, setCurrentStep] = useState(1)

  // Selections
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedProf, setSelectedProf] = useState<Professional | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [clientNotes, setClientNotes] = useState('')

  const [bookingInProgress, setBookingInProgress] = useState(false)
  const [bookingSuccessData, setBookingSuccessData] = useState<{
    appointment_id: string
    date: string
    start_time: string
    end_time: string
    service_name: string
    professional_name: string
    price: number
  } | null>(null)

  useEffect(() => {
    const fetchPublicOrg = async () => {
      if (!slug) return
      setLoading(true)
      try {
        const orgRecord = await pb
          .collection('organizations')
          .getFirstListItem<Organization>(`slug = "${slug}"`)
        setOrg(orgRecord)

        const [settRes, servsRes, profsRes, psRes, apptsRes] = await Promise.all([
          pb
            .collection('business_settings')
            .getFirstListItem<BusinessSettings>(`organization_id = "${orgRecord.id}"`)
            .catch(() => null),
          pb.collection('services').getFullList<Service>({
            filter: `organization_id = "${orgRecord.id}" && active = true`,
            sort: 'name',
          }),
          pb.collection('professionals').getFullList<Professional>({
            filter: `organization_id = "${orgRecord.id}" && active = true`,
            sort: 'name',
          }),
          pb.collection('professional_services').getFullList<ProfessionalService>({
            filter: `organization_id = "${orgRecord.id}"`,
          }),
          pb.collection('appointments').getFullList<Appointment>({
            filter: `organization_id = "${orgRecord.id}" && status != "CANCELADO"`,
          }),
        ])

        setSettings(settRes)
        setServices(servsRes)
        setProfessionals(profsRes)
        setProfServices(psRes)
        setExistingAppointments(apptsRes)
      } catch (err) {
        console.error('Error loading public booking page:', err)
        setErrorNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPublicOrg()
  }, [slug])

  // Filter professionals that perform selected service
  const availableProfessionalsForService = useMemo(() => {
    if (!selectedService) return professionals
    const linkedProfIds = profServices
      .filter((ps) => ps.service_id === selectedService.id)
      .map((ps) => ps.professional_id)

    if (linkedProfIds.length === 0) return professionals
    return professionals.filter((p) => linkedProfIds.includes(p.id))
  }, [selectedService, profServices, professionals])

  // Step 4: Available Time Slots calculation for selectedDate and selectedProf
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !selectedProf || !selectedService) return []

    const startH = 8
    const endH = 19
    const duration = selectedService.duration || 45
    const slots: string[] = []

    // Appts on selected date for this professional
    const dayAppts = existingAppointments.filter(
      (a) => a.professional_id === selectedProf.id && a.date?.startsWith(selectedDate),
    )

    // Generate potential slots every 30 mins
    for (let h = startH; h < endH; h++) {
      for (const m of [0, 30]) {
        const slotStartStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`

        // Calculate slot end
        const totalMinutes = h * 60 + m + duration
        const endHour = Math.floor(totalMinutes / 60)
        const endMin = totalMinutes % 60
        const slotEndStr = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`

        if (endHour > endH || (endHour === endH && endMin > 0)) continue

        // Check conflicts with existing appointments: (start < existEnd) && (end > existStart)
        const hasConflict = dayAppts.some((a) => {
          return slotStartStr < a.end_time && slotEndStr > a.start_time
        })

        if (!hasConflict) {
          slots.push(slotStartStr)
        }
      }
    }

    return slots
  }, [selectedDate, selectedProf, selectedService, existingAppointments])

  // Next 14 days selector
  const nextDays = useMemo(() => {
    const today = startOfToday()
    return Array.from({ length: 14 }, (_, i) => addDays(today, i))
  }, [])

  // Confirm booking
  const handleConfirmBooking = async () => {
    if (
      !org ||
      !selectedService ||
      !selectedProf ||
      !selectedDate ||
      !selectedTimeSlot ||
      !clientName ||
      !clientPhone
    ) {
      toast.error('Preencha todos os dados antes de confirmar.')
      return
    }

    setBookingInProgress(true)
    try {
      const response = await fetch(
        `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/public-booking`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            org_slug: org.slug,
            service_id: selectedService.id,
            professional_id: selectedProf.id,
            date: selectedDate,
            start_time: selectedTimeSlot,
            client_name: clientName,
            client_phone: clientPhone,
            client_email: clientEmail,
            notes: clientNotes,
          }),
        },
      )

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Erro ao confirmar agendamento.')
      }

      setBookingSuccessData(result)
      toast.success('Agendamento realizado com sucesso!')
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Erro ao realizar agendamento.'
      toast.error(msg)
    } finally {
      setBookingInProgress(false)
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Carregando página de agendamento...</p>
        </div>
      </div>
    )
  }

  if (errorNotFound || !org) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-800 bg-slate-950 text-white text-center p-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center mx-auto">
            <Building className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold">Estabelecimento não encontrado</h2>
          <p className="text-xs text-slate-400">
            O endereço <b>/agendar/{slug}</b> não corresponde a nenhuma empresa ativa no Contek
            Agenda IA.
          </p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
            <Link to="/login">Ir para Contek Agenda IA</Link>
          </Button>
        </Card>
      </div>
    )
  }

  // TELA FINAL DE SUCESSO
  if (bookingSuccessData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative">
        <div className="max-w-lg w-full bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Agendamento Realizado com Sucesso!
            </h1>
            <p className="text-xs text-emerald-400 mt-1">
              Seu horário está confirmado em <b>{org.name}</b>.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left space-y-2.5 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Serviço:</span>
              <span className="font-semibold text-white">{bookingSuccessData.service_name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Profissional:</span>
              <span className="font-semibold text-white">
                {bookingSuccessData.professional_name}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">Data e Horário:</span>
              <span className="font-bold text-emerald-400">
                {format(parseISO(bookingSuccessData.date), "dd 'de' MMMM", { locale: ptBR })} às{' '}
                {bookingSuccessData.start_time}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Valor do Atendimento:</span>
              <span className="font-bold text-white">
                {formatCurrency(bookingSuccessData.price)}
              </span>
            </div>
          </div>

          {settings?.default_booking_message && (
            <p className="text-xs text-slate-400 italic bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
              "{settings.default_booking_message}"
            </p>
          )}

          <div className="pt-2 flex flex-col gap-2">
            <Button
              onClick={() => {
                setBookingSuccessData(null)
                setCurrentStep(1)
                setSelectedService(null)
                setSelectedProf(null)
                setSelectedTimeSlot('')
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold h-11"
            >
              Fazer Outro Agendamento
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 mt-6">
          Desenvolvido por <b>Contek Tecnologia e Consultoria</b> • Contek Agenda IA
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 sm:px-6 relative overflow-x-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl w-full space-y-6 relative z-10">
        {/* ORGANIZATION BRAND HEADER */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Agendamento Online Oficial
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{org.name}</h1>
          {org.address && (
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              {org.address}
            </p>
          )}
        </div>

        {/* STEP PROGRESS BAR (1 to 6) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
            <span>Passo {currentStep} de 6</span>
            <span className="text-emerald-400">
              {currentStep === 1 && '1. Escolher Serviço'}
              {currentStep === 2 && '2. Escolher Profissional'}
              {currentStep === 3 && '3. Escolher Data'}
              {currentStep === 4 && '4. Escolher Horário'}
              {currentStep === 5 && '5. Seus Dados'}
              {currentStep === 6 && '6. Confirmar Agendamento'}
            </span>
          </div>

          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 6) * 100}%` }}
            />
          </div>
        </div>

        {/* CARD WITH STEP CONTENTS */}
        <Card className="border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
          {/* STEP 1: ESCOLHER SERVIÇO */}
          {currentStep === 1 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-emerald-400" />
                  Passo 1: Selecione o Serviço Desejado
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Escolha o procedimento ou consulta que deseja realizar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1">
                {services.map((serv) => {
                  const isSelected = selectedService?.id === serv.id
                  return (
                    <div
                      key={serv.id}
                      onClick={() => setSelectedService(serv)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/40 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{serv.name}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] border-slate-700 text-slate-400"
                          >
                            {serv.duration} min
                          </Badge>
                        </div>
                        {serv.description && (
                          <p className="text-xs text-slate-400 line-clamp-1">{serv.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-bold text-sm text-emerald-400">
                          {formatCurrency(serv.price)}
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                              : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
              <CardFooter className="pt-2 flex justify-end">
                <Button
                  disabled={!selectedService}
                  onClick={() => setCurrentStep(2)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-5"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 2: ESCOLHER PROFISSIONAL */}
          {currentStep === 2 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  Passo 2: Escolha o Profissional
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Profissionais qualificados para realizar "{selectedService?.name}".
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1">
                {availableProfessionalsForService.map((prof) => {
                  const isSelected = selectedProf?.id === prof.id
                  return (
                    <div
                      key={prof.id}
                      onClick={() => setSelectedProf(prof)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/40 text-white shadow-md'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-emerald-400 flex items-center justify-center font-bold text-sm">
                          {prof.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-white">{prof.name}</p>
                          <p className="text-xs text-slate-400">
                            {prof.specialty || 'Especialista'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : 'border-slate-700'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="border-slate-700 text-slate-300 text-xs h-10"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  disabled={!selectedProf}
                  onClick={() => setCurrentStep(3)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-5"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 3: ESCOLHER DATA */}
          {currentStep === 3 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-emerald-400" />
                  Passo 3: Escolha a Data
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Selecione um dos dias disponíveis nos próximos 14 dias.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {nextDays.map((day) => {
                    const dayStr = format(day, 'yyyy-MM-dd')
                    const isSelected = selectedDate === dayStr

                    return (
                      <button
                        key={dayStr}
                        type="button"
                        onClick={() => setSelectedDate(dayStr)}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-600 text-slate-950 font-bold shadow-lg shadow-emerald-500/20'
                            : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <p className="text-[10px] uppercase font-semibold">
                          {format(day, 'EEE', { locale: ptBR })}
                        </p>
                        <p className="text-lg font-bold">{format(day, 'dd')}</p>
                        <p className="text-[10px] opacity-80">
                          {format(day, 'MMM', { locale: ptBR })}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
              <CardFooter className="pt-3 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="border-slate-700 text-slate-300 text-xs h-10"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  disabled={!selectedDate}
                  onClick={() => setCurrentStep(4)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-5"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 4: VISUALIZAR SOMENTE HORÁRIOS DISPONÍVEIS */}
          {currentStep === 4 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-400" />
                  Passo 4: Escolha o Horário Disponível
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Horários livres calculados sem conflito para {selectedProf?.name} em{' '}
                  {format(parseISO(selectedDate), "dd 'de' MMMM", { locale: ptBR })}.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-1">
                {availableTimeSlots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 space-y-2">
                    <Clock className="w-8 h-8 mx-auto text-slate-600" />
                    <p className="text-sm font-semibold">Nenhum horário livre nesta data</p>
                    <p className="text-xs text-slate-500">
                      Por favor, volte e selecione outro dia.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {availableTimeSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot)}
                          className={`p-3 rounded-lg border font-mono text-xs font-bold text-center transition-all ${
                            isSelected
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md scale-105'
                              : 'bg-slate-950 border-slate-800 hover:border-emerald-700 text-slate-200'
                          }`}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-3 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(3)}
                  className="border-slate-700 text-slate-300 text-xs h-10"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  disabled={!selectedTimeSlot}
                  onClick={() => setCurrentStep(5)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-5"
                >
                  Continuar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 5: INFORMAR NOME E TELEFONE */}
          {currentStep === 5 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-400" />
                  Passo 5: Seus Dados de Contato
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Informe seus dados para confirmação do atendimento (sem necessidade de login).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 pt-1 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Seu Nome Completo *
                  </Label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Mariana Silva"
                    required
                    className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      Telefone / WhatsApp *
                    </Label>
                    <Input
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="(11) 99999-8888"
                      required
                      className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-mail (opcional)
                    </Label>
                    <Input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">
                    Observações adicionais (opcional)
                  </Label>
                  <Textarea
                    value={clientNotes}
                    onChange={(e) => setClientNotes(e.target.value)}
                    placeholder="Alguma restrição, preferência ou detalhe..."
                    className="bg-slate-950 border-slate-700 text-white text-xs h-18 resize-none"
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(4)}
                  className="border-slate-700 text-slate-300 text-xs h-10"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  disabled={!clientName.trim() || !clientPhone.trim()}
                  onClick={() => setCurrentStep(6)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-10 px-5"
                >
                  Revisar e Confirmar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 6: CONFIRMAR AGENDAMENTO */}
          {currentStep === 6 && (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-emerald-400" />
                  Passo 6: Confirmação do Agendamento
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Por favor revise todas as informações antes de finalizar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Estabelecimento:</span>
                    <span className="font-semibold text-white">{org.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Serviço:</span>
                    <span className="font-semibold text-emerald-400">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Profissional:</span>
                    <span className="font-semibold text-white">{selectedProf?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Data e Horário:</span>
                    <span className="font-bold text-white">
                      {format(parseISO(selectedDate), "EEEE, dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}{' '}
                      às {selectedTimeSlot}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">Cliente:</span>
                    <span className="font-semibold text-white">
                      {clientName} ({clientPhone})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valor Estimado:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      {formatCurrency(selectedService?.price || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(5)}
                  className="border-slate-700 text-slate-300 text-xs h-11"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  disabled={bookingInProgress}
                  onClick={handleConfirmBooking}
                  className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs h-11 px-6 shadow-lg shadow-emerald-600/30"
                >
                  {bookingInProgress ? 'Agendando...' : 'Confirmar Agendamento Agora'}
                  <CheckCircle2 className="w-4 h-4 ml-1.5" />
                </Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
export default AgendamentoPublico
