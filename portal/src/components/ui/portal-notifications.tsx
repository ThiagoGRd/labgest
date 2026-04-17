'use client'

import { useState, useEffect } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { getNotificacoesPortal } from '@/actions/notificacoes'
import Link from 'next/link'

export function PortalNotifications() {
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNotificacoes() {
      try {
        const data = await getNotificacoesPortal()
        setNotificacoes(data || [])
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchNotificacoes()
    
    // Polling básico a cada 2 minutos
    const interval = setInterval(fetchNotificacoes, 120000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
        title="Notificações"
      >
        <Bell className="h-5 w-5" />
        {notificacoes.length > 0 && !loading && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-zinc-950 animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-zinc-950 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 z-50">
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-950/90 backdrop-blur-md">
            <h3 className="font-bold text-slate-900 dark:text-white">Avisos Importantes</h3>
          </div>
          
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : notificacoes.length === 0 ? (
              <p className="p-4 text-center text-sm text-slate-500">Tudo em dia! Sem novas notificações.</p>
            ) : (
              notificacoes.map((notif) => (
                <Link
                  href={notif.link}
                  key={notif.id}
                  onClick={() => setOpen(false)}
                  className="block p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <div className="flex gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${notif.tipo === 'destructive' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className={`text-sm font-bold ${notif.tipo === 'destructive' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{notif.mensagem}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
