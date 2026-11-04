"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Re-fetch through authenticated server routes; no raw order subscription or
// patient payload is exposed to an anonymous browser channel.
export function RealtimeOrders() {
  const router = useRouter()
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      const focused = document.activeElement
      if (focused instanceof HTMLElement && (focused.matches('input, textarea, select') || focused.isContentEditable)) return
      router.refresh()
    }
    const timer = window.setInterval(refresh, 30_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router])
  return null
}
