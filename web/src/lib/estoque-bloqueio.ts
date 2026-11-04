import type { Prisma } from '@labgest/database'

// Lock the full set before reading any quantity. Every stock writer uses the
// same ascending order; repeated materials still produce separate ledger rows.
// Order finalization locks its order first, then these items, then writes ledgers.
export async function bloquearItensEstoque(tx: Prisma.TransactionClient, ids: number[]) {
  const ordenados = [...new Set(ids)].sort((a, b) => a - b)
  for (const id of ordenados) {
    await tx.$queryRaw`SELECT id FROM estoque WHERE id = ${id} FOR UPDATE`
  }
}
