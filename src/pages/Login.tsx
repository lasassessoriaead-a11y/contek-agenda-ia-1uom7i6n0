import React, { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
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
  Phone,
  Check,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Globe,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { AgyliLogo } from '@/components/AgyliBranding'
import { MarkalyLogo } from '@/components/MarkalyBranding'
import { ContekSymbol, ContekFullLogo } from '@/components/ContekBranding'

import { resolveProductByDomain, resolveBrandDomainContext } from '@/lib/branding'

export const Login: React.FC = () => {
  const { user, isSuperAdmin, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const brandParam = searchParams.get('brand')?.toLowerCase()
  const orgParam = searchParams.get('org')?.trim()
  const emailParam = searchParams.get('email')?.trim()
  const planParam = searchParams.get('plan')?.toLowerCase()

  // Se o link contiver parâmetros de credenciais/marca/e-mail de ativação (ex: vindos de e-mail),
  // NUNCA pular direto para dentro: força a exibição da tela de login da marca certa.
  // Somente se for acesso direto à rota /login sem nenhum desses parâmetros é que redireciona o usuário já logado.
  const hasCredentialParams = Boolean(brandParam || orgParam || emailParam)

  useEffect(() => {
    if (user && !hasCredentialParams) {
      if (isSuperAdmin) {
        navigate('/contek', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    }
  }, [user, isSuperAdmin, navigate, hasCredentialParams])

  // Detecta o contexto de domínio da aplicação: 'agyli' (agyli.com.br), 'contek' (grupocontek.com.br), ou 'default'
  const domainContext =
    typeof window !== 'undefined' ? resolveBrandDomainContext(window.location.hostname) : 'default'

  // Detect initial product preference from query param, then domain, or fallback to agyli
  const initialDetectedProduct =
    brandParam === 'markaly' || brandParam === 'agyli'
      ? (brandParam as 'agyli' | 'markaly')
      : domainContext === 'agyli'
        ? 'agyli'
        : typeof window !== 'undefined'
          ? resolveProductByDomain(window.location.hostname, 'agyli')
          : 'agyli'

  const tabParam = searchParams.get('tab')?.toLowerCase()
  // A aba 'manual' (Cadastro Contek) só é ativada se for explicitamente solicitada via URL (?tab=contek ou ?tab=manual)
  const isContekTabRequested = tabParam === 'contek' || tabParam === 'manual'
  const initialTab =
    tabParam === 'signup' || tabParam === 'criar-empresa' || tabParam === 'cadastro'
      ? 'signup'
      : isContekTabRequested
        ? 'manual'
        : 'login'

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'manual'>(initialTab)

  useEffect(() => {
    if (tabParam === 'signup' || tabParam === 'criar-empresa' || tabParam === 'cadastro') {
      setActiveTab('signup')
    } else if (tabParam === 'manual' || tabParam === 'contek') {
      setActiveTab('manual')
    } else if (tabParam === 'login') {
      setActiveTab('login')
    }
  }, [tabParam])

  const [activeBrand, setActiveBrand] = useState<'agyli' | 'markaly'>(initialDetectedProduct)

  // Resolve brand via org slug query param if brand is not explicitly given in URL
  useEffect(() => {
    if (brandParam === 'markaly') {
      setActiveBrand('markaly')
      return
    }
    if (brandParam === 'agyli') {
      setActiveBrand('agyli')
      return
    }

    if (orgParam) {
      let isCancelled = false
      const fetchOrgProduct = async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/public-booking-data?slug=${encodeURIComponent(orgParam)}`,
          )
          if (!res.ok) return
          const data = await res.json()
          if (!isCancelled && data?.organization?.product) {
            const orgProd = data.organization.product === 'markaly' ? 'markaly' : 'agyli'
            setActiveBrand(orgProd)
          }
        } catch (_) {
          // ignore error and maintain current brand
        }
      }
      fetchOrgProduct()
      return () => {
        isCancelled = true
      }
    }
  }, [brandParam, orgParam])

  // Sign in state (estritamente vazio, sem valores padrão, sem demo e sem resíduos)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loadingLogin, setLoadingLogin] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [loadingForgot, setLoadingForgot] = useState(false)
  const [forgotSuccessEmail, setForgotSuccessEmail] = useState<string | null>(null)
  const [forgotErrorMessage, setForgotErrorMessage] = useState<string | null>(null)

  // Self-service signup state (etapas 1, 2, 3)
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1)
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupPhone, setSignupPhone] = useState('')

  const [signupOrgName, setSignupOrgName] = useState('')
  const [signupSlug, setSignupSlug] = useState('')
  const [isSlugEditedManually, setIsSlugEditedManually] = useState(false)
  const [signupProduct, setSignupProduct] = useState<'agyli' | 'markaly'>('agyli')
  const [signupPlanSlug, setSignupPlanSlug] = useState<string>(
    planParam === 'agyli-essencial' ? 'agyli-essencial' : 'agyli-pro',
  )
  const [signupCreateExampleService, setSignupCreateExampleService] = useState(true)
  const [loadingSignup, setLoadingSignup] = useState(false)
  const [signupSuccessData, setSignupSuccessData] = useState<{
    orgName: string
    slug: string
    planName: string
    product: 'agyli' | 'markaly'
    email: string
  } | null>(null)

  // Pre-fill email from query param if provided (prevents browser autofill from inserting wrong admin email)
  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [emailParam])

  // Manual Contek admin creation state
  const [manualOrgName, setManualOrgName] = useState('')
  const [manualSlug, setManualSlug] = useState('')
  const [manualAdminName, setManualAdminName] = useState('')
  const [manualAdminEmail, setManualAdminEmail] = useState('')
  const [manualAdminPassword, setManualAdminPassword] = useState('')
  const [manualProduct, setManualProduct] = useState<'agyli' | 'markaly'>('agyli')
  const [manualPlan, setManualPlan] = useState(
    planParam === 'agyli-essencial' ? 'agyli-essencial' : 'agyli-pro',
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
      const loggedUser = await login(email, password)
      toast.success(
        activeBrand === 'markaly' ? 'Bem-vindo ao MARKALY!' : 'Bem-vindo ao AGYLI Agenda IA!',
      )
      // Se o usuário for SuperAdmin, redirecionar para a Central Contek (/contek)
      const isSuper = Boolean(loggedUser?.is_super_admin || loggedUser?.role === 'SUPERADMIN')
      if (isSuper) {
        navigate('/contek')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      console.error(err)
      toast.error('E-mail ou senha incorretos. Verifique suas credenciais.')
    } finally {
      setLoadingLogin(false)
    }
  }

  // Gerador automático de slug a partir do nome
  const generateSlugFromName = (val: string) => {
    return val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  const handleOrgNameChange = (val: string) => {
    setSignupOrgName(val)
    if (!isSlugEditedManually) {
      setSignupSlug(generateSlugFromName(val))
    }
  }

  const handleSlugChange = (val: string) => {
    setIsSlugEditedManually(true)
    setSignupSlug(
      val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9-]/g, ''),
    )
  }

  const validateStep1 = () => {
    const cleanName = signupName.trim()
    const cleanMail = signupEmail.trim().toLowerCase()

    if (!cleanName) {
      toast.error('Informe seu nome completo.')
      return false
    }
    if (!cleanMail || !cleanMail.includes('@') || !cleanMail.includes('.')) {
      toast.error('Informe um e-mail válido.')
      return false
    }
    if (!signupPassword || signupPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return false
    }
    if (signupPassword !== signupPasswordConfirm) {
      toast.error('A confirmação de senha não coincide com a senha digitada.')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    const cleanOrg = signupOrgName.trim()
    if (!cleanOrg) {
      toast.error('Informe o nome da sua empresa.')
      return false
    }
    return true
  }

  const handleNextToStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep1()) {
      setSignupStep(2)
    }
  }

  const handleNextToStep3 = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateStep2()) {
      setSignupStep(3)
    }
  }

  const handleSelfServiceSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep1() || !validateStep2()) {
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
        email_sent?: boolean
        organization?: { id: string; name: string; slug: string; product?: string }
        subscription?: { id: string; status: string; trial_ends_at: string }
        user?: { id: string; email: string; name: string }
      }>('/backend/v1/onboarding/self-service', {
        method: 'POST',
        body: {
          name: signupName.trim(),
          email: signupEmail.trim().toLowerCase(),
          password: signupPassword,
          phone: signupPhone.trim(),
          org_name: signupOrgName.trim(),
          slug: signupSlug.trim() || generateSlugFromName(signupOrgName.trim()),
          product: signupProduct,
          plan_slug: signupPlanSlug,
          create_example_service: signupCreateExampleService,
        },
      })

      if (!res.success) {
        throw new Error(res.error || 'Erro ao cadastrar empresa.')
      }

      toast.success(
        res.email_sent
          ? 'Conta e empresa criadas com sucesso! E-mail de boas-vindas enviado.'
          : 'Conta e empresa criadas com sucesso!',
      )

      // Salva dados para exibir confirmação amigável
      setSignupSuccessData({
        orgName: res.organization?.name || signupOrgName.trim(),
        slug: res.organization?.slug || signupSlug.trim() || generateSlugFromName(signupOrgName),
        planName:
          signupPlanSlug === 'agyli-essencial'
            ? 'AGYLI Essencial'
            : signupPlanSlug === 'markaly-start'
              ? 'MARKALY Essencial'
              : 'AGYLI Pro',
        product: signupProduct,
        email: signupEmail.trim().toLowerCase(),
      })

      // Auto login na conta recém criada
      try {
        await login(signupEmail.trim().toLowerCase(), signupPassword)
        // Redireciona para o painel principal após pequeno delay de celebração
        setTimeout(() => {
          navigate('/')
        }, 1800)
      } catch (loginErr) {
        console.error('Auto login fallback:', loginErr)
        // Se auto login falhar por qualquer motivo de rede, navega para a aba de entrar preenchida
        setEmail(signupEmail.trim().toLowerCase())
      }
    } catch (err: unknown) {
      console.error(err)
      const dataErr = (err as { data?: { error?: string } })?.data?.error
      const responseErr = (err as { response?: { error?: string } })?.response?.error
      const messageErr = (err as { message?: string })?.message

      const finalMsg =
        dataErr ||
        responseErr ||
        messageErr ||
        'Erro ao cadastrar empresa. Verifique os dados informados.'

      if (
        finalMsg.toLowerCase().includes('já está cadastrado') ||
        finalMsg.toLowerCase().includes('already') ||
        finalMsg.toLowerCase().includes('email')
      ) {
        toast.error('Este e-mail já está cadastrado no sistema. Faça login com suas credenciais.')
      } else {
        toast.error(finalMsg)
      }
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
        activeBrand === 'markaly' ? 'bg-[#1E0338] text-slate-100' : 'bg-[#0F172A] text-slate-100'
      }`}
    >
      {/* Background glow effects fieis a cada produto */}
      {activeBrand === 'markaly' ? (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#F97316]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#EC4899]/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-[#7C3AED]/15 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#3B82F6]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#8B5CF6]/15 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Cabeçalho Oficial Conforme Marca / Domínio (sem seletor confuso de produtos) */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 flex flex-col items-center text-center px-4">
        {domainContext === 'contek' && activeBrand !== 'markaly' ? (
          <>
            {/* Identidade Institucional Grupo Contek */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E293B]/90 border border-blue-500/30 text-blue-300 text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Grupo Contek • Tecnologia e Consultoria</span>
            </div>

            <div className="flex items-center justify-center p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl mb-3">
              <ContekFullLogo height={44} theme="dark" />
            </div>

            <p className="text-xs text-slate-300 max-w-sm mt-1">
              Acesse a plataforma de agendamento e gestão inteligente do Grupo Contek.
            </p>
          </>
        ) : activeBrand === 'markaly' ? (
          <>
            {/* Badge Institucional MARKALY */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2D0B52]/90 border border-orange-500/40 text-orange-200 text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Organização que impulsiona seu negócio</span>
            </div>

            {/* Logo Oficial Completa MARKALY em versão dark adaptada ao fundo roxo escuro #1E0338 */}
            <div className="flex items-center justify-center p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-purple-500/30 shadow-xl mb-3">
              <MarkalyLogo height={48} theme="dark" showSlogan={true} showSignature={true} />
            </div>

            <p className="text-xs text-purple-200/90 max-w-sm mt-1">
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
              ? 'border-purple-800/60 bg-[#240644]/95 text-slate-100 shadow-purple-950/50'
              : 'border-slate-800 bg-[#1E293B]/95 text-slate-100'
          }`}
        >
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'login' | 'signup' | 'manual')}
            defaultValue="login"
            className="w-full"
          >
            <CardHeader className="pb-3 pt-5">
              <TabsList
                className={`grid w-full ${
                  isContekTabRequested ? 'grid-cols-3' : 'grid-cols-2'
                } p-1 rounded-xl border ${
                  activeBrand === 'markaly'
                    ? 'bg-[#150228]/80 border-purple-800/60 text-purple-200'
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
                  Criar conta
                </TabsTrigger>
                {isContekTabRequested && (
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
                )}
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
                            ? 'bg-[#3A0A66] text-[#F97316] border border-orange-500/30'
                            : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
                        }`}
                      >
                        <KeyRound className="w-5 h-5" />
                      </div>
                      <h2 className="text-lg font-bold tracking-tight text-white">
                        Recuperar Senha
                      </h2>
                      <p
                        className={`text-xs mt-1 ${
                          activeBrand === 'markaly' ? 'text-purple-200/80' : 'text-slate-400'
                        }`}
                      >
                        Informe seu e-mail cadastrado para enviarmos as instruções de redefinição
                      </p>
                    </div>

                    {forgotSuccessEmail ? (
                      <div
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          activeBrand === 'markaly'
                            ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
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
                                ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
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
                              activeBrand === 'markaly' ? 'text-purple-200' : 'text-slate-300'
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
                            name="forgot-email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            placeholder="seu@email.com"
                            autoComplete="email"
                            required
                            autoFocus
                            className={`rounded-xl h-11 ${
                              activeBrand === 'markaly'
                                ? 'bg-[#150228] border-purple-800/80 text-white focus-visible:ring-[#F97316]'
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
                          ? 'text-purple-300 hover:text-[#F97316]'
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
                      <h2 className="text-lg font-bold tracking-tight text-white">Bem-vindo(a)</h2>
                      <p
                        className={`text-xs ${
                          activeBrand === 'markaly' ? 'text-purple-200/80' : 'text-slate-400'
                        }`}
                      >
                        Acesse sua conta para continuar
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="login-email"
                        className={`text-xs font-medium flex items-center gap-1.5 ${
                          activeBrand === 'markaly' ? 'text-purple-200' : 'text-slate-300'
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
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        required
                        className={`rounded-xl h-11 ${
                          activeBrand === 'markaly'
                            ? 'bg-[#150228] border-purple-800/80 text-white focus-visible:ring-[#F97316]'
                            : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                        }`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="login-password"
                          className={`text-xs font-medium flex items-center gap-1.5 ${
                            activeBrand === 'markaly' ? 'text-purple-200' : 'text-slate-300'
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
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        required
                        className={`rounded-xl h-11 ${
                          activeBrand === 'markaly'
                            ? 'bg-[#150228] border-purple-800/80 text-white focus-visible:ring-[#F97316]'
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
                        activeBrand === 'markaly' ? 'text-purple-300/80' : 'text-slate-400'
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

            {/* TAB 2: SELF-SERVICE SIGNUP (WIZARD 3 ETAPAS) */}
            <TabsContent value="signup">
              {signupSuccessData ? (
                /* Tela de Sucesso Pós-Cadastro */
                <CardContent className="space-y-4 pt-4 pb-6 text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mb-1">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Parabéns! Empresa Criada com Sucesso
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Seu período de{' '}
                    <span className="text-emerald-400 font-semibold">7 dias grátis</span> no plano{' '}
                    <span className="font-semibold text-white">{signupSuccessData.planName}</span>{' '}
                    já começou. Enviamos um e-mail de boas-vindas para{' '}
                    <span className="font-semibold text-cyan-300">{signupSuccessData.email}</span>.
                  </p>

                  <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-left text-xs space-y-2.5 max-w-md mx-auto">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Empresa:</span>
                      <span className="text-white font-bold">{signupSuccessData.orgName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-slate-400">Página Pública:</span>
                      <a
                        href={`/agendar/${signupSuccessData.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-400 font-semibold hover:underline"
                      >
                        /agendar/{signupSuccessData.slug}
                      </a>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Status:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <Check className="w-3.5 h-3.5" /> Trial Ativo (7 dias)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      onClick={() => navigate('/')}
                      className={`w-full max-w-md text-white font-semibold h-11 rounded-xl shadow-lg ${
                        signupSuccessData.product === 'markaly' || activeBrand === 'markaly'
                          ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED]'
                          : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]'
                      }`}
                    >
                      Acessar Meu Painel Agora
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              ) : (
                <div className="pt-2">
                  {/* Stepper Minimalista no Topo */}
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-between relative">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 w-full z-0" />
                      <div
                        className={`absolute left-0 top-1/2 -translate-y-1/2 h-0.5 transition-all duration-300 z-0 ${
                          activeBrand === 'markaly'
                            ? 'bg-gradient-to-r from-[#F97316] to-[#EC4899]'
                            : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]'
                        }`}
                        style={{
                          width: signupStep === 1 ? '0%' : signupStep === 2 ? '50%' : '100%',
                        }}
                      />

                      {/* Step 1 */}
                      <div className="relative z-10 flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => setSignupStep(1)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            signupStep === 1
                              ? activeBrand === 'markaly'
                                ? 'bg-[#F97316] text-white ring-4 ring-[#F97316]/20'
                                : 'bg-[#3B82F6] text-white ring-4 ring-[#3B82F6]/20'
                              : signupStep > 1
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {signupStep > 1 ? <Check className="w-4 h-4" /> : '1'}
                        </button>
                        <span className="text-[11px] font-medium text-slate-300 mt-1">Você</span>
                      </div>

                      {/* Step 2 */}
                      <div className="relative z-10 flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (validateStep1()) setSignupStep(2)
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            signupStep === 2
                              ? activeBrand === 'markaly'
                                ? 'bg-[#F97316] text-white ring-4 ring-[#F97316]/20'
                                : 'bg-[#3B82F6] text-white ring-4 ring-[#3B82F6]/20'
                              : signupStep > 2
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {signupStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                        </button>
                        <span className="text-[11px] font-medium text-slate-300 mt-1">
                          Empresa & Plano
                        </span>
                      </div>

                      {/* Step 3 */}
                      <div className="relative z-10 flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (validateStep1() && validateStep2()) setSignupStep(3)
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                            signupStep === 3
                              ? activeBrand === 'markaly'
                                ? 'bg-[#F97316] text-white ring-4 ring-[#F97316]/20'
                                : 'bg-[#3B82F6] text-white ring-4 ring-[#3B82F6]/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          3
                        </button>
                        <span className="text-[11px] font-medium text-slate-300 mt-1">Revisão</span>
                      </div>
                    </div>
                  </div>

                  {/* ETAPA 1: DADOS DA PESSOA */}
                  {signupStep === 1 && (
                    <form onSubmit={handleNextToStep2}>
                      <CardContent className="space-y-3.5 pt-1">
                        <div className="pb-1">
                          <h3 className="text-sm font-semibold text-white">
                            Etapa 1 de 3 — Seus Dados Pessoais
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Crie seu acesso administrativo de dona(o) da conta para gerenciar seu
                            espaço.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-400" />
                            Nome Completo *
                          </Label>
                          <Input
                            value={signupName}
                            onChange={(e) => setSignupName(e.target.value)}
                            placeholder="Ex: Dra. Luciana Silva ou Roberto Neves"
                            required
                            autoFocus
                            className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-blue-400" />
                              E-mail de Acesso *
                            </Label>
                            <Input
                              type="email"
                              value={signupEmail}
                              onChange={(e) => setSignupEmail(e.target.value)}
                              placeholder="seu@email.com"
                              autoComplete="email"
                              required
                              className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              WhatsApp (opcional)
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
                              <Lock className="w-3.5 h-3.5 text-blue-400" />
                              Senha (mínimo 8 dígitos) *
                            </Label>
                            <Input
                              type="password"
                              value={signupPassword}
                              onChange={(e) => setSignupPassword(e.target.value)}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              required
                              className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                              <Lock className="w-3.5 h-3.5 text-blue-400" />
                              Confirmar Senha *
                            </Label>
                            <Input
                              type="password"
                              value={signupPasswordConfirm}
                              onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              required
                              className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                            />
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2">
                        <Button
                          type="submit"
                          className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl ${
                            activeBrand === 'markaly'
                              ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95'
                              : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED]'
                          }`}
                        >
                          Continuar para Dados da Empresa
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardFooter>
                    </form>
                  )}

                  {/* ETAPA 2: DADOS DA EMPRESA E ESCOLHA DO PLANO */}
                  {signupStep === 2 && (
                    <form onSubmit={handleNextToStep3}>
                      <CardContent className="space-y-4 pt-1">
                        <div className="pb-1">
                          <h3 className="text-sm font-semibold text-white">
                            Etapa 2 de 3 — Sua Empresa & Plano
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Defina o nome comercial, seu link público de agendamento e o plano
                            ideal.
                          </p>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" />
                            Nome da Empresa ou Estabelecimento *
                          </Label>
                          <Input
                            value={signupOrgName}
                            onChange={(e) => handleOrgNameChange(e.target.value)}
                            placeholder="Ex: Clínica Bella Estética, Barbearia Silva, Consultório Dr. Neves..."
                            required
                            autoFocus
                            className="bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]"
                          />
                        </div>

                        {/* Slug gerado automaticamente / editável */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Globe className="w-3.5 h-3.5 text-cyan-400" />
                              Link da Sua Página Pública de Agendamento
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Gerado do nome (editável)
                            </span>
                          </Label>
                          <div className="flex items-center rounded-xl bg-[#0F172A] border border-slate-700 px-3 py-2 text-xs">
                            <span className="text-slate-500 font-mono select-none">/agendar/</span>
                            <input
                              type="text"
                              value={signupSlug}
                              onChange={(e) => handleSlugChange(e.target.value)}
                              placeholder="sua-empresa"
                              className="bg-transparent border-0 outline-none text-cyan-300 font-mono flex-1 ml-0.5"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Seus clientes acessarão este link exclusivo para marcar horários online.
                          </p>
                        </div>

                        {/* Cartões Comparativos de Planos */}
                        <div className="space-y-2 pt-1">
                          <Label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Escolha o Plano Ideal (Ambos com 7 dias grátis) *
                          </Label>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Card AGYLI ESSENCIAL */}
                            <div
                              onClick={() => {
                                setSignupProduct('agyli')
                                setSignupPlanSlug('agyli-essencial')
                              }}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all relative ${
                                signupPlanSlug === 'agyli-essencial'
                                  ? 'border-cyan-500 bg-cyan-950/60 shadow-lg ring-1 ring-cyan-500'
                                  : 'border-slate-800 bg-[#0F172A]/70 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded-full border border-cyan-800/60 mb-1">
                                    Essencial & Ágil
                                  </span>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    AGYLI Essencial
                                  </h4>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-bold text-cyan-300">R$ 19,90</div>
                                  <div className="text-[10px] text-slate-400">/mês</div>
                                </div>
                              </div>

                              <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3 h-3" /> 7 dias grátis de teste
                              </div>

                              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  <span>1 Profissional incluso</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  <span>Agenda inteligente online & presencial</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  <span>Gestão de clientes & catálogo de serviços</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  <span>
                                    Link público <code>/agendar/slug</code>
                                  </span>
                                </li>
                              </ul>
                            </div>

                            {/* Card AGYLI PRO */}
                            <div
                              onClick={() => {
                                setSignupProduct('agyli')
                                setSignupPlanSlug('agyli-pro')
                              }}
                              className={`p-3.5 rounded-xl border cursor-pointer transition-all relative ${
                                signupPlanSlug === 'agyli-pro'
                                  ? 'border-[#3B82F6] bg-blue-950/70 shadow-lg ring-1 ring-[#3B82F6]'
                                  : 'border-slate-800 bg-[#0F172A]/70 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950 px-2 py-0.5 rounded-full border border-blue-800/60 mb-1">
                                    Mais Completo
                                  </span>
                                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                    AGYLI Pro
                                  </h4>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-bold text-blue-300">R$ 29,90</div>
                                  <div className="text-[10px] text-slate-400">/mês</div>
                                </div>
                              </div>

                              <div className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                                <Calendar className="w-3 h-3" /> 7 dias grátis de teste
                              </div>

                              <ul className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                  <span>Até 5 Profissionais simultâneos</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                  <span>Módulo Financeiro completo + comissões</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                  <span>Assistente IA & Recepção WhatsApp</span>
                                </li>
                                <li className="flex items-center gap-1.5">
                                  <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                  <span>Encaixes inteligentes & relatórios</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Checkbox serviço de exemplo opcional */}
                        <div className="pt-1">
                          <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={signupCreateExampleService}
                              onChange={(e) => setSignupCreateExampleService(e.target.checked)}
                              className="mt-0.5 rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                            />
                            <span>
                              Criar automaticamente um serviço de exemplo (Atendimento Inicial / R$
                              150) para testar a agenda de imediato.
                            </span>
                          </label>
                        </div>
                      </CardContent>

                      <CardFooter className="flex items-center gap-2.5 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSignupStep(1)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 h-11 px-4 rounded-xl"
                        >
                          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
                        </Button>
                        <Button
                          type="submit"
                          className={`flex-1 text-white font-semibold shadow-lg h-11 rounded-xl ${
                            signupProduct === 'markaly' || activeBrand === 'markaly'
                              ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95'
                              : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED]'
                          }`}
                        >
                          Avançar para Revisão
                          <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardFooter>
                    </form>
                  )}

                  {/* ETAPA 3: REVISÃO DOS DADOS E FINALIZAÇÃO */}
                  {signupStep === 3 && (
                    <form onSubmit={handleSelfServiceSignup}>
                      <CardContent className="space-y-4 pt-1">
                        <div className="pb-1">
                          <h3 className="text-sm font-semibold text-white">
                            Etapa 3 de 3 — Revisão dos Dados
                          </h3>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Confirme os dados antes de ativar seu período gratuito de 7 dias.
                          </p>
                        </div>

                        {/* Card com resumo */}
                        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 text-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-slate-400">Responsável:</span>
                            <span className="text-white font-semibold">{signupName || '—'}</span>
                          </div>

                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-slate-400">E-mail de acesso:</span>
                            <span className="text-cyan-300 font-mono font-medium">
                              {signupEmail || '—'}
                            </span>
                          </div>

                          {signupPhone && (
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="text-slate-400">WhatsApp:</span>
                              <span className="text-white font-medium">{signupPhone}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-slate-400">Nome da Empresa:</span>
                            <span className="text-white font-bold">{signupOrgName || '—'}</span>
                          </div>

                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-slate-400">Link público da página:</span>
                            <span className="text-cyan-400 font-mono font-medium">
                              /agendar/
                              {signupSlug || generateSlugFromName(signupOrgName) || 'empresa'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                            <span className="text-slate-400">Plano escolhido:</span>
                            <span className="font-bold text-white">
                              {signupPlanSlug === 'agyli-essencial'
                                ? 'AGYLI Essencial (R$ 19,90/mês)'
                                : signupPlanSlug === 'markaly-start'
                                  ? 'MARKALY Essencial (R$ 19,90/mês)'
                                  : 'AGYLI Pro (R$ 29,90/mês)'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-slate-400">Período de avaliação:</span>
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 7 dias grátis sem
                              cobrança imediata
                            </span>
                          </div>
                        </div>

                        {/* Aviso amigável sobre e-mail de boas-vindas */}
                        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            Ao clicar em criar, sua conta e empresa são ativadas instantaneamente.
                            Você receberá um e-mail de boas-vindas com o resumo e o link público de
                            agendamento.
                          </p>
                        </div>
                      </CardContent>

                      <CardFooter className="flex items-center gap-2.5 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSignupStep(2)}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800 h-11 px-4 rounded-xl"
                        >
                          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
                        </Button>
                        <Button
                          type="submit"
                          disabled={loadingSignup}
                          className={`flex-1 text-white font-semibold shadow-lg h-11 rounded-xl ${
                            signupProduct === 'markaly' || activeBrand === 'markaly'
                              ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/25'
                              : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                          }`}
                        >
                          {loadingSignup ? 'Criando sua conta...' : 'Criar minha conta grátis'}
                          <CheckCircle2 className="w-4 h-4 ml-2" />
                        </Button>
                      </CardFooter>
                    </form>
                  )}
                </div>
              )}
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
                        name="manual-admin-email"
                        value={manualAdminEmail}
                        onChange={(e) => setManualAdminEmail(e.target.value)}
                        placeholder="admin@empresa.com"
                        autoComplete="off"
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
                        name="manual-admin-password"
                        value={manualAdminPassword}
                        onChange={(e) => setManualAdminPassword(e.target.value)}
                        placeholder="mínimo 8 dígitos"
                        autoComplete="new-password"
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

        <div className="mt-6 text-center space-y-1.5">
          {activeBrand === 'markaly' ? (
            <>
              <p className="text-xs text-purple-200 font-medium">
                MARKALY • Organizar hoje, crescer sempre.
              </p>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-purple-300/80">
                <ContekSymbol size={12} className="inline-block" />
                <span>
                  Uma solução{' '}
                  <span className="text-orange-400 font-semibold">
                    Contek Tecnologia e Consultoria
                  </span>
                  . Todos os direitos reservados.
                </span>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400 font-medium">AGYLI • Agendar ficou simples.</p>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                <ContekSymbol size={12} className="inline-block" />
                <span>
                  Uma solução{' '}
                  <span className="text-blue-400 font-medium">Contek Tecnologia e Consultoria</span>
                  . Todos os direitos reservados.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
export default Login
