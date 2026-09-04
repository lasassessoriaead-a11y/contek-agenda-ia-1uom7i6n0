export type UserRole = 'ADMINISTRADOR' | 'PROFISSIONAL' | 'SUPERADMIN'

export type ProductType = 'agyli' | 'markaly'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  phone?: string
  role: UserRole
  organization_id?: string
  is_super_admin?: boolean
  created: string
  updated: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  product?: ProductType
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

export interface ProductFeatureConfig {
  id: string
  product: ProductType
  name: string
  description?: string
  features: string[]
  is_active: boolean
}

export interface Plan {
  id: string
  name: string
  slug: string
  product: ProductType
  price_monthly?: number
  trial_days?: number
  max_professionals?: number
  modules_included?: string[]
  description?: string
  active: boolean
  created: string
  updated: string
}

export type SubscriptionStatus = 'trial' | 'active' | 'overdue' | 'canceled'

export interface Subscription {
  id: string
  organization_id: string
  plan_id: string
  status: SubscriptionStatus
  trial_ends_at?: string
  starts_at?: string
  current_period_ends_at?: string
  canceled_at?: string
  notes?: string
  history?: Array<{
    date: string
    action: string
    note?: string
    changed_by?: string
  }>
  created: string
  updated: string
}

export interface OrganizationFeaturesResponse {
  organization_id: string
  organization_name: string
  slug: string
  product: ProductType
  product_name: string
  product_description: string
  features: string[]
  feature_map: Record<string, boolean>
  subscription?: {
    id: string
    status: SubscriptionStatus
    plan_id: string
    plan_name?: string
    starts_at?: string
    trial_ends_at?: string
    current_period_ends_at?: string
    notes?: string
  } | null
  is_super_admin?: boolean
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
  whatsapp_phone_number?: string
  whatsapp_welcome_message?: string
  whatsapp_phone_number_id?: string
  auto_reminders_enabled?: boolean
  template_confirmation_request?: string
  template_confirmation_thanks?: string
  template_day_reminder?: string
  whatsapp_ai_enabled?: boolean
  created: string
  updated: string
}

export interface WorkShift {
  id?: string
  start: string
  end: string
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
  work_shifts?: WorkShift[]
  date_exceptions?: string[]
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
  confirmation_token?: string
  notifications_sent?: Record<string, string>
  created: string
  updated: string
  expand?: {
    client_id?: Client
    professional_id?: Professional
    service_id?: Service
    organization_id?: Organization
  }
}

export interface NotificationLog {
  id: string
  organization_id: string
  appointment_id?: string
  type:
    | 'CONFIRMATION_REQUEST'
    | 'CONFIRMATION_THANKS'
    | 'DAY_REMINDER'
    | 'MANUAL_WA'
    | 'WHATSAPP_AI'
  channel: 'WHATSAPP_AUTO' | 'WHATSAPP_MANUAL' | 'WEB'
  status: 'SENT' | 'PENDING_NO_CREDENTIALS' | 'FAILED'
  recipient_phone?: string
  recipient_name?: string
  message_text?: string
  payload?: Record<string, unknown>
  created: string
  updated: string
  expand?: {
    appointment_id?: Appointment
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
