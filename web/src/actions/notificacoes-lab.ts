'use server'

import { Prisma, prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

interface MensagemOrdem {
  role?: string
  lidoPeloLab?: boolean
  [chave: string]: unknown
}

/** Conta mensagens do dentista ainda não lidas pelo lab (role = 'dentista', !lidoPeloLab) */
export async function getMensagensNaoLidasLab(): Promise<number> {
  try {
    await requireUser()
    const ordens = await prisma.ordem.findMany({
      where: {
        status: { notIn: ['Cancelado'] },
      },
      select: { mensagens: true },
    })

    let total = 0
    for (const o of ordens) {
      const msgs = Array.isArray(o.mensagens) ? o.mensagens as MensagemOrdem[] : []
      total += msgs.filter(
        (mensagem) => mensagem.role === 'dentista' && !mensagem.lidoPeloLab
      ).length
    }
    return total
  } catch {
    return 0
  }
}

export async function marcarMensagensComoLidasLab(ordemId: number) {
  try {
    await requireUser()
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      select: { mensagens: true },
    })
    if (!ordem || !Array.isArray(ordem.mensagens)) return { success: true, alteradas: 0 }

    let alteradas = 0
    const atualizadas = (ordem.mensagens as MensagemOrdem[]).map((msg) => {
      if (msg && typeof msg === 'object' && msg.role === 'dentista' && !msg.lidoPeloLab) {
        alteradas += 1
        return { ...msg, lidoPeloLab: true }
      }
      return msg
    })

    if (alteradas > 0) {
      await prisma.ordem.update({
        where: { id: ordemId },
        data: { mensagens: atualizadas as Prisma.InputJsonArray },
      })
      revalidatePath('/ordens')
      revalidatePath('/lab-interno')
      revalidatePath('/producao')
    }

    return { success: true, alteradas }
  } catch {
    return { success: false, alteradas: 0 }
  }
}

