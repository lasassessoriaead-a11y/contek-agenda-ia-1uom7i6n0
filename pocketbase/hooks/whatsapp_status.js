/// <reference path="../pb_data/types.d.ts" />

routerAdd(
  'GET',
  '/backend/v1/whatsapp/status',
  (e) => {
    try {
      const accessToken =
        $os.getenv('META_WA_ACCESS_TOKEN') || $secrets.get('META_WA_ACCESS_TOKEN') || ''
      const phoneNumberId =
        $os.getenv('META_WA_PHONE_NUMBER_ID') || $secrets.get('META_WA_PHONE_NUMBER_ID') || ''
      const wabaId =
        $os.getenv('META_WA_BUSINESS_ACCOUNT_ID') ||
        $secrets.get('META_WA_BUSINESS_ACCOUNT_ID') ||
        ''
      const appSecret = $os.getenv('META_WA_APP_SECRET') || $secrets.get('META_WA_APP_SECRET') || ''
      const verifyToken =
        $os.getenv('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
        $secrets.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
        ''
      const centralNumber =
        $os.getenv('WHATSAPP_CENTRAL_PHONE') ||
        $secrets.get('WHATSAPP_CENTRAL_PHONE') ||
        '5511987654321'

      const pbUrl = $os.getenv('PB_INSTANCE_URL') || ''
      const webhookCallbackUrl = `${pbUrl}/backend/v1/whatsapp/webhook`

      const missingSecrets = []
      if (!accessToken) missingSecrets.push('META_WA_ACCESS_TOKEN')
      if (!phoneNumberId) missingSecrets.push('META_WA_PHONE_NUMBER_ID')
      if (!wabaId) missingSecrets.push('META_WA_BUSINESS_ACCOUNT_ID')
      if (!appSecret) missingSecrets.push('META_WA_APP_SECRET')
      if (!verifyToken) missingSecrets.push('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

      const isConfigured = missingSecrets.length === 0

      return e.json(200, {
        is_configured: isConfigured,
        webhook_callback_url: webhookCallbackUrl,
        verify_token_configured: Boolean(verifyToken),
        has_access_token: Boolean(accessToken),
        has_phone_number_id: Boolean(phoneNumberId),
        has_waba_id: Boolean(wabaId),
        has_app_secret: Boolean(appSecret),
        missing_secrets: missingSecrets,
        central_phone: centralNumber,
      })
    } catch (err) {
      return e.json(500, { error: err.message || 'Error checking WhatsApp status' })
    }
  },
  $apis.requireAuth(),
)
