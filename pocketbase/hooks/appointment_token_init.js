/// <reference path="../pb_data/types.d.ts" />

// Auto-assign confirmation_token on appointment creation if not present
onRecordCreate((e) => {
  const record = e.record
  if (!record.getString('confirmation_token')) {
    record.set('confirmation_token', $security.randomString(32))
  }
  if (!record.get('notifications_sent')) {
    record.set('notifications_sent', {})
  }
  e.next()
}, 'appointments')
