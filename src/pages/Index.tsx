import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles,
  ShieldCheck,
  Check,
  ArrowRight,
  Clock,
  HeartHandshake,
  Star,
  Zap,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TestimonialsCarousel } from '@/components/TestimonialsCarousel'
import { AgyliLogo } from '@/components/AgyliBranding'
import { ContekSymbol, ContekFullLogo } from '@/components/ContekBranding'
import { resolveBrandDomainContext, type BrandDomainContext } from '@/lib/branding'
import { pb } from '@/lib/pocketbase/client'
import type { Plan } from '@/types'

interface IndexProps {
  /**
   * Força um contexto de domínio específico (útil para testes ou preview).
   * Se omitido, infere automaticamente a partir de window.location.hostname.
   */
  forcedDomainContext?: BrandDomainContext
}

export const Index: React.FC<IndexProps> = ({ forcedDomainContext }) => {
  const domainContext: BrandDomainContext = useMemo(() => {
    if (forcedDomainContext) return forcedDomainContext
    if (typeof window !== 'undefined') {
      return resolveBrandDomainContext(window.location.hostname)
    }
    return 'default'
  }, [forcedDomainContext])

  const isAgyliDomain = domainContext === 'agyli'
  const isContekDomain = domainContext === 'contek'

  // Preços dinâmicos da coleção plans (com fallbacks padrão caso offline)
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    let isMounted = true
    pb.collection('plans')
      .getFullList<Plan>({
        filter: 'active = true',
        sort: 'price_monthly',
      })
      .then((records) => {
        if (isMounted && records.length > 0) {
          setPlans(records)
        }
      })
      .catch(() => {
        // Fallback silencioso mantendo os valores padrão
      })
    return () => {
      isMounted = false
    }
  }, [])

  const essencialPrice = useMemo(() => {
    const p = plans.find((item) => item.slug === 'agyli-essencial')
    return p?.price_monthly ?? 19.9
  }, [plans])

  const proPrice = useMemo(() => {
    const p = plans.find((item) => item.slug === 'agyli-pro')
    return p?.price_monthly ?? 29.9
  }, [plans])

  const formatPrice = (val: number) => {
    return Number(val).toFixed(2).replace('.', ',')
  }

  return (
    <div
      data-testid="index-root"
      data-domain-context={domainContext}
      className="min-h-screen bg-[#0A0F1D] text-slate-100 flex flex-col font-['Poppins',sans-serif] selection:bg-[#3B82F6] selection:text-white"
    >
      {/* NAVBAR SUPERIOR */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#0D1B2A]/85 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isAgyliDomain ? (
              <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
                <AgyliLogo height={38} theme="dark" showSlogan={false} showSignature={false} />
              </Link>
            ) : (
              <Link to="/" className="flex items-center gap-2 hover:opacity-95 transition-opacity">
                <ContekFullLogo height={38} theme="dark" />
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Acesso ao SuperAdmin em destaque exclusivo para o domínio CONTEK */}
            {isContekDomain && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-blue-500/50 bg-blue-950/40 text-blue-300 hover:text-white hover:bg-blue-900/60 text-xs sm:text-sm font-semibold rounded-xl"
                data-testid="contek-admin-link"
              >
                <Link to="/admin">
                  <Lock className="w-3.5 h-3.5 mr-1 text-blue-400" />
                  Painel SuperAdmin
                </Link>
              </Button>
            )}

            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs sm:text-sm font-medium"
            >
              <Link to={isAgyliDomain ? '/login?brand=agyli' : '/login'}>Entrar</Link>
            </Button>

            <Button
              asChild
              size="sm"
              className={
                isAgyliDomain
                  ? 'bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/25 rounded-xl'
                  : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/20 rounded-xl'
              }
            >
              <Link to={isAgyliDomain ? '/login?tab=signup&brand=agyli' : '/login?tab=signup'}>
                Começar 7 dias grátis
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8">
        {/* Ambient Glow */}
        {isAgyliDomain ? (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-gradient-to-tr from-[#1E3A8A]/35 via-[#2563EB]/25 to-[#38BDF8]/20 rounded-full blur-3xl pointer-events-none" />
        ) : (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] bg-gradient-to-tr from-[#1E3A8A]/25 via-[#7C3AED]/20 to-[#EC4899]/15 rounded-full blur-3xl pointer-events-none" />
        )}

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
          {/* Badge institucional */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-medium text-slate-300 shadow-sm">
            <ContekSymbol size={16} />
            <span>
              Uma solução oficial do <strong className="text-white">Grupo CONTEK</strong>
            </span>
          </div>

          {/* Título do Hero */}
          {isAgyliDomain ? (
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              A agenda com IA que{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#93C5FD]">
                organiza seus agendamentos
              </span>{' '}
              e multiplica seu faturamento.
            </h1>
          ) : (
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              A agenda online inteligente que{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#818CF8] to-[#EC4899]">
                organiza seu dia
              </span>{' '}
              e atrai clientes.
            </h1>
          )}

          {/* Descrição do Hero */}
          {isAgyliDomain ? (
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Elimine faltas com confirmações online, receba pagamentos com facilidade, controle seu
              financeiro completo e conte com uma recepcionista virtual de Inteligência Artificial
              para o seu negócio.
            </p>
          ) : (
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Elimine faltas, marque horários 24 horas por dia e receba pagamentos com facilidade.
              Escolha a solução que melhor se adapta ao momento do seu negócio.
            </p>
          )}

          {/* CTA Principal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              asChild
              size="lg"
              className={
                isAgyliDomain
                  ? 'w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#60A5FA] hover:opacity-95 text-white shadow-xl shadow-blue-500/25 rounded-xl transition-all'
                  : 'w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] hover:opacity-95 text-white shadow-xl shadow-blue-500/25 rounded-xl transition-all'
              }
            >
              <Link to="/login?tab=signup&brand=agyli">
                Começar 7 dias grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-6 border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-200 text-sm font-medium rounded-xl"
            >
              <a href="#produtos">
                {isAgyliDomain ? 'Ver recursos e plano' : 'Ver soluções e preços'}
              </a>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 pt-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 7 dias de teste grátis
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Sem taxa de adesão
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-4 h-4 text-blue-400" /> Cancele quando quiser
            </span>
          </div>
        </div>
      </section>

      {/* SEÇÃO DE PRODUTO(S) */}
      <section
        id="produtos"
        className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-slate-950/60 border-t border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Cabeçalho da seção */}
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Planos sob medida para o seu atendimento
            </h2>
            <p className="text-sm sm:text-base text-slate-400">
              Escolha o plano ideal para a sua rotina: do agendamento ágil para 1 profissional à
              plataforma completa com inteligência artificial e financeiro integrado.
            </p>
          </div>
          {/* Grid dos dois planos AGYLI (Essencial e Pro) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* PLANO 1: AGYLI ESSENCIAL */}
            <div
              data-testid="agyli-essencial-card"
              className="relative rounded-3xl p-6 sm:p-8 border border-cyan-500/30 bg-gradient-to-b from-[#0B1E33] to-[#0A1626] shadow-xl shadow-cyan-950/30 flex flex-col justify-between"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" /> Essencial & Ágil
                </span>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <AgyliLogo height={40} theme="dark" showSlogan={false} showSignature={false} />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white">AGYLI Essencial</h3>
                  <p className="text-xs text-cyan-300 font-medium mt-0.5">
                    Focado em 1 profissional • Agendamento inteligente descomplicado
                  </p>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Perfeito para autônomos, consultórios individuais, manicures, barbearias e
                    esteticistas que buscam uma agenda ágil, controle de clientes e link público sem
                    complexidade.
                  </p>
                </div>

                {/* Preço */}
                <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">
                      Investimento mensal
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">
                        R$ {formatPrice(essencialPrice)}
                      </span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5" /> 7 dias grátis
                    </span>
                  </div>
                </div>

                {/* Recursos inclusos */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    O que está incluso no AGYLI Essencial:
                  </p>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>1 Profissional:</strong> Gerenciamento exclusivo para você ou seu
                        atendente.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Agenda Online em Tempo Real:</strong> Marcação rápida presencial e
                        online 24h.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Cadastro de Clientes e Serviços:</strong> Histórico de visitas e
                        catálogo de procedimentos.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Link Público Personalizado:</strong> Seu link exclusivo{' '}
                        <code>/agendar/sua-empresa</code>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Confirmações Online:</strong> Menos faltas com lembretes e
                        notificações.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  asChild
                  className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-cyan-500/20"
                >
                  <Link to="/login?tab=signup&brand=agyli&plan=agyli-essencial">
                    Começar 7 dias grátis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* PLANO 2: AGYLI PRO */}
            <div
              data-testid="agyli-product-card"
              className="relative rounded-3xl p-6 sm:p-8 border border-blue-500/40 bg-gradient-to-b from-[#0F1E38] to-[#0D1527] shadow-2xl shadow-blue-950/50 flex flex-col justify-between"
            >
              <div className="absolute top-4 right-4">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 border border-blue-400/40 text-blue-300">
                  <Star className="w-3.5 h-3.5 text-blue-400 fill-blue-400" /> Mais Completo
                </span>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <AgyliLogo height={40} theme="dark" showSlogan={false} showSignature={false} />
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white">AGYLI Pro</h3>
                  <p className="text-xs text-blue-300 font-medium mt-0.5">
                    Até 5 profissionais • Financeiro total + IA integrada + Encaixes
                  </p>
                  <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                    Ideal para clínicas, consultórios, salões e equipes que necessitam de controle
                    financeiro completo com comissões, recepção WhatsApp por IA e relatórios
                    estratégicos.
                  </p>
                </div>

                {/* Preço */}
                <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/50 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">
                      Investimento mensal
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-white">
                        R$ {formatPrice(proPrice)}
                      </span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5" /> 7 dias grátis
                    </span>
                  </div>
                </div>

                {/* Recursos inclusos */}
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    O que está incluso no AGYLI Pro:
                  </p>
                  <ul className="space-y-2.5 text-xs sm:text-sm text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Até 5 Profissionais:</strong> Múltiplas agendas simultâneas com
                        turnos independentes.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Módulo Financeiro Completo:</strong> Fluxo de caixa, recebimentos e
                        cálculo de comissões por profissional.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Assistente de IA & WhatsApp:</strong> Agente inteligente para
                        atendimento, tirar dúvidas e apoio na recepção.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Encaixes Inteligentes & Relatórios:</strong> Otimização da ocupação
                        de horários e análise de desempenho.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <span>
                        <strong>Página Pública & Lembretes:</strong> Link{' '}
                        <code>/agendar/sua-empresa</code> personalizado e confirmação de presença.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  asChild
                  className="w-full h-12 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/25"
                >
                  <Link to="/login?tab=signup&brand=agyli&plan=agyli-pro">
                    Começar 7 dias grátis
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>{' '}
        </div>
      </section>

      {/* CARROSSEL DE DEPOIMENTOS DE CLIENTES REAIS */}
      <TestimonialsCarousel
        productName={
          isAgyliDomain ? 'AGYLI Pro' : isContekDomain ? 'Grupo CONTEK' : 'CONTEK AGENDA'
        }
      />

      {/* DIFERENCIAIS EM PORTUGUÊS CLARO */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Por que nossos clientes adoram
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Criado com foco em simplicidade e usabilidade para que você não perca tempo com sistemas
            complicados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Mais tempo livre no seu dia</h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Deixe que seus próprios clientes escolham os melhores horários pela internet. Menos
              mensagens de WhatsApp para responder manualmente.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Fim das faltas sem aviso</h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              A página de confirmação simples avisa quem realmente comparecerá ao atendimento,
              liberando horários vagos com antecedência.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h4 className="text-base font-bold text-white">Suporte humanizado Contek</h4>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Conte com a equipe do Grupo CONTEK para tirar dúvidas, orientar sua equipe e garantir
              a estabilidade do seu sistema.
            </p>
          </div>
        </div>
      </section>

      {/* BANNER FINAL DE CONVITE */}
      <section className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-r from-[#1E3A8A]/40 via-[#7C3AED]/40 to-[#0D1B2A] border border-blue-500/30 shadow-2xl relative overflow-hidden space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-cyan-200">
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            Experimente sem compromisso
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Pronto para transformar a gestão dos seus agendamentos?
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
            Cadastre sua empresa em menos de 2 minutos e comece a utilizar hoje mesmo com 7 dias
            grátis.
          </p>

          <div className="pt-2">
            <Button
              asChild
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-white text-slate-950 hover:bg-slate-100 shadow-xl rounded-xl transition-all"
            >
              <Link to="/login?tab=signup&brand=agyli">
                Começar 7 dias grátis agora
                <ArrowRight className="w-5 h-5 ml-2 text-blue-600" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* RODAPÉ INSTITUCIONAL GRUPO CONTEK */}
      <footer className="mt-auto border-t border-slate-800 bg-[#080D1A] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col items-center justify-center space-y-6 text-center">
          <div className="flex items-center justify-center gap-2">
            {isAgyliDomain ? (
              <AgyliLogo height={32} theme="dark" showSlogan={false} showSignature={false} />
            ) : (
              <ContekFullLogo height={32} theme="dark" />
            )}
          </div>

          <p className="text-xs text-slate-400 max-w-lg">
            Plataforma Corporativa de Agendamento e Gestão Online. Uma solução desenvolvida e
            mantida por{' '}
            <strong className="text-slate-200 font-semibold">
              Grupo CONTEK — Tecnologia e Consultoria
            </strong>
            .
          </p>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <Link
              to={isAgyliDomain ? '/login?brand=agyli' : '/login'}
              className="hover:text-white transition-colors"
            >
              Área de Acesso do Cliente
            </Link>
            <span>•</span>
            <Link
              to={isAgyliDomain ? '/login?tab=signup&brand=agyli' : '/login?tab=signup'}
              className="hover:text-white transition-colors"
            >
              Criar Empresa (7 dias grátis)
            </Link>
            <span>•</span>
            <Link to="/agendar/contek-demo" className="hover:text-white transition-colors">
              Exemplo de Agendamento
            </Link>
            {isContekDomain && (
              <>
                <span>•</span>
                <Link
                  to="/admin"
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  data-testid="contek-admin-footer-link"
                >
                  Painel SuperAdmin (/admin)
                </Link>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800/80 w-full flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-center sm:text-left">
              <span>© {new Date().getFullYear()} Grupo CONTEK. Todos os direitos reservados.</span>
              <span className="hidden sm:inline text-slate-700">•</span>
              <span className="text-slate-400 font-medium font-mono">CNPJ 47.769.566/0001-46</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">AGYLI — Uma solução Grupo CONTEK</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Index
