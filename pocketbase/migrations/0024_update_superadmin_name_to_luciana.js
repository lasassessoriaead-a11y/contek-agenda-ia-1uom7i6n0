migrate(
  (app) => {
    // Atualiza o nome do usuário SuperAdmin (luka2510@hotmail.com) de "Lucas ..." para "Luciana"
    app
      .db()
      .newQuery(`
    UPDATE users
    SET name = {:newName}
    WHERE email = {:email}
  `)
      .bind({
        newName: 'Luciana (SuperAdmin)',
        email: 'luka2510@hotmail.com',
      })
      .execute()
  },
  (app) => {
    // Reverte para o nome anterior se necessário
    app
      .db()
      .newQuery(`
    UPDATE users
    SET name = {:oldName}
    WHERE email = {:email}
  `)
      .bind({
        oldName: 'Lucas Silva (Administrador)',
        email: 'luka2510@hotmail.com',
      })
      .execute()
  },
)
