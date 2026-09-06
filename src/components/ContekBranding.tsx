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
/**
 * Renderizador Vetorial 100% puro do Símbolo C Oficial da CONTEK.
 * Zero dependência de rede, zero falha, nitidez vetorial máxima em qualquer DPI.
 * Arcos característicos em gradiente: #1E3A8A (Azul) → #06B6D4 (Ciano) → #22C55E (Verde).
 */
export const ContekSymbolVector: React.FC<{ className?: string; title?: string }> = ({
  className = '',
  title = 'Símbolo Oficial CONTEK',
}) => {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`w-full h-full select-none ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="contek-c-outer" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="45%" stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient id="contek-c-inner" x1="20%" y1="90%" x2="90%" y2="20%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="65%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#84CC16" />
        </linearGradient>
      </defs>
      {/* Arco externo do C com extremidades arredondadas e espessura balanceada */}
      <path
        d="M 68 22 C 55 12 36 14 24 26 C 10 40 10 60 24 74 C 36 86 55 88 68 78"
        stroke="url(#contek-c-outer)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      {/* Arco interno sobreposto característico do símbolo C Contek */}
      <path
        d="M 58 36 C 48 28 38 30 32 38 C 24 46 24 54 32 62 C 38 70 48 72 58 64"
        stroke="url(#contek-c-inner)"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Símbolo C Oficial da CONTEK (arcos sobrepostos em azul, ciano e verde)
 * Usado exclusivamente em favicons, avatares, PWA, botões, mobile e cabeçalhos compactos.
 *
 * Estratégia de exibição à prova de falhas:
 * 1. O SVG vetorial está SEMPRE montado imediatamente no fundo — nunca há caixa de imagem quebrada nem flash em branco.
 * 2. Caso a imagem raster PNG carregue com sucesso, ela faz fade-in suave por cima.
 * 3. Se a imagem PNG falhar (offline, erro 404, bloqueador), o SVG vetorial permanece ativo perfeitamente.
 */
export const ContekSymbol: React.FC<ContekSymbolProps> = ({
  size = 40,
  className = '',
  alt = 'Símbolo Oficial Contek',
  glow = false,
}) => {
  const dimension = typeof size === 'number' ? `${size}px` : size
  const [imgFailed, setImgFailed] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // Asset oficial via bundler (prioritário) ou fallback do public
  const resolvedSrc = contekSymbolBundled || '/contek-symbol.png'

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
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

      {/* SVG vetorial como base nativa ininterrupta — NUNCA QUEBRA */}
      <div
        className="w-full h-full flex items-center justify-center relative z-10"
        style={{ display: imgLoaded ? 'none' : 'flex' }}
      >
        <ContekSymbolVector title={alt} />
      </div>

      {/* Imagem raster oficial sobreposta quando disponível */}
      {!imgFailed && resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          className={`w-full h-full object-contain relative z-20 transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
          loading="eager"
        />
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
/**
 * Logotipo Horizontal Completo Oficial do GRUPO CONTEK
 * Wordmark: "GRUPO CONTEK — TECNOLOGIA E CONSULTORIA" + Símbolo C
 *
 * Estratégia de fallback à prova de falhas:
 * 1. O layout vetorial oficial com o ContekSymbolVector + tipografia Poppins oficial está SEMPRE pronto.
 * 2. Se a imagem oficial carregou com sucesso, renderiza a imagem.
 * 3. Se falhar ou estiver carregando, o layout vetorial garante visual impecável sem caixa quebrada.
 */
export const ContekFullLogo: React.FC<ContekFullLogoProps> = ({
  className = '',
  height = 48,
  alt = 'Grupo CONTEK — Tecnologia e Consultoria',
  theme = 'auto',
}) => {
  const h = typeof height === 'number' ? `${height}px` : height
  const numericHeight = typeof height === 'number' ? height : parseInt(String(height), 10) || 48
  const [imgFailed, setImgFailed] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const resolvedSrc = contekFullLogoBundled || '/contek-logo-full.png'

  return (
    <div className={`inline-flex items-center select-none ${className}`} style={{ minHeight: h }}>
      {/* Fallback vetorial tipográfico impecável (ativo enquanto a imagem não carrega ou se falhar) */}
      <div className="items-center gap-2.5" style={{ display: imgLoaded ? 'none' : 'inline-flex' }}>
        <ContekSymbol size={Math.max(28, Math.round(numericHeight * 0.85))} />
        <div className="flex flex-col text-left leading-tight">
          <span
            className={`font-black tracking-tight uppercase font-poppins ${
              theme === 'light' ? 'text-[#0D1B2A]' : 'text-white'
            }`}
            style={{ fontSize: `${Math.max(13, Math.round(numericHeight * 0.38))}px` }}
          >
            GRUPO CONTEK
          </span>
          <span
            className={`font-semibold tracking-wider uppercase font-poppins ${
              theme === 'light' ? 'text-slate-500' : 'text-[#06B6D4]'
            }`}
            style={{ fontSize: `${Math.max(8, Math.round(numericHeight * 0.2))}px` }}
          >
            Tecnologia e Consultoria
          </span>
        </div>
      </div>

      {/* Imagem raster oficial horizontal com transição suave */}
      {!imgFailed && resolvedSrc && (
        <img
          src={resolvedSrc}
          alt={alt}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgFailed(true)}
          style={{ height: h, width: 'auto' }}
          className={`object-contain max-w-full ${
            theme === 'dark' ? 'drop-shadow-[0_2px_12px_rgba(6,182,212,0.25)]' : ''
          } ${imgLoaded ? 'block' : 'hidden'}`}
          loading="eager"
        />
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
