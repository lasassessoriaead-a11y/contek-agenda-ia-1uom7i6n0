import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

export const LoginContek: React.FC = () => {
  const { login, logout } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [loadingForgot, setLoadingForgot] = useState(false)
  const [forgotSuccessEmail, setForgotSuccessEmail] = useState<string | null>(null)
  const [forgotErrorMessage, setForgotErrorMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      toast.error('Preencha seu e-mail e senha.')
      return
    }

    setLoading(true)
    try {
      const loggedUser = await login(email, password)
      const isSuper = Boolean(loggedUser?.is_super_admin || loggedUser?.role === 'SUPERADMIN')

      if (!isSuper) {
        // Se NÃO for SuperAdmin, não permitir acesso por esta entrada interna
        logout()
        setErrorMessage('Esta área é restrita à equipe Contek. Utilize a tela de login principal.')
        toast.error('Acesso restrito à equipe Contek.')
        return
      }

      toast.success('Bem-vinda à Central Contek!')
      navigate('/contek')
    } catch (err: unknown) {
      console.error('Erro de autenticação Contek:', err)
      setErrorMessage('E-mail ou senha incorretos. Verifique suas credenciais corporativas.')
      toast.error('Credenciais inválidas.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetEmail = forgotEmail.trim()
    if (!targetEmail) {
      toast.error('Informe o e-mail corporativo.')
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
      setForgotErrorMessage(
        'Não foi possível processar a recuperação de senha no momento. Contate o suporte técnico Contek.',
      )
      toast.error('Falha ao solicitar redefinição.')
    } finally {
      setLoadingForgot(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-['Poppins',sans-serif] relative overflow-hidden">
      {/* Background gradients discretos e escuros */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-slate-800/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-purple-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Topo com navegação sutil de volta ao portal */}
      <header className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between py-2">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 px-2 rounded-lg hover:bg-slate-900/60"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao login principal</span>
        </Link>
        <span className="text-[11px] text-slate-500 font-mono tracking-wider uppercase">
          Ambiente Corporativo Contek
        </span>
      </header>

      {/* Conteúdo Central */}
      <main className="relative z-10 w-full max-w-md mx-auto my-auto py-8">
        {/* Identidade Contek Sóbria */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-xl flex items-center justify-center mb-4">
            <span className="text-2xl font-black tracking-tight text-white">C</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-400 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Acesso Interno Contek</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">CONTEK</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Tecnologia e Consultoria • Gestão de Sistemas
          </p>
        </div>

        {/* Card de Login Contek */}
        <Card className="bg-slate-900/90 border border-slate-800 shadow-2xl rounded-2xl backdrop-blur-md">
          {showForgotPassword ? (
            /* Sub-fluxo: Recuperação de Senha */
            <form onSubmit={handleForgotPassword}>
              <CardHeader className="text-center pb-2 pt-6">
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 mx-auto flex items-center justify-center mb-2">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h2 className="text-base font-bold text-white">Recuperar Senha Corporativa</h2>
                <p className="text-xs text-slate-400">
                  Informe seu e-mail cadastrado para redefinir o acesso
                </p>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {forgotSuccessEmail ? (
                  <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-200 text-xs space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Solicitação enviada!</p>
                        <p className="text-[11px] opacity-90 mt-0.5">
                          Verifique sua caixa de entrada no e-mail{' '}
                          <b className="underline">{forgotSuccessEmail}</b>.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {forgotErrorMessage && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <p className="leading-relaxed">{forgotErrorMessage}</p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="contek-forgot-email"
                        className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        E-mail Corporativo
                      </Label>
                      <Input
                        id="contek-forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="nome@contek.com.br"
                        required
                        autoFocus
                        className="bg-slate-950 border-slate-700 text-white rounded-xl h-11 focus-visible:ring-slate-400"
                      />
                    </div>
                  </>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-2.5 pb-6">
                {!forgotSuccessEmail ? (
                  <Button
                    type="submit"
                    disabled={loadingForgot}
                    className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold h-11 rounded-xl transition-all shadow-md"
                  >
                    {loadingForgot ? 'Enviando...' : 'Enviar link de redefinição'}
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false)
                      setForgotSuccessEmail(null)
                      setForgotErrorMessage(null)
                    }}
                    className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold h-11 rounded-xl transition-all shadow-md"
                  >
                    Voltar ao Login Contek
                  </Button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotErrorMessage(null)
                    setForgotSuccessEmail(null)
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  Cancelar
                </button>
              </CardFooter>
            </form>
          ) : (
            /* Formulário Principal de Login Corporativo Contek */
            <form onSubmit={handleLogin}>
              <CardHeader className="text-center pb-2 pt-6">
                <h2 className="text-base font-bold text-white">Central de Acesso da Equipe</h2>
                <p className="text-xs text-slate-400">
                  Entre com suas credenciais de Administrador Contek
                </p>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="contek-email"
                    className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    E-mail
                  </Label>
                  <Input
                    id="contek-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                    className="bg-slate-950 border-slate-700 text-white rounded-xl h-11 focus-visible:ring-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="contek-password"
                      className="text-xs font-medium text-slate-300 flex items-center gap-1.5"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
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
                      className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input
                    id="contek-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="bg-slate-950 border-slate-700 text-white rounded-xl h-11 focus-visible:ring-slate-400"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pb-6">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-100 hover:bg-white text-slate-950 font-semibold h-11 rounded-xl transition-all shadow-md"
                >
                  {loading ? 'Acessando Central...' : 'Entrar na Central Contek'}
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                <p className="text-[11px] text-center text-slate-500">
                  Uso exclusivo da equipe técnica e administrativa Contek
                </p>
              </CardFooter>
            </form>
          )}
        </Card>
      </main>

      {/* Rodapé Sóbrio */}
      <footer className="relative z-10 max-w-5xl w-full mx-auto py-3 text-center text-[11px] text-slate-500">
        <p>Contek Tecnologia e Consultoria • Todos os direitos reservados.</p>
      </footer>
    </div>
  )
}

export default LoginContek
