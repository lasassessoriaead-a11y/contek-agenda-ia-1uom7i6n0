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
  switchOrganization: (orgId: string) => Promise<void>
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

  const loadOrgAndSettings = useCallback(async (orgId: string) => {
    try {
      const org = await pb.collection('organizations').getOne<Organization>(orgId)
      setOrganization(org)

      try {
        const sett = await pb
          .collection('business_settings')
          .getFirstListItem<BusinessSettings>(`organization_id = "${orgId}"`)
        setSettings(sett)
      } catch {
        // Create initial settings if missing
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
          /* intentionally ignored */
        }
      }
    } catch (err) {
      console.error('Error loading organization:', err)
      // Fallback: try to fetch first available organization
      try {
        const fallback = await pb.collection('organizations').getFirstListItem<Organization>('')
        setOrganization(fallback)
      } catch {
        /* intentionally ignored */
      }
    }
  }, [])

  const refreshOrganization = useCallback(async () => {
    if (!user?.organization_id) {
      try {
        const firstOrg = await pb.collection('organizations').getFirstListItem<Organization>('')
        if (firstOrg) {
          await loadOrgAndSettings(firstOrg.id)
        }
      } catch {
        /* intentionally ignored */
      }
      return
    }
    await loadOrgAndSettings(user.organization_id)
  }, [user?.organization_id, loadOrgAndSettings])

  useEffect(() => {
    const unsub = pb.authStore.onChange(async (_, model) => {
      if (model) {
        const u = model as unknown as User
        setUser(u)
        if (u.organization_id) {
          await loadOrgAndSettings(u.organization_id)
        } else {
          // If user has no org yet, try to find one
          try {
            const org = await pb.collection('organizations').getFirstListItem<Organization>('')
            await loadOrgAndSettings(org.id)
          } catch {
            /* intentionally ignored */
          }
        }
      } else {
        setUser(null)
        setOrganization(null)
        setSettings(null)
      }
      setLoading(false)
    })

    // Initial load
    if (pb.authStore.isValid && pb.authStore.record) {
      const u = pb.authStore.record as unknown as User
      setUser(u)
      if (u.organization_id) {
        loadOrgAndSettings(u.organization_id).finally(() => setLoading(false))
      } else {
        pb.collection('organizations')
          .getFirstListItem<Organization>('')
          .then((org) => loadOrgAndSettings(org.id))
          .finally(() => setLoading(false))
      }
    } else {
      setLoading(false)
    }

    return () => unsub()
  }, [loadOrgAndSettings])

  const login = async (email: string, pass: string) => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    const u = authData.record as unknown as User
    setUser(u)
    if (u.organization_id) {
      await loadOrgAndSettings(u.organization_id)
    } else {
      const org = await pb.collection('organizations').getFirstListItem<Organization>('')
      if (org) {
        await pb.collection('users').update(u.id, { organization_id: org.id })
        await loadOrgAndSettings(org.id)
      }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setOrganization(null)
    setSettings(null)
  }

  const updateSettings = async (newSettings: Partial<BusinessSettings>) => {
    if (!settings?.id) return
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

  const switchOrganization = async (orgId: string) => {
    if (user?.id) {
      await pb.collection('users').update(user.id, { organization_id: orgId })
    }
    await loadOrgAndSettings(orgId)
  }

  const isAdmin = user?.role === 'ADMINISTRADOR' || user?.role === 'SUPERADMIN' || !user?.role
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
        switchOrganization,
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
