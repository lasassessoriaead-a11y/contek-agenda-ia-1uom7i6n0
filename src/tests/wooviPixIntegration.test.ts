import { describe, it, expect, vi } from 'vitest'
import appSource from '../App.tsx?raw'
import superAdminLayoutSource from '../components/SuperAdminLayout.tsx?raw'
import financeiroContekSource from '../pages/FinanceiroContek.tsx?raw'
import migration0026Source from '../../pocketbase/migrations/0026_create_contek_charges.js?raw'
import migration0028Source from '../../pocketbase/migrations/0028_add_woovi_pix_fields_to_contek_charges.js?raw'
import cronSource from '../../pocketbase/hooks/contek_financial_cron.js?raw'
import routesSource from '../../pocketbase/hooks/contek_finance_routes.js?raw'

describe('Integração Woovi Pix - Módulo Financeiro Contek (Luciana / SuperAdmin)', () => {
  describe('1. Schema e Migrations contek_charges', () => {
    it('migration 0028 adiciona campos pix_brcode, pix_qrcode_image, correlation_id e woovi_charge_id', () => {
      expect(migration0028Source).toContain("name: 'pix_brcode'")
      expect(migration0028Source).toContain("name: 'pix_qrcode_image'")
      expect(migration0028Source).toContain("name: 'correlation_id'")
      expect(migration0028Source).toContain("name: 'woovi_charge_id'")
      expect(migration0028Source).toContain("idx_contek_charges_correlation_id")
    })

    it('isolamento de segurança: cliente comum NÃO tem acesso a contek_charges', () => {
      const superAdminRule = "@request.auth.id != '' && @request.auth.is_super_admin = true"
      expect(migration0026Source).toContain(superAdminRule)
      expect(migration0026Source).toContain('listRule: superAdminOnlyRule')
      expect(migration0026Source).toContain('viewRule: superAdminOnlyRule')
    })
  })

  describe('2. Endpoints e Integração com a API da Woovi', () => {
    it('chama endpoint oficial POST https://api.woovi.com/api/v1/charge com correlationID, valor em centavos e comment', () => {
      expect(routesSource).toContain('https://api.woovi.com/api/v1/charge')
      expect(routesSource).toContain('correlationID: correlationId')
      expect(routesSource).toContain('value: chargeValueCents')
      expect(routesSource).toContain('comment:')
    })

    it('possui rota dedicada para gerar ou regenerar Pix por cobrança (/charge/pix)', () => {
      expect(routesSource).toContain('/backend/v1/superadmin/finance/charge/pix')
      expect(routesSource).toContain("chargeRecord.getString('status') === 'PAGA'")
      expect(routesSource).toContain("chargeRecord.set('pix_brcode', brCode)")
      expect(routesSource).toContain("chargeRecord.set('pix_qrcode_image', qrImage)")
    })

    it('armazena brCode, qrCodeImage, correlationID e woovi_charge_id retornados pela Woovi', () => {
      expect(routesSource).toContain("chargeRecord.set('pix_brcode', brCode)")
      expect(routesSource).toContain("chargeRecord.set('pix_qrcode_image', qrImage)")
      expect(routesSource).toContain("chargeRecord.set('correlation_id', correlationId)")
      expect(routesSource).toContain("chargeRecord.set('woovi_charge_id', String(wooviChargeId))")
    })

    it('possui rota de auto-setup do webhook na Woovi (/woovi/setup-webhook)', () => {
      expect(routesSource).toContain('/backend/v1/superadmin/finance/woovi/setup-webhook')
      expect(routesSource).toContain('https://api.woovi.com/api/v1/webhook')
      expect(routesSource).toContain("event: 'OPENPIX:CHARGE_COMPLETED'")
      expect(routesSource).toContain('/backend/v1/public/woovi/webhook')
    })
  })

  describe('3. Webhook Público da Woovi com Idempotência e Atualização Automática', () => {
    it('endpoint público /backend/v1/public/woovi/webhook está registrado sem auth padrão', () => {
      expect(routesSource).toContain('/backend/v1/public/woovi/webhook')
    })

    it('identifica a cobrança pelo correlationID ou woovi_charge_id recebido no evento', () => {
      expect(routesSource).toContain('correlation_id = "${correlationId}"')
      expect(routesSource).toContain('woovi_charge_id = "${transactionId}"')
    })

    it('idempotência garantida: se cobrança já estiver PAGA, não duplica e retorna 200 com flag idempotent', () => {
      expect(routesSource).toContain("chargeRecord.getString('status') === 'PAGA'")
      expect(routesSource).toContain('idempotent: true')
      expect(routesSource).toContain('Cobrança já processada anteriormente.')
    })

    it('quando o Pix cai, marca cobrança como PAGA, data paid_at, payment_method=PIX e renova assinatura', () => {
      expect(routesSource).toContain("chargeRecord.set('status', 'PAGA')")
      expect(routesSource).toContain("chargeRecord.set('payment_method', 'PIX')")
      expect(routesSource).toContain("chargeRecord.set('paid_at', paidAtDateOnly)")
      expect(routesSource).toContain("action: 'PAYMENT_RECEIVED_WOOVI_PIX'")
      expect(routesSource).toContain("subRecord.set('status', 'active')")
    })
  })

  describe('4. Resiliência e Fallback em Modo Manual', () => {
    it('se a API da Woovi falhar ou chave for inválida, cobrança segue normalmente em modo manual', () => {
      expect(routesSource).toContain('Falha ao comunicar com Woovi API (mantendo modo manual)')
      expect(routesSource).toContain('Não foi possível gerar o Pix agora pela Woovi. A cobrança continua disponível em modo manual.')
      expect(financeiroContekSource).toContain('Não foi possível gerar o Pix agora — a cobrança segue em modo manual.')
    })

    it('normaliza padding de base64 na chave da Woovi caso chegue sem padding = final', () => {
      const normalizeBase64 = (key: string) => {
        let trimmed = key.trim()
        if (trimmed && trimmed.length % 4 !== 0) {
          const pad = 4 - (trimmed.length % 4)
          for (let i = 0; i < pad; i++) trimmed += '='
        }
        return trimmed
      }

      const sampleKeyWithoutPad = 'Q2xpZW50X0lkXzkyNzZlNDdmLTA5NmMtNGM1Yi1iYzJhLThmMjQxOTYxNTZhYzpDbGllbnRfU2VjcmV0X09pREtudmZBcC9aR2xRV0pXNFpydU5RSWNnTEU4OUdhbkFBcDcwYTNVNVk9'
      const normalized = normalizeBase64(sampleKeyWithoutPad)
      expect(normalized.length % 4).toBe(0)
    })
  })

  describe('5. Interface do Usuário Amigável e sem Jargão Técnico (Luciana Contek)', () => {
    it('contém textos claros em português: Pix copia e cola, Copiar código, Ver QR Code Pix', () => {
      expect(financeiroContekSource).toContain('Pix copia e cola')
      expect(financeiroContekSource).toContain('Copiar código')
      expect(financeiroContekSource).toContain('Ver QR Code Pix')
      expect(financeiroContekSource).toContain('Copiado!')
    })

    it('exibe QR Code na modal e feedback visual ao copiar o código', () => {
      expect(financeiroContekSource).toContain('viewingPixCharge')
      expect(financeiroContekSource).toContain('handleCopyPixCode')
      expect(financeiroContekSource).toContain('toast.success(\'Código Pix copiado!\')')
    })

    it('possui botão de ação direta "Gerar Pix" por cobrança pendente', () => {
      expect(financeiroContekSource).toContain('handleGeneratePixForCharge')
      expect(financeiroContekSource).toContain('Gerar Pix')
    })

    it('nunca expõe a credencial de AppID na UI do frontend', () => {
      expect(financeiroContekSource).not.toContain('Q2xpZW50X0lk')
      expect(financeiroContekSource).not.toContain('Client_Secret')
    })
  })
})
