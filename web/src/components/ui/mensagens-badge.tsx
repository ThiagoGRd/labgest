'use client'

import { useState, useEffect } from 'react'
import { getMensagensNaoLidasLab } from '@/actions/notificacoes-lab'

export function MensagensBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      try {
        const quantidade = await getMensagensNaoLidasLab()
        if (ativo) setCount(quantidade)
      } catch {}
    }
    window.addEventListener('labgest:messages-read', carregar)
    const inicio = window.setTimeout(carregar, 0)
    const interval = window.setInterval(carregar, 60_000)
    return () => {
      window.removeEventListener('labgest:messages-read', carregar)
      ativo = false
      window.clearTimeout(inicio)
      window.clearInterval(interval)
    }
  }, [])

  if (count === 0) return null

  return (
    <span title="Mensagens não lidas em todas as ordens" className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
