import assert from 'node:assert/strict'
import test from 'node:test'
import { movimentarCustodiaExterna } from './recepcao-externa-db'

// Contract fixture, not a PostgreSQL integration or concurrency test.
function fixture(options: { archived?: boolean; status?: string; revision?: string; eventFailure?: boolean; previous?: { situacao: string; version: number; dentista: string | null; finalidade: string | null } } = {}) {
  const writes: string[] = []
  const valuesWritten: unknown[][] = []
  let committed = false
  const tx = {
    async $queryRaw(sql: TemplateStringsArray) {
      const query = sql.join('?')
      if (query.includes('pg_catalog.pg_class')) return query.includes('external_order_archive') ? [{ installed: true }] : [{ count: 3 }]
      if (query.includes('external_reception_capability')) return [{ schema_version: 1, enabled: true, permitted: true, full_visibility: true }]
      if (query.includes('FOR UPDATE')) return [{ situacao: options.status ?? 'Pronto', revisao: options.revision ?? 'a'.repeat(32) }]
      if (query.includes('external_order_archive_capability')) return [{ schema_version: 1, enabled: false, permitted: true, full_visibility: true }]
      if (query.includes('external_order_archive')) return [{ pedido_id: 7, archived: options.archived ?? false, version: 1 }]
      if (query.includes('external_reception_state')) return options.previous ? [options.previous] : []
      throw new Error(`Unexpected query: ${query}`)
    },
    async $executeRaw(sql: TemplateStringsArray, ...values: unknown[]) {
      const query = sql.join('?')
      writes.push(query)
      valuesWritten.push(values)
      if (options.eventFailure && query.includes('external_reception_event')) throw new Error('fixture event failure')
      return 1
    },
  }
  const db = { ...tx, async $transaction(fn: (client: typeof tx) => Promise<unknown>) {
    try { const result = await fn(tx); committed = true; return result } catch (e) { writes.length = 0; throw e }
  } }
  return { db, writes, valuesWritten, committed: () => committed }
}
const input = { origem: 'externo' as const, id: 7, expectedRevision: 'a'.repeat(32), expectedVersion: 0, acao: 'receber' as const }
const actor = { id: 1, nome: 'Operador sintético' }
test('origem interna é recusada antes de consulta', async () => {
  let touched = false
  await assert.rejects(() => movimentarCustodiaExterna({ $transaction() { touched = true; throw Error() } } as never, { ...input, origem: 'interno' } as never, actor))
  assert.equal(touched, false)
})
test('revisão alterada impede mutação', async () => {
  const f = fixture({ revision: 'b'.repeat(32) })
  await assert.rejects(() => movimentarCustodiaExterna(f.db as never, input, actor), /alterado/)
  assert.equal(f.writes.length, 0)
})
test('pedido entregue impede mutação', async () => {
  const f = fixture({ status: 'Entregue' })
  await assert.rejects(() => movimentarCustodiaExterna(f.db as never, input, actor), /encerrado/)
  assert.equal(f.writes.length, 0)
})

test('arquivo impede movimento mesmo com capacidade de arquivar desativada', async () => {
  const f = fixture({ archived: true })
  await assert.rejects(() => movimentarCustodiaExterna(f.db as never, input, actor), /arquivado/)
  assert.equal(f.writes.length, 0)
})
test('comando válido grava somente custódia e evento privados', async () => {
  const f = fixture()
  await movimentarCustodiaExterna(f.db as never, input, actor)
  assert.equal(f.committed(), true)
  assert.equal(f.writes.length, 2)
  assert.ok(f.writes[0].includes('INSERT INTO labgest_private.external_reception_state'))
  assert.ok(f.writes[1].includes('INSERT INTO labgest_private.external_reception_event'))
  assert.ok(f.writes.every(q => !q.includes('public.labs_externos_pedidos')))
})
test('erro de evento propaga para rollback da transação', async () => {
  const f = fixture({ eventFailure: true })
  await assert.rejects(() => movimentarCustodiaExterna(f.db as never, input, actor), /event failure/)
  assert.equal(f.committed(), false)
  assert.equal(f.writes.length, 0)
})

test('capacidade desativada bloqueia comando antes de consultar pedido', async () => {
  const f = fixture()
  const db = { async $transaction(fn: (tx: unknown) => Promise<unknown>) {
    return fn({ async $queryRaw(sql: TemplateStringsArray) {
      const q = sql.join('?')
      if (q.includes('pg_catalog.pg_class')) return [{ count: 3 }]
      if (q.includes('external_reception_capability')) return [{ schema_version: 1, enabled: false, permitted: true, full_visibility: true }]
      throw new Error('pedido must not be read')
    } })
  } }
  await assert.rejects(() => movimentarCustodiaExterna(db as never, input, actor), /indisponível/)
  assert.equal(f.writes.length, 0)
})


test('conferência no laboratório guarda estados anterior/seguinte e responsável sem alterar pedido', async () => {
  const previous = { situacao: 'aguardando_distribuicao', version: 2, dentista: 'Anterior', finalidade: 'prova' }
  const f = fixture({ previous })
  await movimentarCustodiaExterna(f.db as never, { ...input, acao: 'registrar_no_laboratorio', expectedVersion: 2 }, actor)
  assert.equal(f.committed(), true)
  assert.equal(f.writes.length, 2)
  assert.deepEqual(f.valuesWritten[1], [7, 3, 'registrar_no_laboratorio', actor.id, actor.nome,
    JSON.stringify(previous), JSON.stringify({ ...previous, situacao: 'no_laboratorio', version: 3 }), null])
  assert.ok(f.writes.every(q => !q.includes('public.labs_externos_pedidos')))
})
