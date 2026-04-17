'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, MessageSquare, Loader2, User } from 'lucide-react'
import { enviarMensagem } from '@/actions/mensagens'

interface Mensagem {
  id: string
  role: string
  nome: string
  texto: string
  createdAt: string
}

interface ChatPedidoProps {
  ordemId: number
  mensagensIniciais: Mensagem[]
  dentistaNome: string
}

export function ChatPedido({ ordemId, mensagensIniciais, dentistaNome }: ChatPedidoProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais || [])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim()) return

    setLoading(true)
    const currentText = texto
    setTexto('')

    try {
      const res = await enviarMensagem(ordemId, currentText)
      if (res.success && res.mensagem) {
        setMensagens(prev => [...prev, res.mensagem as Mensagem])
      }
    } catch (error) {
      console.error(error)
      // Feedback opcional de erro (toast)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[400px] border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-emerald-500" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Mensagens da Ordem</h4>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensagens.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem neste caso.</p>
            <p className="text-xs">Use o chat para falar com o laboratório.</p>
          </div>
        ) : (
          mensagens.map(msg => {
            const isDentista = msg.role === 'dentista'
            return (
              <div key={msg.id} className={`flex flex-col ${isDentista ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-bold text-slate-500">{msg.nome}</span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${
                  isDentista 
                    ? 'bg-emerald-500 text-white rounded-tr-sm' 
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.texto}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
        <Input 
          value={texto} 
          onChange={e => setTexto(e.target.value)} 
          placeholder="Escreva uma mensagem..."
          className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border-transparent focus:border-emerald-500"
          disabled={loading}
        />
        <Button 
          type="submit" 
          disabled={!texto.trim() || loading}
          className="rounded-xl px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
