import React, { useState } from 'react'

export interface WhatsAppFloatingButtonProps {
  /**
   * Número de WhatsApp no formato internacional sem formatação (padrão: Luciana 5515996327431)
   */
  phoneNumber?: string
  /**
   * Mensagem inicial pré-preenchida para iniciar o atendimento.
   */
  defaultMessage?: string
  /**
   * Texto exibido na bolha expansível no hover desktop.
   */
  bubbleText?: string
  /**
   * Subtexto ou CTA curto opcional exibido na bolha.
   */
  bubbleSubtext?: string
  /**
   * Contexto ou variante de marca opcional ('agyli' | 'contek' | 'markaly' | 'default')
   */
  brandContext?: 'agyli' | 'contek' | 'markaly' | 'default'
  /**
   * Classes extras para ajuste fino de espaçamento/posicionamento quando necessário.
   */
  className?: string
  /**
   * Identificador para testes automatizados.
   */
  testId?: string
}

export const LUCIANA_WHATSAPP_NUMBER = '5515996327431'
export const DEFAULT_WHATSAPP_MESSAGE = 'Olá! Vi o site do AGYLI e tenho uma dúvida.'
export const DEFAULT_BUBBLE_TEXT = 'Ficou com dúvida? Fale com a gente!'

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({
  phoneNumber = LUCIANA_WHATSAPP_NUMBER,
  defaultMessage = DEFAULT_WHATSAPP_MESSAGE,
  bubbleText = DEFAULT_BUBBLE_TEXT,
  bubbleSubtext = 'Conversar no WhatsApp',
  brandContext = 'default',
  className = '',
  testId = 'whatsapp-floating-button',
}) => {
  const [isHovered, setIsHovered] = useState(false)

  const cleanNumber = phoneNumber.replace(/\D/g, '')
  const encodedText = encodeURIComponent(defaultMessage)
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedText}`

  return (
    <aside
      aria-label="Atendimento via WhatsApp com Luciana"
      className={`fixed bottom-6 right-6 z-40 pointer-events-none flex items-center justify-end select-none ${className}`}
      data-testid={testId}
      data-brand-context={brandContext}
    >
      <div
        className="pointer-events-auto flex items-center gap-3 relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
      >
        {/* Balão / Bolha curta no desktop (oculto no mobile) */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="whatsapp-floating-bubble"
          className={`hidden md:flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[#0D1B2A]/95 text-slate-100 border border-slate-700/80 shadow-2xl backdrop-blur-md transition-all duration-300 origin-right ${
            isHovered
              ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto shadow-[#25D366]/20'
              : 'opacity-0 translate-x-4 scale-95 pointer-events-none'
          }`}
          aria-hidden={!isHovered}
        >
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-white tracking-wide leading-tight">
              {bubbleText}
            </span>
            <span className="text-[11px] text-[#25D366] font-medium flex items-center gap-1 leading-snug">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              {bubbleSubtext}
            </span>
          </div>
          {/* Ponta da bolha apontando para o botão */}
          <div className="w-2 h-2 bg-[#0D1B2A]/95 border-t border-r border-slate-700/80 rotate-45 -mr-1.5 shrink-0 hidden sm:block" />
        </a>

        {/* Bolinha Verde Oficial WhatsApp (#25D366) */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir conversa no WhatsApp com a Luciana"
          data-testid="whatsapp-floating-action"
          className="relative flex items-center justify-center w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white shadow-lg hover:shadow-2xl shadow-[#25D366]/40 hover:scale-108 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40"
          style={{ backgroundColor: '#25D366' }}
        >
          {/* Pulso de radar suave */}
          <span
            className="absolute -inset-1 rounded-full bg-[#25D366] opacity-30 animate-ping pointer-events-none"
            aria-hidden="true"
          />

          {/* Ícone oficial do WhatsApp (SVG preciso) */}
          <svg
            viewBox="0 0 32 32"
            className="w-8 h-8 fill-current relative z-10 drop-shadow-sm"
            aria-hidden="true"
          >
            <path d="M16.01 3C8.835 3 3 8.834 3 16.009c0 2.476.69 4.793 1.889 6.77L3 30l7.447-1.854c1.897 1.054 4.077 1.637 6.398 1.637 7.175 0 13.01-5.835 13.01-13.01C29.855 9.598 23.943 3 16.01 3zm0 24.03c-2.072 0-4.043-.559-5.759-1.536l-.413-.235-4.27 1.063 1.142-4.148-.272-.432c-1.127-1.79-1.724-3.864-1.724-6.009 0-6.084 4.95-11.033 11.033-11.033 6.084 0 11.033 4.949 11.033 11.033 0 6.084-4.95 11.033-11.033 11.033zm6.046-8.243c-.332-.166-1.964-.97-2.269-1.08-.304-.11-.525-.166-.747.166-.221.332-.858 1.08-1.052 1.302-.194.221-.387.249-.72.083-.332-.166-1.402-.517-2.67-1.648-.988-.88-1.654-1.968-1.848-2.3-.194-.332-.021-.511.146-.677.15-.149.332-.387.498-.581.166-.194.221-.332.332-.553.111-.222.055-.415-.028-.581-.083-.166-.747-1.8-1.024-2.467-.27-.648-.544-.56-.747-.57-.193-.01-.415-.012-.636-.012-.222 0-.582.083-.886.415-.304.332-1.163 1.135-1.163 2.768 0 1.633 1.19 3.211 1.357 3.433.166.221 2.34 3.573 5.669 5.011.792.343 1.41.547 1.892.701.796.253 1.52.217 2.093.132.639-.095 1.964-.803 2.241-1.577.277-.775.277-1.439.194-1.577-.083-.139-.304-.221-.636-.388z" />
          </svg>
        </a>
      </div>
    </aside>
  )
}

export default WhatsAppFloatingButton
