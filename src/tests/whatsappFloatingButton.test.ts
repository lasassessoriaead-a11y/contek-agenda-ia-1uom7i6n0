import { describe, it, expect } from 'vitest'
import indexSource from '../pages/Index.tsx?raw'
import bookingSource from '../pages/AgendamentoPublico.tsx?raw'
import layoutSource from '../components/Layout.tsx?raw'
import superAdminLayoutSource from '../components/SuperAdminLayout.tsx?raw'
import floatingBtnSource from '../components/WhatsAppFloatingButton.tsx?raw'
import {
  LUCIANA_WHATSAPP_NUMBER,
  DEFAULT_WHATSAPP_MESSAGE,
  DEFAULT_BUBBLE_TEXT,
} from '@/components/WhatsAppFloatingButton'

/**
 * Suíte de testes: Botão Flutuante de WhatsApp da Luciana (Dona da Plataforma)
 */
describe('Botão Flutuante de WhatsApp (Luciana / Plataforma AGYLI & Contek)', () => {
  describe('1. Constantes e Configurações Oficiais', () => {
    it('possui o número oficial da Luciana 15 99632-7431 (5515996327431)', () => {
      expect(LUCIANA_WHATSAPP_NUMBER).toBe('5515996327431')
      expect(floatingBtnSource).toContain('5515996327431')
    })

    it('possui a cor oficial verde WhatsApp (#25D366) e ícone oficial', () => {
      expect(floatingBtnSource).toContain('#25D366')
      expect(floatingBtnSource).toContain('svg')
      expect(floatingBtnSource).toContain('viewBox="0 0 32 32"')
    })

    it('possui a mensagem padrão pré-preenchida e bolha informativa com texto amigável', () => {
      expect(DEFAULT_WHATSAPP_MESSAGE).toContain('Olá! Vi o site do AGYLI e tenho uma dúvida.')
      expect(DEFAULT_BUBBLE_TEXT).toBe('Ficou com dúvida? Fale com a gente!')
      expect(floatingBtnSource).toContain('wa.me')
    })
  })

  describe('2. Comportamento e Responsividade no Componente', () => {
    it('possui target _blank e rel="noopener noreferrer" para abrir em nova aba', () => {
      expect(floatingBtnSource).toContain('target="_blank"')
      expect(floatingBtnSource).toContain('rel="noopener noreferrer"')
    })

    it('no mobile oculta a bolha de texto (hidden md:flex) ficando somente a bolinha verde', () => {
      expect(floatingBtnSource).toContain('hidden md:flex')
      expect(floatingBtnSource).toContain('fixed bottom-6 right-6 z-40')
    })

    it('no desktop possui hover para expandir a bolha com transição suave', () => {
      expect(floatingBtnSource).toContain('onMouseEnter')
      expect(floatingBtnSource).toContain('onMouseLeave')
      expect(floatingBtnSource).toContain('transition-all')
    })
  })

  describe('3. Presença nas Páginas Públicas (Landings e Agendamento Público)', () => {
    it('Index.tsx (Landing comum, agyli.com.br e grupocontek.com.br) renderiza WhatsAppFloatingButton', () => {
      expect(indexSource).toContain('WhatsAppFloatingButton')
      expect(indexSource).toContain('<WhatsAppFloatingButton')
      expect(indexSource).toContain('isContekDomain')
    })

    it('Index.tsx não quebra a ordem com TestimonialsCarousel e Rodapé com CNPJ', () => {
      const carouselPos = indexSource.indexOf('<TestimonialsCarousel')
      const footerPos = indexSource.indexOf('<footer')
      const btnPos = indexSource.indexOf('<WhatsAppFloatingButton')

      expect(carouselPos).toBeGreaterThan(0)
      expect(footerPos).toBeGreaterThan(carouselPos)
      expect(btnPos).toBeGreaterThan(footerPos)
    })

    it('AgendamentoPublico.tsx (/agendar/:slug) renderiza WhatsAppFloatingButton com contexto da empresa', () => {
      expect(bookingSource).toContain('WhatsAppFloatingButton')
      expect(bookingSource).toContain('<WhatsAppFloatingButton')
      expect(bookingSource).toContain('brandContext=')
    })
  })

  describe('4. Ausência nos Painéis Logados (Layout e SuperAdminLayout)', () => {
    it('Layout.tsx (painel logado de clientes) NÃO deve importar nem conter WhatsAppFloatingButton', () => {
      expect(layoutSource).not.toContain('WhatsAppFloatingButton')
    })

    it('SuperAdminLayout.tsx (painel administrativo contek) NÃO deve importar nem conter WhatsAppFloatingButton', () => {
      expect(superAdminLayoutSource).not.toContain('WhatsAppFloatingButton')
    })
  })
})
