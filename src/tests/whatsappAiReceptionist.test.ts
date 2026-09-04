import { describe, it, expect } from 'vitest'

describe('WhatsApp AI Receptionist & Multi-tenant Logic', () => {
  it('identifies organization correctly by slug or referral', () => {
    const text1 = 'Olá, quero agendar em [contek-demo]'
    const match1 = text1.match(/\[([a-zA-Z0-9-_]+)\]/)
    expect(match1).not.toBeNull()
    expect(match1?.[1]).toBe('contek-demo')

    const text2 = 'Olá! Quero agendar um horário na Contek Estética & Saúde. [ref:contek-demo]'
    const match2 = text2.match(/(?:ref=|ref:|slug=|empresa:|\bref:)([a-zA-Z0-9-_]+)/i)
    expect(match2).not.toBeNull()
    expect(match2?.[1]).toBe('contek-demo')
  })

  it('detects booking intent and requested time format HH:MM', () => {
    const userText = 'Gostaria de agendar Limpeza de Pele dia 2026-09-08 às 09:30 com Dra Camila. Meu nome é Joana'
    const isBooking = userText.toLowerCase().includes('agendar')
    expect(isBooking).toBe(true)

    const timeMatch = userText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
    expect(timeMatch).not.toBeNull()
    expect(timeMatch?.[0]).toBe('09:30')

    const dateMatch = userText.match(/(\d{4}-\d{2}-\d{2})/)
    expect(dateMatch).not.toBeNull()
    expect(dateMatch?.[0]).toBe('2026-09-08')

    const nameMatch = userText.match(/(?:me chamo|nome [ée]|nome:)\s*([A-Za-zÀ-ÿ\s]{2,30})/i)
    expect(nameMatch).not.toBeNull()
    expect(nameMatch?.[1].trim()).toBe('Joana')
  })

  it('validates anti-hallucination patterns correctly', () => {
    const CONFIRMATION_CLAIM_PATTERNS = [
      /agendamento\s+confirmado/i,
      /agendado\s+com\s+sucesso/i,
      /hor[áa]rio\s+marcado\s+com\s+sucesso/i,
      /hor[áa]rio\s+reservado\s+com\s+sucesso/i,
      /agendei\s+o\s+seu\s+hor[áa]rio/i,
      /agendei\s+para\s+voc[êe]/i,
      /confirmamos\s+seu\s+agendamento/i,
      /✅[^\n\r]*agendad[oa]/i,
      /✅[^\n\r]*agendamento/i,
    ]

    const textFake = '✅ Seu agendamento foi agendado com sucesso para amanhã!'
    const matchesFake = CONFIRMATION_CLAIM_PATTERNS.some((p) => p.test(textFake))
    expect(matchesFake).toBe(true)

    const textSafe = 'Temos horários disponíveis amanhã às 09:00 e 14:00. Qual você prefere?'
    const matchesSafe = CONFIRMATION_CLAIM_PATTERNS.some((p) => p.test(textSafe))
    expect(matchesSafe).toBe(false)
  })

  it('validates shift and lunch calculations correctly', () => {
    const timeToMinutes = (t: string) => {
      const parts = t.split(':')
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
    }

    const shiftStart = timeToMinutes('08:30')
    const shiftEnd = timeToMinutes('18:00')
    const lunchStart = timeToMinutes('12:00')
    const lunchEnd = timeToMinutes('13:00')

    const checkSlot = (startStr: string, durationMin: number) => {
      const startMin = timeToMinutes(startStr)
      const endMin = startMin + durationMin

      if (startMin < shiftStart || endMin > shiftEnd) return false
      // lunch overlap check
      if (lunchEnd > lunchStart && startMin < lunchEnd && endMin > lunchStart) return false
      return true
    }

    expect(checkSlot('08:00', 60)).toBe(false) // before shift
    expect(checkSlot('08:30', 60)).toBe(true) // valid morning
    expect(checkSlot('11:30', 60)).toBe(false) // overlaps lunch (11:30 to 12:30)
    expect(checkSlot('12:00', 30)).toBe(false) // during lunch
    expect(checkSlot('13:00', 45)).toBe(true) // right after lunch
    expect(checkSlot('17:30', 60)).toBe(false) // exceeds shiftEnd (18:30 > 18:00)
    expect(checkSlot('17:00', 60)).toBe(true) // exactly reaches 18:00
  })
})
