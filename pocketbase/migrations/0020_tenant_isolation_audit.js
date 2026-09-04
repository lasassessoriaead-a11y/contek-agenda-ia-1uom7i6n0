/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Migration de auditoria e correção de dados de isolamento multi-tenant
  // Garante que todas as organizações possuam seus próprios profissionais e serviços vinculados com isolamento estrito

  const orgs = app.findRecordsByFilter('organizations', 'id != ""', '-created', 100)

  for (let i = 0; i < orgs.length; i++) {
    const org = orgs[i]
    const orgId = org.id
    const orgName = org.getString('name') || 'Minha Empresa'

    // 1. Verificar se a organização tem pelo menos 1 profissional com seu organization_id
    const profs = app.findRecordsByFilter(
      'professionals',
      'organization_id = {:orgId}',
      '-created',
      10,
      0,
      { orgId },
    )

    let profRecord = null
    if (profs.length > 0) {
      profRecord = profs[0]
    } else {
      // Descobrir usuário administrador da organização
      let ownerName = orgName
      let ownerEmail = ''
      let ownerPhone = ''
      let ownerUserId = ''

      const orgUsers = app.findRecordsByFilter(
        'organization_users',
        'organization_id = {:orgId}',
        '-created',
        1,
        0,
        { orgId },
      )
      if (orgUsers.length > 0) {
        ownerUserId = orgUsers[0].getString('user_id')
        try {
          const userRec = app.findRecordById('users', ownerUserId)
          ownerName = userRec.getString('name') || orgName
          ownerEmail = userRec.getString('email') || ''
          ownerPhone = userRec.getString('phone') || ''
        } catch (_) {}
      }

      const profCol = app.findCollectionByNameOrId('professionals')
      profRecord = new Record(profCol)
      profRecord.set('organization_id', orgId)
      if (ownerUserId) {
        profRecord.set('user_id', ownerUserId)
      }
      profRecord.set('name', ownerName)
      profRecord.set('specialty', 'Especialista')
      profRecord.set('phone', ownerPhone)
      profRecord.set('email', ownerEmail)
      profRecord.set('default_duration', 45)
      profRecord.set('work_days', ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'])
      profRecord.set('work_hours', { start: '08:00', end: '19:00' })
      profRecord.set('active', true)
      app.save(profRecord)
    }

    // 2. Verificar se a organização tem pelo menos 1 serviço com seu organization_id
    const services = app.findRecordsByFilter(
      'services',
      'organization_id = {:orgId}',
      '-created',
      10,
      0,
      { orgId },
    )
    let servRecord = null
    if (services.length > 0) {
      servRecord = services[0]
    } else {
      const servCol = app.findCollectionByNameOrId('services')
      servRecord = new Record(servCol)
      servRecord.set('organization_id', orgId)
      servRecord.set('name', 'Atendimento Inicial / Consulta')
      servRecord.set('description', 'Serviço padrão configurado automaticamente')
      servRecord.set('duration', 45)
      servRecord.set('price', 150)
      servRecord.set('color', '#10b981')
      servRecord.set('category', 'Geral')
      servRecord.set('active', true)
      app.save(servRecord)
    }

    // 3. Garantir vínculo professional_services com isolamento
    if (profRecord && servRecord) {
      const links = app.findRecordsByFilter(
        'professional_services',
        'organization_id = {:orgId} && professional_id = {:profId} && service_id = {:servId}',
        '-created',
        1,
        0,
        { orgId, profId: profRecord.id, servId: servRecord.id },
      )
      if (links.length === 0) {
        const linkCol = app.findCollectionByNameOrId('professional_services')
        const linkRec = new Record(linkCol)
        linkRec.set('organization_id', orgId)
        linkRec.set('professional_id', profRecord.id)
        linkRec.set('service_id', servRecord.id)
        app.save(linkRec)
      }
    }
  }
})
