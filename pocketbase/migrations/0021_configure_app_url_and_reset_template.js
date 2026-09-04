/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    try {
      const settings = app.settings()
      if (settings && settings.meta) {
        settings.meta.appName = 'AGYLI'
        settings.meta.appURL = 'https://contek-agenda-ia-479d4.goskip.app'
        app.save(settings)
      }
    } catch (err) {
      console.log('[0021_configure_app_url_and_reset_template] settings error:', err)
    }

    try {
      const users = app.findCollectionByNameOrId('_pb_users_auth_')
      if (users) {
        users.resetPasswordTemplate = {
          subject: 'Redefinição de senha - AGYLI Gestão Inteligente',
          body: '<p>Olá,</p><p>Recebemos sua solicitação para redefinir a senha de acesso ao sistema AGYLI.</p><p>Clique no link abaixo para cadastrar sua nova senha:</p><p><a class="btn" href="{APP_URL}/redefinir-senha?token={TOKEN}" target="_blank" rel="noopener">Redefinir Senha</a></p><p>Se você não solicitou a redefinição de senha, desconsidere esta mensagem.</p><p>Atenciosamente,<br>Equipe AGYLI • Contek Tecnologia</p>',
        }
        app.save(users)
      }
    } catch (err) {
      console.log('[0021_configure_app_url_and_reset_template] users template error:', err)
    }
  },
  (app) => {},
)
