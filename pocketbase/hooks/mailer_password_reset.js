/// <reference path="../pb_data/types.d.ts" />

onMailerRecordPasswordResetSend((e) => {
  const publicAppUrl = $os.getenv('SITE_URL') || 'https://contek-agenda-ia-479d4.goskip.app'
  const token = (e.meta && e.meta.token) || ''
  const resetLink = publicAppUrl + '/redefinir-senha?token=' + encodeURIComponent(token)

  e.message.subject = 'Redefinição de senha - AGYLI Gestão Inteligente'
  e.message.html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Redefinição de Senha</title>
</head>
<body style="margin: 0; padding: 24px; font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0F172A; color: #F8FAFC;">
  <div style="max-width: 540px; margin: 0 auto; background: #1E293B; border-radius: 16px; border: 1px solid #334155; padding: 36px 28px; text-align: center;">
    <div style="margin-bottom: 24px;">
      <span style="font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #3B82F6, #8B5CF6); -webkit-background-clip: text; color: #3B82F6; letter-spacing: -0.5px;">AGYLI</span>
      <p style="margin: 4px 0 0; font-size: 11px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Gestão & Agenda Inteligente</p>
    </div>

    <h1 style="font-size: 20px; font-weight: 700; color: #FFFFFF; margin: 0 0 12px 0;">Recuperação de Senha</h1>
    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 28px 0;">
      Olá! Recebemos uma solicitação para redefinir a senha da sua conta de acesso. Para cadastrar uma nova senha, clique com segurança no botão abaixo:
    </p>

    <div style="margin: 32px 0;">
      <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="background: linear-gradient(135deg, #3B82F6, #8B5CF6); color: #FFFFFF; font-weight: 600; font-size: 15px; padding: 14px 32px; text-decoration: none; border-radius: 10px; display: inline-block; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);">
        Cadastrar Nova Senha
      </a>
    </div>

    <p style="font-size: 12px; line-height: 1.5; color: #94A3B8; margin: 24px 0 0 0;">
      Caso não tenha solicitado a redefinição, fique tranquilo: sua conta permanece protegida e você pode desconsiderar esta mensagem.
    </p>

    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #334155; font-size: 11px; color: #64748B;">
      Link direto: <a href="${resetLink}" style="color: #60A5FA; word-break: break-all;">${resetLink}</a>
      <p style="margin-top: 8px;">Contek Tecnologia e Consultoria • AGYLI & MARKALY</p>
    </div>
  </div>
</body>
</html>
  `

  e.next()
})
