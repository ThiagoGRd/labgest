/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node CommonJS test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
function service() {
  const filename = path.join(__dirname, '../src/lib/labs-externos-arquivo.ts')
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports }, { filename })
  return exports
}
function fixture({ installed = true, enabled = true, permitted = true, failAudit = false, marker = true, schemaVersion = 1, fullVisibility = true } = {}) {
  const state = { archive: null, events: [], committed: 0 }
  const order = { id: 10, situacao: 'Entregue', paciente: 'Paciente fictício', updated_at: '2026-11-04 10:00:00.123456' }
  const revision = 'a'.repeat(32)
  function queries(target) {
    return {
      async $queryRaw(strings) {
        const sql = strings.join('?')
        if (sql.includes('pg_catalog.pg_class')) return [{ installed }]
        if (sql.includes('external_order_archive_capability')) return marker ? [{ enabled, schema_version: schemaVersion, permitted, full_visibility: fullVisibility }] : []
        if (sql.includes('FOR UPDATE')) return [{ snapshot: { ...order }, revisao: revision }]
        if (sql.includes('external_order_archive')) return fullVisibility && target.archive ? [target.archive] : []
        throw new Error(`Unexpected SQL: ${sql}`)
      },
      async $executeRaw(strings, ...values) {
        const sql = strings.join('?')
        if (sql.includes('INSERT INTO labgest_private.external_order_archive_event')) {
          if (failAudit) throw new Error('Simulated audit failure')
          target.events.push(values)
        } else if (sql.includes('INSERT INTO labgest_private.external_order_archive')) {
          target.archive = { pedido_id: values[0], archived: values[1], version: values[2] }
        } else throw new Error(`Unexpected mutation: ${sql}`)
        return 1
      },
    }
  }
  const db = {
    ...queries(state),
    async $transaction(fn) {
      const draft = structuredClone(state)
      const result = await fn(queries(draft))
      Object.assign(state, draft, { committed: state.committed + 1 })
      return result
    },
  }
  const input = { id: 10, action: 'archive', expectedRevision: revision, expectedVersion: 0, reason: 'Registro duplicado conferido', confirmed: true, review: { financial: 'clear', stock: 'clear', externalCommitment: 'clear' } }
  return { db, state, input, order }
}
const actor = { id: 4, nome: 'Administrador teste' }

test('absent migration and disabled capability refuse without writes', async () => {
  for (const options of [{ installed: false }, { enabled: false }, { permitted: false }]) {
    const f = fixture(options)
    await assert.rejects(service().alterarArquivamento(f.db, f.input, actor), /indisponível/)
    assert.equal(f.state.archive, null)
    assert.equal(f.state.events.length, 0)
  }
})

test('delivered record archives and restores without changing clinical data', async () => {
  const f = fixture()
  const original = structuredClone(f.order)
  await service().alterarArquivamento(f.db, f.input, actor)
  assert.equal(f.state.archive.archived, true)
  assert.equal(f.state.archive.version, 1)
  assert.equal(f.state.events.length, 1)
  assert.equal(f.state.events[0][3], actor.id)
  assert.equal(f.state.events[0][4], actor.nome)
  assert.equal(f.state.events[0][5], f.input.reason)
  assert.equal(JSON.parse(f.state.events[0][6]).updated_at, '2026-11-04 10:00:00.123456')
  assert.deepEqual(JSON.parse(f.state.events[0][7]), f.input.review)
  assert.deepEqual(f.order, original)
  await service().alterarArquivamento(f.db, { ...f.input, action: 'restore', expectedVersion: 1, reason: 'Arquivamento por engano' }, actor)
  assert.equal(f.state.archive.archived, false)
  assert.equal(f.state.archive.version, 2)
  assert.equal(f.state.events.length, 2)
  assert.deepEqual(f.order, original)
})

test('audit failure rolls back the archive state', async () => {
  const f = fixture({ failAudit: true })
  await assert.rejects(service().alterarArquivamento(f.db, f.input, actor), /audit failure/)
  assert.equal(f.state.archive, null)
  assert.equal(f.state.events.length, 0)
  assert.equal(f.state.committed, 0)
})

test('repeated archive and restore requests do not add events', async () => {
  const f = fixture()
  const api = service()
  await api.alterarArquivamento(f.db, f.input, actor)
  await api.alterarArquivamento(f.db, f.input, actor)
  assert.equal(f.state.events.length, 1)
  const restore = { ...f.input, action: 'restore', expectedVersion: 1 }
  await api.alterarArquivamento(f.db, restore, actor)
  await api.alterarArquivamento(f.db, restore, actor)
  assert.equal(f.state.events.length, 2)
})

test('stale exact row revision or archive version requires refresh', async () => {
  const f = fixture()
  const api = service()
  await assert.rejects(api.alterarArquivamento(f.db, { ...f.input, expectedRevision: 'b'.repeat(32) }, actor), /alterado/)
  await api.alterarArquivamento(f.db, f.input, actor)
  await assert.rejects(api.alterarArquivamento(f.db, { ...f.input, action: 'restore', expectedVersion: 0 }, actor), /alterado/)
  assert.equal(f.state.archive.archived, true)
  assert.equal(f.state.events.length, 1)
})

test('pending or unknown reconciliation, missing confirmation and short reason block archive', async () => {
  for (const patch of [
    { review: { financial: 'pending', stock: 'clear', externalCommitment: 'clear' } },
    { review: { financial: 'clear', stock: 'unknown', externalCommitment: 'clear' } },
    { review: { financial: 'clear', stock: 'clear', externalCommitment: 'unknown' } },
    { confirmed: false }, { reason: 'x' }, { id: -1 },
  ]) {
    const f = fixture()
    await assert.rejects(service().alterarArquivamento(f.db, { ...f.input, ...patch }, actor))
    assert.equal(f.state.archive, null)
    assert.equal(f.state.events.length, 0)
  }
})

function actions(db, { admin = true } = {}) {
  let revalidated = 0
  const user = { ...actor, tipo: admin ? 'admin' : 'operador', permissoes: [] }
  const dependencies = {
    '@labgest/database': { prisma: db },
    'next/cache': { revalidatePath() { revalidated++ } },
    zod: require('zod'),
    '@/lib/auth-utils': {
      requireUser: async () => user,
      requireAdmin: async () => { if (!admin) throw new Error('Acesso restrito a administradores'); return user },
    },
    '@/lib/labs-externos-arquivo': service(),
    '@/lib/labs-externos-utils': { hojeIso: () => '2026-11-04' },
  }
  const filename = path.join(__dirname, '../src/actions/labs-externos.ts')
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, Error, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unmocked import: ${name}`)
    return dependencies[name]
  } }, { filename })
  return { api: exports, revalidations: () => revalidated }
}

test('server action authorizes administrators before invoking the transaction', async () => {
  const f = fixture()
  const { api } = actions(f.db, { admin: false })
  await assert.rejects(api.alterarArquivoPedido(f.input), /administradores/)
  assert.equal(f.state.committed, 0)
  assert.equal(f.state.events.length, 0)
})

test('server action only revalidates after an atomic successful commit', async () => {
  const f = fixture()
  const action = actions(f.db)
  const result = await action.api.alterarArquivoPedido(f.input)
  assert.equal(result.success, true)
  assert.equal(f.state.events.length, 1)
  assert.equal(action.revalidations(), 2, 'external lab and reception caches are invalidated')
  const failed = fixture({ failAudit: true })
  const failureAction = actions(failed.db)
  const failure = await failureAction.api.alterarArquivoPedido(failed.input)
  assert.equal(failure.success, false)
  assert.equal(failed.state.archive, null)
  assert.equal(failureAction.revalidations(), 0)
})

test('direct server call fails closed without migration even with forged confirmation', async () => {
  const f = fixture({ installed: false })
  const action = actions(f.db)
  const result = await action.api.alterarArquivoPedido(f.input)
  assert.equal(result.success, false)
  assert.equal(f.state.events.length, 0)
  assert.equal(await action.api.getArquivamentoDisponivel(), false)
})

test('archived records leave active lists, late lists, rework and dashboard even when capability is disabled', async () => {
  const f = fixture({ enabled: false })
  f.state.archive = { pedido_id: 10, archived: true, version: 1 }
  const query = f.db.$queryRaw
  f.db.$queryRaw = async (strings, ...values) => {
    if (strings.join('?').includes('FROM labs_externos_pedidos p')) return [
      { id: 10, lab_nome: 'Lab fictício', paciente: 'Paciente fictício', situacao: 'Enviado', is_retrabalho: true, dias_atraso: 10, created_at: new Date(), revisao: 'a'.repeat(32) },
      { id: 11, lab_nome: 'Lab fictício', paciente: 'Outra peça', situacao: 'Pronto', is_retrabalho: false, dias_atraso: null, created_at: new Date(), revisao: 'b'.repeat(32) },
    ]
    return query(strings, ...values)
  }
  const { api } = actions(f.db)
  assert.equal((await api.getPedidosLabExterno()).length, 1)
  assert.equal((await api.getPedidosLabExterno(undefined, true))[0].id, 10)
  assert.equal((await api.getAtrasados()).length, 0)
  assert.equal((await api.getRetrabalhos()).length, 0)
  const stats = await api.getDashboardLabsExternos()
  assert.equal(stats.total_enviados, 0)
  assert.equal(stats.total_prontos, 1)
  assert.equal(stats.total_atrasados, 0)
  assert.equal(stats.total_retrabalhos, 0)
})

test('partial schema or lost read permission cannot silently expose archived data as active', async () => {
  const f = fixture()
  const query = f.db.$queryRaw
  f.db.$queryRaw = async (strings, ...values) => {
    if (strings.join('?').includes('external_order_archive_capability')) throw new Error('permission denied')
    return query(strings, ...values)
  }
  await assert.rejects(service().estadosArquivamento(f.db), /permission denied/)
})

test('restoring a never-archived record is refused without events', async () => {
  const f = fixture()
  await assert.rejects(service().alterarArquivamento(f.db, { ...f.input, action: 'restore' }, actor), /não está arquivado/)
  assert.equal(f.state.events.length, 0)
})

for (const [label, options] of [
  ['absent marker', { marker: false }],
  ['wrong schema marker', { schemaVersion: 2 }],
  ['ACL-permitted but RLS-invisible role', { permitted: true, fullVisibility: false }],
]) {
  test(`installed storage rejects ${label} instead of presenting archived rows as active`, async () => {
    const f = fixture(options)
    f.state.archive = { pedido_id: 10, archived: true, version: 1 }
    await assert.rejects(service().capacidadeArquivamento(f.db), /visibilidade|marcador/)
    await assert.rejects(service().estadosArquivamento(f.db), /visibilidade|marcador/)
    await assert.rejects(service().alterarArquivamento(f.db, f.input, actor), /visibilidade|marcador/)
    assert.equal(f.state.archive.archived, true)
    assert.equal(f.state.events.length, 0)
  })
}

test('a valid disabled marker with complete visibility still reads existing archive state', async () => {
  const f = fixture({ enabled: false })
  f.state.archive = { pedido_id: 10, archived: true, version: 1 }
  const result = await service().estadosArquivamento(f.db)
  assert.equal(result.enabled, false)
  assert.equal(result.states.length, 1)
  assert.equal(result.states[0].archived, true)
})
