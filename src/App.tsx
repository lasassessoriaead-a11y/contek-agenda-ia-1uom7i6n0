import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Agenda from '@/pages/Agenda'
import Clientes from '@/pages/Clientes'
import Profissionais from '@/pages/Profissionais'
import Servicos from '@/pages/Servicos'
import Financeiro from '@/pages/Financeiro'
import AssistenteIa from '@/pages/AssistenteIa'
import Configuracoes from '@/pages/Configuracoes'
import SuperAdmin from '@/pages/SuperAdmin'
import AgendamentoPublico from '@/pages/AgendamentoPublico'
import ConfirmacaoPublica from '@/pages/ConfirmacaoPublica'
import { FeatureGate, SuperAdminRoute } from '@/components/FeatureGate'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/sonner'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando Contek Agenda IA...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Booking Route (/agendar/:slug) */}
          <Route path="/agendar/:slug" element={<AgendamentoPublico />} />
          <Route path="/book/:slug" element={<AgendamentoPublico />} />

          {/* Public Appointment Confirmation Route (/confirmar/:token) */}
          <Route path="/confirmar/:token" element={<ConfirmacaoPublica />} />

          {/* Login / Signup Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Internal Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="profissionais" element={<Profissionais />} />
            <Route path="servicos" element={<Servicos />} />
            <Route
              path="financeiro"
              element={
                <FeatureGate
                  feature="financeiro"
                  fallbackTitle="Financeiro indisponível no plano MARKALY"
                  fallbackMessage="O módulo de fluxo de caixa e gestão financeira completa faz parte exclusivamente da solução AGYLI. Entre em contato ou acesse o plano AGYLI para habilitar."
                >
                  <Financeiro />
                </FeatureGate>
              }
            />
            <Route
              path="assistente-ia"
              element={
                <FeatureGate
                  feature="assistente_ia"
                  fallbackTitle="Assistente IA indisponível no plano MARKALY"
                  fallbackMessage="A inteligência artificial com análise de dados de atendimento e respostas automáticas faz parte exclusivamente da solução AGYLI."
                >
                  <AssistenteIa />
                </FeatureGate>
              }
            />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route
              path="admin"
              element={
                <SuperAdminRoute>
                  <SuperAdmin />
                </SuperAdminRoute>
              }
            />
          </Route>

          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
