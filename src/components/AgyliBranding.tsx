import React from 'react'

// Arquivos de imagem enviados pelo usuário
import agyliAppIconImg from '@/assets/agyli-app-4ddcf.png'
import agyliLogoImg from '@/assets/logo-agyli-1e02e.png'

interface AgyliEmblemProps {
  size?: number | string
  className?: string
  variant?: 'app-icon' | 'vector' | 'flat'
  rounded?: boolean
}

/**
 * Emblema / Ícone oficial da AGYLI (gradiente azul #3B82F6 -> violeta #8B5CF6)
 * Suporta imagem raster de alta definição oficial enviada ou SVG vetorial nítido.
 */
export const AgyliEmblem: React.FC<AgyliEmblemProps> = ({
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
        src={agyliAppIconImg}
        alt="AGYLI Emblema Oficial"
        style={dimensionStyle}
        className={`object-contain select-none ${rounded ? 'rounded-xl' : ''} ${className}`}
        loading="eager"
      />
    )
  }

  // SVG vetorial nítido fiel ao manual visual: letra "a" minúscula contínua arredondada em gradiente azul -> violeta
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={dimensionStyle}
      className={`select-none ${className}`}
    >
      <defs>
        <linearGradient id="agyli-emblem-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="agyli-emblem-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Ícone estilizado "a" */}
      <g>
        {/* Arco superior e perna direita */}
        <path
          d="M 50 18 C 69 18 82 32 82 52 L 82 72 C 82 78.5 76.5 84 70 84 C 63.5 84 58 78.5 58 72 C 53 80 43 84 32 84 C 18 84 8 74 8 59 C 8 44 20 34 38 34 C 45 34 52 36 58 40 L 58 50 C 58 42 63 34 70 34 C 74 34 78 36 80 39"
          stroke="url(#agyli-emblem-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Curva do bojo interno */}
        <circle cx="36" cy="59" r="13" stroke="url(#agyli-emblem-cyan)" strokeWidth="12" />
      </g>
    </svg>
  )
}

interface AgyliLogoProps {
  className?: string
  height?: number | string
  theme?: 'dark' | 'light' | 'auto'
  showSlogan?: boolean
  showSignature?: boolean
}

/**
 * Logo Oficial Completa AGYLI
 * Emblema oficial + wordmark "agyli" + Slogan "Agendar ficou simples." + Assinatura "Uma solução Contek"
 */
export const AgyliLogo: React.FC<AgyliLogoProps> = ({
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
        {/* Emblema Oficial */}
        <img
          src={agyliAppIconImg}
          alt="AGYLI Emblema"
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
              className={`font-extrabold text-2xl sm:text-3xl tracking-tight font-['Poppins',sans-serif] ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              agyli
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] mb-1" />
          </div>

          {showSlogan && (
            <p
              className={`text-[11px] sm:text-xs font-normal tracking-normal font-['Poppins',sans-serif] mt-0.5 ${
                isDark ? 'text-slate-300' : 'text-slate-600'
              }`}
            >
              Agendar ficou simples.
            </p>
          )}
        </div>
      </div>

      {showSignature && (
        <div className="flex items-center gap-2 mt-1.5 pl-0.5">
          <div className={`h-[1px] w-6 ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} />
          <span
            className={`text-[10px] font-medium font-['Poppins',sans-serif] ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Uma solução <span className="font-semibold text-[#3B82F6]">Contek</span>
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Versão rasterizada oficial (imagem com fundo preto transparente/escuro enviado pelo usuário)
 */
export const AgyliOfficialLogoImage: React.FC<{
  className?: string
  alt?: string
  style?: React.CSSProperties
}> = ({
  className = 'h-10 sm:h-12 w-auto object-contain',
  alt = 'AGYLI - Agendar ficou simples',
  style,
}) => {
  return <img src={agyliLogoImg} alt={alt} className={className} style={style} />
}
