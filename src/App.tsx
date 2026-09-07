import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import RedefinirSenha from '@/pages/RedefinirSenha'
import Dashboard from '@/pages/Dashboard'
import Agenda from '@/pages/Agenda'
import Clientes from '@/pages/Clientes'
import Profissionais from '@/pages/Profissionais'
import Servicos from '@/pages/Servicos'
import Financeiro from '@/pages/Financeiro'
import AssistenteIa from '@/pages/AssistenteIa'
import Configuracoes from '@/pages/Configuracoes'
import SuperAdmin from '@/pages/SuperAdmin'
import FinanceiroContek from '@/pages/FinanceiroContek'
import CentralContek from '@/pages/CentralContek'
import LoginContek from '@/pages/LoginContek'
import AgendamentoPublico from '@/pages/AgendamentoPublico'
import ConfirmacaoPublica from '@/pages/ConfirmacaoPublica'
import { FeatureGate, SuperAdminRoute } from '@/components/FeatureGate'
import SuperAdminLayout from '@/components/SuperAdminLayout'
import Index from '@/pages/Index'
import NotFound from '@/pages/NotFound'
import { Toaster } from '@/components/ui/sonner'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 font-['Poppins',sans-serif]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando AGYLI...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    let target = '/login'
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('logout_redirect_to')
      if (stored) {
        sessionStorage.removeItem('logout_redirect_to')
        target = stored
      }
    }
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}

const RootRoute: React.FC = () => {
  const { user, loading, isSuperAdmin, organization } = useAuth()

  // Enquanto verifica o estado da sessão
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] text-slate-100 flex items-center justify-center p-4 font-['Poppins',sans-serif]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#3B82F6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-medium">Carregando...</p>
        </div>
      </div>
    )
  }

  // 1. Visitante deslogado na raiz (/): exibe a Landing Page de vendas pública
  // Apresentação dos dois produtos (AGYLI e MARKALY), preços, 7 dias grátis e chancela Grupo CONTEK.
  if (!user) {
    return <Index />
  }

  // 2. Se o usuário logado for SuperAdmin (ex.: equipe Contek):
  // Se tiver selecionado uma empresa ativa (organization carregada via contek_active_org_id),
  // exibe o painel operacional daquela empresa (Dashboard).
  // Caso contrário, sem empresa ativa selecionada, vai para a Central Contek (/contek).
  if (isSuperAdmin) {
    if (organization) {
      return (
        <Layout>
          <Dashboard />
        </Layout>
      )
    }
    return <Navigate to="/contek" replace />
  }

  // 3. Clientes comuns autenticados: exibem o painel da própria empresa (Dashboard dentro de Layout)
  return (
    <Layout>
      <Dashboard />
    </Layout>
  )
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
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />
          <Route path="/reset-password" element={<RedefinirSenha />} />

          {/* Acesso exclusivo e discreto da equipe Contek */}
          <Route path="/acesso-contek" element={<LoginContek />} />
          <Route path="/contek-login" element={<LoginContek />} />
          <Route path="/admin-contek" element={<Navigate to="/contek" replace />} />

          {/* Central Contek Hub (Exclusivo SuperAdmin) */}
          <Route
            path="/contek"
            element={
              <SuperAdminRoute>
                <CentralContek />
              </SuperAdminRoute>
            }
          />

          {/* Rota Raiz (/) pública para visitantes deslogados (Landing Page de Vendas) e painel para logados */}
          <Route path="/" element={<RootRoute />} />

          {/* Protected Internal Routes */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Mantém compatibilidade com Route index de subrotas se acessado */}
            <Route path="/painel" element={<Dashboard />} />
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
                  fallbackTitle="Disponível no AGYLI Pro"
                  fallbackMessage="O Assistente IA inteligente com memória de negócios e insights analíticos é exclusivo do plano AGYLI Pro. No MARKALY Essencial, a inteligência artificial não está habilitada."
                >
                  <AssistenteIa />
                </FeatureGate>
              }
            />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          {/* Painel SuperAdmin Contek - Layout Corporativo Próprio (/admin) */}
          <Route
            path="/admin"
            element={
              <SuperAdminRoute>
                <SuperAdminLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<SuperAdmin />} />
            <Route path="financeiro" element={<FinanceiroContek />} />
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
