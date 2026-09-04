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

## 7. Etapa 6: Homologação Mobile e PWA (Progressive Web App)

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
