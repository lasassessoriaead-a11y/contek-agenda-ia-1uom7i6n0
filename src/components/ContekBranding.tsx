import React, { useState } from 'react'
import contekSymbolBundled from '@/assets/c-da-contek-23a2f.png'
import contekFullLogoBundled from '@/assets/logo-contek-correto-25856.png'

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
  fullLogo: contekFullLogoBundled || '/contek-logo-full.png',
  symbol: contekSymbolBundled || '/contek-symbol.png',
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
  const [imgSrc, setImgSrc] = useState<string>(contekSymbolBundled || '/contek-symbol.png')
  const [hasError, setHasError] = useState(false)

  const handleImageError = () => {
    if (imgSrc !== '/contek-symbol.png') {
      setImgSrc('/contek-symbol.png')
    } else {
      setHasError(true)
    }
  }

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
      {!hasError ? (
        <img
          src={imgSrc}
          alt={alt}
          onError={handleImageError}
          className="w-full h-full object-contain relative z-10"
          loading="eager"
        />
      ) : (
        /* Fallback vetorial fiel e nítido do Símbolo C Oficial da Contek */
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full relative z-10 select-none drop-shadow-sm"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="contek-c-grad-outer" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
            <linearGradient id="contek-c-grad-inner" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#84CC16" />
            </linearGradient>
          </defs>
          {/* Arco externo do C com extremidades arredondadas */}
          <path
            d="M 68 22 C 55 12 36 14 24 26 C 10 40 10 60 24 74 C 36 86 55 88 68 78"
            stroke="url(#contek-c-grad-outer)"
            strokeWidth="13"
            strokeLinecap="round"
          />
          {/* Arco interno sobreposto característico do símbolo C Contek */}
          <path
            d="M 58 36 C 48 28 38 30 32 38 C 24 46 24 54 32 62 C 38 70 48 72 58 64"
            stroke="url(#contek-c-grad-inner)"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>
      )}
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
  const [imgSrc, setImgSrc] = useState<string>(contekFullLogoBundled || '/contek-logo-full.png')
  const [hasError, setHasError] = useState(false)

  const handleImageError = () => {
    if (imgSrc !== '/contek-logo-full.png') {
      setImgSrc('/contek-logo-full.png')
    } else {
      setHasError(true)
    }
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      {!hasError ? (
        <img
          src={imgSrc}
          alt={alt}
          onError={handleImageError}
          style={{ height: h, width: 'auto' }}
          className={`object-contain max-w-full ${
            theme === 'dark' ? 'drop-shadow-[0_2px_12px_rgba(6,182,212,0.25)]' : ''
          }`}
          loading="eager"
        />
      ) : (
        <div className="flex items-center gap-2.5">
          <ContekSymbol size={typeof height === 'number' ? height : 36} />
          <div className="flex flex-col text-left">
            <span
              className={`font-black text-lg tracking-tight uppercase leading-tight font-poppins ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              GRUPO CONTEK
            </span>
            <span
              className={`text-[9px] font-semibold tracking-wider uppercase font-poppins ${
                theme === 'light' ? 'text-slate-500' : 'text-cyan-400'
              }`}
            >
              Tecnologia e Consultoria
            </span>
          </div>
        </div>
      )}
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
