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
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Building2,
  User,
  KeyRound,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { AgyliLogo, AgyliEmblem } from '@/components/AgyliBranding'
import { MarkalyLogo, MarkalyEmblem } from '@/components/MarkalyBranding'
import { resolveProductByDomain } from '@/lib/branding'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  // Detect initial product preference from domain or default to agyli
  const initialDetectedProduct =
    typeof window !== 'undefined'
      ? resolveProductByDomain(window.location.hostname, 'agyli')
      : 'agyli'

  const [activeBrand, setActiveBrand] = useState<'agyli' | 'markaly'>(initialDetectedProduct)

  // Sign in state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [loadingForgot, setLoadingForgot] = useState(false)
  const [forgotSuccessEmail, setForgotSuccessEmail] = useState<string | null>(null)
  const [forgotErrorMessage, setForgotErrorMessage] = useState<string | null>(null)

  // Self-service signup state
  const [signupOrgName, setSignupOrgName] = useState('')
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupProduct, setSignupProduct] = useState<'agyli' | 'markaly'>(initialDetectedProduct)
  const [loadingSignup, setLoadingSignup] = useState(false)

  // Manual Contek admin creation state
  const [manualOrgName, setManualOrgName] = useState('')
  const [manualSlug, setManualSlug] = useState('')
  const [manualAdminName, setManualAdminName] = useState('')
  const [manualAdminEmail, setManualAdminEmail] = useState('')
  const [manualAdminPassword, setManualAdminPassword] = useState('')
  const [manualProduct, setManualProduct] = useState<'agyli' | 'markaly'>(initialDetectedProduct)
  const [manualPlan, setManualPlan] = useState(
    initialDetectedProduct === 'markaly' ? 'markaly-start' : 'agyli-pro',
  )
  const [loadingManual, setLoadingManual] = useState(false)

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetEmail = forgotEmail.trim()
    if (!targetEmail) {
      toast.error('Informe o e-mail da sua conta.')
      return
    }

    setLoadingForgot(true)
    setForgotErrorMessage(null)

    try {
      await pb.collection('users').requestPasswordReset(targetEmail)
      setForgotSuccessEmail(targetEmail)
      toast.success('Solicitação de redefinição de senha enviada!')
    } catch (err: unknown) {
      console.error('Password reset error:', err)
      // Tratamento amigável e defensivo
      // PocketBase retorna status 400 ou 404 para e-mail inexistente/inválido ou 500 se o servidor de e-mail falhar
      const status = (err as { status?: number; response?: { message?: string } })?.status
      const msg = (err as { message?: string })?.message || ''

      if (
        status === 404 ||
        status === 400 ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('user')
      ) {
        setForgotErrorMessage(
          'Não encontramos nenhuma conta com este e-mail. Verifique o endereço digitado.',
        )
        toast.error('E-mail não encontrado.')
      } else {
        setForgotErrorMessage(
          'Não foi possível enviar o e-mail de redefinição no momento (servidor de e-mails em manutenção ou não configurado). Por favor, entre em contato com o suporte da Contek para redefinir sua senha.',
        )
        toast.error('Falha no envio do e-mail de redefinição.')
      }
    } finally {
      setLoadingForgot(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Preencha seu e-mail e senha.')
      return
    }
    setLoadingLogin(true)
    try {
      await login(email, password)
      toast.success(
        activeBrand === 'markaly' ? 'Bem-vindo ao MARKALY!' : 'Bem-vindo ao AGYLI Agenda IA!',
      )
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
      // Limpa qualquer vestígio de sessão ou org ativa anterior
      if (typeof window !== 'undefined') {
        localStorage.removeItem('contek_active_org_id')
      }
      pb.authStore.clear()

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

      // Auto login na conta recém criada
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
    <div
      className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-['Poppins',sans-serif] transition-colors duration-300 ${
        activeBrand === 'markaly' ? 'bg-[#F8FAFC] text-[#3B0764]' : 'bg-[#0F172A] text-slate-100'
      }`}
    >
      {/* Background glow effects fieis a cada produto */}
      {activeBrand === 'markaly' ? (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#3B82F6]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Seletor Rápido de Marca no Topo do Login (permite alternar e testar ambas perfeitamente) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 flex justify-center mb-4">
        <div
          className={`inline-flex items-center gap-1 p-1 rounded-full border shadow-sm text-xs font-semibold ${
            activeBrand === 'markaly'
              ? 'bg-white border-purple-200 text-[#3B0764]'
              : 'bg-[#1E293B] border-slate-700 text-slate-300'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveBrand('agyli')
              setSignupProduct('agyli')
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
              activeBrand === 'agyli'
                ? 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <AgyliEmblem size={14} />
            <span>AGYLI</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveBrand('markaly')
              setSignupProduct('markaly')
            }}
            className={`px-3 py-1 rounded-full flex items-center gap-1.5 transition-all ${
              activeBrand === 'markaly'
                ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MarkalyEmblem size={14} />
            <span>MARKALY</span>
          </button>
        </div>
      </div>

      {/* Cabeçalho Oficial Conforme Marca Selecionada */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 flex flex-col items-center text-center px-4">
        {activeBrand === 'markaly' ? (
          <>
            {/* Badge Institucional MARKALY */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3E2] border border-orange-200 text-[#3B0764] text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Organização que impulsiona seu negócio</span>
            </div>

            {/* Logo Oficial Completa MARKALY em fundo claro conforme manual */}
            <div className="flex items-center justify-center p-4 rounded-2xl bg-white border border-purple-100 shadow-xl mb-3">
              <MarkalyLogo height={48} theme="light" showSlogan={true} showSignature={true} />
            </div>

            <p className="text-xs text-slate-600 max-w-sm mt-1">
              A MARKALY é a solução completa para gestão de agendamentos, clientes e serviços, com
              praticidade, controle e resultados reais.
            </p>
          </>
        ) : (
          <>
            {/* Badge Institucional AGYLI */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E293B]/90 border border-blue-500/30 text-blue-300 text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Plataforma Inteligente de Gestão</span>
            </div>

            {/* Logo Oficial Completa AGYLI */}
            <div className="flex items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl mb-3">
              <AgyliLogo height={48} theme="dark" showSlogan={true} showSignature={true} />
            </div>

            <p className="text-xs text-slate-300 max-w-sm mt-1">
              Mais tempo para o que realmente importa. Gestão simplificada para clínicas,
              consultórios, salões e profissionais.
            </p>
          </>
        )}
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl px-4 relative z-10">
        <Card
          className={`shadow-2xl rounded-2xl transition-all ${
            activeBrand === 'markaly'
              ? 'border-purple-100 bg-white text-[#3B0764]'
              : 'border-slate-800 bg-[#1E293B]/95 text-slate-100'
          }`}
        >
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-3 pt-5">
              <TabsList
                className={`grid w-full grid-cols-3 p-1 rounded-xl border ${
                  activeBrand === 'markaly'
                    ? 'bg-[#FEF3E2]/60 border-purple-100 text-slate-600'
                    : 'bg-[#0F172A]/80 border-slate-700/60 text-slate-300'
                }`}
              >
                <TabsTrigger
                  value="login"
                  className={`text-xs sm:text-sm font-medium rounded-lg ${
                    activeBrand === 'markaly'
                      ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:via-[#EC4899] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-md'
                      : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#8B5CF6] data-[state=active]:text-white data-[state=active]:shadow-md'
                  }`}
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className={`text-xs sm:text-sm font-medium rounded-lg ${
                    activeBrand === 'markaly'
                      ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:via-[#EC4899] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-md'
                      : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#8B5CF6] data-[state=active]:text-white data-[state=active]:shadow-md'
                  }`}
                >
                  Criar Empresa
                </TabsTrigger>
                <TabsTrigger
                  value="manual"
                  className={`text-xs sm:text-sm font-medium rounded-lg ${
                    activeBrand === 'markaly'
                      ? 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#F97316] data-[state=active]:via-[#EC4899] data-[state=active]:to-[#7C3AED] data-[state=active]:text-white data-[state=active]:shadow-md'
                      : 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#3B82F6] data-[state=active]:to-[#8B5CF6] data-[state=active]:text-white data-[state=active]:shadow-md'
                  }`}
                >
                  Cadastro Contek
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            {/* TAB 1: LOGIN */}
            <TabsContent value="login">
              {showForgotPassword ? (
                /* Sub-fluxo: Recuperação de Senha */
                <form onSubmit={handleForgotPassword}>
                  <CardContent className="space-y-4 pt-1">
                    <div className="text-center pb-1">
                      <div
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-full mb-2 ${
                          activeBrand === 'markaly'
                            ? 'bg-[#FEF3E2] text-[#F97316]'
                            : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
                        }`}
                      >
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <h2
                        className={`text-lg font-bold tracking-tight ${
                          activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-white'
                        }`}
                      >
                        Recuperar Senha
                      </h2>
                      <p
                        className={`text-xs mt-1 ${
                          activeBrand === 'markaly' ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Informe seu e-mail cadastrado para enviarmos as instruções de redefinição
                      </p>
                    </div>

                    {forgotSuccessEmail ? (
                      <div
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          activeBrand === 'markaly'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-sm">E-mail enviado com sucesso!</p>
                            <p className="mt-1 text-xs">
                              Enviamos um link de redefinição para o seu e-mail{' '}
                              <b className="underline font-semibold">{forgotSuccessEmail}</b>.
                            </p>
                            <p className="mt-1 text-[11px] opacity-90">
                              Verifique sua caixa de entrada e a pasta de spam. Siga as instruções
                              do link recebido para cadastrar sua nova senha.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {forgotErrorMessage && (
                          <div
                            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                              activeBrand === 'markaly'
                                ? 'bg-amber-50 border-amber-200 text-amber-900'
                                : 'bg-amber-950/40 border-amber-800/50 text-amber-200'
                            }`}
                          >
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="leading-relaxed">{forgotErrorMessage}</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label
                            htmlFor="forgot-email"
                            className={`text-xs font-medium flex items-center gap-1.5 ${
                              activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-slate-300'
                            }`}
                          >
                            <Mail
                              className={`w-3.5 h-3.5 ${
                                activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-blue-400'
                              }`}
                            />
                            E-mail da sua conta
                          </Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            autoFocus
                            className={`rounded-xl h-11 ${
                              activeBrand === 'markaly'
                                ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 focus-visible:ring-[#F97316]'
                                : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                            }`}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-3 pt-2">
                    {!forgotSuccessEmail ? (
                      <Button
                        type="submit"
                        disabled={loadingForgot}
                        className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl transition-all ${
                          activeBrand === 'markaly'
                            ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/20'
                            : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                        }`}
                      >
                        {loadingForgot ? 'Enviando solicitação...' : 'Enviar link de redefinição'}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => {
                          setForgotSuccessEmail(null)
                          setForgotErrorMessage(null)
                          setShowForgotPassword(false)
                        }}
                        className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl transition-all ${
                          activeBrand === 'markaly'
                            ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/20'
                            : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                        }`}
                      >
                        Voltar para o login
                        <ArrowLeft className="w-4 h-4 ml-2" />
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(false)
                        setForgotErrorMessage(null)
                        setForgotSuccessEmail(null)
                      }}
                      className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1 transition-colors hover:underline ${
                        activeBrand === 'markaly'
                          ? 'text-[#3B0764] hover:text-[#F97316]'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Voltar para tela de acesso</span>
                    </button>
                  </CardFooter>
                </form>
              ) : (
                /* Formulário Normal de Login */
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4 pt-1">
                    <div className="text-center pb-1">
                      <h2
                        className={`text-lg font-bold tracking-tight ${
                          activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-white'
                        }`}
                      >
                        Bem-vindo(a)
                      </h2>
                      <p
                        className={`text-xs ${
                          activeBrand === 'markaly' ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Acesse sua conta para continuar
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="login-email"
                        className={`text-xs font-medium flex items-center gap-1.5 ${
                          activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-slate-300'
                        }`}
                      >
                        <Mail
                          className={`w-3.5 h-3.5 ${
                            activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-blue-400'
                          }`}
                        />
                        E-mail
                      </Label>
                      <Input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        required
                        className={`rounded-xl h-11 ${
                          activeBrand === 'markaly'
                            ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 focus-visible:ring-[#F97316]'
                            : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                        }`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="login-password"
                          className={`text-xs font-medium flex items-center gap-1.5 ${
                            activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-slate-300'
                          }`}
                        >
                          <Lock
                            className={`w-3.5 h-3.5 ${
                              activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-blue-400'
                            }`}
                          />
                          Senha
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(email || '')
                            setForgotErrorMessage(null)
                            setForgotSuccessEmail(null)
                            setShowForgotPassword(true)
                          }}
                          className={`text-xs font-medium transition-colors hover:underline ${
                            activeBrand === 'markaly'
                              ? 'text-[#F97316] hover:text-[#EA580C]'
                              : 'text-blue-400 hover:text-blue-300'
                          }`}
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className={`rounded-xl h-11 ${
                          activeBrand === 'markaly'
                            ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 focus-visible:ring-[#F97316]'
                            : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                        }`}
                      />
                    </div>
                  </CardContent>

                  <CardFooter className="flex flex-col gap-3 pt-2">
                    <Button
                      type="submit"
                      disabled={loadingLogin}
                      className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl transition-all ${
                        activeBrand === 'markaly'
                          ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/20'
                          : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                      }`}
                    >
                      {loadingLogin
                        ? 'Entrando no sistema...'
                        : activeBrand === 'markaly'
                          ? 'Entrar no MARKALY'
                          : 'Entrar no AGYLI'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>

                    <div
                      className={`text-center text-xs pt-1 ${
                        activeBrand === 'markaly' ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Quer ver a página pública de agendamento?{' '}
                      <Link
                        to="/agendar/contek-demo"
                        className={`hover:underline font-medium ${
                          activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-[#3B82F6]'
                        }`}
                      >
                        Ver /agendar/contek-demo
                      </Link>
                    </div>
                  </CardFooter>
                </form>
              )}
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
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      Nome do Estabelecimento / Empresa *
                    </Label>
                    <Input
                      value={signupOrgName}
                      onChange={(e) => setSignupOrgName(e.target.value)}
                      placeholder="Ex: Clínica Bella Estética, Barbearia Silva..."
                      required
                      className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      Escolha a Solução / Produto Desejado *
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSignupProduct('agyli')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          signupProduct === 'agyli'
                            ? 'border-[#3B82F6] bg-blue-950/60 text-white shadow-sm'
                            : 'border-slate-800 bg-[#0F172A]/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-xs font-bold text-[#3B82F6]">AGYLI (Completo)</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Agenda + Financeiro + Assistente IA
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSignupProduct('markaly')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          signupProduct === 'markaly'
                            ? 'border-[#F97316] bg-orange-950/40 text-white shadow-sm'
                            : activeBrand === 'markaly'
                              ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                              : 'border-slate-800 bg-[#0F172A]/60 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <p className="text-xs font-bold text-[#F97316]">MARKALY (Essencial)</p>
                        <p className="text-[10px] opacity-80 mt-0.5">
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
                        className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
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
                        className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
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
                        className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
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
                        className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={loadingSignup}
                    className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl ${
                      signupProduct === 'markaly' || activeBrand === 'markaly'
                        ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/25'
                        : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                    }`}
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
                  <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-slate-300 space-y-1">
                    <p className="font-semibold text-blue-400">
                      Fluxo Interno de Onboarding Contek:
                    </p>
                    <p className="text-slate-400">
                      Cadastre uma empresa e seu administrador diretamente quando o fechamento
                      comercial for realizado pelos consultores da Contek.
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

        <div className="mt-6 text-center space-y-1">
          {activeBrand === 'markaly' ? (
            <>
              <p className="text-xs text-slate-600 font-medium">
                MARKALY • Organizar hoje, crescer sempre.
              </p>
              <p className="text-[11px] text-slate-500">
                Uma solução{' '}
                <span className="text-[#3B0764] font-semibold">
                  Contek Tecnologia e Consultoria
                </span>
                . Todos os direitos reservados.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 font-medium">AGYLI • Agendar ficou simples.</p>
              <p className="text-[11px] text-slate-500">
                Uma solução{' '}
                <span className="text-blue-400 font-medium">Contek Tecnologia e Consultoria</span>.
                Todos os direitos reservados.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
export default Login
