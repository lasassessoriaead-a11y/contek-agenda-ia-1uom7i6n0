export type UserRole = 'ADMINISTRADOR' | 'PROFISSIONAL' | 'SUPERADMIN'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  phone?: string
  role: UserRole
  organization_id?: string
  created: string
  updated: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  logo?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  plan_id?: string
  status: 'active' | 'trial' | 'suspended'
  created: string
  updated: string
}

export interface BusinessSettings {
  id: string
  organization_id: string
  business_name?: string
  phone?: string
  whatsapp?: string
  address?: string
  opening_time?: string
  closing_time?: string
  working_days?: string[]
  slot_interval_minutes?: number
  buffer_between_appointments?: number
  default_booking_message?: string
  whatsapp_enabled?: boolean
  created: string
  updated: string
}

export interface Professional {
  id: string
  organization_id: string
  user_id?: string
  name: string
  specialty?: string
  phone?: string
  email?: string
  avatar?: string
  default_duration?: number
  work_days?: string[]
  work_hours?: {
    start: string
    end: string
    lunch_start?: string
    lunch_end?: string
  }
  active: boolean
  created: string
  updated: string
}

export interface Service {
  id: string
  organization_id: string
  name: string
  description?: string
  duration: number
  price: number
  color?: string
  category?: string
  active: boolean
  created: string
  updated: string
}

export interface ProfessionalService {
  id: string
  organization_id: string
  professional_id: string
  service_id: string
  expand?: {
    professional_id?: Professional
    service_id?: Service
  }
}

export interface Client {
  id: string
  organization_id: string
  name: string
  phone: string
  whatsapp?: string
  email?: string
  birth_date?: string
  notes?: string
  created: string
  updated: string
}

export type AppointmentStatus =
  | 'AGENDADO'
  | 'CONFIRMADO'
  | 'EM ATENDIMENTO'
  | 'CONCLUÍDO'
  | 'CANCELADO'
  | 'FALTOU'

export interface Appointment {
  id: string
  organization_id: string
  client_id: string
  professional_id: string
  service_id: string
  date: string // ISO date
  start_time: string // HH:mm
  end_time: string // HH:mm
  duration: number
  price: number
  status: AppointmentStatus
  notes?: string
  client_name_snapshot?: string
  client_phone_snapshot?: string
  created: string
  updated: string
  expand?: {
    client_id?: Client
    professional_id?: Professional
    service_id?: Service
    organization_id?: Organization
  }
}

export type PaymentMethod = 'PIX' | 'Dinheiro' | 'Cartão' | 'Outro'

export interface Payment {
  id: string
  organization_id: string
  appointment_id?: string
  client_id?: string
  amount: number
  is_paid: boolean
  payment_method?: PaymentMethod
  payment_date?: string
  description?: string
  notes?: string
  created: string
  updated: string
  expand?: {
    appointment_id?: Appointment
    client_id?: Client
  }
}
