import { describe, it, expect } from 'vitest'
import agendaSource from '../pages/Agenda.tsx?raw'
import publicBookingSource from '../pages/AgendamentoPublico.tsx?raw'

describe('Encaixe de Horário (Agendamentos Sobrepostos) & Isolamento Multi-tenant', () => {
  // Helper para converter tempo em minutos (mesma regra do hook e da aplicação)
  const timeToMinutes = (t: string) => {
    if (!t || typeof t !== 'string') return 0
    const [h, m] = t.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  // Simulação pura da lógica do hook backend validate_appointment_conflict
  interface MockAppointment {
    id: string
    organization_id: string
    professional_id: string
    date: string
    start_time: string
    end_time: string
    status: string
    is_overlap?: boolean
  }

  const validateAppointmentConflict = (
    existingList: MockAppointment[],
    newAppt: {
      id?: string
      organization_id: string
      professional_id: string
      date: string
      start_time: string
      end_time: string
      allow_overlap?: boolean
      is_overlap?: boolean
    },
  ) => {
    const profId = newAppt.professional_id
    const cleanDate = (newAppt.date || '').slice(0, 10)
    const newStartMin = timeToMinutes(newAppt.start_time)
    const newEndMin = timeToMinutes(newAppt.end_time)

    // Regra: o conflito considera APENAS a mesma profissional (professional_id), não a empresa inteira
    const profAppointments = existingList.filter(
      (appt) =>
        appt.professional_id === profId &&
        appt.organization_id === newAppt.organization_id &&
        appt.status !== 'CANCELADO' &&
        (appt.date || '').slice(0, 10) === cleanDate &&
        (!newAppt.id || appt.id !== newAppt.id),
    )

    let hasConflict = false
    let conflictDetails = ''

    for (const appt of profAppointments) {
      const existStartMin = timeToMinutes(appt.start_time)
      const existEndMin = timeToMinutes(appt.end_time)

      if (newStartMin < existEndMin && newEndMin > existStartMin) {
        hasConflict = true
        conflictDetails = `já existe agendamento das ${appt.start_time} às ${appt.end_time}`
        break
      }
    }

    if (hasConflict) {
      const allowOverlap =
        newAppt.allow_overlap === true || newAppt.is_overlap === true
      if (allowOverlap) {
        return { success: true, is_overlap: true }
      }
      return {
        success: false,
        error: `Conflito de horário para este profissional: ${conflictDetails}.`,
      }
    }

    return { success: true, is_overlap: false }
  }

  describe('1. Agendamento Manual (Agenda Interna): Encaixe com aviso e co-existência', () => {
    const orgA = 'org_salao_bella'
    const profMariana = 'prof_mariana_1'

    const existingTintura: MockAppointment = {
      id: 'appt_tintura',
      organization_id: orgA,
      professional_id: profMariana,
      date: '2025-05-10 00:00:00.000Z',
      start_time: '15:00',
      end_time: '17:00',
      status: 'AGENDADO',
    }

    it('bloqueia agendamento sobreposto quando allow_overlap não for confirmado', () => {
      // Nova cliente quer escova das 15:30 às 16:00 com a mesma profissional no mesmo dia
      const result = validateAppointmentConflict([existingTintura], {
        organization_id: orgA,
        professional_id: profMariana,
        date: '2025-05-10',
        start_time: '15:30',
        end_time: '16:00',
        allow_overlap: false,
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Conflito de horário para este profissional')
      expect(result.error).toContain('15:00 às 17:00')
    })

    it('permite agendamento manual sobreposto quando encaixe for confirmado (allow_overlap: true)', () => {
      // Profissional decide encaixar a escova das 15:30 às 16:00 durante o tempo de ação da tintura
      const result = validateAppointmentConflict([existingTintura], {
        organization_id: orgA,
        professional_id: profMariana,
        date: '2025-05-10',
        start_time: '15:30',
        end_time: '16:00',
        allow_overlap: true,
      })

      expect(result.success).toBe(true)
      expect(result.is_overlap).toBe(true)
    })

    it('código de Agenda.tsx detecta conflito e exibe aviso de sobreposição no modal manual', () => {
      expect(agendaSource).toContain('overlappingAppointments')
      expect(agendaSource).toContain('appointment-conflict-alert')
      expect(agendaSource).toContain('Aviso de Sobreposição (Encaixe de Horário)')
      expect(agendaSource).toContain('Deseja agendar mesmo assim como um')
      expect(agendaSource).toContain('allow_overlap: isOverlapBooking')
      expect(agendaSource).toContain('is_overlap: isOverlapBooking')
    })

    it('código de Agenda.tsx exibe badge de Encaixe visualmente distinguível para os atendimentos sobrepostos', () => {
      expect(agendaSource).toContain('appt.is_overlap &&')
      expect(agendaSource).toContain('Encaixe')
      expect(agendaSource).toContain('Encaixe de Horário')
    })
  })

  describe('2. Isolamento de Profissional e Multi-tenant', () => {
    const orgA = 'org_salao_bella'
    const orgB = 'org_outro_salao'
    const profMariana = 'prof_mariana_1'
    const profJuliana = 'prof_juliana_2'

    const existingTinturaMariana: MockAppointment = {
      id: 'appt_tintura_mariana',
      organization_id: orgA,
      professional_id: profMariana,
      date: '2025-05-10 00:00:00.000Z',
      start_time: '15:00',
      end_time: '17:00',
      status: 'AGENDADO',
    }

    it('NÃO gera conflito para outra profissional da mesma empresa no mesmo horário', () => {
      // Juliana atende outra cliente no mesmo salão das 15:00 às 16:00
      const result = validateAppointmentConflict([existingTinturaMariana], {
        organization_id: orgA,
        professional_id: profJuliana,
        date: '2025-05-10',
        start_time: '15:00',
        end_time: '16:00',
        allow_overlap: false,
      })

      expect(result.success).toBe(true)
      expect(result.is_overlap).toBe(false)
    })

    it('NÃO gera conflito para outra empresa (multi-tenant estrito)', () => {
      // Outro salão pode ter agendamentos no mesmo horário sem qualquer colisão
      const result = validateAppointmentConflict([existingTinturaMariana], {
        organization_id: orgB,
        professional_id: 'prof_salao_b',
        date: '2025-05-10',
        start_time: '15:00',
        end_time: '17:00',
        allow_overlap: false,
      })

      expect(result.success).toBe(true)
    })

    it('ignora agendamentos cancelados ao verificar sobreposições', () => {
      const canceledAppt: MockAppointment = {
        id: 'appt_canc',
        organization_id: orgA,
        professional_id: profMariana,
        date: '2025-05-10 00:00:00.000Z',
        start_time: '15:00',
        end_time: '17:00',
        status: 'CANCELADO',
      }

      const result = validateAppointmentConflict([canceledAppt], {
        organization_id: orgA,
        professional_id: profMariana,
        date: '2025-05-10',
        start_time: '15:00',
        end_time: '17:00',
        allow_overlap: false,
      })

      expect(result.success).toBe(true)
      expect(result.is_overlap).toBe(false)
    })
  })

  describe('3. Página Pública de Agendamento (/book/:org_slug): Bloqueio Mantido', () => {
    it('página pública calcula apenas slots livres e NÃO oferece encaixe ao cliente final', () => {
      // A interface pública AgendamentoPublico.tsx bloqueia sobreposições
      expect(publicBookingSource).toContain('hasConflict')
      expect(publicBookingSource).toContain('dayAppts.some')
      expect(publicBookingSource).toContain('currentMinutes < aEnd && slotEndMinutes > aStart')

      // O payload de AgendamentoPublico.tsx nunca envia allow_overlap nem is_overlap como true
      expect(publicBookingSource).not.toContain('allow_overlap: true')
      expect(publicBookingSource).not.toContain('is_overlap: true')
    })
  })
})
