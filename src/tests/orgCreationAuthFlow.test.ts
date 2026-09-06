import { describe, it, expect } from 'vitest'

describe('Org Creation & Email/Password Authentication Flow Simulation', () => {
  it('validates that an org created with admin credentials authenticates with matching pair and fails with mismatch', () => {
    // Simulação exata da criação via SuperAdmin
    const simulatedDb = {
      users: [] as Array<{ email: string; passwordHash: string; organizationId: string; role: string }>,
      orgs: [] as Array<{ id: string; name: string; slug: string; product: string }>,
      services: [] as Array<{ id: string; organizationId: string; name: string }>,
      professionals: [] as Array<{ id: string; organizationId: string; name: string }>,
    }

    const hashPassword = (p: string) => `hashed_${p}`

    const createOrgEndpoint = (payload: {
      name: string
      slug: string
      admin_email: string
      admin_password: string
      product: 'agyli' | 'markaly'
      create_example_service?: boolean
    }) => {
      const orgId = `org_${Date.now()}`
      simulatedDb.orgs.push({
        id: orgId,
        name: payload.name,
        slug: payload.slug,
        product: payload.product,
      })

      simulatedDb.users.push({
        email: payload.admin_email.toLowerCase().trim(),
        passwordHash: hashPassword(payload.admin_password),
        organizationId: orgId,
        role: 'ADMINISTRADOR',
      })

      simulatedDb.professionals.push({
        id: `prof_${orgId}`,
        organizationId: orgId,
        name: payload.name,
      })

      if (payload.create_example_service !== false) {
        simulatedDb.services.push({
          id: `serv_${orgId}`,
          organizationId: orgId,
          name: 'Atendimento Inicial / Consulta',
        })
      }

      return {
        success: true,
        login_url: `/login?org=${encodeURIComponent(payload.slug)}&brand=${encodeURIComponent(payload.product)}&email=${encodeURIComponent(payload.admin_email)}`,
      }
    }

    const authenticate = (email: string, pass: string) => {
      const cleanEmail = email.toLowerCase().trim()
      const user = simulatedDb.users.find((u) => u.email === cleanEmail)
      if (!user) return { success: false, error: 'Usuário não encontrado' }
      if (user.passwordHash !== hashPassword(pass)) {
        return { success: false, error: 'E-mail ou senha incorretos' }
      }
      return { success: true, user }
    }

    // 1. SuperAdmin cadastra CAMILA com MARKALY e email luka251083@gmail.com
    const res = createOrgEndpoint({
      name: 'CAMILA',
      slug: 'camila',
      admin_email: 'luka251083@gmail.com',
      admin_password: 'SenhaForte123@',
      product: 'markaly',
      create_example_service: true,
    })

    expect(res.success).toBe(true)
    expect(res.login_url).toBe('/login?org=camila&brand=markaly&email=luka251083%40gmail.com')

    // 2. Tentar autenticar com o email errado da Luciana (SuperAdmin) preenchido por autofill
    const authWrongEmail = authenticate('luka2510@hotmail.com', 'SenhaForte123@')
    expect(authWrongEmail.success).toBe(false)
    expect(authWrongEmail.error).toBe('Usuário não encontrado')

    // 3. Autenticar com o email e senha corretos informados
    const authCorrect = authenticate('luka251083@gmail.com', 'SenhaForte123@')
    expect(authCorrect.success).toBe(true)
    expect(authCorrect.user?.role).toBe('ADMINISTRADOR')

    // 4. Se a senha for alterada/regenerada no reenvio, a senha anterior DEVE falhar
    const regeneratePassword = (email: string, newPass: string) => {
      const user = simulatedDb.users.find((u) => u.email === email.toLowerCase().trim())
      if (user) {
        user.passwordHash = hashPassword(newPass)
        return true
      }
      return false
    }

    regeneratePassword('luka251083@gmail.com', 'NovaSenhaGerada999@')

    // A senha antiga ('SenhaForte123@') agora é rejeitada
    const authWithOldPass = authenticate('luka251083@gmail.com', 'SenhaForte123@')
    expect(authWithOldPass.success).toBe(false)
    expect(authWithOldPass.error).toBe('E-mail ou senha incorretos')

    // A nova senha autentica perfeitamente
    const authWithNewPass = authenticate('luka251083@gmail.com', 'NovaSenhaGerada999@')
    expect(authWithNewPass.success).toBe(true)

    // 5. Testar criação COM e SEM serviço de exemplo
    const orgSemServico = createOrgEndpoint({
      name: 'OUTRA CLINICA',
      slug: 'outra-clinica',
      admin_email: 'outro@admin.com',
      admin_password: 'OutraSenha888@',
      product: 'agyli',
      create_example_service: false,
    })
    expect(orgSemServico.success).toBe(true)

    const camilaServices = simulatedDb.services.filter((s) => s.name === 'Atendimento Inicial / Consulta')
    expect(camilaServices.length).toBe(1) // apenas CAMILA possui serviço semeado
  })
})
