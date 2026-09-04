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
  }
  thanks_message?: string
}

export const ConfirmacaoPublica: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ConfirmationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      <div className="w-full max-w-md">
        {/* BRAND HEADER */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3 shadow-inner">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            {result?.appointment?.organization_name || 'Contek Agenda'}
          </h1>
          <p className="text-xs text-slate-400">Confirmação de Presença Online</p>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <Card className="border-slate-800 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur-md">
            <CardContent className="py-12 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-300 font-medium">
                Validando e confirmando seu atendimento...
              </p>
            </CardContent>
          </Card>
        )}

        {/* ERROR STATE */}
        {!loading && errorMsg && (
          <Card className="border-rose-900/40 bg-slate-900/90 text-slate-100 shadow-xl backdrop-blur-md">
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
          <Card className="border-emerald-500/30 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-md overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
            <CardHeader className="text-center pb-3">
              <Badge className="w-fit mx-auto bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] mb-1">
                {result.already_confirmed
                  ? 'Já Estava Confirmado'
                  : 'Presença Confirmada com Sucesso!'}
              </Badge>
              <CardTitle className="text-xl font-bold text-white tracking-tight">
                Obrigado, {result.appointment?.client_name || 'Paciente'}!
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                Seu agendamento foi validado no sistema e o profissional já foi notificado.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* DETAILS SUMMARY */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50 space-y-2.5">
                <div className="flex items-center justify-between py-1 border-b border-slate-700/40">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Data:
                  </span>
                  <span className="font-semibold text-slate-100">{result.appointment?.date}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-700/40">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> Horário:
                  </span>
                  <span className="font-semibold text-slate-100">
                    {result.appointment?.start_time}
                  </span>
                </div>

                {result.appointment?.service_name && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-700/40">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-emerald-400" /> Procedimento:
                    </span>
                    <span className="font-semibold text-slate-100">
                      {result.appointment.service_name}
                    </span>
                  </div>
                )}

                {result.appointment?.professional_name && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-emerald-400" /> Profissional:
                    </span>
                    <span className="font-semibold text-slate-100">
                      {result.appointment.professional_name}
                    </span>
                  </div>
                )}
              </div>

              {/* THANKS MESSAGE CARD */}
              {result.thanks_message && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/20 rounded-xl text-emerald-200 text-xs leading-relaxed">
                  <p className="italic">"{result.thanks_message}"</p>
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center">
                Te enviaremos um lembrete no dia do seu atendimento. Caso precise remarcar, entre em
                contato diretamente com a clínica.
              </p>
            </CardContent>

            <CardFooter className="pt-2 pb-4 flex justify-center border-t border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-500">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                <span>Gerenciado por Contek Agenda IA</span>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  )
}

export default ConfirmacaoPublica
