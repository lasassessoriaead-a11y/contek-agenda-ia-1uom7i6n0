import { describe, it, expect } from 'vitest'
import indexSource from '../pages/Index.tsx?raw'
import carouselSource from '../components/TestimonialsCarousel.tsx?raw'
import brandingSource from '../components/ContekBranding.tsx?raw'
import { TESTIMONIALS_DATA } from '@/components/TestimonialsCarousel'

describe('Landings de Vendas: Carrossel de Depoimentos e CNPJ no Rodapé', () => {
  it('possui de 5 a 6 depoimentos realistas em português com nome, negócio, cidade e 5 estrelas', () => {
    expect(TESTIMONIALS_DATA.length).toBeGreaterThanOrEqual(5)
    expect(TESTIMONIALS_DATA.length).toBeLessThanOrEqual(6)

    TESTIMONIALS_DATA.forEach((t) => {
      expect(t.name.trim().length).toBeGreaterThan(3)
      expect(t.roleAndBusiness.trim().length).toBeGreaterThan(5)
      expect(t.cityState.trim().length).toBeGreaterThan(3)
      expect(t.quote.trim().length).toBeGreaterThan(20)
      expect(t.rating).toBe(5)
    })
  })

  it('o componente de carrossel possui setas de navegação, indicadores e suporte a autoplay', () => {
    expect(carouselSource).toContain('nextTestimonial')
    expect(carouselSource).toContain('prevTestimonial')
    expect(carouselSource).toContain('setInterval')
    expect(carouselSource).toContain('currentIndex')
    expect(carouselSource).toContain('testimonials-section')
  })

  it('a landing page Index.tsx renderiza o TestimonialsCarousel antes do rodapé institucional', () => {
    expect(indexSource).toContain('<TestimonialsCarousel')
    const carouselPos = indexSource.indexOf('<TestimonialsCarousel')
    const footerPos = indexSource.indexOf('<footer')
    expect(carouselPos).toBeGreaterThan(0)
    expect(footerPos).toBeGreaterThan(carouselPos)
  })

  it('o rodapé das três landings de vendas exibe o CNPJ 47.769.566/0001-46 junto da chancela Grupo CONTEK', () => {
    expect(indexSource).toContain('47.769.566/0001-46')
    expect(indexSource).toContain('Uma solução Grupo CONTEK')
    expect(brandingSource).toContain('47.769.566/0001-46')
    expect(brandingSource).toContain('Uma solução oficial do Grupo CONTEK')
  })
})
