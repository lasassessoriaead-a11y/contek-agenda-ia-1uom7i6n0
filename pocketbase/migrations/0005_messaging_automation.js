/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Add messaging automation template and switch fields to business_settings
    const bizSettingsCol = app.findCollectionByNameOrId('business_settings')

    if (!bizSettingsCol.fields.getByName('auto_reminders_enabled')) {
      bizSettingsCol.fields.add(
        new BoolField({
          name: 'auto_reminders_enabled',
          required: false,
        }),
      )
    }

    if (!bizSettingsCol.fields.getByName('template_confirmation_request')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'template_confirmation_request',
          required: false,
        }),
      )
    }

    if (!bizSettingsCol.fields.getByName('template_confirmation_thanks')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'template_confirmation_thanks',
          required: false,
        }),
      )
    }

    if (!bizSettingsCol.fields.getByName('template_day_reminder')) {
      bizSettingsCol.fields.add(
        new TextField({
          name: 'template_day_reminder',
          required: false,
        }),
      )
    }

    app.save(bizSettingsCol)

    // 2. Add confirmation token and notifications_sent tracker to appointments
    const appointmentsCol = app.findCollectionByNameOrId('appointments')

    if (!appointmentsCol.fields.getByName('confirmation_token')) {
      appointmentsCol.fields.add(
        new TextField({
          name: 'confirmation_token',
          required: false,
        }),
      )
    }

    if (!appointmentsCol.fields.getByName('notifications_sent')) {
      appointmentsCol.fields.add(
        new JSONField({
          name: 'notifications_sent',
          required: false,
        }),
      )
    }

    app.save(appointmentsCol)

    // Ensure index on confirmation_token for fast lookup
    appointmentsCol.addIndex('idx_appointments_confirmation_token', false, 'confirmation_token', '')
    app.save(appointmentsCol)

    // 3. Create notification_logs collection for history & multi-tenant isolation
    const orgCol = app.findCollectionByNameOrId('organizations')
    const orgId = orgCol.id

    if (!app.hasTable('notification_logs')) {
      const notificationLogs = new Collection({
        name: 'notification_logs',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'organization_id',
            type: 'relation',
            required: true,
            collectionId: orgId,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'appointment_id',
            type: 'relation',
            required: false,
            collectionId: appointmentsCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['CONFIRMATION_REQUEST', 'CONFIRMATION_THANKS', 'DAY_REMINDER', 'MANUAL_WA'],
            maxSelect: 1,
          },
          {
            name: 'channel',
            type: 'select',
            required: true,
            values: ['WHATSAPP_AUTO', 'WHATSAPP_MANUAL', 'WEB'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['SENT', 'PENDING_NO_CREDENTIALS', 'FAILED'],
            maxSelect: 1,
          },
          { name: 'recipient_phone', type: 'text' },
          { name: 'recipient_name', type: 'text' },
          { name: 'message_text', type: 'text' },
          { name: 'payload', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_notif_logs_org ON notification_logs (organization_id, created DESC)',
          'CREATE INDEX idx_notif_logs_appt ON notification_logs (appointment_id, type)',
        ],
      })
      app.save(notificationLogs)
    }

    // 4. Populate default templates on existing business_settings records if blank
    try {
      const allSettings = app.findRecordsByFilter('business_settings', '', '', 100, 0)
      for (const bs of allSettings) {
        let changed = false
        if (!bs.getString('template_confirmation_request')) {
          bs.set(
            'template_confirmation_request',
            'Olá, {{nome_paciente}}! Aqui é da {{empresa}}. Lembramos que você tem um agendamento de {{servico}} com {{nome_profissional}} amanhã, dia {{data}} às {{hora}}.\n\nPor favor, confirme sua presença clicando no link: {{link_confirmacao}} ou responda 1 para confirmar.',
          )
          changed = true
        }
        if (!bs.getString('template_confirmation_thanks')) {
          bs.set(
            'template_confirmation_thanks',
            'Muito obrigado por confirmar, {{nome_paciente}}! Seu agendamento na {{empresa}} para dia {{data}} às {{hora}} está confirmado. Estamos te esperando com carinho!',
          )
          changed = true
        }
        if (!bs.getString('template_day_reminder')) {
          bs.set(
            'template_day_reminder',
            'Olá, {{nome_paciente}}! Passando para lembrar do seu atendimento de {{servico}} HOJE, às {{hora}}, na {{empresa}} com {{nome_profissional}}. Qualquer dúvida, estamos à disposição!',
          )
          changed = true
        }
        if (
          bs.get('auto_reminders_enabled') === null ||
          bs.get('auto_reminders_enabled') === undefined
        ) {
          bs.set('auto_reminders_enabled', true)
          changed = true
        }
        if (changed) {
          app.save(bs)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const notifLogs = app.findCollectionByNameOrId('notification_logs')
      app.delete(notifLogs)
    } catch (_) {}

    try {
      const appointmentsCol = app.findCollectionByNameOrId('appointments')
      if (appointmentsCol.fields.getByName('confirmation_token')) {
        appointmentsCol.fields.removeByName('confirmation_token')
      }
      if (appointmentsCol.fields.getByName('notifications_sent')) {
        appointmentsCol.fields.removeByName('notifications_sent')
      }
      app.save(appointmentsCol)
    } catch (_) {}

    try {
      const bizSettingsCol = app.findCollectionByNameOrId('business_settings')
      if (bizSettingsCol.fields.getByName('auto_reminders_enabled')) {
        bizSettingsCol.fields.removeByName('auto_reminders_enabled')
      }
      if (bizSettingsCol.fields.getByName('template_confirmation_request')) {
        bizSettingsCol.fields.removeByName('template_confirmation_request')
      }
      if (bizSettingsCol.fields.getByName('template_confirmation_thanks')) {
        bizSettingsCol.fields.removeByName('template_confirmation_thanks')
      }
      if (bizSettingsCol.fields.getByName('template_day_reminder')) {
        bizSettingsCol.fields.removeByName('template_day_reminder')
      }
      app.save(bizSettingsCol)
    } catch (_) {}
  },
)
