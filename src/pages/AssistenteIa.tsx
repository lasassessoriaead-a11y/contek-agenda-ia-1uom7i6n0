import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Bot, Sparkles, Send, RotateCcw, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

interface Message {
  id: string
  sender: 'user' | 'assistant'
  text: string
  time: string
}

export const AssistenteIa: React.FC = () => {
  const { organization, user, currentProduct, branding } = useAuth()

  const defaultWelcomeMessage: Message = {
    id: '1',
    sender: 'assistant',
    text: `Olá, ${user?.name || 'Gestor(a)'}! Eu sou o Assistente IA do Contek Agenda (${branding.name}). Como posso apoiar a gestão de ${organization?.name || 'sua empresa'} hoje?`,
    time: 'Agora',
  }

  // Storage key isolated per user and organization
  const storageKeyPrefix = `contek_ai_${user?.id || 'guest'}_${organization?.id || 'default'}`
  const conversationKey = `${storageKeyPrefix}_conversation_id`
  const historyKey = `${storageKeyPrefix}_history`

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(historyKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch {
      /* intentionally ignored */
    }
    return [defaultWelcomeMessage]
  })

  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(conversationKey) || null
    } catch {
      return null
    }
  })

  // Whenever user or organization changes, re-sync from localStorage
  useEffect(() => {
    if (!user?.id || !organization?.id) return
    const currentPrefix = `contek_ai_${user.id}_${organization.id}`
    const savedConv = localStorage.getItem(`${currentPrefix}_conversation_id`)
    const savedHistory = localStorage.getItem(`${currentPrefix}_history`)

    if (savedConv) {
      setConversationId(savedConv)
    } else {
      setConversationId(null)
    }

    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
          return
        }
      } catch {
        /* intentionally ignored */
      }
    }
    setMessages([
      {
        id: '1',
        sender: 'assistant',
        text: `Olá, ${user?.name || 'Gestor(a)'}! Eu sou o Assistente IA do Contek Agenda (${branding.name}). Como posso apoiar a gestão de ${organization?.name || 'sua empresa'} hoje?`,
        time: 'Agora',
      },
    ])
  }, [user?.id, organization?.id, branding.name])

  // Auto-scroll to bottom of messages whenever list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Persist messages and conversationId
  useEffect(() => {
    if (!user?.id || !organization?.id) return
    try {
      localStorage.setItem(historyKey, JSON.stringify(messages))
    } catch {
      /* intentionally ignored */
    }
  }, [messages, historyKey, user?.id, organization?.id])

  useEffect(() => {
    if (!user?.id || !organization?.id) return
    try {
      if (conversationId) {
        localStorage.setItem(conversationKey, conversationId)
      } else {
        localStorage.removeItem(conversationKey)
      }
    } catch {
      /* intentionally ignored */
    }
  }, [conversationId, conversationKey, user?.id, organization?.id])

  const handleClearChat = () => {
    setConversationId(null)
    const resetList = [
      {
        id: Date.now().toString(),
        sender: 'assistant' as const,
        text: `Conversa reiniciada. Como posso apoiar a gestão de ${organization?.name || 'sua clínica/estabelecimento'} hoje?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]
    setMessages(resetList)
    if (user?.id && organization?.id) {
      try {
        localStorage.removeItem(conversationKey)
        localStorage.setItem(historyKey, JSON.stringify(resetList))
      } catch {
        /* intentionally ignored */
      }
    }
    toast.success('Histórico da conversa reiniciado.')
  }

  const isMarkaly = currentProduct === 'markaly'

  // Sugestões solicitadas na especificação:
  // "Meus horários livres", "Resumo da semana", "Clientes que não voltam há 60 dias"
  const quickPrompts = [
    'Meus horários livres',
    'Resumo da semana',
    'Clientes que não voltam há 60 dias',
    'Quem são meus melhores clientes?',
    'Quanto faturei semana passada?',
  ]

  const handleSendMessage = async (customText?: string) => {
    const textToSend = customText || inputMessage
    if (!textToSend.trim()) return

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!customText) setInputMessage('')
    setLoading(true)

    try {
      // Call native Skip Cloud AI hook (strictly isolated per user's organization)
      const token = pb.authStore.token
      const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL}/backend/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: textToSend,
          organization_id: organization?.id,
          conversation_id: conversationId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.conversation_id) setConversationId(data.conversation_id)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'assistant',
            text: data.content || 'Resposta processada com sucesso.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      } else {
        const errData = await response.json().catch(() => null)
        const errMsg = errData?.error || 'Erro ao consultar o assistente IA.'
        toast.error(errMsg)
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'assistant',
            text: `Não consegui processar a consulta no momento: ${errMsg}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ])
      }
    } catch (err) {
      console.error(err)
      toast.error('Não foi possível conectar com o servidor da IA.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto flex-1 min-h-0 flex flex-col gap-3">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-200 flex-shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm ${
                isMarkaly ? 'bg-purple-600 shadow-purple-600/30' : 'bg-blue-600 shadow-blue-600/30'
              }`}
            >
              <Bot className="w-5 h-5" />
            </div>
            <span>Assistente IA</span>
            <Badge
              variant="outline"
              className={
                isMarkaly
                  ? 'border-purple-300 text-purple-700 bg-purple-50 text-[11px]'
                  : 'border-blue-300 text-blue-700 bg-blue-50 text-[11px]'
              }
            >
              {isMarkaly ? 'MARKALY IA' : 'AGYLI Pro'}
            </Badge>
          </h1>
          <p className="text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
            Consultoria de negócios com memória própria e isolamento exclusivo para{' '}
            <span className="font-semibold text-slate-700">
              {organization?.name || 'sua empresa'}
            </span>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={
              isMarkaly
                ? 'border-purple-300 text-purple-800 bg-purple-50 text-xs shrink-0'
                : 'border-blue-300 text-blue-800 bg-blue-50 text-xs shrink-0'
            }
          >
            <Sparkles
              className={`w-3.5 h-3.5 mr-1 ${isMarkaly ? 'text-purple-600' : 'text-blue-600'}`}
            />
            Skip Cloud AI Agent
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearChat}
            className="text-xs h-8 text-slate-600 hover:text-red-600 hover:border-red-300 shrink-0"
            title="Limpar histórico desta conversa"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Nova conversa
          </Button>
        </div>
      </div>

      {/* CHAT CONTAINER */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        {/* Architecture Note Banner */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900 text-slate-200 text-[11px] sm:text-xs flex items-center justify-between border-b border-slate-800 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate sm:whitespace-normal">
              Arquitetura preparada para IA nativa Skip Cloud com RAG multi-tenant e ferramentas
              analíticas.
            </span>
          </div>
          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px] shrink-0">
            Fast Tier
          </Badge>
        </div>

        {/* Message Log - scrollable internally */}
        <div className="flex-1 min-h-0 p-3 sm:p-5 overflow-y-auto space-y-3.5">
          {messages.map((m) => {
            const isMe = m.sender === 'user'
            return (
              <div
                key={m.id}
                className={`flex gap-2.5 sm:gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-white flex items-center justify-center flex-shrink-0 text-xs font-bold shadow-sm mt-0.5 ${
                      isMarkaly
                        ? 'bg-purple-600 shadow-purple-600/30'
                        : 'bg-blue-600 shadow-blue-600/30'
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] sm:max-w-lg rounded-2xl p-3 sm:p-4 text-xs leading-relaxed ${
                    isMe
                      ? isMarkaly
                        ? 'bg-purple-600 text-white rounded-tr-none shadow-sm'
                        : 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                      : 'bg-slate-100 text-slate-800 border border-slate-200/80 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-line break-words">{m.text}</p>
                  <span
                    className={`block text-[9px] mt-1.5 text-right ${
                      isMe ? (isMarkaly ? 'text-purple-100' : 'text-blue-100') : 'text-slate-400'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex gap-2.5 sm:gap-3 justify-start items-center text-xs text-slate-400 py-1">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl text-white flex items-center justify-center animate-pulse flex-shrink-0 ${
                  isMarkaly ? 'bg-purple-600' : 'bg-blue-600'
                }`}
              >
                <Bot className="w-4 h-4" />
              </div>
              <span className="italic">Assistente IA está analisando os dados da empresa...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Prompts - horizontally scrollable on small screens */}
        <div className="p-2 sm:p-2.5 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {quickPrompts.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(q)}
              className={`px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] text-slate-600 transition-colors whitespace-nowrap flex-shrink-0 ${
                isMarkaly
                  ? 'hover:border-purple-400 hover:text-purple-700 hover:bg-purple-50/50'
                  : 'hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar - always pinned to bottom */}
        <div className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Pergunte ao Assistente IA sobre horários livres, resumo da semana, clientes..."
              className={`w-full text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:bg-white resize-none max-h-24 leading-normal text-slate-900 placeholder:text-slate-400 transition-all ${
                isMarkaly ? 'focus:ring-purple-500' : 'focus:ring-blue-500'
              }`}
            />
          </div>
          <Button
            type="button"
            disabled={loading || !inputMessage.trim()}
            onClick={() => handleSendMessage()}
            className={`font-semibold text-xs h-9 sm:h-10 px-3.5 sm:px-4 shrink-0 transition-colors shadow-sm text-white ${
              isMarkaly
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
            }`}
            title="Enviar mensagem (Enter)"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
export default AssistenteIa
