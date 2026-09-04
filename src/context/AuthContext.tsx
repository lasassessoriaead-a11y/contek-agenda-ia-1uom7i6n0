import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type {
  User,
  Organization,
  BusinessSettings,
  ProductType,
  OrganizationFeaturesResponse,
} from '@/types'
import { getProductBranding, resolveProductByDomain, type ProductBranding } from '@/lib/branding'

interface AuthContextType {
  user: User | null
  organization: Organization | null
  settings: BusinessSettings | null
  features: OrganizationFeaturesResponse | null
  currentProduct: ProductType
  branding: ProductBranding
  loading: boolean
  isAdmin: boolean
  isProfessional: boolean
  isSuperAdmin: boolean
  hasFeature: (featureKey: string) => boolean
  login: (email: string, pass: string) => Promise<void>
  logout: () => void
  refreshOrganization: () => Promise<void>
  refreshFeatures: () => Promise<void>
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
  const [features, setFeatures] = useState<OrganizationFeaturesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshFeatures = useCallback(async () => {
    if (!pb.authStore.isValid) return
    try {
      const res = await pb.send<OrganizationFeaturesResponse>('/backend/v1/organization-features', {
        method: 'GET',
      })
      setFeatures(res)
    } catch (err) {
      console.warn('Could not load organization features:', err)
    }
  }, [])

  const loadOrgAndSettings = useCallback(
    async (orgId: string) => {
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

        await refreshFeatures()
      } catch (err) {
        console.error('Error loading organization:', err)
        setOrganization(null)
      }
    },
    [refreshFeatures],
  )

  const refreshOrganization = useCallback(async () => {
    // 1. Prioriza o organization_id do usuário autenticado se presente
    const targetOrgId =
      user?.organization_id ||
      (typeof window !== 'undefined' ? localStorage.getItem('contek_active_org_id') : null)

    if (targetOrgId) {
      await loadOrgAndSettings(targetOrgId)
      return
    }

    // 2. Fallback: verificar em organization_users
    if (user?.id) {
      try {
        const userOrg = await pb
          .collection('organization_users')
          .getFirstListItem(`user_id = "${user.id}"`)
        if (userOrg && userOrg.organization_id) {
          await loadOrgAndSettings(userOrg.organization_id)
          return
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }, [user?.organization_id, user?.id, loadOrgAndSettings])

  useEffect(() => {
    const unsub = pb.authStore.onChange(async (_, model) => {
      if (model) {
        const u = model as unknown as User
        setUser(u)
        const savedOrgId =
          typeof window !== 'undefined' ? localStorage.getItem('contek_active_org_id') : null
        const activeOrgId = u.organization_id || savedOrgId

        if (activeOrgId) {
          await loadOrgAndSettings(activeOrgId)
        } else if (u.id) {
          // Check organization_users membership
          try {
            const userOrg = await pb
              .collection('organization_users')
              .getFirstListItem(`user_id = "${u.id}"`)
            if (userOrg && userOrg.organization_id) {
              await loadOrgAndSettings(userOrg.organization_id)
            }
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
      const savedOrgId =
        typeof window !== 'undefined' ? localStorage.getItem('contek_active_org_id') : null
      const activeOrgId = u.organization_id || savedOrgId

      if (activeOrgId) {
        loadOrgAndSettings(activeOrgId).finally(() => setLoading(false))
      } else if (u.id) {
        pb.collection('organization_users')
          .getFirstListItem(`user_id = "${u.id}"`)
          .then((orgUser) => {
            if (orgUser && orgUser.organization_id) {
              return loadOrgAndSettings(orgUser.organization_id)
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false))
      } else {
        setLoading(false)
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
    } else if (u.id) {
      try {
        const orgUser = await pb
          .collection('organization_users')
          .getFirstListItem(`user_id = "${u.id}"`)
        if (orgUser && orgUser.organization_id) {
          await pb.collection('users').update(u.id, { organization_id: orgUser.organization_id })
          await loadOrgAndSettings(orgUser.organization_id)
        }
      } catch {
        /* intentionally ignored */
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
    if (!orgId) return

    // 1. Armazena localmente para persistência imediata
    if (typeof window !== 'undefined') {
      localStorage.setItem('contek_active_org_id', orgId)
    }

    // 2. Atualiza o registro do usuário se logado
    if (user?.id) {
      try {
        const updatedUser = await pb
          .collection('users')
          .update<User>(user.id, { organization_id: orgId })
        setUser(updatedUser)
      } catch (err) {
        console.warn('Could not update user organization_id on PB:', err)
      }

      // 3. Se for SuperAdmin, assegura vínculo na tabela organization_users para o tenant
      const isSuper = Boolean(user.is_super_admin || user.role === 'SUPERADMIN')
      if (isSuper) {
        try {
          const existing = await pb
            .collection('organization_users')
            .getFirstListItem(`organization_id = "${orgId}" && user_id = "${user.id}"`)
            .catch(() => null)
          if (!existing) {
            await pb.collection('organization_users').create({
              organization_id: orgId,
              user_id: user.id,
              role: 'ADMINISTRADOR',
            })
          }
        } catch {
          /* ignore */
        }
      }
    }

    // 4. Carrega a organização e suas configurações
    await loadOrgAndSettings(orgId)
  }

  const isSuperAdmin = Boolean(user?.is_super_admin || user?.role === 'SUPERADMIN')
  const isAdmin = user?.role === 'ADMINISTRADOR' || isSuperAdmin || !user?.role
  const isProfessional = user?.role === 'PROFISSIONAL'

  // Determinar o produto corrente:
  // Usuários autenticados usam organization.product (ou features.product) como fonte máxima da verdade.
  // Se não houver organização ativa carregada, usa o domínio ou 'agyli' como fallback.
  const currentProduct: ProductType = useMemo(() => {
    if (organization?.product) {
      return organization.product
    }
    if (features?.product) {
      return features.product
    }
    if (typeof window !== 'undefined') {
      return resolveProductByDomain(window.location.hostname, 'agyli')
    }
    return 'agyli'
  }, [organization?.product, features?.product])

  const branding = useMemo(() => {
    return getProductBranding(currentProduct)
  }, [currentProduct])

  const hasFeature = useCallback(
    (featureKey: string): boolean => {
      const effectiveProduct = organization?.product || features?.product || currentProduct

      // Features explicitamente proibidas no plano MARKALY:
      // O produto REAL da organização ativa vence: se for markaly, essas features
      // retornam false MESMO para SuperAdmin inspecionando o tenant.
      const FORBIDDEN_MARKALY_FEATURES = [
        'financeiro',
        'assistente_ia',
        'whatsapp_ai',
        'relatorios',
        'configuracoes_avancadas',
      ]

      if (effectiveProduct === 'markaly' && FORBIDDEN_MARKALY_FEATURES.includes(featureKey)) {
        return false
      }

      // Para demais features ou produtos não-markaly, SuperAdmin tem bypass
      if (isSuperAdmin) return true

      // Se temos o mapa do endpoint do backend:
      if (features?.feature_map) {
        return Boolean(features.feature_map[featureKey])
      }

      // Fallback local se a requisição ainda estiver carregando
      if (effectiveProduct === 'markaly') {
        const markalyFeatures = [
          'dashboard',
          'agenda',
          'clientes',
          'servicos',
          'profissionais',
          'configuracoes_basicas',
          'whatsapp_notificacoes',
        ]
        return markalyFeatures.includes(featureKey)
      }

      // agyli por padrão tem tudo
      return true
    },
    [organization?.product, features?.product, features?.feature_map, isSuperAdmin, currentProduct],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        settings,
        features,
        currentProduct,
        branding,
        loading,
        isAdmin,
        isProfessional,
        isSuperAdmin,
        hasFeature,
        login,
        logout,
        refreshOrganization,
        refreshFeatures,
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
