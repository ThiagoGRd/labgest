'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

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
      const msgs = Array.isArray(o.mensagens) ? (o.mensagens as any[]) : []
      total += msgs.filter(
        (m: any) => m.role === 'dentista' && !m.lidoPeloLab
      ).length
    }
    return total
  } catch {
    return 0
  }
}
