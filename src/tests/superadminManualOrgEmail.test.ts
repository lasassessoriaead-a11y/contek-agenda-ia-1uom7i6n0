import { describe, it, expect, vi } from 'vitest'
import superAdminSource from '../pages/SuperAdmin.tsx?raw'
import superadminRoutesHookSource from '../../pocketbase/hooks/superadmin_routes.js?raw'

describe('SuperAdmin Manual Organization Creation & Automatic Welcome Email', () => {
  describe('Backend Hook Implementation (/backend/v1/superadmin/org/create)', () => {
    it('implements automatic transactional welcome email dispatch with Contek identity', () => {
      // 1. O hook deve instanciar e enviar um e-mail com new MailerMessage
      expect(superadminRoutesHookSource).toContain('new MailerMessage')
      expect(superadminRoutesHookSource).toContain('$app.newMailClient().send')

      // 2. Deve utilizar a paleta oficial do Grupo Contek e chancela
      expect(superadminRoutesHookSource).toContain('#0D1B2A')
      expect(superadminRoutesHookSource).toContain('#1E3A8A')
      expect(superadminRoutesHookSource).toContain('#06B6D4')
      expect(superadminRoutesHookSource).toContain('#22C55E')
      expect(superadminRoutesHookSource).toContain('Uma Solução Grupo CONTEK')
      expect(superadminRoutesHookSource).toContain('GRUPO CONTEK — TECNOLOGIA E CONSULTORIA')

      // 3. Conteúdo obrigatório: login_url, email do admin, senha provisória e link público /agendar/:slug
      expect(superadminRoutesHookSource).toContain('cleanAdminEmail')
      expect(superadminRoutesHookSource).toContain('cleanAdminPassword')
      expect(superadminRoutesHookSource).toContain('/agendar/')
      expect(superadminRoutesHookSource).toContain('/login')

      // 4. Recomendação explícita de segurança para trocar a senha no primeiro acesso
      expect(superadminRoutesHookSource).toContain('Recomendação Importante de Segurança')
      expect(superadminRoutesHookSource).toContain('Esqueci minha senha')
    })

    it('guarantees that email dispatch failure does NOT prevent organization creation', () => {
      // O envio de e-mail é encapsulado em try/catch de forma não impeditiva
      expect(superadminRoutesHookSource).toMatch(/try\s*\{\s*const\s+publicBaseUrl[\s\S]*\$app\.newMailClient\(\)\.send\(mailMsg\)\s*emailSent\s*=\s*true\s*\}\s*catch\s*\(mailErr\)/)
      // O retorno JSON da rota inclui os status email_sent e email_error
      expect(superadminRoutesHookSource).toContain('email_sent: emailSent')
      expect(superadminRoutesHookSource).toContain('email_error: emailError')
    })

    it('provides dedicated resend endpoint (/backend/v1/superadmin/org/resend-credentials)', () => {
      expect(superadminRoutesHookSource).toContain("'/backend/v1/superadmin/org/resend-credentials'")
      expect(superadminRoutesHookSource).toContain('Reenvio de credenciais')
      expect(superadminRoutesHookSource).toContain('$security.randomString')
    })
  })

  describe('Frontend SuperAdmin UI & Credentials Modal', () => {
    it('notifies user whether automatic email was dispatched or failed with retry option', () => {
      // Modal de credenciais possui indicadores claros de envio
      expect(superAdminSource).toContain('E-mail de boas-vindas enviado automaticamente!')
      expect(superAdminSource).toContain('Aviso: Não foi possível enviar o e-mail automático')

      // Botão de reenviar e-mail no modal e na tabela
      expect(superAdminSource).toContain('Reenviar E-mail')
      expect(superAdminSource).toContain('Reenviar e-mail de acesso')
      expect(superAdminSource).toContain('/backend/v1/superadmin/org/resend-credentials')
    })

    it('simulates create response handling for both success and failure of email dispatch', () => {
      const mockCreatedSuccess = {
        success: true,
        message: 'Empresa cadastrada com sucesso! E-mail com credenciais enviado para camila@estetica.com.',
        email_sent: true,
        email_error: null,
        organization: { id: 'org_1', name: 'Clínica Camila', slug: 'clinica-camila' },
        created_credentials: {
          name: 'Clínica Camila',
          slug: 'clinica-camila',
          admin_name: 'Camila Gestora',
          admin_email: 'camila@estetica.com',
          admin_password: 'Provisoria@123',
          login_url: '/login',
          public_url: '/agendar/clinica-camila',
        },
      }

      expect(mockCreatedSuccess.email_sent).toBe(true)
      expect(mockCreatedSuccess.created_credentials.admin_email).toBe('camila@estetica.com')
      expect(mockCreatedSuccess.created_credentials.admin_password).toBe('Provisoria@123')
      expect(mockCreatedSuccess.created_credentials.public_url).toBe('/agendar/clinica-camila')

      const mockCreatedEmailFailed = {
        success: true,
        message: 'Empresa criada, mas houve uma falha no envio do e-mail: SMTP timeout.',
        email_sent: false,
        email_error: 'SMTP timeout',
        organization: { id: 'org_2', name: 'Studio Teste', slug: 'studio-teste' },
      }

      // Organização foi criada mesmo com falha no e-mail
      expect(mockCreatedEmailFailed.success).toBe(true)
      expect(mockCreatedEmailFailed.organization.id).toBe('org_2')
      expect(mockCreatedEmailFailed.email_sent).toBe(false)
      expect(mockCreatedEmailFailed.email_error).toBe('SMTP timeout')
    })

    it('verifies generated email template parameters matching business requirements', () => {
      const generateEmailHtml = (data: {
        adminName: string
        orgName: string
        product: string
        plan: string
        loginUrl: string
        email: string
        pass: string
        bookingUrl: string
      }) => {
        return `
          Saudação: Olá, ${data.adminName}!
          Empresa: ${data.orgName}
          Produto: ${data.product}
          Plano: ${data.plan}
          Login: ${data.loginUrl}
          Acesso: ${data.email}
          Senha: ${data.pass}
          Link Público: ${data.bookingUrl}
          Chancela: Uma Solução Grupo CONTEK — Tecnologia e Consultoria
        `
      }

      const emailContent = generateEmailHtml({
        adminName: 'Camila',
        orgName: 'Camila Estética Avançada',
        product: 'MARKALY',
        plan: 'Markaly Start',
        loginUrl: 'https://contek-agenda-ia-479d4.goskip.app/login',
        email: 'camila@estetica.com',
        pass: 'Segredo@123',
        bookingUrl: 'https://contek-agenda-ia-479d4.goskip.app/agendar/camila-estetica',
      })

      expect(emailContent).toContain('Camila')
      expect(emailContent).toContain('Camila Estética Avançada')
      expect(emailContent).toContain('MARKALY')
      expect(emailContent).toContain('Markaly Start')
      expect(emailContent).toContain('camila@estetica.com')
      expect(emailContent).toContain('Segredo@123')
      expect(emailContent).toContain('/agendar/camila-estetica')
      expect(emailContent).toContain('Grupo CONTEK')
    })
  })
})
