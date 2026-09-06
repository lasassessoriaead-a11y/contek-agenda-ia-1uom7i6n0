import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle2,
  Calendar,
  Clock,
  User,
  Scissors,
  Building,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AgyliEmblem, AgyliLogo } from '@/components/AgyliBranding'
import { MarkalyEmblem, MarkalyLogo } from '@/components/MarkalyBranding'
import { ContekSymbol } from '@/components/ContekBranding'

interface ConfirmationResult {
  success: boolean
  already_confirmed?: boolean
  error?: string
  appointment?: {
    id: string
    status: string
    client_name: string
    professional_name: string
    service_name: string
    date: string
    start_time: string
    organization_name: string
    organization_product?: 'agyli' | 'markaly'
  }
  thanks_message?: string
}

export const ConfirmacaoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ConfirmationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const isMarkaly = result?.appointment?.organization_product === 'markaly'

  useEffect(() => {
    if (!token) {
      setErrorMsg('Token de confirmação não fornecido.')
      setLoading(false)
      return
    }

    const confirmBooking = async () => {
      try {
        const pbUrl = import.meta.env.VITE_POCKETBASE_URL || ''
        const res = await fetch(
          `${pbUrl}/backend/v1/appointments/confirm/${encodeURIComponent(token)}`,
        )
        const data = await res.json()

        if (!res.ok) {
          setErrorMsg(data.error || 'Não foi possível confirmar o agendamento.')
          setResult(null)
        } else {
          setResult(data)
        }
      } catch (err) {
        console.error('Error confirming appointment:', err)
        setErrorMsg('Erro de conexão ao confirmar agendamento. Tente novamente mais tarde.')
      } finally {
        setLoading(false)
      }
    }

    confirmBooking()
  }, [token])

  return (
    <div
      className={`min-h-screen text-slate-100 flex flex-col justify-center items-center p-4 font-['Poppins',sans-serif] transition-colors duration-300 ${
        isMarkaly ? 'bg-[#1E0338] selection:bg-[#F97316]' : 'bg-[#0F172A] selection:bg-[#3B82F6]'
      } selection:text-white`}
    >
      <div className="w-full max-w-md">
        {/* BRAND HEADER */}
        <div className="text-center mb-6 space-y-2">
          <div className="flex justify-center pb-1">
            {isMarkaly ? (
              <MarkalyLogo height={32} theme="dark" showSlogan={true} showSignature={false} />
            ) : (
              <AgyliLogo height={32} theme="dark" showSlogan={true} showSignature={false} />
            )}
          </div>
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-1 shadow-inner ${
              isMarkaly
                ? 'bg-orange-500/10 border border-orange-500/30 text-[#F97316]'
                : 'bg-blue-500/10 border border-blue-500/20 text-[#3B82F6]'
            }`}
          >
            <CheckCircle2
              className={`w-6 h-6 ${isMarkaly ? 'text-[#F97316]' : 'text-[#3B82F6]'}`}
            />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {result?.appointment?.organization_name ||
              (isMarkaly ? 'MARKALY Agenda' : 'AGYLI Agenda')}
          </h1>
          <p className="text-xs text-slate-400">Confirmação de Presença Online</p>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <Card className="border-slate-800 bg-[#1E293B] text-slate-100 shadow-xl rounded-2xl">
            <CardContent className="py-12 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-slate-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium">
                Validando e confirmando seu atendimento...
              </p>
            </CardContent>
          </Card>
        )}

        {/* ERROR STATE */}
        {!loading && errorMsg && (
          <Card className="border-rose-900/40 bg-[#1E293B] text-slate-100 shadow-xl rounded-2xl">
            <CardHeader className="text-center pb-2">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 mx-auto flex items-center justify-center mb-2">
                <AlertCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg text-rose-300 font-bold">
                Não foi possível confirmar
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">{errorMsg}</CardDescription>
            </CardHeader>
            <CardFooter className="pt-4 flex justify-center border-t border-slate-800">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
              >
                <Link to="/">Ir para Página Inicial</Link>
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* SUCCESS CONFIRMED STATE */}
        {!loading && result && (
          <Card
            className={`text-slate-100 shadow-2xl overflow-hidden rounded-2xl ${
              isMarkaly
                ? 'border-purple-800/60 bg-[#2E0854] shadow-purple-950/50'
                : 'border-blue-500/30 bg-[#1E293B] shadow-blue-950/50'
            }`}
          >
            <div
              className={`h-1.5 ${
                isMarkaly
                  ? 'bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED]'
                  : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]'
              }`}
            />
            <CardHeader className="text-center pb-3">
              <Badge
                className={`w-fit mx-auto text-[11px] mb-1 ${
                  isMarkaly
                    ? 'bg-orange-500/20 text-orange-200 border-orange-500/30'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}
              >
                {result.already_confirmed
                  ? 'Já Estava Confirmado'
                  : 'Presença Confirmada com Sucesso!'}
              </Badge>
              <CardTitle className="text-xl font-bold text-white tracking-tight">
                Obrigado, {result.appointment?.client_name || 'Paciente'}!
              </CardTitle>
              <CardDescription
                className={`text-xs ${isMarkaly ? 'text-purple-200' : 'text-slate-300'}`}
              >
                Seu agendamento foi validado no sistema e o profissional já foi notificado.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* DETAILS SUMMARY */}
              <div
                className={`rounded-xl p-4 border space-y-2.5 ${
                  isMarkaly ? 'bg-[#1A0330] border-purple-900/60' : 'bg-[#0F172A] border-slate-800'
                }`}
              >
                <div
                  className={`flex items-center justify-between py-1 border-b ${
                    isMarkaly ? 'border-purple-900/60' : 'border-slate-800'
                  }`}
                >
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar
                      className={`w-3.5 h-3.5 ${isMarkaly ? 'text-[#F97316]' : 'text-[#3B82F6]'}`}
                    />{' '}
                    Data:
                  </span>
                  <span className="font-semibold text-slate-100">{result.appointment?.date}</span>
                </div>

                <div
                  className={`flex items-center justify-between py-1 border-b ${
                    isMarkaly ? 'border-purple-900/60' : 'border-slate-800'
                  }`}
                >
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock
                      className={`w-3.5 h-3.5 ${isMarkaly ? 'text-[#F97316]' : 'text-[#3B82F6]'}`}
                    />{' '}
                    Horário:
                  </span>
                  <span className="font-semibold text-slate-100">
                    {result.appointment?.start_time}
                  </span>
                </div>

                {result.appointment?.service_name && (
                  <div
                    className={`flex items-center justify-between py-1 border-b ${
                      isMarkaly ? 'border-purple-900/60' : 'border-slate-800'
                    }`}
                  >
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Scissors
                        className={`w-3.5 h-3.5 ${isMarkaly ? 'text-[#F97316]' : 'text-[#3B82F6]'}`}
                      />{' '}
                      Procedimento:
                    </span>
                    <span className="font-semibold text-slate-100">
                      {result.appointment.service_name}
                    </span>
                  </div>
                )}

                {result.appointment?.professional_name && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <User
                        className={`w-3.5 h-3.5 ${isMarkaly ? 'text-[#F97316]' : 'text-[#3B82F6]'}`}
                      />{' '}
                      Profissional:
                    </span>
                    <span className="font-semibold text-slate-100">
                      {result.appointment.professional_name}
                    </span>
                  </div>
                )}
              </div>

              {/* THANKS MESSAGE CARD */}
              {result.thanks_message && (
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed border ${
                    isMarkaly
                      ? 'bg-purple-950/40 border-purple-800/40 text-purple-200'
                      : 'bg-blue-950/30 border-blue-500/20 text-blue-200'
                  }`}
                >
                  <p className="italic">"{result.thanks_message}"</p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center">
                Te enviaremos um lembrete no dia do seu atendimento. Caso precise remarcar, entre em
                contato diretamente com a empresa.
              </p>
            </CardContent>

            <CardFooter
              className={`pt-3 pb-4 flex flex-col sm:flex-row items-center justify-center gap-2 border-t text-xs ${
                isMarkaly
                  ? 'border-purple-900/50 text-purple-300/80'
                  : 'border-slate-800 text-slate-400'
              }`}
            >
              {isMarkaly ? (
                <div className="flex items-center gap-1.5">
                  <MarkalyEmblem size={16} />
                  <span>
                    Powered by <strong className="text-white font-semibold">MARKALY</strong>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AgyliEmblem size={16} />
                  <span>
                    Powered by <strong className="text-white font-semibold">AGYLI</strong>
                  </span>
                </div>
              )}
              <span className="hidden sm:inline text-slate-600">•</span>
              <div className="flex items-center gap-1.5">
                <ContekSymbol size={14} alt="Grupo CONTEK" />
                <span>
                  Uma solução{' '}
                  <span className="font-semibold text-slate-200">
                    Grupo CONTEK — Tecnologia e Consultoria
                  </span>
                </span>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ConfirmacaoPublica
