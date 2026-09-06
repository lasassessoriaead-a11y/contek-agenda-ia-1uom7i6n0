import React from 'react'

/**
 * Identidade Visual Oficial do Grupo CONTEK — Tecnologia e Consultoria
 *
 * PALETA OFICIAL:
 * - Azul-marinho principal (base): #0D1B2A
 * - Azul tecnológico: #1E3A8A
 * - Ciano inovação: #06B6D4
 * - Verde institucional: #22C55E
 * - Verde-lima destaque (moderação): #84CC16
 * - Laranja ação (reservado p/ chamadas e alertas): #F59E0B
 * - Cinza apoio: #64748B
 * - Branco: #FFFFFF
 *
 * TIPOGRAFIA:
 * - Família Poppins
 *
 * LOGOTIPOS:
 * 1. Logo horizontal completa: /contek-logo-full.png
 * 2. Símbolo C oficial: /contek-symbol.png
 */

export const CONTEK_PALETTE = {
  navy: '#0D1B2A',
  blue: '#1E3A8A',
  cyan: '#06B6D4',
  green: '#22C55E',
  lime: '#84CC16',
  orange: '#F59E0B',
  slate: '#64748B',
  white: '#FFFFFF',
} as const

export const CONTEK_ASSETS = {
  fullLogo: '/contek-logo-full.png',
  symbol: '/contek-symbol.png',
} as const

export interface ContekSymbolProps {
  size?: number | string
  className?: string
  alt?: string
  glow?: boolean
}

/**
 * Símbolo C Oficial da CONTEK (arcos sobrepostos em azul, ciano e verde)
 * Usado exclusivamente em favicons, avatares, PWA, botões, mobile e cabeçalhos compactos.
 */
export const ContekSymbol: React.FC<ContekSymbolProps> = ({
  size = 40,
  className = '',
  alt = 'Símbolo Oficial Contek',
  glow = false,
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${CONTEK_PALETTE.cyan} 0%, ${CONTEK_PALETTE.green} 70%, transparent 100%)`,
          }}
        />
      )}
      <img
        src={CONTEK_ASSETS.symbol}
        alt={alt}
        className="w-full h-full object-contain relative z-10"
        loading="eager"
      />
    </div>
  )
}

export interface ContekFullLogoProps {
  className?: string
  height?: number | string
  alt?: string
  theme?: 'dark' | 'light' | 'auto'
}

/**
 * Logotipo Horizontal Completo Oficial do GRUPO CONTEK
 * Wordmark: "GRUPO CONTEK — TECNOLOGIA E CONSULTORIA" + Símbolo C
 */
export const ContekFullLogo: React.FC<ContekFullLogoProps> = ({
  className = '',
  height = 48,
  alt = 'Grupo CONTEK — Tecnologia e Consultoria',
  theme = 'auto',
}) => {
  const h = typeof height === 'number' ? `${height}px` : height

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={CONTEK_ASSETS.fullLogo}
        alt={alt}
        style={{ height: h, width: 'auto' }}
        className={`object-contain max-w-full ${
          theme === 'dark' ? 'drop-shadow-[0_2px_12px_rgba(6,182,212,0.25)]' : ''
        }`}
        loading="eager"
      />
    </div>
  )
}

export interface ContekFooterSignatureProps {
  productName?: string
  className?: string
  variant?: 'subtle' | 'card' | 'badge'
}

/**
 * Assinatura institucional Contek padronizada para rodapés de telas públicas e clientes
 * "Powered by AGYLI • Uma solução Grupo CONTEK"
 */
export const ContekFooterSignature: React.FC<ContekFooterSignatureProps> = ({
  productName = 'AGYLI',
  className = '',
  variant = 'subtle',
}) => {
  if (variant === 'badge') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium font-poppins border shadow-sm ${className}`}
        style={{
          backgroundColor: '#0D1B2A',
          borderColor: 'rgba(6, 182, 212, 0.3)',
          color: '#FFFFFF',
        }}
      >
        <ContekSymbol size={16} />
        <span className="tracking-wide">
          <span className="font-semibold text-[#06B6D4]">{productName}</span>
          <span className="opacity-60 mx-1.5">•</span>
          <span className="opacity-90">Uma solução Grupo CONTEK</span>
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-poppins text-slate-500 ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <ContekSymbol size={18} />
        <span>
          Powered by <strong className="text-slate-700 font-semibold">{productName}</strong>
        </span>
      </div>
      <span className="hidden sm:inline text-slate-300">•</span>
      <span className="text-slate-500">
        Uma solução{' '}
        <span className="font-semibold text-[#0D1B2A] hover:text-[#06B6D4] transition-colors">
          Grupo CONTEK — Tecnologia e Consultoria
        </span>
      </span>
    </div>
  )
}
