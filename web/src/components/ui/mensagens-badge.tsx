'use client'

import { useState, useEffect } from 'react'
import { getMensagensNaoLidasLab } from '@/actions/notificacoes-lab'

export function MensagensBadge() {
  const [count, setCount] = useState(0)

  async function fetch() {
    try {
      const n = await getMensagensNaoLidasLab()
      setCount(n)
    } catch {}
  }

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 60000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) return null

  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
      {count > 99 ? '99+' : count}
    </span>
  )
}
