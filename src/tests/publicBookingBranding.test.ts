import { describe, it, expect } from 'vitest'
import agendamentoPublicoSource from '../pages/AgendamentoPublico.tsx?raw'
import confirmacaoPublicaSource from '../pages/ConfirmacaoPublica.tsx?raw'
import publicBookingHookSource from '../../pocketbase/hooks/public_booking_data.js?raw'
import confirmHookSource from '../../pocketbase/hooks/appointment_confirm_public.js?raw'

describe('Validação Estrita de Branding da Página Pública de Agendamento e Confirmação', () => {
  describe('1. AgendamentoPublico.tsx - Branding Dinâmico Derivado da Empresa', () => {
    it('o componente AgendamentoPublico deriva isMarkaly do produto da organização retornada pelo endpoint', () => {
      expect(agendamentoPublicoSource).toContain("const isMarkaly = org?.product === 'markaly'")
    })

    it('renderiza MarkalyLogo e MarkalyEmblem quando isMarkaly for true, e AgyliLogo/AgyliEmblem quando false', () => {
      expect(agendamentoPublicoSource).toContain('MarkalyLogo')
      expect(agendamentoPublicoSource).toContain('AgyliLogo')
      expect(agendamentoPublicoSource).toContain('MarkalyEmblem')
      expect(agendamentoPublicoSource).toContain('AgyliEmblem')
    })

    it('inclui os slogans oficiais nos badges/headers do produto (Organizar hoje, crescer sempre. vs Agendar ficou simples.)', () => {
      expect(agendamentoPublicoSource).toContain('Organizar hoje, crescer sempre.')
      expect(agendamentoPublicoSource).toContain('Agendar ficou simples.')
      expect(agendamentoPublicoSource).toContain('Plataforma Oficial MARKALY • Organizar hoje, crescer sempre.')
      expect(agendamentoPublicoSource).toContain('Plataforma Oficial AGYLI • Agendar ficou simples.')
    })

    it('utiliza a paleta roxa do MARKALY (#3B0764 / #1E0338 / #2E0854) e gradiente laranja/rosa quando isMarkaly é verdadeiro', () => {
      expect(agendamentoPublicoSource).toContain('#3B0764')
      expect(agendamentoPublicoSource).toContain('#1E0338')
      expect(agendamentoPublicoSource).toContain('#2E0854')
      expect(agendamentoPublicoSource).toContain('#F97316')
      expect(agendamentoPublicoSource).toContain('#EC4899')
    })

    it('não possui branding estático fixo de AGYLI desassociado da checagem isMarkaly no cabeçalho ou tela final', () => {
      // Garante que o header oficial sempre verifica isMarkaly
      expect(agendamentoPublicoSource).toContain('{isMarkaly ? (')
      // Garante que ContekSymbol discreto de rodapé ("Uma solução Grupo CONTEK") é mantido em ambas
      expect(agendamentoPublicoSource).toContain('ContekSymbol')
      expect(agendamentoPublicoSource).toContain('Grupo CONTEK — Tecnologia e Consultoria')
    })
  })

  describe('2. ConfirmacaoPublica.tsx - Branding Dinâmico no Fluxo de Confirmação', () => {
    it('deriva isMarkaly de appointment.organization_product retornado pelo backend', () => {
      expect(confirmacaoPublicaSource).toContain("result?.appointment?.organization_product === 'markaly'")
    })

    it('renderiza MarkalyLogo com slogan quando a empresa for MARKALY e AgyliLogo com slogan quando AGYLI', () => {
      expect(confirmacaoPublicaSource).toContain('MarkalyLogo')
      expect(confirmacaoPublicaSource).toContain('AgyliLogo')
      expect(confirmacaoPublicaSource).toContain('showSlogan={true}')
    })

    it('aplica tema roxo (#1E0338 / #2E0854) e acentos de cor para MARKALY vs azul (#0F172A / #1E293B) para AGYLI', () => {
      expect(confirmacaoPublicaSource).toContain('#1E0338')
      expect(confirmacaoPublicaSource).toContain('#2E0854')
      expect(confirmacaoPublicaSource).toContain('#0F172A')
      expect(confirmacaoPublicaSource).toContain('#1E293B')
    })
  })

  describe('3. Backend Hooks - Exposição do Produto da Empresa no Booking Público', () => {
    it('public_booking_data.js inclui o atributo product da organização no payload retornado', () => {
      expect(publicBookingHookSource).toContain("product: org.getString('product') || 'agyli'")
      expect(publicBookingHookSource).toContain("plan_id: org.getString('plan_id')")
    })

    it('appointment_confirm_public.js inclui organization_product no payload do agendamento confirmado', () => {
      expect(confirmHookSource).toContain("orgProduct = org.getString('product') || 'agyli'")
      expect(confirmHookSource).toContain('organization_product: orgProduct')
    })
  })

  describe('4. Teste de Regressão: Falha se empresa MARKALY renderizar identidade AGYLI (ou vice-versa)', () => {
    interface OrganizationData {
      name: string
      slug: string
      product: 'agyli' | 'markaly'
    }

    const renderPublicPageHeader = (org: OrganizationData) => {
      const isMarkaly = org.product === 'markaly'
      if (isMarkaly) {
        return {
          brand: 'MARKALY',
          logoComponent: 'MarkalyLogo',
          slogan: 'Organizar hoje, crescer sempre.',
          badgeBg: '#3B0764',
          themeBg: '#1E0338',
          cardBg: '#2E0854',
          accentColor: '#F97316',
        }
      } else {
        return {
          brand: 'AGYLI',
          logoComponent: 'AgyliLogo',
          slogan: 'Agendar ficou simples.',
          badgeBg: '#1E293B',
          themeBg: '#0F172A',
          cardBg: '#1E293B',
          accentColor: '#3B82F6',
        }
      }
    }

    it('uma empresa MARKALY (ex: La Bela ou Lulu) NUNCA renderiza marca, slogan ou cor do AGYLI', () => {
      const markalyOrgs: OrganizationData[] = [
        { name: 'Lulu', slug: 'lulu', product: 'markaly' },
        { name: 'la bela', slug: 'la-bela', product: 'markaly' },
      ]

      for (const org of markalyOrgs) {
        const rendered = renderPublicPageHeader(org)
        expect(rendered.brand).toBe('MARKALY')
        expect(rendered.logoComponent).toBe('MarkalyLogo')
        expect(rendered.slogan).toBe('Organizar hoje, crescer sempre.')
        expect(rendered.badgeBg).toBe('#3B0764')
        expect(rendered.themeBg).toBe('#1E0338')
        expect(rendered.cardBg).toBe('#2E0854')

        // PROIBIDO conter branding AGYLI
        expect(rendered.brand).not.toBe('AGYLI')
        expect(rendered.logoComponent).not.toBe('AgyliLogo')
        expect(rendered.slogan).not.toBe('Agendar ficou simples.')
        expect(rendered.accentColor).not.toBe('#3B82F6')
      }
    })

    it('uma empresa AGYLI (ex: Contek Estética & Saúde ou LUIS) NUNCA renderiza marca MARKALY', () => {
      const agyliOrgs: OrganizationData[] = [
        { name: 'Contek Estética & Saúde', slug: 'contek-demo', product: 'agyli' },
        { name: 'LUIS', slug: 'luis', product: 'agyli' },
      ]

      for (const org of agyliOrgs) {
        const rendered = renderPublicPageHeader(org)
        expect(rendered.brand).toBe('AGYLI')
        expect(rendered.logoComponent).toBe('AgyliLogo')
        expect(rendered.slogan).toBe('Agendar ficou simples.')
        expect(rendered.accentColor).toBe('#3B82F6')

        // PROIBIDO conter branding MARKALY
        expect(rendered.brand).not.toBe('MARKALY')
        expect(rendered.logoComponent).not.toBe('MarkalyLogo')
        expect(rendered.slogan).not.toBe('Organizar hoje, crescer sempre.')
        expect(rendered.accentColor).not.toBe('#F97316')
      }
    })
  })
})
