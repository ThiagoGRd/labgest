import { prisma, Prisma } from './index'
import { proximaRevisaoOrdem } from '@labgest/shared'

export interface MensagemOrdem {
  id: string
  role: string
  remetenteId?: number
  nome: string
  texto: string
  fotoUrl?: string
  createdAt: string
  lidoPeloLab?: boolean
  lidoPeloDentista?: boolean
}

export function mensagensDaOrdem(value: unknown): MensagemOrdem[] {
  return Array.isArray(value) ? value.filter((m): m is MensagemOrdem =>
    !!m && typeof m === 'object' && typeof m.id === 'string' && typeof m.role === 'string') : []
}

// Both applications and read receipts acquire the same database row lock before
// reading JSON. Preserve historical entries, including unknown metadata.
export async function alterarMensagens(ordemId: number, clienteId: number | undefined,
  alterar: (mensagens: Prisma.InputJsonValue[]) => Prisma.InputJsonValue[]) {
  return prisma.$transaction(async tx => {
    const rows = clienteId === undefined
      ? await tx.$queryRaw<{ id: number }[]>`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
      : await tx.$queryRaw<{ id: number }[]>`SELECT id FROM ordens WHERE id = ${ordemId} AND cliente_id = ${clienteId} FOR UPDATE`
    if (!rows.length) return false
    const ordem = await tx.ordem.findFirst({ where: { id: ordemId, ...(clienteId === undefined ? {} : { clienteId }) } })
    if (!ordem) return false
    const atuais = (Array.isArray(ordem.mensagens) ? ordem.mensagens : []) as Prisma.InputJsonValue[]
    // Snapshot before invoking the callback, including callbacks that mutate the
    // array in place. Repeated receipts/retries must not touch the order revision.
    const anterior = JSON.stringify(atuais)
    const seguintes = alterar(atuais)
    if (JSON.stringify(seguintes) === anterior) return true
    // A genuine message/receipt change still updates updatedAt conservatively:
    // an open workflow form must refresh its revision before its next mutation.
    await tx.ordem.update({ where: { id: ordemId }, data: { mensagens: seguintes as Prisma.InputJsonArray, updatedAt: proximaRevisaoOrdem(ordem.updatedAt) } })
    return true
  })
}

export function recibos(mensagens: Prisma.InputJsonValue[], ids: string[], destinatario: 'lab' | 'dentista') {
  const vistos = new Set(ids)
  return mensagens.map(m => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return m
    if (!('id' in m) || !('role' in m) || typeof m.id !== 'string' || !vistos.has(m.id) || m.role !== (destinatario === 'lab' ? 'dentista' : 'lab')) return m
    return { ...m, [destinatario === 'lab' ? 'lidoPeloLab' : 'lidoPeloDentista']: true }
  })
}
