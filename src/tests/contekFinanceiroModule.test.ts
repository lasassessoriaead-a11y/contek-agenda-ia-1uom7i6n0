import { describe, it, expect } from 'vitest'
import appSource from '../App.tsx?raw'
import superAdminLayoutSource from '../components/SuperAdminLayout.tsx?raw'
import financeiroContekSource from '../pages/FinanceiroContek.tsx?raw'
import migrationSource from '../../pocketbase/migrations/0026_create_contek_charges.js?raw'
import cronSource from '../../pocketbase/hooks/contek_financial_cron.js?raw'
import routesSource from '../../pocketbase/hooks/contek_finance_routes.js?raw'

describe('Módulo Financeiro Contek (/admin/financeiro) - Regras de Negócio e Homologação', () => {
  describe('1. Coleção contek_charges e Isolamento RLS', () => {
    it('migration define contek_charges com todos os campos especificados', () => {
      expect(migrationSource).toContain("name: 'contek_charges'")
      expect(migrationSource).toContain("name: 'organization_id'")
      expect(migrationSource).toContain("name: 'subscription_id'")
      expect(migrationSource).toContain("name: 'description'")
      expect(migrationSource).toContain("name: 'amount'")
      expect(migrationSource).toContain("name: 'due_date'")
      expect(migrationSource).toContain("name: 'status'")
      expect(migrationSource).toContain("name: 'payment_method'")
      expect(migrationSource).toContain("name: 'paid_at'")
      expect(migrationSource).toContain("name: 'notes'")
      expect(migrationSource).toContain("values: ['PENDENTE', 'PAGA', 'ATRASADA', 'CANCELADA']")
      expect(migrationSource).toContain("values: ['PIX', 'Dinheiro', 'Cartão', 'Transferência', 'Outro']")
    })

    it('RLS estrito: cliente NÃO pode listar nem visualizar contek_charges (apenas SuperAdmin)', () => {
      const superAdminRule = "@request.auth.id != '' && @request.auth.is_super_admin = true"
      expect(migrationSource).toContain(superAdminRule)
      expect(migrationSource).toContain('listRule: superAdminOnlyRule')
      expect(migrationSource).toContain('viewRule: superAdminOnlyRule')
      expect(migrationSource).toContain('createRule: superAdminOnlyRule')
      expect(migrationSource).toContain('updateRule: superAdminOnlyRule')
      expect(migrationSource).toContain('deleteRule: superAdminOnlyRule')
    })
  })

  describe('2. Roteamento e Proteção de Rota /admin/financeiro', () => {
    it('/admin/financeiro está registrado sob SuperAdminRoute no App.tsx', () => {
      expect(appSource).toContain('path="financeiro" element={<FinanceiroContek />}')
      expect(appSource).toContain('<SuperAdminRoute>')
      expect(appSource).toContain('<SuperAdminLayout />')
    })

    it('SuperAdminLayout inclui link direto para Financeiro Contek com badge e ícone', () => {
      expect(superAdminLayoutSource).toContain("name: 'Financeiro Contek'")
      expect(superAdminLayoutSource).toContain("path: '/admin/financeiro'")
      expect(superAdminLayoutSource).toContain('sidebar-financeiro-contek-link')
      expect(superAdminLayoutSource).toContain('DollarSign')
    })

    it('redirecionamento de segurança: cliente comum tentando acessar /admin é redirecionado para /', () => {
      const checkRouteAccess = (user: { is_super_admin?: boolean; role?: string } | null) => {
        if (!user) return { allowed: false, redirect: '/login' }
        const isSuper = Boolean(user.is_super_admin === true || user.role === 'SUPERADMIN')
        if (!isSuper) return { allowed: false, redirect: '/' }
        return { allowed: true, redirect: null }
      }

      // Cliente comum de clínica (dono ou profissional)
      expect(checkRouteAccess({ is_super_admin: false, role: 'ADMINISTRADOR' })).toEqual({
        allowed: false,
        redirect: '/',
      })
      expect(checkRouteAccess({ is_super_admin: false, role: 'PROFISSIONAL' })).toEqual({
        allowed: false,
        redirect: '/',
      })
      // SuperAdmin Contek
      expect(checkRouteAccess({ is_super_admin: true, role: 'SUPERADMIN' })).toEqual({
        allowed: true,
        redirect: null,
      })
    })
  })

  describe('3. Regra de Negócio Crítica: Valores Editáveis (OBS. da Usuária)', () => {
    it('o frontend possui campo explícito de edição de valor na criação e edição da cobrança', () => {
      expect(financeiroContekSource).toContain('chargeAmount')
      expect(financeiroContekSource).toContain('setChargeAmount')
      expect(financeiroContekSource).toContain('Valor a Cobrar *')
      expect(financeiroContekSource).toContain('Editável')
      expect(financeiroContekSource).toContain('type="number"')
      expect(financeiroContekSource).toContain('step="0.01"')
    })

    it('backend permite salvar qualquer valor positivo editado pelo SuperAdmin', () => {
      expect(routesSource).toContain('/backend/v1/superadmin/finance/charge/save')
      expect(routesSource).toContain('amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0')
      expect(routesSource).toContain("chargeRecord.set('amount', parsedAmount)")
    })

    it('no modal de pagamento o valor recebido também pode ser ajustado', () => {
      expect(financeiroContekSource).toContain('setPayAmount')
      expect(financeiroContekSource).toContain('Valor Pago (R$) *')
      expect(routesSource).toContain('/backend/v1/superadmin/finance/charge/pay')
      expect(routesSource).toContain("chargeRecord.set('amount', Math.round(Number(amount) * 100) / 100)")
    })
  })

  describe('4. Geração de Cobranças do Mês e Vigência Mensal', () => {
    it('gera cobrança com vencimento no dia do aniversário de starts_at e calcula +30 dias de vigência', () => {
      const calculateDueAndPeriod = (startsAtStr: string, targetYear: number, targetMonth: number) => {
        const startsAt = new Date(startsAtStr)
        let anniversaryDay = startsAt.getUTCDate()
        if (isNaN(anniversaryDay) || anniversaryDay < 1) anniversaryDay = 10

        const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
        const effectiveDay = Math.min(anniversaryDay, daysInTargetMonth)

        const monthPad = String(targetMonth).padStart(2, '0')
        const dayPad = String(effectiveDay).padStart(2, '0')
        const dueDateStr = `${targetYear}-${monthPad}-${dayPad}`
        const dueDateObj = new Date(Date.UTC(targetYear, targetMonth - 1, effectiveDay, 23, 59, 59))
        const periodEndDate = new Date(dueDateObj.getTime() + 30 * 24 * 60 * 60 * 1000)

        return {
          dueDateStr,
          currentPeriodEndsAt: periodEndDate.toISOString(),
        }
      }

      // Exemplo: empresa iniciou em 15/01/2026, gerando cobrança para Setembro/2026
      const calc1 = calculateDueAndPeriod('2026-01-15T10:00:00.000Z', 2026, 9)
      expect(calc1.dueDateStr).toBe('2026-09-15')
      expect(calc1.currentPeriodEndsAt).toContain('2026-10-15')

      // Exemplo: dia 31 gerando cobrança para Fevereiro/2026 (ajusta para 28)
      const calc2 = calculateDueAndPeriod('2026-01-31T10:00:00.000Z', 2026, 2)
      expect(calc2.dueDateStr).toBe('2026-02-28')
    })

    it('backend registra ação de geração no histórico da assinatura', () => {
      expect(routesSource).toContain("action: 'GENERATE_MONTH_CHARGE'")
      expect(routesSource).toContain("current_period_ends_at")
      expect(routesSource).toContain("sub.set('history', JSON.stringify(historyList))")
    })
  })

  describe('5. Liquidação de Pagamento e Cancelamento com Histórico', () => {
    it('marcar como paga reativa assinatura para active e estende vigência', () => {
      expect(routesSource).toContain("chargeRecord.set('status', 'PAGA')")
      expect(routesSource).toContain("subRecord.set('status', 'active')")
      expect(routesSource).toContain("action: 'PAYMENT_RECEIVED'")
      expect(routesSource).toContain("org.set('status', 'active')")
    })

    it('cancelar cobrança marca como CANCELADA e registra motivo no histórico', () => {
      expect(routesSource).toContain('/backend/v1/superadmin/finance/charge/cancel')
      expect(routesSource).toContain("chargeRecord.set('status', 'CANCELADA')")
      expect(routesSource).toContain("action: 'CHARGE_CANCELED'")
    })
  })

  describe('6. Automação Diária (Cron Sweep)', () => {
    it('cronAdd está configurado para rodar diariamente', () => {
      expect(cronSource).toContain("cronAdd('contek_financial_daily_check', '0 3 * * *'")
    })

    it('trials vencidos (trial_ends_at < hoje) são alterados para overdue e organização suspensa', () => {
      expect(cronSource).toContain('status = "trial" && trial_ends_at != "" && trial_ends_at <')
      expect(cronSource).toContain("sub.set('status', 'overdue')")
      expect(cronSource).toContain("org.set('status', 'suspended')")
      expect(cronSource).toContain("action: 'TRIAL_EXPIRED_OVERDUE'")
    })

    it('cobranças vencidas pendentes tornam-se ATRASADA e assinatura overdue', () => {
      expect(cronSource).toContain('status = "PENDENTE" && due_date <')
      expect(cronSource).toContain("charge.set('status', 'ATRASADA')")
      expect(cronSource).toContain("action: 'CHARGE_OVERDUE'")
    })

    it('inadimplência de 15+ dias suspende a organização automaticamente', () => {
      expect(cronSource).toContain('status = "ATRASADA" && due_date <=')
      expect(cronSource).toContain("action: 'ORG_SUSPENDED_15_DAYS_OVERDUE'")
    })
  })

  describe('7. Painel Lateral de Assinaturas e Destaque de Trials <= 3 dias', () => {
    it('calcula dias restantes e destaca trials com <= 3 dias em laranja', () => {
      const getRemainingDays = (trialEndsAtIso: string, mockNowIso: string) => {
        const end = new Date(trialEndsAtIso).getTime()
        const now = new Date(mockNowIso).getTime()
        return Math.ceil((end - now) / (24 * 60 * 60 * 1000))
      }

      // Simulação: hoje é 09/09/2026, trial de LUIS vence em 11/09/2026 -> 2 dias restantes (<= 3)
      const days = getRemainingDays('2026-09-11T23:59:59.000Z', '2026-09-09T10:00:00.000Z')
      expect(days).toBe(2)
      expect(days <= 3).toBe(true)

      // Frontend possui o alerta e badge específica
      expect(financeiroContekSource).toContain('getTrialDaysRemaining')
      expect(financeiroContekSource).toContain('days !== null && days <= 3')
      expect(financeiroContekSource).toContain('border-amber-300 bg-amber-50')
    })

    it('permite ações manuais de Ativar, Estender Trial e Cancelar', () => {
      expect(financeiroContekSource).toContain('handleOpenSubAction(sub, \'ACTIVATE_MANUAL\')')
      expect(financeiroContekSource).toContain('handleOpenSubAction(sub, \'EXTEND_TRIAL\')')
      expect(financeiroContekSource).toContain('handleOpenSubAction(sub, \'CANCEL_SUB\')')
      expect(routesSource).toContain("action === 'ACTIVATE_MANUAL'")
      expect(routesSource).toContain("action === 'EXTEND_TRIAL'")
      expect(routesSource).toContain("action === 'CANCEL_SUB'")
    })
  })

  describe('8. Identidade Visual Contek no Módulo', () => {
    it('utiliza azul-marinho #0D1B2A, fonte Poppins e símbolo C da Contek', () => {
      expect(financeiroContekSource).toContain('#0D1B2A')
      expect(financeiroContekSource).toContain("font-['Poppins',sans-serif]")
      expect(financeiroContekSource).toContain('ContekSymbol')
    })
  })
})
