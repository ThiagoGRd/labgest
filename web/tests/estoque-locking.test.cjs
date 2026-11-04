/* eslint-disable @typescript-eslint/no-require-imports -- Isolated source-executing transaction contract tests. */
const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const sourceRoot = path.join(__dirname, '../src')
// This adapter tests lock ordering, refreshed state and transactional rollback.
// It does not simulate PostgreSQL Serializable snapshots: a real manual overlap
// may reject with serialization failure, without changing stock or replaying it.
function fixture(materials = [[{ id: 1, quantidade: 20 }], [{ id: 1, quantidade: 20 }]]) {
  const items = new Map([1, 2].map(id => [id, { id, quantidade: 100, precoUnitario: 5, ativo: true, unidade: 'g' }]))
  const orders = new Map(materials.map((rows, i) => [i + 1, { id: i + 1, estoqueBaixadoEm: null, servico: { materiais: rows }, contasReceber: [], valorFinal: 100 }]))
  const ledger = [], invoices = [], lockLog = [], tails = new Map()
  let failLedger = false
  const prisma = {
    servico: { findUnique: async ({ where }) => ({ nome: 'Synthetic service', materiais: materials[where.id - 1] }) },
    async $transaction(fn, options) {
      if (options) assert.equal(options.isolationLevel, 'Serializable', 'Preserve manual movement isolation')
      const localItems = new Map(), localOrders = new Map(), localLedger = [], localInvoices = [], releases = []
      const acquired = new Set(), stockIds = []
      async function lock(kind, id) {
        const key = `${kind}:${id}`
        assert.ok(!acquired.has(key), 'Acquire each stock row once per transaction')
        if (kind === 'estoque') { assert.ok(stockIds.every(previous => previous < id), 'Stock locks must be unique and ascending'); stockIds.push(id) }
        const previous = tails.get(key) || Promise.resolve()
        tails.set(key, new Promise(resolve => releases.push(resolve)))
        await previous
        acquired.add(key)
        lockLog.push(key)
        if (kind === 'estoque' && items.has(id)) localItems.set(id, { ...items.get(id) })
        if (kind === 'ordens' && orders.has(id)) localOrders.set(id, { ...orders.get(id) })
      }
      const tx = {
        async $queryRaw(strings, ...values) {
          const sql = strings.join('?')
          const match = /^SELECT id FROM (ordens|estoque) WHERE id = \? FOR UPDATE$/.exec(sql)
          assert.ok(match, `Unexpected query: ${sql}`)
          assert.equal(values.length, 1)
          await lock(match[1], values[0])
          return [{ id: values[0] }]
        },
        ordem: {
          async findUnique({ where }) { assert.ok(acquired.has(`ordens:${where.id}`)); return localOrders.get(where.id) },
          async updateMany({ where, data }) { const order = localOrders.get(where.id); if (order.estoqueBaixadoEm) return { count: 0 }; Object.assign(order, data); return { count: 1 } },
          async update({ where, data }) { Object.assign(localOrders.get(where.id), data) },
        },
        estoque: {
          async findUnique({ where }) { assert.ok(acquired.has(`estoque:${where.id}`), 'Lock item before reading quantity'); return localItems.get(where.id) && { ...localItems.get(where.id) } },
          async update({ where, data }) { assert.ok(acquired.has(`estoque:${where.id}`)); Object.assign(localItems.get(where.id), data) },
        },
        movimentacaoEstoque: { async create({ data }) { if (failLedger) throw new Error('Injected ledger failure'); localLedger.push(data) } },
        contaReceber: { async create({ data }) { localInvoices.push(data) } },
      }
      try {
        const result = await fn(tx)
        for (const [id, item] of localItems) items.set(id, item)
        for (const [id, order] of localOrders) orders.set(id, order)
        ledger.push(...localLedger); invoices.push(...localInvoices)
        return result
      } finally { for (const release of releases) release() }
    },
  }
  function load(file) {
    const exports = {}
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, console: { error() {} }, require(name) {
      if (name === '@labgest/database') return { prisma }
      if (name === 'next/cache') return { revalidatePath() {} }
      if (name === '@/lib/auth-utils') return { requireUser: async () => ({ id: 1, nome: 'Synthetic tester' }) }
      if (name.startsWith('@/')) return load(path.join(sourceRoot, `${name.slice(2)}.ts`))
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`))
      throw new Error(`Unexpected import: ${name}`)
    } })
    return exports
  }
  const { garantirEfeitosFinalizacao } = load(path.join(sourceRoot, 'lib/finalizacao-ordem.ts'))
  const actions = load(path.join(sourceRoot, 'actions/estoque.ts'))
  return {
    items, orders, ledger, invoices, lockLog,
    finalize: id => prisma.$transaction(tx => garantirEfeitosFinalizacao(tx, id)),
    consume: id => actions.abaterEstoquePorServico(id),
    manual: (tipo = 'Saída', quantidade = 20) => actions.registrarMovimentacaoEstoque({ estoqueId: 1, tipo, quantidade, motivo: 'Synthetic movement' }),
    failLedger: value => { failLedger = value },
    consistent() {
      for (const id of items.keys()) {
        let balance = 100
        for (const movement of ledger.filter(row => row.estoqueId === id)) {
          assert.equal(movement.saldoAnterior, balance)
          balance = movement.saldoPosterior
        }
        assert.equal(items.get(id).quantidade, balance)
      }
    },
  }
}

test('distinct orders sharing one item both consume stock and preserve ledger chain', async () => {
  const f = fixture()
  await Promise.all([f.finalize(1), f.finalize(2)])
  assert.equal(f.items.get(1).quantidade, 60)
  assert.equal(f.ledger.length, 2)
  assert.equal(f.invoices.length, 2)
  f.consistent()
})
for (const operation of ['manual', 'consume']) test(`automatic consumption overlaps ${operation} without lost quantity`, async () => {
  const f = fixture()
  const results = await Promise.all([f.finalize(1), f[operation](operation === 'consume' ? 2 : undefined)])
  assert.equal(results[1].success, true)
  assert.equal(f.items.get(1).quantidade, 60)
  f.consistent()
})
test('reversed material lists lock unique IDs ascending but retain repeated ledger entries', async () => {
  const f = fixture([[{ id: 2, quantidade: 10 }, { id: 1, quantidade: 20 }, { id: 2, quantidade: 5 }], [{ id: 1, quantidade: 20 }, { id: 2, quantidade: 10 }]])
  await Promise.all([f.finalize(1), f.finalize(2)])
  assert.equal(f.items.get(1).quantidade, 60)
  assert.equal(f.items.get(2).quantidade, 75)
  assert.equal(f.ledger.length, 5)
  assert.equal(f.lockLog.filter(key => key === 'estoque:2').length, 2)
  assert.deepEqual(f.ledger.filter(row => row.ordemId === 1).map(row => row.estoqueId), [2, 1, 2])
  f.consistent()
})
test('legacy service consumption also sorts unique locks and retains repeated entries', async () => {
  const f = fixture([[{ id: 2, quantidade: 10 }, { id: 1, quantidade: 20 }, { id: 2, quantidade: 5 }]])
  assert.equal((await f.consume(1)).success, true)
  assert.deepEqual(f.lockLog, ['estoque:1', 'estoque:2'])
  assert.deepEqual(f.ledger.map(row => row.estoqueId), [2, 1, 2])
  f.consistent()
})
test('failed ledger insert rolls back stock, reservation and invoice; explicit retry can finish', async () => {
  const f = fixture()
  f.failLedger(true)
  await assert.rejects(f.finalize(1), /Injected ledger failure/)
  assert.equal(f.items.get(1).quantidade, 100)
  assert.equal(f.orders.get(1).estoqueBaixadoEm, null)
  assert.equal(f.ledger.length, 0)
  assert.equal(f.invoices.length, 0)
  f.failLedger(false)
  await f.finalize(1)
  assert.equal(f.items.get(1).quantidade, 80)
  f.consistent()
})
test('manual failure rolls back and existing negative-stock policies remain distinct', async () => {
  const f = fixture([[{ id: 1, quantidade: 120 }]])
  assert.equal((await f.manual('Saída', 120)).success, false)
  assert.equal(f.items.get(1).quantidade, 100)
  await f.finalize(1)
  assert.equal(f.items.get(1).quantidade, -20)
  f.consistent()
})
test('manual entry and adjustment record refreshed before/after balances', async () => {
  const f = fixture()
  const results = await Promise.all([f.manual('Entrada', 20), f.manual('Ajuste', 50)])
  assert.ok(results.every(result => result.success))
  assert.equal(f.items.get(1).quantidade, 50)
  f.consistent()
})
test('same order repeated finalization consumes once', async () => {
  const f = fixture()
  await Promise.all([f.finalize(1), f.finalize(1)])
  assert.equal(f.items.get(1).quantidade, 80)
  assert.equal(f.ledger.length, 1)
  f.consistent()
})
