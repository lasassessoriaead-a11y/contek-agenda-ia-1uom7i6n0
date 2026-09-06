import { describe, it, expect } from 'vitest'
import layoutSource from '../components/Layout.tsx?raw'
import pwaPromptSource from '../components/PwaInstallPrompt.tsx?raw'

describe('Layout Header Plan Badge and Responsiveness Verification', () => {
  it('garante que o badge do plano ESSENCIAL / PRO no cabeçalho possui shrink-0 e whitespace-nowrap para não ser truncado', () => {
    // 1. O badge do plano deve possuir data-testid="header-plan-badge"
    expect(layoutSource).toContain('data-testid="header-plan-badge"')

    // 2. O badge do plano deve possuir 'shrink-0' e 'whitespace-nowrap'
    // Tanto para o plano ESSENCIAL do Markaly quanto para o plano PRO do Agyli
    expect(layoutSource).toMatch(
      /data-testid="header-plan-badge"[^>]*className="[^"]*shrink-0[^"]*whitespace-nowrap[^"]*"/,
    )

    // 3. O texto ESSENCIAL e PRO devem estar explícitos e sem classes de truncate aplicadas ao badge
    const badgeMatches = layoutSource.match(/data-testid="header-plan-badge"[\s\S]*?<\/span>/g)
    expect(badgeMatches).not.toBeNull()
    expect(badgeMatches?.length).toBeGreaterThanOrEqual(2)

    for (const match of badgeMatches || []) {
      expect(match).not.toContain('truncate')
      expect(match).not.toContain('overflow-hidden')
      expect(match).toContain('shrink-0')
      expect(match).toContain('whitespace-nowrap')
    }
  })

  it('garante que o container da marca/logo e nome da empresa não comprime o badge de plano nem quebra no mobile', () => {
    // 1. O bloco esquerdo do header (botão menu + logo + nome da empresa) deve ter shrink-0
    expect(layoutSource).toMatch(/<div className="flex items-center gap-2 sm:gap-3 shrink-0">/)

    // 2. O Link da marca deve ter shrink-0 para não ser espremido pelos botões de ação à direita
    expect(layoutSource).toContain('data-testid="header-brand-link"')
    expect(layoutSource).toMatch(/<Link to="\/"[^>]*shrink-0[^>]*data-testid="header-brand-link"/)

    // 3. Os nomes dos produtos "markaly" e "agyli" no topo têm shrink-0
    expect(layoutSource).toMatch(/span className="font-(?:black|extrabold)[^"]*shrink-0/)

    // 4. Apenas o nome da empresa tem truncate com max-w controlado (max-w-[90px] sm:max-w-[140px]), liberando espaço para o badge
    expect(layoutSource).toMatch(/truncate max-w-\[90px\] sm:max-w-\[140px\]/)
  })

  it('garante que o botão "Instalar App" no cabeçalho não encobre o badge em mobile e é responsivo', () => {
    // 1. No cabeçalho (Layout.tsx), o botão de instalação deve ficar oculto em telas estreitas (hidden sm:inline-flex)
    // para evitar empilhar ou sobrepor o badge do plano e o nome da organização no mobile
    expect(layoutSource).toMatch(
      /<PwaInstallPrompt\s+variant="button"\s+className="hidden sm:inline-flex"\s*\/>/,
    )

    // 2. O botão de PWA (PwaInstallPrompt.tsx) deve ter shrink-0 e whitespace-nowrap
    expect(pwaPromptSource).toContain('shrink-0')
    expect(pwaPromptSource).toContain('whitespace-nowrap')

    // 3. O texto do botão deve ser adaptável (Instalar em telas intermediárias / Instalar App em xl)
    expect(pwaPromptSource).toContain('Instalar App')
    expect(pwaPromptSource).toContain('Instalar')
    expect(pwaPromptSource).toMatch(/<span className="hidden xl:inline">\s*Instalar App\s*<\/span>/)
    expect(pwaPromptSource).toMatch(/<span className="xl:hidden">\s*Instalar\s*<\/span>/)
  })

  it('preserva todos os elementos e data-testids obrigatórios do header', () => {
    // Badge da organização conectada para SuperAdmin
    expect(layoutSource).toContain('data-testid="header-connected-org-badge"')
    expect(layoutSource).toContain('Conectada a:')

    // Botão Central Contek para SuperAdmin
    expect(layoutSource).toContain('data-testid="superadmin-central-contek-btn"')
    expect(layoutSource).toContain('Central Contek')

    // Botão Novo Agendamento
    expect(layoutSource).toContain('Novo Agendamento')

    // Selo de SuperAdmin quando aplicável
    expect(layoutSource).toContain('SUPERADMIN')
  })
})
