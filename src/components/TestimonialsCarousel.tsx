import React, { useState, useEffect } from 'react'
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TestimonialItem {
  id: string
  name: string
  roleAndBusiness: string
  cityState: string
  quote: string
  rating: number
  avatarInitials: string
  highlightBadge?: string
}

export const TESTIMONIALS_DATA: TestimonialItem[] = [
  {
    id: '1',
    name: 'Ana Paula Ferreira',
    roleAndBusiness: 'Proprietária do Salão Bella Hair',
    cityState: 'Belo Horizonte, MG',
    quote:
      'A economia de tempo foi imediata! Antes passávamos metade da tarde trocando mensagens no WhatsApp para marcar uma cliente. Com o link de agendamento online e os avisos automáticos, zeramos as faltas sem aviso e a organização da equipe melhorou 100%.',
    rating: 5,
    avatarInitials: 'AP',
    highlightBadge: 'Salão de Beleza',
  },
  {
    id: '2',
    name: 'Camila Guimarães',
    roleAndBusiness: 'Espaço Camila Guimarães Estética & Sobrancelhas',
    cityState: 'Ribeirão Preto, SP',
    quote:
      'O sistema é muito intuitivo. As clientes adoram receber o lembrete com botão de confirmação e poder escolher o serviço sozinhas. Para quem atende sozinha ou tem equipe pequena, o Contek Agenda é indispensável!',
    rating: 5,
    avatarInitials: 'CG',
    highlightBadge: 'Clínica de Estética',
  },
  {
    id: '3',
    name: 'Rodrigo Medeiros',
    roleAndBusiness: 'Barbearia Dom Medeiros',
    cityState: 'Curitiba, PR',
    quote:
      'Nossos barbeiros tinham muita confusão com horários e clientes esquecendo. A redução de faltas depois da confirmação pelo WhatsApp foi absurda — caiu mais de 80%. Não troco por nada.',
    rating: 5,
    avatarInitials: 'RM',
    highlightBadge: 'Barbearia Premium',
  },
  {
    id: '4',
    name: 'Dra. Mariana Vasconcelos',
    roleAndBusiness: 'Clínica Harmonize Dermatologia & Estética',
    cityState: 'Goiânia, GO',
    quote:
      'A gestão multi-profissional é perfeita. Cada profissional tem sua agenda organizada, com os tempos exatos dos procedimentos e controle completo dos atendimentos. O suporte do Grupo Contek também é nota dez!',
    rating: 5,
    avatarInitials: 'MV',
    highlightBadge: 'Clínica Médica / Estética',
  },
  {
    id: '5',
    name: 'Juliana Siqueira',
    roleAndBusiness: 'Studio Ju Siqueira Nails & Hair',
    cityState: 'Campinas, SP',
    quote:
      'A possibilidade de encaixar clientes nos intervalos de procedimentos longos, como tinturas e mechas, salvou a nossa rotina! Aumentamos o faturamento do salão sem estresse e com a agenda sempre cheia.',
    rating: 5,
    avatarInitials: 'JS',
    highlightBadge: 'Studio de Beleza',
  },
  {
    id: '6',
    name: 'Patrícia Neves',
    roleAndBusiness: 'Centro de Beleza e Spa Patrícia Neves',
    cityState: 'Florianópolis, SC',
    quote:
      'A facilidade de uso encantou tanto nossas profissionais quanto as clientes mais idosas. O sistema roda rápido no celular, a confirmação é prática e o controle financeiro integrado fechou com chave de ouro.',
    rating: 5,
    avatarInitials: 'PN',
    highlightBadge: 'Spa & Bem-estar',
  },
]

interface TestimonialsCarouselProps {
  productName?: string
  accentColor?: 'blue' | 'purple' | 'cyan'
}

export const TestimonialsCarousel: React.FC<TestimonialsCarouselProps> = ({
  productName = 'CONTEK AGENDA',
  accentColor = 'blue',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const total = TESTIMONIALS_DATA.length

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % total)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + total) % total)
  }

  // Autoplay suave (a cada 6 segundos, pausa com hover)
  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => {
      nextTestimonial()
    }, 6000)
    return () => clearInterval(interval)
  }, [isPaused, total])

  // Get active items for desktop (showing 2-3 items)
  const getVisibleItems = () => {
    const items = []
    for (let i = 0; i < 3; i++) {
      items.push(TESTIMONIALS_DATA[(currentIndex + i) % total])
    }
    return items
  }

  const visibleItems = getVisibleItems()

  return (
    <section
      data-testid="testimonials-section"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="text-center space-y-3 mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-300">
          <Quote className="w-3.5 h-3.5 text-blue-400" />
          Depoimentos de quem usa no dia a dia
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Aprovado por quem vive da rotina de beleza, estética e saúde
        </h2>
        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
          Veja como salões, clínicas e barbearias de todo o Brasil organizaram suas agendas,
          reduziram as faltas e ganharam horas preciosas com o {productName}.
        </p>
      </div>

      {/* CAROUSEL WRAPPER */}
      <div className="relative">
        {/* Navigation Buttons (Desktop side floating) */}
        <div className="hidden lg:flex justify-between absolute top-1/2 -left-4 -right-4 -translate-y-1/2 pointer-events-none z-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={prevTestimonial}
            aria-label="Depoimento anterior"
            className="w-11 h-11 rounded-full pointer-events-auto bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800 hover:text-white shadow-xl backdrop-blur transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={nextTestimonial}
            aria-label="Próximo depoimento"
            className="w-11 h-11 rounded-full pointer-events-auto bg-slate-900/90 border-slate-700 text-white hover:bg-slate-800 hover:text-white shadow-xl backdrop-blur transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* MOBILE: 1 por vez com transição suave */}
        <div className="md:hidden">
          {(() => {
            const item = TESTIMONIALS_DATA[currentIndex]
            return (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4 relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  {item.highlightBadge && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                      {item.highlightBadge}
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-200 leading-relaxed italic">"{item.quote}"</p>

                <div className="pt-3 border-t border-slate-800/80 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                    {item.avatarInitials}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{item.roleAndBusiness}</p>
                    <p className="text-[11px] text-slate-500 font-medium">{item.cityState}</p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* DESKTOP & TABLET: 2 a 3 visíveis com profundidade */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleItems.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 shadow-xl flex flex-col justify-between space-y-4 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  {item.highlightBadge && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                      {item.highlightBadge}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
                  "{item.quote}"
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800/80 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                  {item.avatarInitials}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                  <p className="text-xs text-slate-400 truncate">{item.roleAndBusiness}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{item.cityState}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CONTROLES / INDICADORES (Mobile e Desktop) */}
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevTestimonial}
            className="text-slate-400 hover:text-white hover:bg-slate-800/60 h-8 px-2"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span className="text-xs">Anterior</span>
          </Button>

          <div className="flex items-center gap-1.5">
            {TESTIMONIALS_DATA.map((_, dotIdx) => (
              <button
                key={dotIdx}
                type="button"
                onClick={() => setCurrentIndex(dotIdx)}
                aria-label={`Ir para depoimento ${dotIdx + 1}`}
                className={`h-2 rounded-full transition-all ${
                  currentIndex === dotIdx
                    ? 'w-6 bg-blue-500'
                    : 'w-2 bg-slate-700 hover:bg-slate-600'
                }`}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={nextTestimonial}
            className="text-slate-400 hover:text-white hover:bg-slate-800/60 h-8 px-2"
          >
            <span className="text-xs">Próximo</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </section>
  )
}

export default TestimonialsCarousel
