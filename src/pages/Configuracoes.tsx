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
  const [savingSettings, setSavingSettings] = useState(false)

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
    }
  }, [organization, settings])

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
      })
      toast.success('Configurações de agendamento salvas com sucesso!')
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

        {/* TAB 3: WHATSAPP & MENSAGENS */}
        <TabsContent value="whatsapp">
          <Card className="border-slate-200 bg-white shadow-sm">
            <form onSubmit={handleSaveSettings}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  WhatsApp & Notificações (Arquitetura Preparada)
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Estrutura preparada para envio de mensagens automáticas de confirmação, lembrete e
                  pós-atendimento.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Arquitetura pronta para integração de API Oficial do WhatsApp
                  </p>
                  <p className="text-emerald-800 text-[11px]">
                    Na V1, o sistema formata e salva os templates de mensagens com isolamento por
                    organização para conexão com provedor homologado.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Mensagem Padrão de Confirmação de Agendamento
                  </Label>
                  <Textarea
                    value={defaultMessage}
                    onChange={(e) => setDefaultMessage(e.target.value)}
                    placeholder="Olá! Seu agendamento foi confirmado na nossa clínica..."
                    className="text-xs h-24 resize-none"
                  />
                  <p className="text-[11px] text-slate-400">
                    Exibida no comprovante de agendamento online e pronta para envio automático.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 block">
                      Habilitar Notificações WhatsApp
                    </Label>
                    <span className="text-[11px] text-slate-400">
                      Disparar lembretes automáticos para clientes
                    </span>
                  </div>
                  <Switch checked={whatsappEnabled} onCheckedChange={setWhatsappEnabled} />
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
                  Salvar Configuração de Mensagem
                </Button>
              </CardFooter>
            </form>
          </Card>
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
