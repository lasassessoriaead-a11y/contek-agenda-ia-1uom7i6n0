import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import type { User, Organization, BusinessSettings } from '@/types'

interface AuthContextType {
  user: User | null
  organization: Organization | null
  settings: BusinessSettings | null
  loading: boolean
  isAdmin: boolean
  isProfessional: boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshOrganization: () => Promise<void>
  updateSettings: (newSettings: Partial<BusinessSettings>) => Promise<void>
  updateOrgProfile: (newOrg: Partial<Organization>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      return pb.authStore.record as unknown as User
    }
    return null
  })
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const clearTenantContext = useCallback(() => {
    setOrganization(null)
    setSettings(null)
  }, [])

  const loadOrgAndSettings = useCallback(async (orgId: string) => {
    if (!orgId) {
      clearTenantContext()
      throw new Error('Usuário sem organização vinculada.')
    }

    try {
      const org = await pb.collection('organizations').getOne<Organization>(orgId)
      setOrganization(org)

      try {
        const sett = await pb
          .collection('business_settings')
          .getFirstListItem<BusinessSettings>(`organization_id = "${orgId}"`)
        setSettings(sett)
      } catch {
        // If settings are missing, try to create them only for the authenticated tenant.
        try {
          const createdSett = await pb.collection('business_settings').create<BusinessSettings>({
            organization_id: orgId,
            business_name: org.name,
            opening_time: '08:00',
            closing_time: '19:00',
            working_days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
            slot_interval_minutes: 30,
            buffer_between_appointments: 10,
            default_booking_message: `Olá! Seu agendamento foi confirmado com sucesso na ${org.name}.`,
            whatsapp_enabled: true,
          })
          setSettings(createdSett)
        } catch {
          setSettings(null)
        }
      }
    } catch (err) {
      console.error('Error loading organization:', err)
      clearTenantContext()
      throw err
    }
  }, [clearTenantContext])

  const refreshOrganization = useCallback(async () => {
    if (!user?.organization_id) {
      clearTenantContext()
      return
    }
    await loadOrgAndSettings(user.organization_id)
  }, [user?.organization_id, loadOrgAndSettings, clearTenantContext])

  useEffect(() => {
    const unsub = pb.authStore.onChange(async (_, model) => {
      if (model) {
        const u = model as unknown as User
        setUser(u)
        if (u.organization_id) {
          try {
            await loadOrgAndSettings(u.organization_id)
          } catch {
            clearTenantContext()
          }
        } else {
          clearTenantContext()
        }
      } else {
        setUser(null)
        clearTenantContext()
      }
      setLoading(false)
    })

    if (pb.authStore.isValid && pb.authStore.record) {
      const u = pb.authStore.record as unknown as User
      setUser(u)
      if (u.organization_id) {
        loadOrgAndSettings(u.organization_id)
          .catch(() => clearTenantContext())
          .finally(() => setLoading(false))
      } else {
        clearTenantContext()
        setLoading(false)
      }
    } else {
      setLoading(false)
    }

    return () => unsub()
  }, [loadOrgAndSettings, clearTenantContext])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    const u = authData.record as unknown as User

    if (!u.organization_id) {
      pb.authStore.clear()
      setUser(null)
      clearTenantContext()
      throw new Error('Sua conta não está vinculada a uma empresa. Contate a Contek.')
    }

    setUser(u)
    await loadOrgAndSettings(u.organization_id)
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    clearTenantContext()
  }

  const updateSettings = async (newSettings: Partial<BusinessSettings>) => {
    if (!settings?.id || !organization?.id) return
    const updated = await pb
      .collection('business_settings')
      .update<BusinessSettings>(settings.id, newSettings)
    setSettings(updated)
  }

  const updateOrgProfile = async (newOrg: Partial<Organization>) => {
    if (!organization?.id) return
    const updated = await pb
      .collection('organizations')
      .update<Organization>(organization.id, newOrg)
    setOrganization(updated)
  }

  const isAdmin = user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERADMIN'
  const isProfessional = user?.role === 'PROFISSIONAL'

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        settings,
        loading,
        isAdmin,
        isProfessional,
        login,
        logout,
        refreshOrganization,
        updateSettings,
        updateOrgProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
