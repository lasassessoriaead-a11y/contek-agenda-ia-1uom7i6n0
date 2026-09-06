# Checklist de Homologação Oficial — AGYLI (Produção & PWA)

Este documento estabelece o roteiro padronizado de validação e homologação do fluxo comercial da solução **AGYLI**, cobrindo desde a primeira impressão do visitante/cliente até o uso contínuo da aplicação e instalação como Progressive Web App (PWA).

---

## 1. Mapeamento de Domínios e Identidade Visual (Branding)

| Domínio de Teste                    | Tema / Produto Esperado | Identidade Visual                                         |
| :---------------------------------- | :---------------------- | :-------------------------------------------------------- |
| `app.agyli.com.br`                  | **AGYLI** (Padrão)      | Azul (#3B82F6) / Violeta (#8B5CF6) / Dark Slate (#0F172A) |
| `agyli.com.br`                      | **AGYLI** (Padrão)      | Azul (#3B82F6) / Violeta (#8B5CF6) / Dark Slate (#0F172A) |
| `www.agyli.com.br`                  | **AGYLI** (Padrão)      | Azul (#3B82F6) / Violeta (#8B5CF6) / Dark Slate (#0F172A) |
| `contek-agenda-ia-479d4.goskip.app` | **AGYLI** (Padrão)      | Fallback nativo AGYLI, com seletor de tenant              |
| `*.goskip.app` (Previews)           | **AGYLI** (Padrão)      | Fallback nativo AGYLI com toggle de marca no login        |

---

## 2. Etapa 1: Acesso Inicial e Cadastro Comercial Self-Service

### Roteiro Desktop e Mobile:

1. **Acessar `/login`** no navegador (desktop ou dispositivo móvel).
2. **Verificar a marcação visual**:
   - [ ] Logotipo oficial AGYLI em alta definição exibido com slogan _"Agendar ficou simples."_
   - [ ] Badge _"Plataforma Inteligente de Gestão"_ e cores em azul e violeta.
   - [ ] Aba "Criar Empresa" acessível.
3. **Preencher formulário de criação de nova empresa (Self-Service)**:
   - [ ] Nome da Empresa: _Ex: Clínica Exemplo AGYLI_
   - [ ] Solução selecionada: **AGYLI (Completo)**
   - [ ] Nome do Administrador: _Ex: Dr. Lucas Silveira_
   - [ ] WhatsApp: _(11) 99999-0000_
   - [ ] E-mail de acesso e senha (mínimo 8 caracteres).
4. **Submeter criação**:
   - [ ] O sistema processa via transação atômica (`/backend/v1/onboarding/self-service`).
   - [ ] Criação automática da Organização com status `trial` (7 dias).
   - [ ] Criação da assinatura no plano `agyli-pro`.
   - [ ] Criação do usuário Administrador e vínculo com a organização.
   - [ ] Criação dos horários e configurações padrão (`business_settings`).
   - [ ] Criação do profissional principal e serviço padrão de consulta.
   - [ ] Login automático e redirecionamento para o Dashboard principal (`/`).

---

## 3. Etapa 2: Acesso Administrativo e Gerenciamento de Sessão

### Roteiro de Login / Logout:

1. **Logout**:
   - [ ] Clicar no botão de logout no menu lateral ou rodapé mobile.
   - [ ] Confirmar que a sessão é limpa e a tela é redirecionada para `/login`.
2. **Login com credenciais cadastradas**:
   - [ ] Informar o e-mail e senha recém-criados.
   - [ ] Acesso concedido com toast de boas-vindas: _"Bem-vindo ao AGYLI Agenda IA!"_.
   - [ ] Sessão restabelecida mantendo a organização ativa e seus dados isolados.
3. **Tentativa de login com senha incorreta**:
   - [ ] Mensagem de alerta exibida: _"E-mail ou senha incorretos. Verifique suas credenciais."_.
   - [ ] Nenhum dado sensível exposto no console.

---

## 4. Etapa 3: Onboarding Operacional da Empresa

### Criação Manual de Empresa pelo SuperAdmin e Disparo Automático de Credenciais:

1. **Acesso SuperAdmin (`/admin`)**:
   - [ ] Autenticação com credenciais de Super Administrador (Luciana / Contek).
   - [ ] Clicar no botão **"Nova Empresa"**.
2. **Preenchimento e Envio**:
   - [ ] Preencher Nome da Empresa (ex.: _Camila Estética_), E-mail do Administrador (_camila@exemplo.com_), Senha Inicial Provisória, Seleção de Produto (**MARKALY** ou **AGYLI**) e Plano.
   - [ ] Submeter criação via endpoint `/backend/v1/superadmin/org/create`.
3. **Disparo Automático de E-mail de Boas-Vindas**:
   - [ ] Disparo server-side imediato via `$app.newMailClient().send(...)`.
   - [ ] E-mail formatado na paleta oficial do **Grupo CONTEK** (#0D1B2A, #1E3A8A, #06B6D4, #22C55E; Poppins; chancela oficial).
   - [ ] Conteúdo do e-mail: Saudação personalizada, Produto e Plano, Link de Login, E-mail de acesso, Senha Provisória, Link Público `/agendar/:slug` e instrução de troca de senha no primeiro acesso.
4. **Feedback e Resiliência na Interface**:
   - [ ] Modal de credenciais geradas exibe status de confirmação do envio do e-mail.
   - [ ] Caso o envio falhe, a empresa é criada normalmente, o erro é relatado de forma transparente e um botão de **"Reenviar E-mail"** fica disponível.
   - [ ] Tabela de organizações do SuperAdmin possui ação dedicada de **"Reenviar e-mail de acesso"** (ícone de e-mail) para qualquer tenant cadastrado.

---

### Verificações Obrigatórias no Painel (`/configuracoes` e Módulos):

1. **Dados da Empresa (`/configuracoes`)**:
   - [ ] Nome do estabelecimento e slug gerado automaticamente.
   - [ ] Link público de agendamento disponível (`/agendar/:slug`).
   - [ ] Horários de atendimento (abertura, fechamento, intervalos e dias de funcionamento).
2. **Serviços (`/servicos`)**:
   - [ ] Serviço inicial cadastrado exibido na listagem.
   - [ ] Possibilidade de editar preço, duração, cor e categoria.
   - [ ] Possibilidade de cadastrar novo serviço.
3. **Profissionais (`/profissionais`)**:
   - [ ] Profissional administrador cadastrado com seus turnos semanais.
   - [ ] Aba de **Folgas / Exceções de Data** funcional:
     - [ ] Cadastrar folga em data específica.
     - [ ] Validar que o dia fica indisponível para novos agendamentos na grade.
4. **Clientes (`/clientes`)**:
   - [ ] Cadastro manual de novo cliente com nome, WhatsApp e e-mail.
   - [ ] Histórico de agendamentos e prontuário vinculados ao cliente.

---

## 5. Etapa 4: Experiência Completa de Agendamento do Paciente

### Fluxo na Página Pública (`/agendar/:slug`):

1. **Acessar `/agendar/:slug`**:
   - [ ] Identidade visual oficial AGYLI carregada.
   - [ ] Seleção de serviço com duração e valor.
   - [ ] Seleção de profissional disponível.
   - [ ] Calendário exibe apenas os dias em que o profissional atende e não está de folga.
   - [ ] Horários disponíveis respeitam intervalo e slots configurados.
2. **Conclusão do Agendamento**:
   - [ ] Inserir dados do paciente (nome e WhatsApp).
   - [ ] Confirmação na tela e geração de token único de agendamento.
   - [ ] Redirecionamento para a página de confirmação (`/confirmar/:token`).
3. **Reflexo na Agenda Administrativa (`/agenda`)**:
   - [ ] O agendamento aparece em tempo real no calendário interno da clínica.
   - [ ] O status inicial consta como `AGENDADO`.

---

## 6. Etapa 5: Módulos Exclusivos AGYLI (Verificação de Integridade)

### 1. Gestão Financeira (`/financeiro`):

- [ ] Módulo liberado (não exibe tela de bloqueio).
- [ ] Lançamento de receitas e despesas.
- [ ] Vínculo automático de pagamentos de agendamentos concluídos.
- [ ] Cards de fluxo de caixa (total receitas, despesas e saldo líquido).

### 2. Assistente IA & Chat Interno (`/assistente-ia`):

- [ ] Módulo liberado para AGYLI.
- [ ] Histórico de chat persistido e isolado por organização.
- [ ] Guarda anti-alucinação ativa: respostas restritas a horários reais, serviços cadastrados e dados da clínica.
- [ ] Campo de entrada de mensagem (input) com foco, envio imediato e scroll automático para as respostas mais recentes.

### 3. Painel SuperAdmin (`/admin`):

- [ ] Acessível somente por usuários com flag `is_super_admin: true` ou `role: "SUPERADMIN"`.
- [ ] Rota protegida por `SuperAdminRoute` (usuários normais são redirecionados).
- [ ] Visão geral de tenants, planos cadastrados e ferramentas de suporte.

---

## 7. Testes Automatizados (Suíte de Homologação Comercial)

A validação contínua da jornada comercial é garantida por testes automatizados em **Vitest**, que executam sem alterar nem consultar o banco de dados de produção (utilizando mocks de SDK e isolamento estrito).

### Como Rodar os Testes:

```bash
npm test
```

Ou no modo contínuo de observação:

```bash
npm run test:watch
```

### O que a Suíte Cobre (`src/tests/agyliCommercialHomologation.test.ts`):

1. **Cadastro Self-Service AGYLI**:
   - Criação da empresa com status `trial` (7 dias exatos).
   - Atribuição automática do plano `agyli-pro`.
   - Vínculo do usuário como `ADMINISTRADOR` / owner.
   - Criação do profissional inicial com o nome informado no cadastro, dias úteis de seg-sáb 08:00–19:00 e duração padrão de 45 minutos.
   - Criação do serviço padrão _"Atendimento Inicial / Consulta"_ (R$ 150, 45 min) e seu vínculo na tabela `professional_services`.
   - Rejeição de senhas com menos de 8 caracteres.

2. **Login, Logout e Isolamento de Sessão**:
   - Estados iniciais de e-mail e senha estritamente vazios (`""`) no formulário (`Login.tsx`).
   - Carregamento imediato do contexto da organização pertencente ao usuário autenticado.
   - Limpeza completa do `localStorage` (`contek_active_org_id`, `pb_auth`) no logout para impedir vazamento entre diferentes empresas ou sessões no mesmo navegador.

3. **Isolamento Multi-tenant**:
   - Duas empresas criadas pelo mesmo fluxo não compartilham profissionais, serviços nem agendamentos.
   - Usuários comuns recém-logados nunca herdam `contek_active_org_id` deixado no navegador por outra conta.

4. **Recuperação e Redefinição de Senha**:
   - Formulário de recuperação solicita e-mail via `requestPasswordReset` com mensagens claras e amigáveis.
   - Tela `RedefinirSenha.tsx` valida presença obrigatória do token na URL, tamanho mínimo de senha (8 caracteres) e confirmação idêntica.

5. **Bloqueios MARKALY vs Liberação AGYLI**:
   - Tenant com produto `markaly` tem `financeiro`, `assistente_ia`, `whatsapp_ai`, `relatorios` e `configuracoes_avancadas` estritamente bloqueados (inclusive para SuperAdmin inspecionando a empresa).
   - Tenant `agyli` tem todos os módulos liberados.
   - Fallback de integridade: quando a lista de features do servidor vem vazia, o sistema assume os padrões do produto em vez de ocultar todo o menu (correção v0.0.39 protegida por teste).

6. **Agendamento Público (`/agendar/:slug`)**:
   - Cálculo dinâmico de slots disponíveis respeitando abertura, fechamento e intervalo de almoço do profissional.
   - Slots já ocupados por agendamentos existentes no mesmo dia **nunca** são oferecidos.
   - Fluxo completo em 6 passos sem necessidade de login prévio do cliente/paciente.
   - Detecção correta de folgas e dias de atendimento do profissional.

7. **Branding Oficial AGYLI**:
   - Resolução correta dos domínios oficiais (`agyli.com.br`, `app.agyli.com.br`, `*.goskip.app`) para o tema AGYLI com cores e slogan oficiais (#3B82F6 / #8B5CF6 / _"Agendar ficou simples."_).

---

## 8. Etapa 6: Homologação Mobile e PWA (Progressive Web App)

### Verificações em Smartphone (Android / iOS):

1. **Design Responsivo**:
   - [ ] Menu inferior móvel fixo e navegação touch fluida.
   - [ ] Título e barra de status (meta `theme-color: #0F172A`) em tom escuro oficial AGYLI.
   - [ ] Modais de criação e visualização adaptados para telas pequenas sem quebra horizontal.
2. **Instalação PWA**:
   - [ ] No Chrome/Edge (Android/Desktop): banner ou botão de instalação do PWA oferecido.
   - [ ] No Safari (iOS): instrução "Adicionar à Tela de Início" clara.
   - [ ] Ao abrir o aplicativo instalado pela tela inicial:
     - Inicia em modo standalone (sem barra de URL do navegador).
     - Ícone oficial AGYLI renderizado no launcher.
     - Sessão do usuário preservada entre aberturas do app.
