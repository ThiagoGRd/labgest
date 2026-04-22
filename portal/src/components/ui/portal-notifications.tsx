'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell, Loader2, MessageSquare, AlertTriangle, CreditCard, X } from 'lucide-react'
import { getNotificacoesPortal } from '@/actions/notificacoes'
import Link from 'next/link'

const TIPO_ICONS: Record<string, any> = {
  info: MessageSquare,
  warning: AlertTriangle,
  destructive: CreditCard,
}

const TIPO_COLORS: Record<string, string> = {
  info: 'bg-indigo-500/10 text-indigo-500',
  warning: 'bg-amber-500/10 text-amber-500',
  destructive: 'bg-red-500/10 text-red-500',
}

const TIPO_BADGE: Record<string, string> = {
  info: 'text-indigo-600 dark:text-indigo-400',
  warning: 'text-amber-600 dark:text-amber-400',
  destructive: 'text-red-600 dark:text-red-400',
}

export function PortalNotifications() {
  const [open, setOpen] = useState(false)
  const [notificacoes, setNotificacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const total = notificacoes.reduce((acc, n) => acc + (n.count ?? 1), 0)

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

  useEffect(() => {
    fetchNotificacoes()
    // Polling a cada 90s
    const interval = setInterval(fetchNotificacoes, 90000)
    return () => clearInterval(interval)
  }, [])

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all duration-300"
        title="Notificações"
        aria-label={`${total} notificações`}
      >
        <Bell className={`h-5 w-5 transition-colors ${total > 0 && !loading ? 'text-indigo-400' : ''}`} />

        {/* Badge numérico */}
        {total > 0 && !loading && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none ring-2 ring-zinc-950 animate-in fade-in zoom-in duration-200">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-84 max-h-[420px] flex flex-col bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-500" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Notificações</h3>
              {total > 0 && (
                <span className="text-xs font-bold bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  {total}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 text-slate-400 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {loading ? (
              <div className="p-8 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : notificacoes.length === 0 ? (
              <div className="p-6 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                  <Bell className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Tudo em dia!</p>
                <p className="text-xs text-slate-400">Sem novas notificações.</p>
              </div>
            ) : (
              notificacoes.map((notif) => {
                const Icon = TIPO_ICONS[notif.tipo] || Bell
                return (
                  <Link
                    href={notif.link}
                    key={notif.id}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors group"
                  >
                    <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${TIPO_COLORS[notif.tipo] || 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold leading-snug ${TIPO_BADGE[notif.tipo] || 'text-slate-700 dark:text-slate-300'}`}>
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {notif.mensagem}
                      </p>
                    </div>
                    {notif.count && notif.count > 1 && (
                      <span className="ml-auto shrink-0 self-center text-xs font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        {notif.count}
                      </span>
                    )}
                  </Link>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
