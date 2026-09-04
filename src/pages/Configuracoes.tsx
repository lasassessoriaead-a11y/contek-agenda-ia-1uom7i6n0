import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Settings,
  Building,
  Phone,
  Mail,
  MapPin,
  Clock,
  Calendar,
  MessageSquare,
  Shield,
  Save,
  CreditCard,
  CheckCircle2,
  ExternalLink,
  Layers,
  Send,
  BellRing,
  CheckCircle,
  HelpCircle,
  RefreshCw,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'

const ALL_DAYS = [
  { id: 'seg', label: 'Segunda-feira' },
  { id: 'ter', label: 'Terça-feira' },
  { id: 'qua', label: 'Quarta-feira' },
  { id: 'qui', label: 'Quinta-feira' },
  { id: 'sex', label: 'Sexta-feira' },
  { id: 'sab', label: 'Sábado' },
  { id: 'dom', label: 'Domingo' },
]

export const Configuracoes: React.FC = () => {
  const { organization, settings, updateSettings, updateOrgProfile, user, isAdmin } = useAuth()

  // Org form
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [savingOrg, setSavingOrg] = useState(false)

  // Settings form
  const [openingTime, setOpeningTime] = useState('08:00')
  const [closingTime, setClosingTime] = useState('19:00')
  const [workingDays, setWorkingDays] = useState<string[]>([
    'seg',
    'ter',
    'qua',
    'qui',
    'sex',
    'sab',
  ])
  const [slotInterval, setSlotInterval] = useState(30)
  const [bufferBetween, setBufferBetween] = useState(10)
  const [defaultMessage, setDefaultMessage] = useState('')
  const [whatsappEnabled, setWhatsappEnabled] = useState(true)
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState('')
  const [whatsappWelcomeMessage, setWhatsappWelcomeMessage] = useState('')
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('')

  // Message Automation templates state
  const [autoRemindersEnabled, setAutoRemindersEnabled] = useState(true)
  const [templateConfirm, setTemplateConfirm] = useState(
    'Olá, {{nome_paciente}}! Aqui é da {{empresa}}. Lembramos que você tem um agendamento de {{servico}} com {{nome_profissional}} amanhã, dia {{data}} às {{hora}}.\n\nPor favor, confirme sua presença clicando no link: {{link_confirmacao}} ou responda 1 para confirmar.',
  )
  const [templateThanks, setTemplateThanks] = useState(
    'Muito obrigado por confirmar, {{nome_paciente}}! Seu agendamento na {{empresa}} para dia {{data}} às {{hora}} está confirmado. Estamos te esperando com carinho!',
  )
  const [templateReminder, setTemplateReminder] = useState(
    'Olá, {{nome_paciente}}! Passando para lembrar do seu atendimento de {{servico}} HOJE, às {{hora}}, na {{empresa}} com {{nome_profissional}}. Qualquer dúvida, estamos à disposição!',
  )

  const [savingSettings, setSavingSettings] = useState(false)

  // Upcoming scheduled messages queue (live preview)
  const [upcomingMessages, setUpcomingMessages] = useState<
    Array<{
      id: string
      date: string
      start_time: string
      client_name: string
      client_phone: string
      service_name: string
      professional_name: string
      type: string
      status: string
      notifications_sent: Record<string, string>
    }>
  >([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(false)

  // Meta Integration Status (secrets & webhook)
  const [metaStatus, setMetaStatus] = useState<{
    is_configured: boolean
    webhook_callback_url: string
    verify_token_configured: boolean
    has_access_token: boolean
    has_phone_number_id: boolean
    has_waba_id: boolean
    has_app_secret: boolean
    missing_secrets: string[]
    central_phone: string
    stats?: {
      total_sent: number
      pending_no_credentials: number
    }
  } | null>(null)
  const [loadingMetaStatus, setLoadingMetaStatus] = useState(false)

  useEffect(() => {
    const fetchMetaStatus = async () => {
      setLoadingMetaStatus(true)
      try {
        const res = await fetch(
          `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/whatsapp/status`,
          {
            headers: {
              Authorization: (await import('@/lib/pocketbase/client')).default.authStore.token,
            },
          },
        )
        if (res.ok) {
          const data = await res.json()
          setMetaStatus(data)
        }
      } catch (err) {
        console.error('Error fetching meta status:', err)
      } finally {
        setLoadingMetaStatus(false)
      }
    }

    fetchMetaStatus()
  }, [])

  useEffect(() => {
    if (organization) {
      setName(organization.name || '')
      setSlug(organization.slug || '')
      setPhone(organization.phone || '')
      setWhatsapp(organization.whatsapp || '')
      setEmail(organization.email || '')
      setAddress(organization.address || '')
    }
    if (settings) {
      setOpeningTime(settings.opening_time || '08:00')
      setClosingTime(settings.closing_time || '19:00')
      setWorkingDays(settings.working_days || ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      setSlotInterval(settings.slot_interval_minutes || 30)
      setBufferBetween(settings.buffer_between_appointments || 10)
      setDefaultMessage(settings.default_booking_message || '')
      setWhatsappEnabled(settings.whatsapp_enabled !== false)
      setWhatsappPhoneNumber(settings.whatsapp_phone_number || '')
      setWhatsappWelcomeMessage(settings.whatsapp_welcome_message || '')
      setWhatsappPhoneNumberId(settings.whatsapp_phone_number_id || '')
      setAutoRemindersEnabled(settings.auto_reminders_enabled !== false)
      if (settings.template_confirmation_request) {
        setTemplateConfirm(settings.template_confirmation_request)
      }
      if (settings.template_confirmation_thanks) {
        setTemplateThanks(settings.template_confirmation_thanks)
      }
      if (settings.template_day_reminder) {
        setTemplateReminder(settings.template_day_reminder)
      }
    }
  }, [organization, settings])

  // Load upcoming scheduled messages for the next 48 hours
  useEffect(() => {
    if (!organization?.id) return
    const fetchUpcomingQueue = async () => {
      setLoadingUpcoming(true)
      try {
        const pbClient = (await import('@/lib/pocketbase/client')).default
        const now = new Date()
        const todayStr = now.toISOString().slice(0, 10)
        const inTwoDays = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const appts = await pbClient.collection('appointments').getList(1, 20, {
          filter: `organization_id = "${organization.id}" && (status = "AGENDADO" || status = "CONFIRMADO") && date >= "${todayStr} 00:00:00.000Z" && date <= "${inTwoDays} 23:59:59.999Z"`,
          sort: 'date,start_time',
          expand: 'client_id,service_id,professional_id',
        })

        const mapped = appts.items.map((item) => {
          const rawDate = item.date ? item.date.slice(0, 10) : ''
          let isToday = rawDate === todayStr
          let typeTarget = isToday ? 'Lembrete no Dia (D-0)' : 'Pedido de Confirmação (D-1)'
          const sent = (item.notifications_sent as Record<string, string>) || {}

          return {
            id: item.id,
            date: rawDate,
            start_time: item.start_time,
            client_name: item.expand?.client_id?.name || item.client_name_snapshot || 'Cliente',
            client_phone: item.expand?.client_id?.phone || item.client_phone_snapshot || '',
            service_name: item.expand?.service_id?.name || 'Atendimento',
            professional_name: item.expand?.professional_id?.name || 'Profissional',
            type: typeTarget,
            status: item.status,
            notifications_sent: sent,
          }
        })

        setUpcomingMessages(mapped)
      } catch (err) {
        console.error('Error fetching upcoming messages queue:', err)
      } finally {
        setLoadingUpcoming(false)
      }
    }

    fetchUpcomingQueue()
  }, [organization?.id])

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingOrg(true)
    try {
      await updateOrgProfile({
        name: name.trim(),
        slug: slug.trim(),
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        address: address.trim(),
      })
      toast.success('Perfil da empresa atualizado com sucesso!')
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar dados da empresa. O slug deve ser único.')
    } finally {
      setSavingOrg(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await updateSettings({
        opening_time: openingTime,
        closing_time: closingTime,
        working_days: workingDays,
        slot_interval_minutes: Number(slotInterval),
        buffer_between_appointments: Number(bufferBetween),
        default_booking_message: defaultMessage.trim(),
        whatsapp_enabled: whatsappEnabled,
        whatsapp_phone_number: whatsappPhoneNumber.trim(),
        whatsapp_welcome_message: whatsappWelcomeMessage.trim(),
        whatsapp_phone_number_id: whatsappPhoneNumberId.trim(),
        auto_reminders_enabled: autoRemindersEnabled,
        template_confirmation_request: templateConfirm.trim(),
        template_confirmation_thanks: templateThanks.trim(),
        template_day_reminder: templateReminder.trim(),
      })
      toast.success('Configurações salvas com sucesso!')
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao salvar configurações.')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleDayToggle = (dayId: string) => {
    setWorkingDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId],
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-600" />
            Configurações da Empresa
          </h1>
          <p className="text-xs text-slate-500">
            Gerencie os dados cadastrais, horários de funcionamento, mensagens automáticas e regras
            multi-tenant.
          </p>
        </div>

        {slug && (
          <Button
            size="sm"
            variant="outline"
            asChild
            className="text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-9"
          >
            <Link to={`/agendar/${slug}`} target="_blank">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Ver Link Público (/agendar/{slug})
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList className="bg-slate-200/80 p-1">
          <TabsTrigger value="dados" className="text-xs">
            Dados da Empresa
          </TabsTrigger>
          <TabsTrigger value="horarios" className="text-xs">
            Horários & Intervalos
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs">
            WhatsApp & Mensagens
          </TabsTrigger>
          <TabsTrigger value="plano" className="text-xs">
            Plano & Multi-tenant
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DADOS DA EMPRESA */}
        <TabsContent value="dados">
          <Card className="border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSaveOrg}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Building className="w-4 h-4 text-emerald-600" />
                  Identificação do Estabelecimento
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Essas informações são visíveis aos seus clientes na página de agendamento online.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Nome da Empresa *
                    </Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Contek Estética & Saúde"
                      required
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Slug da Página Pública (/agendar/:slug) *
                    </Label>
                    <Input
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="contek-demo"
                      required
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">Telefone Fixo</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 3333-4444"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      WhatsApp Comercial
                    </Label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(11) 98765-4321"
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      E-mail de Contato
                    </Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@empresa.com"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">Endereço Completo</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Av. Paulista, 1000 - Sala 42 - São Paulo / SP"
                    className="text-xs"
                  />
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-slate-100 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingOrg}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingOrg ? 'Salvando...' : 'Salvar Dados da Empresa'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* TAB 2: HORÁRIOS & INTERVALOS */}
        <TabsContent value="horarios">
          <Card className="border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSaveSettings}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Horários de Atendimento e Intervalos
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Configure a grade de horários de abertura, fechamento e tempo de descanso entre
                  atendimentos.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Horário Geral de Abertura
                    </Label>
                    <Input
                      type="time"
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Horário Geral de Fechamento
                    </Label>
                    <Input
                      type="time"
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Intervalo de Grade / Slot (minutos)
                    </Label>
                    <Input
                      type="number"
                      value={slotInterval}
                      onChange={(e) => setSlotInterval(Number(e.target.value))}
                      placeholder="30"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-slate-400">Ex: 15, 30 ou 60 minutos</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Intervalo entre atendimentos (buffer em minutos)
                    </Label>
                    <Input
                      type="number"
                      value={bufferBetween}
                      onChange={(e) => setBufferBetween(Number(e.target.value))}
                      placeholder="10"
                      className="text-xs"
                    />
                    <p className="text-[11px] text-slate-400">
                      Tempo de higienização ou transição de sala
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Dias de Funcionamento da Empresa
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {ALL_DAYS.map((day) => (
                      <label
                        key={day.id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <Checkbox
                          checked={workingDays.includes(day.id)}
                          onCheckedChange={() => handleDayToggle(day.id)}
                        />
                        <span>{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 border-t border-slate-100 flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingSettings}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {savingSettings ? 'Salvando...' : 'Salvar Regras de Horário'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        {/* TAB 3: WHATSAPP & INTEGRAÇÃO META OFICIAL */}
        <TabsContent value="whatsapp">
          <div className="space-y-4">
            {/* Meta Cloud API Integration Diagnostic Panel */}
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-900 text-white pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      Integração Oficial Meta WhatsApp Business Platform
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-300">
                      Conexão 100% oficial via Cloud API da Meta. Sem risco de banimento de número.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-1 font-semibold ${
                      metaStatus?.is_configured
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    {metaStatus?.is_configured ? '● Meta Cloud Conectado' : 'Pronto para Conectar'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                {/* Status explanation */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Roteamento Inteligente V1:</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-emerald-100 text-emerald-800 font-mono"
                    >
                      Número Central + Deep Link por Slug
                    </Badge>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Na V1, o número central da Contek atende as mensagens. O cliente clica no botão
                    com o link{' '}
                    <code className="text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded font-mono">
                      wa.me/?text=...&ref={organization?.slug || 'slug'}
                    </code>
                    . O agente nativo Skip Cloud (
                    <code className="font-mono text-slate-800">contek-whatsapp-bot</code>)
                    identifica a sua empresa, apresenta os serviços e o link público oficial de
                    agendamento.
                  </p>
                </div>

                {/* Checklist of Meta Secrets */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-800 block">
                    Status das Credenciais Meta (Secrets do Backend)
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        key: 'META_WA_ACCESS_TOKEN',
                        label: 'Meta System User Access Token',
                        ok: metaStatus?.has_access_token,
                      },
                      {
                        key: 'META_WA_PHONE_NUMBER_ID',
                        label: 'Phone Number ID (WABA)',
                        ok: metaStatus?.has_phone_number_id,
                      },
                      {
                        key: 'META_WA_BUSINESS_ACCOUNT_ID',
                        label: 'WhatsApp Business Account ID (WABA)',
                        ok: metaStatus?.has_waba_id,
                      },
                      {
                        key: 'META_WA_APP_SECRET',
                        label: 'Meta App Secret',
                        ok: metaStatus?.has_app_secret,
                      },
                      {
                        key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
                        label: 'Webhook Verify Token',
                        ok: metaStatus?.verify_token_configured,
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 text-[11px]"
                      >
                        <div className="space-y-0.5">
                          <p className="font-medium text-slate-800">{item.label}</p>
                          <p className="font-mono text-[10px] text-slate-400">{item.key}</p>
                        </div>
                        {item.ok ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                            Configurado
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                          >
                            Pendente
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>

                  {metaStatus?.missing_secrets && metaStatus.missing_secrets.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px] space-y-1">
                      <p className="font-semibold">O que falta para ativar as mensagens reais:</p>
                      <p className="text-amber-800">
                        Adicionar as credenciais da Meta aos secrets da plataforma:{' '}
                        <b>{metaStatus.missing_secrets.join(', ')}</b>. Todo o código do webhook,
                        agente e envio já está implantado e pronto.
                      </p>
                    </div>
                  )}
                </div>

                {/* Webhook endpoint URL box */}
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    URL de Retorno do Webhook (para cadastrar no Painel Meta Developer)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={
                        metaStatus?.webhook_callback_url ||
                        `${window.location.origin}/backend/v1/whatsapp/webhook`
                      }
                      className="text-xs font-mono bg-slate-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url =
                          metaStatus?.webhook_callback_url ||
                          `${window.location.origin}/backend/v1/whatsapp/webhook`
                        navigator.clipboard.writeText(url)
                        toast.success('URL do webhook copiada!')
                      }}
                      className="text-xs text-slate-700 h-9"
                    >
                      Copiar
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    No Meta for Developers &gt; WhatsApp &gt; Configuração &gt; Webhook, insira esta
                    URL e o Verify Token correspondente.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Organization Specific WhatsApp Settings Form */}
            <Card className="border-slate-200 bg-white shadow-sm">
              <form onSubmit={handleSaveSettings}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600" />
                    Configurações do WhatsApp da Empresa ({organization?.name})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Personalize o número exibido, a saudação do bot e regras de atendimento.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 text-xs">
                  {/* Enable / Disable WhatsApp for this org */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                    <div>
                      <Label className="text-xs font-semibold text-slate-800 block">
                        Ativar Atendimento por WhatsApp para esta Empresa
                      </Label>
                      <span className="text-[11px] text-slate-500">
                        Exibe o botão de WhatsApp na página pública e permite que o bot responda por
                        este tenant.
                      </span>
                    </div>
                    <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        Número de WhatsApp Específico (opcional)
                      </Label>
                      <Input
                        value={whatsappPhoneNumber}
                        onChange={(e) => setWhatsappPhoneNumber(e.target.value)}
                        placeholder="Ex: 5511987654321"
                        className="text-xs font-mono"
                      />
                      <p className="text-[11px] text-slate-400">
                        Deixe em branco para usar o número central da Contek com roteamento
                        automático por slug.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700">
                        Phone Number ID Meta Específico (V2 multi-número)
                      </Label>
                      <Input
                        value={whatsappPhoneNumberId}
                        onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                        placeholder="Ex: 104589239847291"
                        className="text-xs font-mono"
                      />
                      <p className="text-[11px] text-slate-400">
                        Preencha apenas se sua empresa possuir seu próprio número registrado na
                        Cloud API da Meta.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Mensagem de Boas-Vindas Personalizada do Bot
                    </Label>
                    <Textarea
                      value={whatsappWelcomeMessage}
                      onChange={(e) => setWhatsappWelcomeMessage(e.target.value)}
                      placeholder="Olá! Que bom ter você aqui na Contek Estética & Saúde. Como posso te ajudar hoje?"
                      className="text-xs h-20 resize-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      O agente inteligente utilizará esta saudação personalizada ao iniciar a
                      conversa com seus clientes.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Mensagem Padrão de Comprovante de Agendamento
                    </Label>
                    <Textarea
                      value={defaultMessage}
                      onChange={(e) => setDefaultMessage(e.target.value)}
                      placeholder="Olá! Seu agendamento foi confirmado com sucesso. Estamos te aguardando!"
                      className="text-xs h-20 resize-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Enviada ou exibida na tela quando o agendamento for concluído com sucesso.
                    </p>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t border-slate-100 flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingSettings}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingSettings ? 'Salvando...' : 'Salvar Configurações de WhatsApp'}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* SEÇÃO NOBRE: AUTOMAÇÃO DE MENSAGENS (3 TEMPLATES + CRON + FILA) */}
            <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
              <form onSubmit={handleSaveSettings}>
                <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                        <BellRing className="w-4 h-4 text-emerald-600" />
                        Automação de Mensagens de Agendamento
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Disparo programado de confirmação 1 dia antes, agradecimento imediato e
                        lembrete no dia.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="toggle-auto" className="text-xs font-semibold text-slate-700">
                        Automação Geral
                      </Label>
                      <Switch
                        id="toggle-auto"
                        checked={autoRemindersEnabled}
                        onCheckedChange={setAutoRemindersEnabled}
                      />
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6 pt-5 text-xs">
                  {/* Explanatory badge & variables guide */}
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Variáveis Dinâmicas Disponíveis nos Templates:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[
                        '{{nome_paciente}}',
                        '{{nome_profissional}}',
                        '{{servico}}',
                        '{{data}}',
                        '{{hora}}',
                        '{{empresa}}',
                        '{{link_confirmacao}}',
                      ].map((v) => (
                        <code
                          key={v}
                          className="px-2 py-0.5 rounded text-[11px] bg-white text-emerald-800 border border-emerald-200 font-mono"
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      O sistema substitui essas variáveis pelos dados reais de cada paciente e
                      atendimento automaticamente.
                    </p>
                  </div>

                  {/* 3 TEMPLATES GRID */}
                  <div className="space-y-4">
                    {/* TEMPLATE 1: UM DIA ANTES */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[10px] font-mono">
                            1
                          </span>
                          Mensagem de Confirmação (1 dia antes do atendimento - D-1)
                        </Label>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Disparo D-1
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Enviada automaticamente na véspera para pedir a confirmação da presença do
                        paciente.
                      </p>
                      <Textarea
                        value={templateConfirm}
                        onChange={(e) => setTemplateConfirm(e.target.value)}
                        placeholder="Template de confirmação..."
                        className="text-xs font-mono h-24 resize-none leading-relaxed"
                      />
                    </div>

                    {/* TEMPLATE 2: AGRADECIMENTO PÓS-CONFIRMAÇÃO */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-mono">
                            2
                          </span>
                          Mensagem de Agradecimento (Após o paciente confirmar)
                        </Label>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                        >
                          Resposta Imediata
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Disparada assim que o paciente clica no link ou responde "1 / Sim" no
                        WhatsApp.
                      </p>
                      <Textarea
                        value={templateThanks}
                        onChange={(e) => setTemplateThanks(e.target.value)}
                        placeholder="Template de agradecimento..."
                        className="text-xs font-mono h-24 resize-none leading-relaxed"
                      />
                    </div>

                    {/* TEMPLATE 3: LEMBRETE NO MESMO DIA */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-mono">
                            3
                          </span>
                          Mensagem de Lembrete (No mesmo dia do atendimento - D-0)
                        </Label>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Disparo D-0
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Disparada no dia agendado para reforçar o horário e orientações de chegada.
                      </p>
                      <Textarea
                        value={templateReminder}
                        onChange={(e) => setTemplateReminder(e.target.value)}
                        placeholder="Template de lembrete no dia..."
                        className="text-xs font-mono h-24 resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* EXECUÇÃO & FILA DE PRÓXIMAS MENSAGENS PROGRAMADAS */}
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-bold text-slate-900 block">
                          Fila de Próximas Mensagens Programadas (Próximas 48 horas)
                        </Label>
                        <p className="text-[11px] text-slate-500">
                          Varredura automática por cron job do Skip Cloud rodando a cada 15 minutos.
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-[11px] font-mono">
                        {upcomingMessages.length} agendamento(s) no radar
                      </Badge>
                    </div>

                    {loadingUpcoming ? (
                      <div className="p-6 text-center text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-600" />
                        <span className="text-xs">Carregando fila de disparos...</span>
                      </div>
                    ) : upcomingMessages.length === 0 ? (
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-center text-xs">
                        Nenhum agendamento agendado ou confirmado para as próximas 48 horas nesta
                        empresa.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                        {upcomingMessages.map((m) => {
                          const hasSentReq = Boolean(m.notifications_sent['CONFIRMATION_REQUEST'])
                          const hasSentThanks = Boolean(m.notifications_sent['CONFIRMATION_THANKS'])
                          const hasSentRem = Boolean(m.notifications_sent['DAY_REMINDER'])

                          return (
                            <div
                              key={m.id}
                              className="p-3 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {m.client_name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      m.status === 'CONFIRMADO'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}
                                  >
                                    {m.status}
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                  {m.service_name} com {m.professional_name} •{' '}
                                  <span className="font-mono text-slate-700 font-semibold">
                                    {m.date} às {m.start_time}
                                  </span>
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500 font-medium">
                                  {m.type}:
                                </span>
                                {hasSentReq || hasSentRem ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                    ✓ Disparado
                                  </Badge>
                                ) : metaStatus?.is_configured ? (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                    Programado
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                  >
                                    Fila (Aguardando Meta)
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t border-slate-200 flex justify-end bg-slate-50">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={savingSettings}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {savingSettings ? 'Salvando...' : 'Salvar Templates e Regras de Mensagem'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: PLANO & MULTI-TENANT */}
        <TabsContent value="plano">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                Isolamento Multi-tenant & Status do Plano
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Informações de infraestrutura e permissões de acesso do usuário.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[11px]">Organização ID</span>
                  <p className="font-mono font-bold text-slate-900 truncate">{organization?.id}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[11px]">Status da Assinatura</span>
                  <div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                      {organization?.status?.toUpperCase() || 'ATIVO'}
                    </Badge>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 text-[11px]">Plano V1 (Arquitetura)</span>
                  <p className="font-semibold text-slate-900">
                    {organization?.plan_id || 'Pro V1 Beta'} (Sem cobrança online V1)
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-900 text-slate-200 rounded-xl space-y-1.5 text-xs">
                <p className="font-semibold text-emerald-400">Regras de Acesso Multi-tenant:</p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Todas as consultas a clientes, agendamentos, serviços e finanças são estritamente
                  filtradas por <code className="text-emerald-300 font-mono">organization_id</code>{' '}
                  no backend PocketBase. Uma empresa jamais tem acesso aos dados de outra empresa.
                </p>
                <div className="pt-1 flex items-center gap-2 text-[11px] text-slate-400">
                  <span>
                    Perfil logado: <b>{user?.role || 'ADMINISTRADOR'}</b>
                  </span>
                  <span>•</span>
                  <span>
                    E-mail: <b>{user?.email}</b>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
export default Configuracoes
