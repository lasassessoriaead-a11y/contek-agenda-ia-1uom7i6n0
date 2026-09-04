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
  const [signupProduct, setSignupProduct] = useState<'agyli' | 'markaly'>('agyli')
  const [loadingSignup, setLoadingSignup] = useState(false)

  // Manual Contek admin creation state
  const [manualOrgName, setManualOrgName] = useState('')
  const [manualSlug, setManualSlug] = useState('')
  const [manualAdminName, setManualAdminName] = useState('')
  const [manualAdminEmail, setManualAdminEmail] = useState('')
  const [manualAdminPassword, setManualAdminPassword] = useState('')
  const [manualProduct, setManualProduct] = useState<'agyli' | 'markaly'>('agyli')
  const [manualPlan, setManualPlan] = useState('agyli-pro')
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
      const res = await pb.send<{
        success: boolean
        message?: string
        error?: string
        organization?: { id: string; name: string; slug: string }
      }>('/backend/v1/onboarding/self-service', {
        method: 'POST',
        body: {
          org_name: signupOrgName.trim(),
          name: signupName.trim(),
          phone: signupPhone.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
          product: signupProduct,
        },
      })

      if (!res.success) {
        throw new Error(res.error || 'Erro ao cadastrar empresa.')
      }

      // Auto login
      await login(signupEmail.trim(), signupPassword)
      toast.success('Empresa e conta criadas com sucesso!')
      navigate('/')
    } catch (err: unknown) {
      console.error(err)
      const message =
        (err as { response?: { error?: string }; message?: string })?.response?.error ||
        (err as { message?: string })?.message ||
        'Erro ao cadastrar empresa. Verifique os dados informados.'
      toast.error(message)
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

    if (manualAdminPassword.length < 8) {
      toast.error('A senha provisória deve conter no mínimo 8 caracteres.')
      return
    }

    setLoadingManual(true)
    try {
      const res = await pb.send<{
        success: boolean
        message?: string
        error?: string
        organization?: { id: string; name: string; slug: string }
      }>('/backend/v1/onboarding/manual', {
        method: 'POST',
        body: {
          org_name: manualOrgName.trim(),
          slug: manualSlug.trim(),
          admin_name: manualAdminName.trim(),
          admin_email: manualAdminEmail.trim(),
          admin_password: manualAdminPassword,
          product: manualProduct,
          plan: manualPlan.trim() || (manualProduct === 'markaly' ? 'markaly-start' : 'agyli-pro'),
        },
      })

      if (!res.success) {
        throw new Error(res.error || 'Erro no cadastro manual.')
      }

      toast.success(res.message || `Empresa ${manualOrgName} cadastrada pela Contek com sucesso!`)
      // reset form
      setManualOrgName('')
      setManualSlug('')
      setManualAdminName('')
      setManualAdminEmail('')
      setManualAdminPassword('')
    } catch (err: unknown) {
      console.error(err)
      const message =
        (err as { response?: { error?: string }; message?: string })?.response?.error ||
        (err as { message?: string })?.message ||
        'Erro no cadastro manual. Verifique se o slug ou e-mail já existem.'
      toast.error(message)
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
                  {import.meta.env.DEV && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-lg flex items-center gap-3 text-xs text-emerald-300">
                      <ShieldCheck className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                      <div>
                        <p className="font-semibold">
                          Acesso de Demonstração (Ambiente Dev/Preview):
                        </p>
                        <p className="text-emerald-400/80">
                          E-mail: <b>luka2510@hotmail.com</b> | Senha: <b>Skip@Pass</b>
                        </p>
                      </div>
                    </div>
                  )}

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

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      Escolha a Solução / Produto Desejado *
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupProduct('agyli')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          signupProduct === 'agyli'
                            ? 'border-emerald-500 bg-emerald-950/50 text-white shadow-sm'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-xs font-bold text-emerald-400">AGYLI (Completo)</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Agenda + Financeiro + Assistente IA
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSignupProduct('markaly')}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          signupProduct === 'markaly'
                            ? 'border-sky-500 bg-sky-950/50 text-white shadow-sm'
                            : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-xs font-bold text-sky-400">MARKALY (Essencial)</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Agenda ágil + Clientes + Serviços
                        </p>
                      </button>
                    </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">
                        Produto Selecionado
                      </Label>
                      <select
                        value={manualProduct}
                        onChange={(e) => {
                          const val = e.target.value as 'agyli' | 'markaly'
                          setManualProduct(val)
                          setManualPlan(val === 'markaly' ? 'markaly-start' : 'agyli-pro')
                        }}
                        className="w-full h-10 px-3 rounded-md bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        <option value="agyli">AGYLI (Completo com Financeiro e IA)</option>
                        <option value="markaly">MARKALY (Essencial sem Financeiro/IA)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-300">Slug do Plano</Label>
                      <Input
                        value={manualPlan}
                        onChange={(e) => setManualPlan(e.target.value)}
                        placeholder="agyli-pro, markaly-start"
                        className="bg-slate-950 border-slate-700 text-white"
                      />
                    </div>
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
