/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/backend/v1/whatsapp/webhook', (e) => {
  const query = e.requestInfo().query || {}
  const mode = query['hub.mode']
  const token = query['hub.verify_token']
  const challenge = query['hub.challenge']

  const expectedToken =
    $os.getenv('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
    $secrets.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ||
    'contek_agenda_webhook_secret'

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook Verified] WhatsApp webhook challenge accepted.')
    return e.string(200, challenge || '')
  }

  console.warn('[Meta Webhook Verification Failed] Token mismatch or invalid mode.')
  return e.json(403, { error: 'Verification failed: invalid hub.verify_token or hub.mode' })
})
