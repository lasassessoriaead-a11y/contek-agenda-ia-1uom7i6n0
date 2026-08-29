import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sparkles,
  Calendar,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Mail,
  Building2,
  User,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  // Sign in state
  const [email, setEmail] = useState('luka2510@hotmail.com')
  const [password, setPassword] = useState('Skip@Pass')
  const [loadingLogin, setLoadingLogin] = useState(false)

  // Self-service signup state
  const [signupOrgName, setSignupOrgName] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [loadingSignup, setLoadingSignup] = useState(false)

  // Manual Contek admin creation state
  const [manualOrgName, setManualOrgName] = useState('')
  const [manualSlug, setManualSlug] = useState('')
  const [manualAdminName, setManualAdminName] = useState('')
  const [manualAdminEmail, setManualAdminEmail] = useState('')
  const [manualAdminPassword, setManualAdminPassword] = useState('')
  const [manualPlan, setManualPlan] = useState('pro_v1')
  const [loadingManual, setLoadingManual] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha seu e-mail e senha.')
      return
    }
    setLoadingLogin(true)
    try {
      await login(email, password)
      toast.success('Bem-vindo ao Contek Agenda IA!')
      navigate('/')
    } catch (err: unknown) {
      console.error(err)
      toast.error('E-mail ou senha incorretos. Verifique suas credenciais.')
    } finally {
      setLoadingLogin(false)
    }
  }

  const handleSelfServiceSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signupOrgName || !signupName || !signupEmail || !signupPassword) {
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    if (signupPassword.length < 8) {
      toast.error('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    setLoadingSignup(true)
    try {
      // 1. Create slug from org name
      const cleanSlug =
        signupOrgName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '') +
        '-' +
        Math.floor(1000 + Math.random() * 9000)

      // 2. Create organization
      const org = await pb.collection('organizations').create({
        name: signupOrgName.trim(),
        slug: cleanSlug,
        phone: signupPhone.trim(),
        whatsapp: signupPhone.trim(),
        email: signupEmail.trim(),
        status: 'active',
        plan_id: 'trial_v1',
      })

      // 3. Create business settings
      await pb.collection('business_settings').create({
        organization_id: org.id,
        business_name: signupOrgName.trim(),
        phone: signupPhone.trim(),
        whatsapp: signupPhone.trim(),
        opening_time: '08:00',
        closing_time: '19:00',
        working_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
        slot_interval_minutes: 30,
        buffer_between_appointments: 10,
        default_booking_message: `Olá! Seu agendamento foi confirmado com sucesso na ${signupOrgName}.`,
        whatsapp_enabled: true,
      })

      // 4. Create user linked to organization
      await pb.collection('users').create({
        email: signupEmail.trim(),
        password: signupPassword,
        passwordConfirm: signupPassword,
        name: signupName.trim(),
        phone: signupPhone.trim(),
        role: 'ADMINISTRADOR',
        organization_id: org.id,
      })

      // 5. Create default professional
      const prof = await pb.collection('professionals').create({
        organization_id: org.id,
        name: signupName.trim(),
        specialty: 'Especialista',
        phone: signupPhone.trim(),
        email: signupEmail.trim(),
        default_duration: 45,
        work_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
        work_hours: { start: '08:00', end: '19:00' },
        active: true,
      })

      // 6. Create a default service
      const serv = await pb.collection('services').create({
        organization_id: org.id,
        name: 'Atendimento Inicial / Consulta',
        description: 'Serviço padrão configurado automaticamente',
        duration: 45,
        price: 150,
        color: '#10b981',
        category: 'Geral',
        active: true,
      })

      // Link professional to service
      await pb.collection('professional_services').create({
        organization_id: org.id,
        professional_id: prof.id,
        service_id: serv.id,
      })

      // 7. Auto login
      await login(signupEmail.trim(), signupPassword)
      toast.success('Empresa e conta criadas com sucesso!')
      navigate('/')
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro ao cadastrar empresa. Este e-mail já pode estar em uso.')
    } finally {
      setLoadingSignup(false)
    }
  }

  const handleManualAdminCreation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualOrgName || !manualAdminName || !manualAdminEmail || !manualAdminPassword) {
      toast.error('Preencha todos os campos para cadastrar a empresa manualmente.')
      return
    }

    setLoadingManual(true)
    try {
      const slugVal =
        manualSlug.trim() ||
        manualOrgName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')

      const org = await pb.collection('organizations').create({
        name: manualOrgName.trim(),
        slug: slugVal,
        email: manualAdminEmail.trim(),
        status: 'active',
        plan_id: manualPlan,
      })

      await pb.collection('business_settings').create({
        organization_id: org.id,
        business_name: manualOrgName.trim(),
        opening_time: '08:00',
        closing_time: '19:00',
        working_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
        slot_interval_minutes: 30,
        buffer_between_appointments: 10,
        default_booking_message: `Olá! Seu agendamento foi confirmado na ${manualOrgName}.`,
        whatsapp_enabled: true,
      })

      await pb.collection('users').create({
        email: manualAdminEmail.trim(),
        password: manualAdminPassword,
        passwordConfirm: manualAdminPassword,
        name: manualAdminName.trim(),
        role: 'ADMINISTRADOR',
        organization_id: org.id,
      })

      toast.success(`Empresa ${manualOrgName} cadastrada pela Contek com sucesso!`)
      // reset form
      setManualOrgName('')
      setManualSlug('')
      setManualAdminName('')
      setManualAdminEmail('')
      setManualAdminPassword('')
    } catch (err: unknown) {
      console.error(err)
      toast.error('Erro no cadastro manual. Verifique se o slug ou e-mail já existem.')
    } finally {
      setLoadingManual(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 text-xs font-semibold mb-4 shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          Contek Tecnologia e Consultoria
        </div>
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Calendar className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contek Agenda IA</h1>
        </div>
        <p className="text-sm text-slate-400">
          SaaS multi-tenant profissional de gestão e agendamento inteligente para pequenos
          prestadores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl px-4 relative z-10">
        <Card className="border-slate-800 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-slate-100">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-4">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800/80 p-1 border border-slate-700/50">
                <TabsTrigger
                  value="login"
                  className="text-xs sm:text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="text-xs sm:text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  Criar Empresa (Self)
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className="text-xs sm:text-sm data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  Cadastro Contek (Admin)
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            {/* TAB 1: LOGIN */}
            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4 pt-2">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
                    <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <div>
                      <p className="font-semibold">Acesso de Demonstração Contek:</p>
                      <p className="text-emerald-400/80">
                        E-mail: <b>luka2510@hotmail.com</b> | Senha: <b>Skip@Pass</b>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="login-email"
                      className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      E-mail
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="login-password"
                      className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      Senha
                    </Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={loadingLogin}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-600/25 h-11"
                  >
                    {loadingLogin ? 'Entrando no sistema...' : 'Acessar Painel da Empresa'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>

                  <div className="text-center text-xs text-slate-400">
                    Quer ver a página pública de agendamento?{' '}
                    <Link
                      to="/agendar/contek-demo"
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      Ver /agendar/contek-demo
                    </Link>
                  </div>
                </CardFooter>
              </form>
            </TabsContent>

            {/* TAB 2: SELF-SERVICE SIGNUP */}
            <TabsContent value="signup">
              <form onSubmit={handleSelfServiceSignup}>
                <CardContent className="space-y-3.5 pt-2">
                  <CardDescription className="text-slate-400 text-xs">
                    Cadastre seu estabelecimento (clínica, salão, consultório, barbearia) e comece a
                    gerenciar hoje mesmo com isolamento total de dados.
                  </CardDescription>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                      Nome do Estabelecimento / Empresa *
                    </Label>
                    <Input
                      value={signupOrgName}
                      onChange={(e) => setSignupOrgName(e.target.value)}
                      placeholder="Ex: Clínica Bella Estética, Barbearia Silva..."
                      required
                      className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        Seu Nome Completo *
                      </Label>
                      <Input
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="Dra. Ana Paula"
                        required
                        className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        WhatsApp / Telefone
                      </Label>
                      <Input
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        placeholder="(11) 99999-8888"
                        className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        E-mail de Acesso *
                      </Label>
                      <Input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="contato@empresa.com"
                        required
                        className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Senha (mín. 8 caracteres) *
                      </Label>
                      <Input
                        type="password"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="bg-slate-950 border-slate-700 text-white focus-visible:ring-emerald-500"
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={loadingSignup}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-600/25 h-11"
                  >
                    {loadingSignup ? 'Criando sua conta SaaS...' : 'Cadastrar Empresa e Começar'}
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            {/* TAB 3: CONTEK ADMIN MANUAL ONBOARDING */}
            <TabsContent value="manual">
              <form onSubmit={handleManualAdminCreation}>
                <CardContent className="space-y-3.5 pt-2">
                  <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-emerald-400">
                      Fluxo Interno de Onboarding Contek:
                    </p>
                    <p className="text-slate-400">
                      Cadastre uma empresa e seu administrador diretamente quando o fechamento
                      comercial for realizado por consultores da Contek fora da plataforma.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        Nome da Empresa *
                      </Label>
                      <Input
                        value={manualOrgName}
                        onChange={(e) => setManualOrgName(e.target.value)}
                        placeholder="Ex: NutriLife Consultoria"
                        required
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        Slug da URL (opcional)
                      </Label>
                      <Input
                        value={manualSlug}
                        onChange={(e) => setManualSlug(e.target.value)}
                        placeholder="ex: nutrilife"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300">
                      Nome do Administrador *
                    </Label>
                    <Input
                      value={manualAdminName}
                      onChange={(e) => setManualAdminName(e.target.value)}
                      placeholder="Dr. Roberto Neves"
                      required
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        E-mail do Admin *
                      </Label>
                      <Input
                        type="email"
                        value={manualAdminEmail}
                        onChange={(e) => setManualAdminEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        required
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        Senha Provisória *
                      </Label>
                      <Input
                        type="password"
                        value={manualAdminPassword}
                        onChange={(e) => setManualAdminPassword(e.target.value)}
                        placeholder="mínimo 8 dígitos"
                        required
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300">
                      Plano Contratado (V1)
                    </Label>
                    <Input
                      value={manualPlan}
                      onChange={(e) => setManualPlan(e.target.value)}
                      placeholder="pro_v1, enterprise_v1"
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={loadingManual}
                    className="w-full bg-slate-100 hover:bg-white text-slate-900 font-semibold shadow-md h-11"
                  >
                    {loadingManual ? 'Cadastrando Empresa...' : 'Cadastrar Empresa Manualmente'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Contek Tecnologia e Consultoria. Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  )
}
export default Login
