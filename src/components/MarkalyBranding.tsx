import React from 'react'

// Ativos oficiais da MARKALY salvos a partir dos anexos do usuário
import markalyAppIconImg from '@/assets/app-marklay-e2ac7.png'
import markalyLogoImg from '@/assets/logo-markaly-ce5ee.png'

export interface MarkalyEmblemProps {
  size?: number | string
  className?: string
  variant?: 'app-icon' | 'vector' | 'flat'
  rounded?: boolean
}

/**
 * Emblema / Ícone oficial da MARKALY:
 * M com 3 dobras/segmentos em gradiente Laranja (#F97316) -> Rosa (#EC4899) -> Roxo (#7C3AED)
 * sobre fundo app-icon roxo escuro (#3B0764) arredondado.
 */
export const MarkalyEmblem: React.FC<MarkalyEmblemProps> = ({
  size = 36,
  className = '',
  variant = 'app-icon',
  rounded = true,
}) => {
  const dimensionStyle =
    typeof size === 'number' ? { width: size, height: size } : { width: size, height: size }

  if (variant === 'app-icon') {
    return (
      <img
        src={markalyAppIconImg}
        alt="MARKALY Emblema Oficial"
        style={dimensionStyle}
        className={`object-contain select-none ${rounded ? 'rounded-xl' : ''} ${className}`}
        loading="eager"
      />
    )
  }

  // SVG vetorial de alta precisão reconstruído estritamente a partir do manual da marca MARKALY
  // M com dobras contínuas e gradiente suave Laranja -> Rosa -> Roxo
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={dimensionStyle}
      className={`select-none ${rounded ? 'rounded-xl overflow-hidden' : ''} ${className}`}
    >
      <defs>
        {/* Gradiente de fundo do ícone app */}
        <linearGradient id="markaly-icon-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E0854" />
          <stop offset="50%" stopColor="#3B0764" />
          <stop offset="100%" stopColor="#1E0338" />
        </linearGradient>

        {/* Gradiente principal do M: Laranja -> Rosa -> Roxo */}
        <linearGradient id="markaly-m-grad" x1="10%" y1="90%" x2="90%" y2="20%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>

        {/* Gradiente para primeira dobra (haste esquerda -> vale central) */}
        <linearGradient id="markaly-m-left" x1="0%" y1="100%" x2="60%" y2="0%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="70%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#F43F5E" />
        </linearGradient>

        {/* Gradiente para dobra intermediária */}
        <linearGradient id="markaly-m-center" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EC4899" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        {/* Gradiente para haste direita */}
        <linearGradient id="markaly-m-right" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* Fundo arredondado squircle se não for flat */}
      {variant !== 'flat' && <rect width="100" height="100" rx="22" fill="url(#markaly-icon-bg)" />}

      {/* Geometria do M estilizado da MARKALY */}
      <g
        transform={variant !== 'flat' ? 'translate(10, 15) scale(0.8)' : 'translate(0, 5) scale(1)'}
      >
        {/* Dobra traseira direita (Roxo) */}
        <path
          d="M 68 82 C 63 82 59 77 62 70 L 78 28 C 80 23 85 20 90 23 C 95 26 97 32 94 38 L 78 80 C 76 83 72 85 68 85 Z"
          fill="url(#markaly-m-right)"
          opacity="0.95"
        />

        {/* Arco superior direito / transição */}
        <path
          d="M 52 48 C 50 32 62 20 76 22 C 86 24 92 34 88 46 L 76 74 C 74 78 69 80 65 77 C 61 74 61 68 64 64 L 72 44 C 74 39 70 34 65 33 C 58 32 53 38 52 48 Z"
          fill="url(#markaly-m-center)"
        />

        {/* Arco frontal esquerdo em fita fluida (Laranja para Rosa) */}
        <path
          d="M 12 76 C 7 70 8 60 14 52 L 32 28 C 38 20 49 19 55 26 C 61 33 60 44 54 52 L 36 76 C 30 84 19 84 12 76 Z"
          fill="url(#markaly-m-left)"
        />

        {/* Curva de conexão contínua inferior */}
        <path
          d="M 28 58 C 34 48 44 42 52 46 C 58 50 56 60 50 68 C 44 76 34 78 28 72 C 24 68 25 62 28 58 Z"
          fill="url(#markaly-m-grad)"
        />
      </g>
    </svg>
  )
}

export interface MarkalyLogoProps {
  className?: string
  height?: number | string
  theme?: 'dark' | 'light' | 'auto'
  showSlogan?: boolean
  showSignature?: boolean
}

/**
 * Logo Oficial Completa MARKALY
 * Emblema oficial + wordmark "markaly" arredondado + Slogan "Organizar hoje, crescer sempre." + Assinatura "Uma solução Contek"
 */
export const MarkalyLogo: React.FC<MarkalyLogoProps> = ({
  className = '',
  height = 42,
  theme = 'light',
  showSlogan = true,
  showSignature = true,
}) => {
  const isDark = theme === 'dark'

  return (
    <div className={`inline-flex flex-col items-start select-none ${className}`}>
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Emblema Oficial M */}
        <img
          src={markalyAppIconImg}
          alt="MARKALY Emblema"
          className="rounded-xl object-contain shadow-md flex-shrink-0"
          style={{
            height: typeof height === 'number' ? height : height,
            width: typeof height === 'number' ? height : height,
          }}
        />

        {/* Wordmark typography */}
        <div className="flex flex-col justify-center leading-none">
          <div className="flex items-baseline gap-1">
            <span
              className={`font-black text-2xl sm:text-3xl tracking-tight font-['Poppins',sans-serif] lowercase ${
                isDark ? 'text-white' : 'text-[#3B0764]'
              }`}
            >
              markaly
            </span>
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#7C3AED] mb-1" />
          </div>

          {showSlogan && (
            <p
              className={`text-[11px] sm:text-xs font-normal tracking-normal font-['Poppins',sans-serif] mt-0.5 ${
                isDark ? 'text-purple-200' : 'text-slate-600'
              }`}
            >
              Organizar hoje, crescer sempre.
            </p>
          )}
        </div>
      </div>

      {showSignature && (
        <div className="flex items-center gap-2 mt-1.5 pl-0.5">
          <div className={`h-[1px] w-6 ${isDark ? 'bg-purple-800' : 'bg-slate-300'}`} />
          <span
            className={`text-[10px] font-medium font-['Poppins',sans-serif] ${
              isDark ? 'text-purple-300' : 'text-slate-500'
            }`}
          >
            Uma solução{' '}
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-[#3B0764]'}`}>
              Contek
            </span>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Versão rasterizada oficial (imagem com fundo transparente enviada pelo usuário)
 */
export const MarkalyOfficialLogoImage: React.FC<{
  className?: string
  alt?: string
  style?: React.CSSProperties
}> = ({
  className = 'h-10 sm:h-12 w-auto object-contain',
  alt = 'MARKALY - Organizar hoje, crescer sempre.',
  style,
}) => {
  return <img src={markalyLogoImg} alt={alt} className={className} style={style} />
}
