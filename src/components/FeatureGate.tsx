import React from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShieldAlert, ArrowLeft, Sparkles, Lock } from 'lucide-react'

interface FeatureGateProps {
  feature: string
  children: React.ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
}

export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  fallbackTitle = 'Módulo não incluído no seu plano',
  fallbackMessage,
}) => {
  const { hasFeature, currentProduct, branding } = useAuth()

  if (hasFeature(feature)) {
    return <>{children}</>
  }

  const defaultMsg =
    fallbackMessage ||
    `Este módulo não está ativo no produto ${branding.name}. Para ter acesso a recursos avançados como Gestão Financeira Completa e Assistente de IA, conheça o plano AGYLI.`

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-slate-200 shadow-lg text-center">
        <CardHeader className="space-y-3 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
            <Lock className="w-6 h-6 stroke-[2.2]" />
          </div>
          <CardTitle className="text-xl font-bold text-slate-900">{fallbackTitle}</CardTitle>
          <CardDescription className="text-sm text-slate-600 leading-relaxed">
            {defaultMsg}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
            <span className="font-medium">Produto Atual:</span>
            <span className="font-bold uppercase tracking-wider text-slate-800">
              {currentProduct}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" asChild className="w-full text-xs">
              <Link to="/">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Voltar ao Início
              </Link>
            </Button>
            <Button
              asChild
              className="w-full text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Link to="/agenda">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Ir para Agenda
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Validando credenciais SuperAdmin...</p>
        </div>
      </div>
    )
  }

  if (!user || !isSuperAdmin) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
