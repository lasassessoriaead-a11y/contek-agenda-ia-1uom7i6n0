# RELATÓRIO DE AUDITORIA TÉCNICA E NÃO DESTRUTIVA

## Sistema-Mãe: Contek Agenda IA (Base Unificada para AGYLI e MARKALY)

**Data da Auditoria:** 04 de Setembro de 2026  
**Auditor:** Skip Developer Agent / Engenharia de Software  
**Natureza da Auditoria:** 100% Somente Leitura e Análise Não Destrutiva (Nenhum dado, tabela ou código operacional foi modificado)  
**Status do Ambiente:** Produção / Skip Cloud / PocketBase Backend

---

## 1. RESUMO EXECUTIVO

O sistema **Contek Agenda IA** é uma aplicação web moderna (SPA em React + TypeScript + Tailwind CSS com backend PocketBase / Skip Cloud) concebida para atender clínicas de estética, consultórios de saúde e estabelecimentos de agendamento por serviços. A proposta estratégica deste projeto é servir como **sistema-mãe unificado** que dará origem a duas ofertas de mercado:

- **AGYLI:** Versão completa (_enterprise/premium_), com todos os módulos operacionais, automação de WhatsApp com IA, relatórios de faturamento e inteligência analítica.
- **MARKALY:** Versão essencial (_lite/standard_), focada em agendamento simplificado, catálogo de serviços e controle de clientes, com funcionalidades avançadas desabilitadas conforme definição comercial.

### Principais Conclusões da Auditoria:

1. **Viabilidade como Sistema-Mãe:** O sistema possui uma excelente base visual, módulos ricos e lógica de agendamento avançada (com cálculo de duração, intervalos, bloqueio de conflitos e suporte a múltiplos turnos de trabalho por profissional). No entanto, **ainda não está pronto para operar imediatamente como sistema-mãe** de AGYLI e MARKALY porque não possui camada de identificação de produto por domínio, matriz de _feature flags_ protegida no backend nem catálogo de planos/assinaturas SaaS.
2. **Isolamento Multi-tenant:** A separação de dados por empresa (`organization_id`) foi implementada nas coleções principais via migração `0009`, mas foram identificadas **duas brechas de segurança e usabilidade críticas**:
   - O fluxo de **Agendamento Público (`/agendar/:slug`)** no frontend tenta ler diretamente do PocketBase as coleções `organizations`, `services`, `professionals` e `appointments`. Como a migração `0009` bloqueou leituras anônimas nestas coleções (`@request.auth.id != ''`), clientes anônimos na web recebem erro de permissão ou tela de "Estabelecimento não encontrado", a menos que usem um endpoint backend desacoplado.
   - A tabela associativa `professional_services` ficou sem regras de validação de `organization_id` na migração `0009`, permitindo que um usuário autenticado de uma empresa associe serviços de outra.
3. **Credenciais de Demonstração em Produção:** A tela de login expõe um botão de "Acesso Rápido DEMO" preenchendo credenciais que dão acesso direto aos dados da empresa de demonstração no banco de produção.
4. **Ausência de Módulo de Faturamento SaaS:** O módulo financeiro atual gerencia **exclusivamente o faturamento do cliente final da clínica** (procedimentos e consultas). Não existe qualquer modelo para cobrança da assinatura mensal/anual que as empresas clientes pagarão à Contek, nem controle de inadimplência, teste grátis (_trial_) ou bloqueio por expiração de plano.

---

## 2. TECNOLOGIAS ENCONTRADAS

### Frontend:

- **Linguagem & Tipagem:** TypeScript 5.5.3 (estrita e tipada).
- **Biblioteca Base:** React 18.3.1 (Single Page Application via React DOM).
- **Bundler & Dev Server:** Vite 5.4.1 (compilação rápida via ESBuild/Rollup).
- **Roteamento:** `react-router-dom` 6.26.2 (roteador SPA cliente com rotas públicas e rotas protegidas por autenticação).
- **Estilização & UI Kit:** Tailwind CSS 3.4.1 com plugin Tailwind Animate, Radix UI primitives e biblioteca de componentes shadcn/ui.
- **Gráficos & Dashboards:** Recharts 2.12.2 (gráficos de barras e pizza para faturamento e status de consultas).
- **Manipulação de Datas:** `date-fns` 3.3.1 com locale `pt-BR`.
- **Feedbacks & Notificações:** `sonner` 2.0.7 (toasts).
- **Ícones:** `lucide-react` 0.344.0.
- **PWA (Progressive Web App):** Suporte configurado com hook `usePwaInstall` e prompt modal `PwaInstallPrompt`.

### Backend:

- **Motor Backend:** Skip Cloud (PocketBase v0.22+ embutido em Go).
- **SDK Cliente:** `pocketbase` 0.21.5 (consumo via cliente REST e realtime WebSocket).
- **Lógica Server-side (Hooks):** PocketBase JavaScript Hooks (`pb_hooks/`), executados em ambiente isolado ECMAScript (Goja engine).
- **Agente Nativo de IA:** Skip Cloud Native Agent (`$ai.agents.define` na migração `0002_agent_setup.js` e `0006_update_agent_isolation.js`).
- **Automação Agendada (Cron Jobs):** `$app.cron().add` via Go/PocketBase no hook `message_automation_sweep.js` (rodando a cada 15 minutos: `*/15 * * * *`).

### Serviços Externos Configurados ou Integrados:

- **OpenAI API (`OPENAI_API_KEY`):** Utilizada internamente pelo motor de IA do Skip Cloud para respostas do assistente contextual.
- **Meta WhatsApp Cloud API:** Variáveis de ambiente configuradas no backend (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WABA_ID`, `WHATSAPP_APP_SECRET`).
- **Webhooks Meta:** Endpoints configurados em `/backend/v1/whatsapp/webhook` para validação e recepção de mensagens.

---

## 3. ARQUITETURA ATUAL

### Arquitetura de Software:

```
[Navegador / Dispositivo Móvel / PWA]
                 │
                 ├── 1. Rotas Públicas: /agendar/:slug, /confirmar/:token, /login
                 └── 2. Rotas Privadas: /dashboard, /agenda, /clientes, /profissionais, etc.
                                 │
                         (HTTPS / WSS)
                                 ▼
                     [Skip Cloud / PocketBase]
         ┌───────────────────────┼────────────────────────┐
         ▼                       ▼                        ▼
 [REST Collections API]   [pb_hooks Endpoints]     [Native Cron & AI Engine]
  - users                  - /public-booking        - Sweep a cada 15 min
  - organizations          - /onboarding            - Meta WhatsApp Dispatch
  - appointments           - /ai-chat               - $ai.agents (Contek IA)
  - clients                - /whatsapp/status
  - payments               - /appointments/confirm
  - services
         │
         ▼
 [Embedded SQLite Engine - Multi-tenant por organization_id]
```

### Avaliação de Manutenibilidade e Código Abandonado:

- **Estrutura de Pastas:** Bem modularizada em `src/pages`, `src/components`, `src/context`, `src/hooks`, `src/lib`, `src/types`.
- **Tamanho dos Arquivos:** `Agenda.tsx` atingiu 2.062 linhas e `Configuracoes.tsx` 1.282 linhas. Embora funcionais, são monolíticos e devem ser decompostos em subcomponentes menores antes da ramificação de produtos.
- **Código Abandonado:**
  - `src/pages/Index.tsx`: Apenas 12 linhas redirecionando para `/dashboard`.
  - Migração `0007_cleanup_cancelled_appointment_payments.js`: Script temporário de limpeza de dados legados mantido na esteira de migrações.
  - Dependências obsoletas no `package.json`: nenhuma detectada. Todas as bibliotecas listadas possuem importação ativa.

---

## 4. MAPA DOS MÓDULOS

Abaixo está a classificação detalhada de cada módulo do sistema após validação estática de ponta a ponta:

| Módulo                                        | Status                                  | Descrição e Avaliação Técnica                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autenticação & Sessão**                     | **Funcional**                           | Login por email/senha via PocketBase AuthStore, persistência em localStorage, proteção de rotas privadas via `ProtectedRoute` no `App.tsx`. Possui recuperação de senha funcional.                                                                                                                                                                                                                  |
| **Onboarding / Cadastro de Empresa**          | **Funcional**                           | Tela de cadastro cria transacionalmente: usuário, organização, associação `organization_users`, configurações iniciais em `business_settings`, e serviço/profissional padrão.                                                                                                                                                                                                                       |
| **Agenda (Dia/Semana/Mês)**                   | **Funcional**                           | Gestão de agendamentos, drag/click para criar consultas, filtros por profissional e status, bloqueio de conflito de horários via hook backend, modal de disparo manual de WhatsApp.                                                                                                                                                                                                                 |
| **Agendamento Público (`/agendar/:slug`)**    | **Parcialmente Funcional (Risco Alto)** | Fluxo completo de 6 passos (serviço → profissional → data → horários livres → dados de contato → confirmação). O cálculo de horários livres respeita turnos de trabalho. **Porém, falha para usuários deslogados** porque as consultas diretas do frontend ao PocketBase batem nas regras de segurança da migração `0009`. O envio final via POST `/backend/v1/public-booking` funciona no backend. |
| **Confirmação Pública (`/confirmar/:token`)** | **Funcional**                           | Permite que o paciente confirme sua presença com 1 clique a partir de link recebido no WhatsApp/SMS, consumindo o endpoint GET `/backend/v1/appointments/confirm/:token`. Atualiza o status para `CONFIRMADO` no banco.                                                                                                                                                                             |
| **Clientes**                                  | **Funcional**                           | CRUD completo de clientes, busca por nome/telefone, histórico de atendimentos e observações clínicas/estéticas isoladas por `organization_id`.                                                                                                                                                                                                                                                      |
| **Profissionais e Equipe**                    | **Funcional**                           | Cadastro de especialistas, vinculação de serviços habilitados (`professional_services`), suporte avançado a múltiplos turnos de trabalho diários (`work_shifts`) e intervalos de almoço.                                                                                                                                                                                                            |
| **Serviços**                                  | **Funcional**                           | Catálogo de serviços com precificação, duração em minutos, categoria, cor na agenda e profissionais vinculados.                                                                                                                                                                                                                                                                                     |
| **Dashboard**                                 | **Funcional**                           | Consolidação de métricas diárias e mensais (total de atendimentos, faturamento do dia, taxa de faltas e cancelamentos, gráficos semanais). Conexão realtime para atualização instantânea.                                                                                                                                                                                                           |
| **Histórico de Atendimentos**                 | **Funcional**                           | Integrado na gaveta (_sheet_) de detalhes de cada cliente e no modal de detalhes do agendamento.                                                                                                                                                                                                                                                                                                    |
| **Financeiro Simples**                        | **Funcional**                           | Registro de pagamentos atrelados a agendamentos, cálculo de faturamento diário, semanal e mensal, filtro por forma de pagamento (PIX, Cartão, Dinheiro).                                                                                                                                                                                                                                            |
| **Automação de Mensagens / WhatsApp**         | **Parcialmente Funcional**              | Templates customizáveis de D-1 (confirmação), agradecimento e D-0 (lembrete). Disparo manual com geração de link `wa.me` 100% funcional. Disparo automático via Cron depende de credenciais Meta ativas (quando ausentes, grava status `PENDING_NO_CREDENTIALS`).                                                                                                                                   |
| **Assistente IA**                             | **Funcional**                           | Interface de chat consumindo `/backend/v1/ai-chat` com o agente nativo `contek-assistant`, configurado com isolamento de contexto para dados da empresa logada.                                                                                                                                                                                                                                     |
| **Configurações da Empresa**                  | **Funcional**                           | Ajuste de horários de abertura/fechamento, dias de funcionamento, intervalo entre sessões, dados cadastrais e visualização do status multi-tenant.                                                                                                                                                                                                                                                  |
| **Planos & Assinaturas SaaS (Contek)**        | **Não Implementado**                    | Tela exibe apenas cartão estático ("Plano Pro V1 Beta"). Não há tabelas de planos, regras de cobrança, faturas nem integração com meios de pagamento.                                                                                                                                                                                                                                               |
| **Gestão Central / Painel SuperAdmin**        | **Não Implementado**                    | Não existe visão administrativa para a Contek visualizar todas as empresas clientes em uma única interface.                                                                                                                                                                                                                                                                                         |
| **Responsividade Mobile & PWA**               | **Funcional**                           | Layout responsivo com drawer lateral no mobile, tabs compactas e manifesto PWA com prompt de instalação.                                                                                                                                                                                                                                                                                            |

---

## 5. MAPA DO BANCO DE DADOS

O banco de dados é operado através do **PocketBase** (armazenamento relacional em SQLite de alta performance com suporte a WAL mode).

### Coleções Identificadas:

1. **`users` (Coleção de Autenticação):**
   - _Finalidade:_ Armazena credenciais de acesso, e-mail, hash de senha e nome dos operadores.
   - _Campos principais:_ `id`, `email`, `name`, `avatar`, `role` (ADMINISTRADOR, PROFISSIONAL, RECEPCIONISTA).
   - _Relacionamentos:_ Relaciona-se com organizações através de `organization_users`.

2. **`organizations` (Tenants / Empresas):**
   - _Finalidade:_ Representa cada clínica, consultório ou empresa contratante.
   - _Campos principais:_ `id`, `name`, `slug` (único, usado nas URLs públicas), `logo`, `phone`, `whatsapp`, `email`, `address`, `plan_id`, `status` (`active`, `suspended`, `trial`).
   - _Índices:_ Índice único em `slug`.
   - _Políticas de Acesso:_ Listagem e visualização restritas a membros vinculados na tabela `organization_users`.

3. **`organization_users` (Associação Usuário ↔ Empresa):**
   - _Finalidade:_ Chave de controle multi-tenant. Define a qual organização cada usuário pertence e qual é o seu papel.
   - _Campos:_ `id`, `user_id` (relação `users`), `organization_id` (relação `organizations`), `role`.
   - _Índices:_ Índice composto `(user_id, organization_id)`.

4. **`business_settings` (Configurações Operacionais):**
   - _Finalidade:_ Horários de atendimento, tempo de intervalo (_buffer_), mensagens automáticas e credenciais de WhatsApp por empresa.
   - _Campos:_ `organization_id`, `opening_time`, `closing_time`, `working_days` (JSON), `slot_interval_minutes`, `buffer_between_appointments`, `default_booking_message`, `whatsapp_enabled`, `whatsapp_phone_number`, `auto_reminders_enabled`, `template_confirmation_request`, `template_confirmation_thanks`, `template_day_reminder`.

5. **`professionals` (Corpo Clínico / Especialistas):**
   - _Finalidade:_ Profissionais que prestam serviços na organização.
   - _Campos:_ `organization_id`, `user_id` (opcional), `name`, `specialty`, `phone`, `email`, `avatar`, `default_duration`, `work_days` (JSON), `work_hours` (JSON legado), `work_shifts` (JSON de múltiplos turnos), `active`.

6. **`services` (Catálogo de Procedimentos):**
   - _Finalidade:_ Serviços ofertados pela clínica.
   - _Campos:_ `organization_id`, `name`, `description`, `duration`, `price`, `color`, `category`, `active`.

7. **`professional_services` (Junction Profissional ↔ Serviço):**
   - _Finalidade:_ Mapeia quais profissionais executam quais serviços.
   - _Campos:_ `organization_id`, `professional_id`, `service_id`.
   - _Índice:_ `(organization_id, professional_id, service_id)`.

8. **`clients` (Base de Pacientes / Clientes):**
   - _Finalidade:_ Cadastro de clientes da empresa.
   - _Campos:_ `organization_id`, `name`, `phone`, `whatsapp`, `email`, `birth_date`, `notes`.
   - _Índice:_ `(organization_id, phone)`.

9. **`appointments` (Agendamentos / Atendimentos):**
   - _Finalidade:_ Registro central da agenda.
   - _Campos:_ `organization_id`, `client_id`, `professional_id`, `service_id`, `date`, `start_time`, `end_time`, `status` (`AGENDADO`, `CONFIRMADO`, `EM ATENDIMENTO`, `CONCLUÍDO`, `CANCELADO`, `FALTOU`), `price`, `confirmation_token`, `notifications_sent` (JSON), `client_name_snapshot`, `client_phone_snapshot`, `notes`.
   - _Índices:_ `(organization_id, date)`, `(professional_id, date, start_time)`, `(confirmation_token)`.

10. **`payments` (Lançamentos Financeiros Operacionais):**
    - _Finalidade:_ Controle financeiro dos atendimentos prestados aos clientes da clínica.
    - _Campos:_ `organization_id`, `appointment_id`, `client_id`, `amount`, `is_paid`, `payment_method` (`PIX`, `Dinheiro`, `Cartão`, `Outro`), `payment_date`, `description`, `notes`.

11. **`notification_logs` (Histórico de Disparos WhatsApp):**
    - _Finalidade:_ Auditoria de mensagens enviadas ou com falha.
    - _Campos:_ `organization_id`, `appointment_id`, `type`, `channel`, `status` (`SENT`, `FAILED`, `PENDING_NO_CREDENTIALS`), `recipient_name`, `recipient_phone`, `message_text`.

### Avaliação de Integridade e Backups:

- **Tabelas duplicadas ou sem uso:** Nenhuma tabela órfã.
- **Risco de Perda ou Mistura de Dados:** Todas as consultas no frontend passam `organization_id = "${orgId}"`. No entanto, como detalhado abaixo, regras de API no backend são o verdadeiro guardião contra mistura de dados.
- **Backup:** O PocketBase realiza gravação em SQLite único (`pb_data/data.db`). Na infraestrutura do Skip Cloud, o snapshot do volume de dados e arquivos de mídia é persistido no ambiente de nuvem gerenciado.

---

## 6. SITUAÇÃO DA AUTENTICAÇÃO E PERMISSÕES

### Fluxo de Autenticação:

- **Login:** Autenticação padrão via PocketBase SDK (`pb.collection('users').authWithPassword(email, password)`).
- **Sessão:** Token JWT armazenado no `pb.authStore` sincronizado com `localStorage`. Ao recarregar a página, o `AuthContext` valida se o token ainda é válido chamando `pb.collection('users').authRefresh()`.
- **Recuperação de Senha:** Implementada via `pb.collection('users').requestPasswordReset(email)` nativo do PocketBase.

### Papéis e Perfis:

- Existem 3 papéis declarados no tipo `UserRole`: `ADMINISTRADOR`, `PROFISSIONAL`, `RECEPCIONISTA`.
- Na tabela `users` existe uma coluna `role`, e na tabela `organization_users` também existe uma coluna `role`.
- **Vulnerabilidade de Controle de Acesso por Papel (RBAC):**
  - No frontend, o `AuthContext` expõe `isAdmin`, mas quase todas as páginas (`Agenda`, `Clientes`, `Serviços`, `Financeiro`) estão acessíveis a qualquer usuário autenticado.
  - No backend, as regras das coleções (`services`, `clients`, `payments`, `appointments`) permitem exclusão e edição para **qualquer usuário associado à organização**, mesmo que seu perfil seja `RECEPCIONISTA` ou `PROFISSIONAL`. Apenas a coleção `organizations` exige `role ?= 'ADMINISTRADOR'` para atualização e exclusão.

---

## 7. SITUAÇÃO DA SEPARAÇÃO POR EMPRESA (MULTITENANCY)

### Avaliação de Isolamento:

1. **No Banco de Dados:** Todas as tabelas operacionais possuem a coluna `organization_id`.
2. **Nas Políticas de API (Backend PocketBase):**
   - As coleções `appointments`, `clients`, `payments`, `services`, `professionals`, `business_settings`, `organizations` e `notification_logs` foram protegidas na migração `0009` com a expressão:
     ```sql
     @request.auth.id != '' && @collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id
     ```
   - **Eficácia:** Se um usuário da Empresa A tentar alterar uma requisição na URL inserindo o `id` de um agendamento da Empresa B, a consulta retornará erro 404/403 diretamente do PocketBase. O isolamento entre empresas no acesso autenticado é **robusto**.
3. **Ponto Crítico Identificado — Coleção `professional_services`:**
   - A coleção `professional_services` possui regras `@request.auth.id != ''` para escrita, **sem checar a organização**. Um usuário mal-intencionado autenticado em qualquer empresa poderia vincular um profissional a serviços de outra empresa.
4. **Ponto Crítico Identificado — Página Pública de Agendamento:**
   - A página `AgendamentoPublico.tsx` foi construída fazendo consultas diretas via SDK para ler serviços e profissionais da empresa. Como as regras exigem `@request.auth.id != ''`, um visitante da internet (cliente sem login) não consegue listar os serviços da empresa pela API padrão. O agendamento só é salvo porque a rota final de confirmação passa por um hook `/backend/v1/public-booking` que roda como superusuário no backend.

---

## 8. PROBLEMAS DE SEGURANÇA

Abaixo estão listados todos os riscos de segurança identificados, classificados por severidade:

| ID         | Classificação | Onde foi encontrado                                                      | Descrição e Evidência Técnica                                                                                                                                                                                | Impacto                                                                                                                     | Correção Recomendada                                                                                                                                                                                                              | Risco da Correção |
| ---------- | ------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **SEC-01** | **CRÍTICO**   | `src/pages/AgendamentoPublico.tsx` x Migração `0009`                     | A página pública tenta consultar coleções protegidas sem autenticação (`pb.collection('services').getFullList(...)`). O visitante comum não consegue ver os serviços da clínica para agendar.                | Bloqueio do agendamento online para clientes públicos na web.                                                               | Criar endpoint público dedicado no backend (`GET /backend/v1/public-booking-data?slug=:slug`) retornando dados sanitizados (empresa, serviços ativos, profissionais e horários livres calculados) sem expor as coleções internas. | Baixo             |
| **SEC-02** | **ALTO**      | `src/pages/Login.tsx` (linhas 38-42 e 228-251)                           | Botão visível de "Acesso Rápido de Demonstração (DEMO)" com credenciais fixadas em código (`demo@contek.com.br` / `contek123456`) que realizam login em dados reais de demonstração no banco de produção.    | Qualquer visitante pode entrar no sistema, visualizar e alterar a base da clínica demo.                                     | Remover o botão e as credenciais padrão da tela de login em produção, ou restringi-lo estritamente a um ambiente isolado de testes.                                                                                               | Baixo             |
| **SEC-03** | **ALTO**      | `pocketbase/migrations/0001_initial_schema.js` (`professional_services`) | A coleção `professional_services` não possui regra de isolamento por `organization_id` para create/update/delete.                                                                                            | Um usuário de um tenant pode manipular registros da tabela de junção de outros tenants.                                     | Aplicar regra `@collection.organization_users.user_id ?= @request.auth.id && @collection.organization_users.organization_id ?= organization_id` na coleção `professional_services`.                                               | Baixo             |
| **SEC-04** | **MÉDIO**     | `pocketbase/migrations/0009_audit_data_and_rules_fix.js`                 | Ausência de granularidade de papéis (RBAC) para exclusão de registros financeiros e cadastrais. Usuários com perfil `RECEPCIONISTA` ou `PROFISSIONAL` podem excluir pagamentos e clientes do próprio tenant. | Possibilidade de operador interno apagar registros financeiros ou de pacientes sem autorização do administrador da clínica. | Adicionar verificação de perfil nas regras de exclusão: `&& @collection.organization_users.role ?= 'ADMINISTRADOR'` para tabelas críticas (`payments`, `services`).                                                               | Baixo             |
| **SEC-05** | **BAIXO**     | `pocketbase/hooks/onboarding.js`                                         | O endpoint `/backend/v1/onboarding` não possui limitação de taxa (_rate limiting_) ou CAPTCHA contra criação massiva de tenants falsos por bots.                                                             | Possível esgotamento de recursos por criação automatizada de organizações no banco SQLite.                                  | Implementar rate limit por IP e verificação de CAPTCHA / validação de email no cadastro.                                                                                                                                          | Baixo             |

---

## 9. PROBLEMAS FUNCIONAIS

1. **Agendamento Público com Dependência de Leitura Protegida (Falha de Fluxo):**
   - _Evidência:_ No arquivo `AgendamentoPublico.tsx`, linhas 94 a 118, o código executa `pb.collection('organizations').getFirstListItem('slug = "${slug}"')` e `pb.collection('services').getFullList()`. Como o visitante não está logado, a requisição é rejeitada com status 400/403 pelo PocketBase.
   - _Impacto:_ Pacientes externos não conseguem carregar a tela de agendamento em navegadores anônimos.
2. **Sincronização de Pagamentos Duplicados no Hook de Appointments:**
   - _Evidência:_ No arquivo `Agenda.tsx` (linhas 415-424) o frontend cria um registro na coleção `payments` ao salvar um agendamento. Simultaneamente, o arquivo `pocketbase/hooks/appointment_payment_sync.js` possui um gatilho `onModelAfterCreate` que também cria um lançamento financeiro na coleção `payments`.
   - _Impacto:_ Risco de lançamentos financeiros duplicados para um único atendimento se o frontend e o hook atuarem ao mesmo tempo.
3. **Monolitismo do Componente `Agenda.tsx`:**
   - Com mais de 2.060 linhas, o componente centraliza lógica de calendário dia/semana/mês, modal de agendamento, modal de WhatsApp manual, drawer de detalhes, cálculo de horários e filtros. Qualquer manutenção futura corre alto risco de efeito colateral.

---

## 10. SITUAÇÃO DA HOSPEDAGEM E PUBLICAÇÃO

- **Frontend:** SPA estática compilada via Vite, hospedada no container web do Skip Cloud.
- **Backend & Banco de Dados:** Instância PocketBase rodando no mesmo host de nuvem Skip Cloud (`https://*.app.usecurling.com`), com banco SQLite local montado no volume persistente `pb_data/`.
- **Domínio Atual:** Subdomínio dinâmico gerado pelo Skip Cloud.
- **Ambientes de Desenvolvimento vs. Produção:** Atualmente existe **apenas uma única instância ativa**. Todas as ações de teste, migrações e dados de demonstração compartilham o mesmo banco de dados onde clientes reais podem operar.
- **Risco de Novas Publicações:** Como o banco utiliza migrações declarativas ordenadas (`0001_...` até `0009_...`), qualquer migração com erro de sintaxe pode travar o ciclo de deploy do backend.

---

## 11. PREPARAÇÃO PARA AGYLI E MARKALY

Esta é a análise estratégica central para a usuária e tomadores de decisão do projeto:

### O que o sistema já tem preparado:

- Modelo de dados multi-tenant pronto (`organizations` + `organization_users`).
- Roteamento dinâmico no frontend com base em estado central (`AuthContext`).
- Módulos bem desenhados visual e funcionalmente.

### O que falta para suportar AGYLI e MARKALY sem duplicar o código:

1. **Identificação de Produto por Hostname / Domínio:**
   - O sistema precisa identificar se o usuário acessou por `app.agyli.com.br` ou `app.markaly.com.br`.
   - Recomenda-se um arquivo de configuração central `src/config/products.ts` que determine:
     - Nome do produto, logotipo, cores primárias (tema Tailwind dinâmico).
     - Lista de módulos autorizados para aquele produto.
2. **Controle de Funcionalidades (Feature Flags) no Backend:**
   - Apenas esconder menus no frontend não é seguro. Um usuário da versão MARKALY poderia tentar chamar a rota `/backend/v1/ai-chat` ou acessar a API de `/payments`.
   - O backend precisa validar se a organização contratou o produto AGYLI ou MARKALY antes de autorizar requisições do módulo de IA ou relatórios avançados.
3. **Campo `product_type` na tabela `organizations`:**
   - Deve ser adicionado um campo `product` (`'AGYLI' | 'MARKALY'`) na organização para vincular permanentemente o estabelecimento ao produto contratado.
4. **Painel Central Contek (SuperAdmin):**
   - Criação de uma área administrativa exclusiva para a equipe Contek gerenciar empresas clientes, alterar planos, emitir cobranças e auditar o sistema.

---

## 12. RISCOS DE MIGRAÇÃO

Ao transformar o sistema atual nos dois produtos, os principais riscos são:

1. **Risco de Regressão em Migrações do Banco:** O PocketBase executa migrações sequenciais. A criação de novas coleções de planos ou produtos deve ser feita com migrações idempotentes para não quebrar os registros existentes da empresa `tp9rn2ezqwk7xy5` e `qksryd4nrmgfr6q`.
2. **Mistura de Identidade Visual em Cache do Navegador:** Clientes acessando os dois produtos poderiam reter estilos cacheados ou tokens em `localStorage` sob o mesmo domínio. Cada produto deve rodar em domínio/subdomínio próprio com chaves de armazenamento distintas (ex: `agyli_token` vs `markaly_token`).
3. **Dependência Crítica de SQLite Único:** Para dezenas de milhares de clínicas simultâneas, uma base SQLite única em um único container demandará monitoramento de concorrência de escrita. Para a fase atual (dezenas a centenas de clínicas), a performance é excelente devido ao WAL mode.

---

## 13. MELHORIAS RECOMENDADAS

### Arquitetura & Backend:

1. **Endpoint de Agendamento Público:** Criar o endpoint server-side `GET /backend/v1/public-booking-data?slug=:slug` retornando dados filtrados para a página `/agendar/:slug` sem expor regras internas de banco.
2. **Unificação do Trigger Financeiro:** Remover a criação de pagamentos no frontend `Agenda.tsx` e deixar 100% da criação e cancelamento de pagamentos sob responsabilidade do hook `appointment_payment_sync.js`.
3. **Adição da Regra em `professional_services`:** Incluir validação de `organization_id` na tabela associativa.

### Frontend:

1. **Modularização de `Agenda.tsx`:** Extrair o calendário, modal de agendamento e modal de WhatsApp em arquivos independentes (`src/pages/agenda/components/...`).
2. **Remoção do Acesso Demo da Tela de Login de Produção:** Ocultar botão de credenciais automáticas.
3. **Arquitetura de Temas e Marcas:** Criar contexto `ProductThemeContext` que injete as variáveis visuais de AGYLI ou MARKALY conforme o domínio acessado.

---

## 14. PRIORIDADES: CRÍTICA, ALTA, MÉDIA E BAIXA

### Prioridade Crítica (Imediata):

- Corrigir a leitura da página de Agendamento Público (`/agendar/:slug`) via endpoint backend público para garantir que visitantes sem login consigam agendar normalmente.
- Bloquear a coleção `professional_services` para isolamento estrito por `organization_id`.

### Prioridade Alta:

- Remover as credenciais fixadas do botão DEMO na tela de login de produção.
- Corrigir a duplicidade potencial de inserção de pagamentos entre frontend e hook de agendamentos.
- Modelar o campo `product` (`'AGYLI' | 'MARKALY'`) na tabela `organizations`.

### Prioridade Média:

- Implementar RBAC granular no backend (impedir exclusão de financeiro e clientes por operadores não-administradores).
- Decompor o arquivo `Agenda.tsx` em subcomponentes para facilitar a manutenção.
- Criar a matriz de _Feature Flags_ por produto (AGYLI vs MARKALY).

### Prioridade Baixa:

- Rate-limiting no endpoint de onboarding.
- Expansão de relatórios analíticos em PDF ou exportação para Excel.

---

## 15. PROPOSTA DE ETAPAS FUTURAS

Após a aprovação deste relatório pela usuária, recomendamos o seguinte roteiro de execução em fases:

- **Fase 1 — Estabilização e Segurança da Base Atual:**
  - Criação do endpoint público de agendamento e fechamento de brechas em `professional_services`.
  - Remoção de atalhos demo na tela de login.
  - Testes do fluxo de ponta a ponta sem autenticação.
- **Fase 2 — Preparação do Núcleo Multi-Produto (AGYLI & MARKALY):**
  - Definição do schema de produtos (`product_type`, domínios, temas).
  - Implementação do seletor de módulos e _feature flags_ no frontend e backend.
- **Fase 3 — Estrutura de Planos, Assinaturas e Painel SuperAdmin:**
  - Criação das coleções `plans`, `subscriptions` e controle de datas de vigência/teste.
  - Interface administrativa para a equipe Contek gerenciar as licenças de AGYLI e MARKALY.
- **Fase 4 — Homologação e Lançamento:**
  - Configuração de DNS dos domínios oficiais de cada marca e testes de isolamento de marca.

---

## 16. INFORMAÇÕES OU ACESSOS AINDA NECESSÁRIOS

Para as próximas fases (quando autorizadas pela usuária), serão necessários:

1. **Definição Comercial da MARKALY:** Lista exata de quais módulos estarão liberados e quais estarão bloqueados na versão reduzida.
2. **Identidade Visual e Domínios:** Nomes de domínio definitivos (ex: `agyli.com.br` e `markaly.com.br`), logotipos e paletas de cores aprovadas de cada produto.
3. **Definição de Meio de Pagamento para Assinaturas SaaS:** Escolha do gateway que processará as mensalidades das clínicas (ex: Asaas, Stripe, Mercado Pago ou Pagar.me) e respectivas chaves de API para desenvolvimento.

---

## RESPOSTAS DIRETAS ÀS 5 PERGUNTAS OBRIGATÓRIAS

### 1. O sistema está pronto para ser usado como sistema-mãe?

**NÃO IMEDIATAMENTE, MAS ESTÁ MUITO PRÓXIMO.**  
A base arquitetural, a qualidade visual e a lógica operacional de agendamento são excelentes. No entanto, o sistema ainda opera como um produto único monomarca ("Contek Agenda IA"). Antes de lançar AGYLI e MARKALY, é indispensável adicionar o suporte a identificação por domínio, controle de tema dinâmico e bloqueio de funcionalidades no backend.

### 2. O banco está seguro e preparado para várias empresas?

**SIM PARA A MAIORIA DAS CONSULTAS, COM 2 AJUSTES OBRIGATÓRIOS.**  
As regras da migração `0009` garantem que nenhum usuário logado consiga ver ou alterar dados de outra empresa nas coleções principais. É necessário apenas aplicar a mesma regra à coleção `professional_services` e implementar proteção por papel administrativo (RBAC) para exclusões críticas.

### 3. O que precisa ser corrigido antes de criar AGYLI e MARKALY?

1. Corrigir o carregamento da página pública de agendamento (`/agendar/:slug`) criando um endpoint público no backend.
2. Fechar a brecha de permissão na tabela `professional_services`.
3. Retirar o atalho com senha exposta de demonstração da tela de login.
4. Adicionar o discriminador de produto (`product`) na entidade `organizations`.

### 4. É seguro continuar usando a estrutura atual?

**SIM, COM SEGURANÇA TOTAL PARA OPERAÇÃO INTERNA.**  
A estrutura atual do PocketBase no Skip Cloud é estável, rápida e mantém a integridade dos dados cadastrados das duas empresas já existentes no banco (`Contek Estética & Saúde` e `Lulu`). Não há perda de dados ou risco iminente de corrupção.

### 5. Qual deve ser a primeira implementação depois da auditoria?

A primeira implementação deve ser a **correção não disruptiva do endpoint de Agendamento Público** e a **aplicação da regra de isolamento na tabela `professional_services`**, garantindo que o sistema funcione perfeitamente para clientes anônimos da web antes da divisão em AGYLI e MARKALY.

---

_Relatório concluído e arquivado com sucesso no repositório em `docs/AUDITORIA_TECNICA_CONTEK_AGENDA_IA.md`._
