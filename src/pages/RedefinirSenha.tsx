import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
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
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Sparkles,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'
import { AgyliLogo, AgyliEmblem } from '@/components/AgyliBranding'
import { MarkalyLogo, MarkalyEmblem } from '@/components/MarkalyBranding'
import { resolveProductByDomain } from '@/lib/branding'

export const RedefinirSenha: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('token') || ''
  const brandFromUrl = searchParams.get('brand') as 'agyli' | 'markaly' | null

  const initialDetectedProduct =
    brandFromUrl === 'agyli' || brandFromUrl === 'markaly'
      ? brandFromUrl
      : typeof window !== 'undefined'
        ? resolveProductByDomain(window.location.hostname, 'agyli')
        : 'agyli'

  const [activeBrand, setActiveBrand] = useState<'agyli' | 'markaly'>(initialDetectedProduct)

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenFromUrl) {
      setErrorMessage(
        'Token de redefinição não encontrado ou expirado. Por favor, solicite um novo link de recuperação de senha.',
      )
    }
  }, [tokenFromUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!tokenFromUrl) {
      setErrorMessage('Token de redefinição ausente. Solicite um novo link.')
      toast.error('Token ausente.')
      return
    }

    if (!password || !passwordConfirm) {
      toast.error('Preencha os dois campos de senha.')
      return
    }

    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== passwordConfirm) {
      toast.error('As senhas não coincidem.')
      return
    }

    setLoading(true)

    try {
      await pb.collection('users').confirmPasswordReset(tokenFromUrl, password, passwordConfirm)
      setSuccess(true)
      toast.success('Senha redefinida com sucesso!')
    } catch (err: unknown) {
      console.error('Password reset confirmation error:', err)
      const msg =
        (err as { message?: string })?.message ||
        'Falha ao redefinir a senha. O link pode ter expirado ou já ter sido utilizado.'
      setErrorMessage(
        msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired')
          ? 'Este link de redefinição expirou ou já foi utilizado. Solicite um novo link na tela de login.'
          : 'Não foi possível redefinir sua senha. Verifique se o link ainda é válido ou tente novamente.',
      )
      toast.error('Não foi possível redefinir a senha.')
    } finally {
      setLoading(false)
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

      {/* Seletor Rápido de Marca */}
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
            onClick={() => setActiveBrand('agyli')}
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
            onClick={() => setActiveBrand('markaly')}
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

      {/* Cabeçalho de Marca */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 flex flex-col items-center text-center px-4">
        {activeBrand === 'markaly' ? (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3E2] border border-orange-200 text-[#3B0764] text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Segurança da Conta</span>
            </div>
            <div className="flex items-center justify-center p-4 rounded-2xl bg-white border border-purple-100 shadow-xl mb-3">
              <MarkalyLogo height={48} theme="light" showSlogan={true} showSignature={true} />
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1E293B]/90 border border-blue-500/30 text-blue-300 text-xs font-medium mb-4 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Segurança da Conta</span>
            </div>
            <div className="flex items-center justify-center p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl mb-3">
              <AgyliLogo height={48} theme="dark" showSlogan={true} showSignature={true} />
            </div>
          </>
        )}
      </div>

      <div className="mt-4 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <Card
          className={`shadow-2xl rounded-2xl border transition-all ${
            activeBrand === 'markaly'
              ? 'border-purple-100 bg-white text-[#3B0764]'
              : 'border-slate-800 bg-[#1E293B]/95 text-slate-100'
          }`}
        >
          <CardHeader className="text-center pb-3 pt-6">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 rounded-full mx-auto mb-2 ${
                activeBrand === 'markaly'
                  ? 'bg-[#FEF3E2] text-[#F97316]'
                  : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
              }`}
            >
              <KeyRound className="w-6 h-6" />
            </div>
            <CardTitle
              className={`text-xl font-bold tracking-tight ${
                activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-white'
              }`}
            >
              Criar Nova Senha
            </CardTitle>
            <CardDescription
              className={`text-xs mt-1 ${
                activeBrand === 'markaly' ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Defina sua nova senha de acesso ao sistema
            </CardDescription>
          </CardHeader>

          {success ? (
            <div>
              <CardContent className="space-y-4 pt-2">
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
                      <p className="font-semibold text-sm">Senha redefinida com sucesso!</p>
                      <p className="mt-1 text-xs leading-relaxed">
                        Sua senha foi atualizada. Agora você já pode acessar sua conta utilizando a
                        nova senha cadastrada.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-6">
                <Button
                  type="button"
                  onClick={() => navigate('/login')}
                  className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl transition-all ${
                    activeBrand === 'markaly'
                      ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/20'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                  }`}
                >
                  Ir para a tela de login
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-2">
                {errorMessage && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      activeBrand === 'markaly'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-amber-950/40 border-amber-800/50 text-amber-200'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{errorMessage}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label
                    htmlFor="new-password"
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-slate-300'
                    }`}
                  >
                    <Lock
                      className={`w-3.5 h-3.5 ${
                        activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-blue-400'
                      }`}
                    />
                    Nova Senha (mínimo 8 caracteres)
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      disabled={!tokenFromUrl || loading}
                      className={`rounded-xl h-11 pr-10 ${
                        activeBrand === 'markaly'
                          ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 focus-visible:ring-[#F97316]'
                          : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors ${
                        activeBrand === 'markaly' ? 'hover:text-slate-700' : ''
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="new-password-confirm"
                    className={`text-xs font-medium flex items-center gap-1.5 ${
                      activeBrand === 'markaly' ? 'text-[#3B0764]' : 'text-slate-300'
                    }`}
                  >
                    <Lock
                      className={`w-3.5 h-3.5 ${
                        activeBrand === 'markaly' ? 'text-[#F97316]' : 'text-blue-400'
                      }`}
                    />
                    Confirmar Nova Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="new-password-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={!tokenFromUrl || loading}
                      className={`rounded-xl h-11 pr-10 ${
                        activeBrand === 'markaly'
                          ? 'bg-[#F8FAFC] border-slate-300 text-slate-900 focus-visible:ring-[#F97316]'
                          : 'bg-[#0F172A] border-slate-700 text-white focus-visible:ring-[#3B82F6]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 transition-colors ${
                        activeBrand === 'markaly' ? 'hover:text-slate-700' : ''
                      }`}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
                <Button
                  type="submit"
                  disabled={loading || !tokenFromUrl}
                  className={`w-full text-white font-semibold shadow-lg h-11 rounded-xl transition-all ${
                    activeBrand === 'markaly'
                      ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] hover:opacity-95 shadow-orange-500/20'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] shadow-blue-500/25'
                  }`}
                >
                  {loading ? 'Salvando nova senha...' : 'Salvar Nova Senha'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <Link
                  to="/login"
                  className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1 transition-colors hover:underline ${
                    activeBrand === 'markaly'
                      ? 'text-[#3B0764] hover:text-[#F97316]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar para o login</span>
                </Link>
              </CardFooter>
            </form>
          )}
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

export default RedefinirSenha
