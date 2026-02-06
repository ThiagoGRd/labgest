'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export function RealtimeOrders() {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3') // Pleasant notification sound
    audioRef.current.volume = 0.5

    const supabase = createClient()

    const channel = supabase
      .channel('realtime-ordens')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ordens',
        },
        (payload) => {
          // Play sound
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.log('Audio play failed:', e))
          }

          // Show Toast
          toast.success('Novo Pedido Recebido!', {
            description: `Paciente: ${payload.new.nome_paciente} - ${payload.new.servico_nome}`,
            duration: 8000,
            action: {
              label: 'Ver',
              onClick: () => router.push('/ordens'),
            },
          })

          // Refresh data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
