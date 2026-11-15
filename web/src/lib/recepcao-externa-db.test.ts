import assert from 'node:assert/strict'
import test from 'node:test'
import { movimentarCustodiaExterna, concluirPedidoExterno } from './recepcao-externa-db'

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


test('entrega pela recepção altera somente situação e atualização do pedido pronto', async () => {
  const f = fixture()
  await concluirPedidoExterno(f.db as never, input)
  assert.equal(f.committed(), true)
  assert.equal(f.writes.length, 1)
  assert.match(f.writes[0], /UPDATE public\.labs_externos_pedidos/)
  assert.match(f.writes[0], /SET situacao = 'Entregue', updated_at = NOW\(\)/)
  assert.doesNotMatch(f.writes[0], /data_retorno|external_reception|finance|valor|pagamento/)
  assert.deepEqual(f.valuesWritten[0], [7])
})
for (const status of ['Enviado', 'Provando', 'Entregue']) {
  test(`entrega pela recepção recusa pedido ${status}`, async () => {
    const f = fixture({ status })
    await assert.rejects(() => concluirPedidoExterno(f.db as never, input), /pronto/)
    assert.equal(f.writes.length, 0)
  })
}
test('entrega pela recepção recusa pedido arquivado', async () => {
  const f = fixture({ archived: true })
  await assert.rejects(() => concluirPedidoExterno(f.db as never, input), /arquivado/)
  assert.equal(f.writes.length, 0)
})
test('entrega pela recepção recusa tela anterior a edição de pedido ou movimento físico', async () => {
  for (const options of [{ revision: 'b'.repeat(32) }, { previous: { situacao: 'no_laboratorio', version: 1, dentista: null, finalidade: null } }]) {
    const f = fixture(options)
    await assert.rejects(() => concluirPedidoExterno(f.db as never, input), /alterado/)
    assert.equal(f.writes.length, 0)
  }
})
test('entrega externa valida origem, identificador, revisão e versão antes de consultar', async () => {
  const db = { $transaction() { throw Error('must not query') } }
  for (const invalid of [{ origem: 'interno' }, { id: 0 }, { id: 1.1 }, { expectedRevision: 'invalid' }, { expectedVersion: -1 }, { expectedVersion: 0.5 }]) {
    await assert.rejects(() => concluirPedidoExterno(db as never, { ...input, ...invalid } as never), /Comando externo inválido/)
  }
})

// Execute the server wrapper without loading the real client or environment.
async function deliveryActionFixture(failure?: Error, authFailure = false) {
  const { readFileSync } = await import('node:fs')
  const { runInNewContext } = await import('node:vm')
  const ts = await import('typescript')
  const calls: string[] = []
  const exported: Record<string, (value: unknown) => Promise<{ success: boolean; code?: string; error?: string }>> = {}
  runInNewContext(ts.transpileModule(readFileSync('web/src/actions/recepcao-externa.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: exported, Error, require(name: string) {
    if (name === '@labgest/database') return { prisma: {} }
    if (name === 'next/cache') return { revalidatePath: (p: string) => calls.push(p) }
    if (name === '@/lib/auth-utils') return { requireRecepcao: async () => {
      calls.push('auth'); if (authFailure) throw new Error('unauthorized'); return { tipo: 'recepcao' }
    } }
    if (name === '@/lib/recepcao-externa-db') return { concluirPedidoExterno: async () => {
      calls.push('write'); if (failure) throw failure; return { success: true }
    } }
    throw new Error(`Unexpected dependency ${name}`)
  } })
  return { calls, action: exported.registrarEntregaExternaRecepcao }
}
test('entrega externa autoriza recepção antes de escrever e revalida ambas telas após sucesso', async () => {
  const f = await deliveryActionFixture()
  assert.equal((await f.action(input)).success, true)
  assert.deepEqual(f.calls, ['auth', 'write', '/recepcao', '/labs-externos'])
})
test('entrega externa não grava nem revalida se autenticação falhar', async () => {
  const f = await deliveryActionFixture(undefined, true)
  await assert.rejects(() => f.action(input), /unauthorized/)
  assert.deepEqual(f.calls, ['auth'])
})
test('entrega externa identifica conflito e oculta erros internos sem revalidar', async () => {
  const conflict = await deliveryActionFixture(new Error('O registro foi alterado. Atualize a página.'))
  const result = await conflict.action(input)
  assert.equal(result.code, 'CONFLICT')
  assert.equal(result.error, 'O registro foi alterado. Atualize a página.')
  assert.deepEqual(conflict.calls, ['auth', 'write'])
  const hidden = await deliveryActionFixture(new Error('database private connection details'))
  assert.doesNotMatch((await hidden.action(input)).error || '', /private|database/)
})
