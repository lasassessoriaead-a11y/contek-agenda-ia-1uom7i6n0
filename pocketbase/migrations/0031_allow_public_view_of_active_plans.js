/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration 0031: Tornar listagem pública de planos ativos disponível para Landing e Cadastro
 * Permite que a coleção `plans` seja lida por visitantes não autenticados (apenas planos ativos),
 * para que os preços editáveis apareçam automaticamente nas landings e cadastro.
 */
migrate(
  (app) => {
    const plansCol = app.findCollectionByNameOrId('plans')
    // Permite leitura pública de planos que estão ativos
    plansCol.listRule = 'active = true'
    plansCol.viewRule = 'active = true'
    app.save(plansCol)
  },
  (app) => {
    const plansCol = app.findCollectionByNameOrId('plans')
    plansCol.listRule = "@request.auth.id != ''"
    plansCol.viewRule = "@request.auth.id != ''"
    app.save(plansCol)
  },
)
