"use client"

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import { lerMensagens, marcarMensagensLidas } from '@/actions/mensagens'
import { mergeMessages } from './message-sync'
import type { MensagemOrdem } from '@labgest/database/src/mensagens'

export function useMessageSync(ordemId: number, mensagens: MensagemOrdem[], setMensagens: Dispatch<SetStateAction<MensagemOrdem[]>>) {
  useEffect(() => {
    let active = true
    let pending = false
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || pending) return
      pending = true
      try {
        const result = await lerMensagens(ordemId)
        if (active && result.success) setMensagens(current => mergeMessages(current, result.mensagens))
      } catch { /* Retry on the next poll or focus; keep the draft. */ }
      finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(refresh, 10_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [ordemId, setMensagens])

  // Runs after React commits the displayed messages, never acknowledges messages
  // arriving between this snapshot and the locked database mutation.
  useEffect(() => {
    const acknowledge = async () => {
      if (document.visibilityState !== 'visible') return
      const ids = mensagens.filter(m => m.role === 'lab' && !m.lidoPeloDentista).map(m => m.id)
      if (!ids.length) return
      try {
        const result = await marcarMensagensLidas(ordemId, ids)
        if (result.success) window.dispatchEvent(new Event('labgest:messages-read'))
      } catch { /* Retried by the next conversation poll. */ }
    }
    void acknowledge()
    document.addEventListener('visibilitychange', acknowledge)
    return () => document.removeEventListener('visibilitychange', acknowledge)
  }, [ordemId, mensagens])
}
