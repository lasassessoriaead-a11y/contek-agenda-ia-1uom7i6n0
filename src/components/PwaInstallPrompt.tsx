import React, { useState } from 'react'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Download, Smartphone, Share, PlusSquare, X, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface PwaInstallPromptProps {
  className?: string
  variant?: 'banner' | 'button' | 'badge'
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  className = '',
  variant = 'button',
}) => {
  const { isInstallable, isStandalone, isIos, promptInstall } = usePwaInstall()
  const [showIosModal, setShowIosModal] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Don't show if already running as standalone installed app
  if (isStandalone) {
    return null
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const ok = await promptInstall()
      if (ok) return
    }
    // If not installable via native prompt or on iOS, show the installation instructions modal
    setShowIosModal(true)
  }

  // Variant: Badge/Button in header or menu
  if (variant === 'button') {
    return (
      <>
        <Button
          type="button"
          size="sm"
          onClick={handleInstallClick}
          className={`bg-slate-900 hover:bg-slate-800 text-blue-400 border border-blue-500/30 text-xs font-semibold shadow-sm flex items-center gap-1.5 h-9 ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-[#3B82F6] animate-pulse" />
          <span>Instalar App</span>
        </Button>

        <Dialog open={showIosModal} onOpenChange={setShowIosModal}>
          <DialogContent className="max-w-md bg-[#0F172A] border-slate-800 text-slate-100 rounded-2xl">
            <DialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-blue-950 border border-blue-800 text-[#3B82F6] flex items-center justify-center mx-auto mb-2">
                <Smartphone className="w-6 h-6" />
              </div>
              <DialogTitle className="text-center text-lg font-bold text-white">
                Instalar AGYLI
              </DialogTitle>
              <DialogDescription className="text-center text-xs text-slate-400">
                Agendar ficou simples. Adicione o aplicativo à tela inicial do seu celular ou
                computador para abrir em tela cheia.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2 text-xs">
              {isIos ? (
                <div className="space-y-3 bg-[#1E293B] p-3.5 rounded-xl border border-slate-800 text-slate-300">
                  <p className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> No iPhone / iPad (Safari):
                  </p>
                  <ol className="space-y-2 list-decimal list-inside text-slate-300">
                    <li>
                      Toque no botão de <b>Compartilhar</b>{' '}
                      <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> na barra inferior
                      do Safari.
                    </li>
                    <li>
                      Role para cima e toque em <b>Adicionar à Tela de Início</b>{' '}
                      <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-blue-400" />.
                    </li>
                    <li>
                      Toque em <b>Adicionar</b> no canto superior direito. Pronto!
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 bg-[#1E293B] p-3.5 rounded-xl border border-slate-800 text-slate-300">
                  <p className="font-semibold text-blue-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> No Android (Chrome) ou Computador:
                  </p>
                  <ol className="space-y-2 list-decimal list-inside text-slate-300">
                    <li>Abra o menu do navegador (três pontinhos no canto superior).</li>
                    <li>
                      Selecione <b>Instalar aplicativo</b> ou <b>Adicionar à tela inicial</b>.
                    </li>
                    <li>
                      Confirme a instalação. O ícone oficial do AGYLI aparecerá entre seus apps.
                    </li>
                  </ol>
                </div>
              )}

              <div className="p-3 bg-blue-950/40 rounded-lg border border-blue-800/40 text-[11px] text-blue-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#3B82F6] flex-shrink-0" />
                <span>
                  Funciona em tela cheia (standalone), sem barras de navegador e com carregamento
                  ultrarrápido.
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIosModal(false)}
                className="border-slate-800 text-slate-300 text-xs"
              >
                Entendi
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // Variant: Banner (e.g. at top of Layout or sidebar)
  if (variant === 'banner' && !dismissed) {
    return (
      <div
        className={`bg-gradient-to-r from-blue-950 via-[#0F172A] to-indigo-950 border border-blue-500/40 text-white rounded-xl p-3 shadow-lg flex items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-white">Instalar AGYLI no Celular</p>
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[9px] px-1.5 py-0">
                App PWA
              </Badge>
            </div>
            <p className="text-[11px] text-slate-300">
              Agendar ficou simples. Acesse sua agenda direto da tela de início em tela cheia.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#2563EB] hover:to-[#7C3AED] text-white font-bold text-xs h-8 px-3"
          >
            Instalar
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return null
}
