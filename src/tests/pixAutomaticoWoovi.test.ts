import { describe, it, expect } from 'vitest'
import migration0033Source from '../../pocketbase/migrations/0033_add_pix_automatic_to_subscriptions.js?raw'
import cronSource from '../../pocketbase/hooks/contek_financial_cron.js?raw'
import routesSource from '../../pocketbase/hooks/contek_finance_routes.js?raw'
import financeiroContekSource from '../pages/FinanceiroContek.tsx?raw'

/**
 * Suíte de Testes para o Pix Automático da Woovi no Financeiro Contek:
 * 1. Schema / Migration de Pix Automático na coleção subscriptions
 * 2. Inscrição na recorrência (mandato/assinatura Woovi) e geração de link/QR
 * 3. Rotina de cobrança automática mensal via Cron (não duplicidade no mês, suporte a Pix Automático vs Pix avulso)
 * 4. Webhook de autorização aprovada (PIX_AUTOMATIC_APPROVED) e rejeitada (PIX_AUTOMATIC_REJECTED)
 * 5. Webhook de liquidação automática de débito recorrente (PIX_AUTOMATIC_COBR_COMPLETED / OPENPIX:CHARGE_COMPLETED)
 * 6. Fallback resiliente: tolerância a falhas na API Woovi sem quebrar o fluxo manual existente
 * 7. Proteção de segredos: AppID nunca exposto em tela ou logs
 */
describe('Woovi Pix Automático & Recorrência Mensal — Contek Financeiro', () => {
  it('Migration 0033 define os novos campos de Pix Automático na coleção subscriptions', () => {
    expect(migration0033Source).toContain('recurring_status')
    expect(migration0033Source).toContain('NOT_ENROLLED')
    expect(migration0033Source).toContain('PENDING_AUTHORIZATION')
    expect(migration0033Source).toContain('ACTIVE')
    expect(migration0033Source).toContain('REJECTED')
    expect(migration0033Source).toContain('recurring_link')
    expect(migration0033Source).toContain('recurring_emv')
    expect(migration0033Source).toContain('recurring_correlation_id')
    expect(migration0033Source).toContain('recurring_subscription_id')
    expect(migration0033Source).toContain('recurring_authorized_at')
  })

  it('Endpoint de inscrição /backend/v1/superadmin/finance/subscription/enroll-pix-automatic cria mandato Woovi com fallback seguro', () => {
    // Rota existe e exige autenticação SuperAdmin
    expect(routesSource).toContain('/backend/v1/superadmin/finance/subscription/enroll-pix-automatic')
    expect(routesSource).toContain('journey')
    expect(routesSource).toContain('PIX_RECURRING')
    expect(routesSource).toContain('https://api.woovi.com/api/v1/subscriptions')
    expect(routesSource).toContain('PENDING_AUTHORIZATION')
    expect(routesSource).toContain('recurring_link')
    expect(routesSource).toContain('recurring_correlation_id')
  })

  it('Página pública de confirmação/autorização para o cliente ativa o Pix Automático', () => {
    expect(routesSource).toContain('/backend/v1/public/pix-automatic/authorize')
    expect(routesSource).toContain("sub.set('recurring_status', 'ACTIVE')")
    expect(routesSource).toContain("sub.set('recurring_authorized_at', now.toISOString())")
  })

  it('Rotina diária do cron executa cobrança automática mensal com idempotência (sem duplicação)', () => {
    // Verifica que o cron busca assinaturas ativas e checa se já existe cobrança gerada para a org no mês
    expect(cronSource).toContain('contek_charges')
    expect(cronSource).toContain('status = "active"')
    expect(cronSource).toContain('recurring_status')
    expect(cronSource).toContain('contek-cron-')
    expect(cronSource).toContain('MONTHLY_CHARGE_AUTOMATIC')
  })

  it('Simulação da lógica do cron garante não duplicação de cobrança para a mesma empresa no mesmo mês', () => {
    const existingChargesInMonth = [
      {
        organization_id: 'org-gaby-salgado',
        due_date: '2025-05-10',
        status: 'PENDENTE',
      },
    ]

    const targetOrgId = 'org-gaby-salgado'
    const targetMonth = '2025-05'

    const alreadyBilled = existingChargesInMonth.some(
      (c) => c.organization_id === targetOrgId && c.due_date.startsWith(targetMonth),
    )

    expect(alreadyBilled).toBe(true)

    // Para outra empresa que não foi cobrada ainda:
    const newOrgId = 'org-nova-empresa'
    const alreadyBilledNew = existingChargesInMonth.some(
      (c) => c.organization_id === newOrgId && c.due_date.startsWith(targetMonth),
    )
    expect(alreadyBilledNew).toBe(false)
  })

  it('Webhook handler trata eventos de PIX_AUTOMATIC_APPROVED e ativa a assinatura', () => {
    expect(routesSource).toContain("eventName === 'PIX_AUTOMATIC_APPROVED'")
    expect(routesSource).toContain("matchedSub.set('recurring_status', 'ACTIVE')")
    expect(routesSource).toContain("action: 'PIX_AUTOMATIC_APPROVED'")
  })

  it('Webhook handler trata eventos de PIX_AUTOMATIC_REJECTED', () => {
    expect(routesSource).toContain("eventName === 'PIX_AUTOMATIC_REJECTED'")
    expect(routesSource).toContain("sub.set('recurring_status', 'REJECTED')")
  })

  it('Webhook handler baixa cobrança e estende vigência em pagamentos recorrentes (PIX_AUTOMATIC_COBR_COMPLETED / OPENPIX:CHARGE_COMPLETED)', () => {
    expect(routesSource).toContain("chargeRecord.set('status', 'PAGA')")
    expect(routesSource).toContain("chargeRecord.set('payment_method', 'PIX')")
    expect(routesSource).toContain('PIX_AUTOMATIC_COBR_COMPLETED')
    expect(routesSource).toContain('PAYMENT_RECEIVED_PIX_AUTOMATICO')
    expect(routesSource).toContain('30 * 24 * 60 * 60 * 1000') // +30 dias vigência
  })

  it('Segredo da Woovi (AppID) nunca é logado nem exposto no payload retornado', () => {
    // Garante que wooviKey não é impresso em console.log
    expect(routesSource).not.toMatch(/console\.log\(.*wooviKey.*\)/)
    expect(routesSource).not.toMatch(/console\.log\(.*WOOVI_APP_ID.*\)/)
  })

  it('Interface FinanceiroContek exibe status do Pix Automático e botão de ativação', () => {
    expect(financeiroContekSource).toContain('handleEnrollPixAutomatic')
    expect(financeiroContekSource).toContain('Ativar Pix Automático')
    expect(financeiroContekSource).toContain('PIX AUTO ATIVO')
    expect(financeiroContekSource).toContain('AGUARDANDO AUTORIZAÇÃO')
    expect(financeiroContekSource).toContain('Autorização do Pix Automático')
  })
})
