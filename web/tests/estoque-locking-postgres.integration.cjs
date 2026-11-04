/* eslint-disable @typescript-eslint/no-require-imports -- Standalone synthetic PostgreSQL regression runner. */
// PREPARED, not executed in cloud. Requires external pg + typescript only.
// node web/tests/estoque-locking-postgres.integration.cjs 'postgresql://USER:PASS@127.0.0.1:5432/labgest_stock_test'
// Uses actual PostgreSQL locks/isolation/rollback with a Prisma-shaped adapter,
// NOT a generated Prisma client. Never loads dotenv or application DB modules.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { Pool } = require('pg')
const { lookup } = require('node:dns/promises')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
assert.equal(url.pathname, '/labgest_stock_test', 'Disposable synthetic database required')
assert.equal(url.search, '', 'Connection overrides are not allowed')
assert.equal(url.hash, '', 'URL fragments are forbidden')
let pool
const schema = `stock_lock_${process.pid}`
const sourceRoot = path.join(__dirname, '../src')
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
let firstStockLock, releaseStock, pauseStock = false, stockLocks = 0, failLedger = false
function statement(strings, values) { return { text: strings.reduce((sql, part, i) => sql + (i ? `$${i}` : '') + part, ''), values } }
function table(client, name) {
  return {
    async findUnique({ where }) { return (await client.query(`SELECT payload FROM ${name} WHERE id=$1`, [where.id])).rows[0]?.payload },
    async update({ where, data }) { return (await client.query(`UPDATE ${name} SET payload=payload || $2::jsonb WHERE id=$1 RETURNING payload`, [where.id, JSON.stringify(data)])).rows[0]?.payload },
  }
}
const prisma = {
  servico: { async findUnique({ where }) { return (await pool.query(`SELECT payload FROM ${schema}.servicos WHERE id=$1`, [where.id])).rows[0]?.payload } },
  async $transaction(fn, options) {
    const client = await pool.connect()
    try {
      assert.ok(!options || options.isolationLevel === 'Serializable')
      await client.query(options ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN')
      await client.query(`SET LOCAL search_path TO ${schema}`)
      await client.query("SET LOCAL statement_timeout TO '7000ms'")
      const tx = {
        async $queryRaw(strings, ...values) {
          const sql = statement(strings, values)
          const rows = (await client.query(sql)).rows
          if (sql.text.startsWith('SELECT id FROM estoque') && ++stockLocks === 1 && pauseStock) {
            firstStockLock.resolve()
            await releaseStock.promise
          }
          return rows
        },
        ordem: {
          ...table(client, 'ordens'),
          async findUnique({ where }) {
            const order = await table(client, 'ordens').findUnique({ where })
            if (!order) return null
            const invoices = (await client.query("SELECT payload FROM invoices WHERE payload->>'ordemId'=$1", [String(where.id)])).rows.map(row => row.payload)
            return { ...order, contasReceber: invoices }
          },
          async updateMany({ where, data }) {
            return { count: (await client.query("UPDATE ordens SET payload=payload || $2::jsonb WHERE id=$1 AND payload->>'estoqueBaixadoEm' IS NULL", [where.id, JSON.stringify(data)])).rowCount }
          },
        },
        estoque: table(client, 'estoque'),
        movimentacaoEstoque: { async create({ data }) {
          if (failLedger) throw new Error('Injected ledger failure')
          await client.query('INSERT INTO ledger(payload) VALUES($1)', [JSON.stringify(data)])
        } },
        contaReceber: { async create({ data }) { await client.query('INSERT INTO invoices(payload) VALUES($1)', [JSON.stringify(data)]) } },
      }
      const result = await fn(tx)
      await client.query('COMMIT')
      return result
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
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
    throw new Error(`Unexpected import ${name}`)
  } })
  return exports
}
const { garantirEfeitosFinalizacao } = load(path.join(sourceRoot, 'lib/finalizacao-ordem.ts'))
const actions = load(path.join(sourceRoot, 'actions/estoque.ts'))
const finalize = id => prisma.$transaction(tx => garantirEfeitosFinalizacao(tx, id))
const manual = (quantidade = 20) => actions.registrarMovimentacaoEstoque({ estoqueId: 1, tipo: 'Saída', quantidade, motivo: 'Synthetic manual consumption' })
async function seed(materials = [[{ id: 1, quantidade: 20 }], [{ id: 1, quantidade: 20 }]]) {
  pauseStock = false; failLedger = false
  await pool.query(`TRUNCATE ${schema}.estoque, ${schema}.ordens, ${schema}.servicos, ${schema}.ledger, ${schema}.invoices RESTART IDENTITY`)
  for (const id of [1, 2]) await pool.query(`INSERT INTO ${schema}.estoque VALUES($1,$2)`, [id, JSON.stringify({ id, quantidade: 100, precoUnitario: 5, ativo: true, unidade: 'g' })])
  for (const [index, rows] of materials.entries()) {
    await pool.query(`INSERT INTO ${schema}.ordens VALUES($1,$2)`, [index + 1, JSON.stringify({ id: index + 1, estoqueBaixadoEm: null, servico: { materiais: rows }, valorFinal: 100 })])
    await pool.query(`INSERT INTO ${schema}.servicos VALUES($1,$2)`, [index + 1, JSON.stringify({ nome: 'Synthetic service', materiais: rows })])
  }
}
async function concurrent(first, second) {
  stockLocks = 0; pauseStock = true; firstStockLock = deferred(); releaseStock = deferred()
  const a = first()
  let b
  try {
    await Promise.race([firstStockLock.promise, a.then(() => { throw new Error('First operation never locked stock') })])
    b = second()
    let waiting = false
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const rows = (await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM %FOR UPDATE' LIMIT 1", [schema])).rows
      if (rows.length) { waiting = true; break }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.ok(waiting, 'Second operation must actually wait for a PostgreSQL row lock')
  } finally { releaseStock.resolve(); pauseStock = false }
  return Promise.all([a, b])
}
async function state() {
  const items = (await pool.query(`SELECT id,payload FROM ${schema}.estoque ORDER BY id`)).rows
  const ledger = (await pool.query(`SELECT payload FROM ${schema}.ledger ORDER BY id`)).rows.map(row => row.payload)
  for (const item of items) {
    let balance = 100
    for (const entry of ledger.filter(row => row.estoqueId === item.id)) { assert.equal(entry.saldoAnterior, balance); balance = entry.saldoPosterior }
    assert.equal(item.payload.quantidade, balance)
  }
  return { items: items.map(row => row.payload), ledger }
}
async function main() {
  let created = false
  try {
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), { all: true })
    assert.ok(addresses.length && addresses.every(row => row.address === '127.0.0.1' || row.address === '::1'), 'All resolved addresses must be loopback')
    pool = new Pool({ host: addresses[0].address, port: Number(url.port || 5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'labgest_stock_test', ssl: false, application_name: schema, max: 6, connectionTimeoutMillis: 3000 })
    const target = (await pool.query('SELECT current_database() AS db, inet_server_addr()::text AS address')).rows[0]
    assert.equal(target.db, 'labgest_stock_test')
    assert.ok(['127.0.0.1', '::1'].includes(target.address))
    await pool.query(`CREATE SCHEMA ${schema}`); created = true
    for (const name of ['estoque', 'ordens', 'servicos']) await pool.query(`CREATE TABLE ${schema}.${name}(id integer PRIMARY KEY,payload jsonb NOT NULL)`)
    for (const name of ['ledger', 'invoices']) await pool.query(`CREATE TABLE ${schema}.${name}(id serial PRIMARY KEY,payload jsonb NOT NULL)`)
    await seed()
    await concurrent(() => finalize(1), () => finalize(2))
    assert.equal((await state()).items[0].quantidade, 60)
    console.log('PASS distinct orders: 100 - 20 - 20 = 60 with coherent ledger')

    await seed()
    const overlap = await concurrent(() => finalize(1), () => manual())
    const afterManual = await state()
    assert.equal(afterManual.items[0].quantidade, overlap[1].success ? 60 : 80)
    assert.equal(afterManual.ledger.length, overlap[1].success ? 2 : 1)
    if (!overlap[1].success) assert.match(overlap[1].error, /serializ/i)
    console.log(`PASS automatic/manual: ${overlap[1].success ? 'both committed' : 'manual serialization rejection rolled back'}, no replay`)

    await seed()
    const legacy = await concurrent(() => finalize(1), () => actions.abaterEstoquePorServico(2))
    assert.equal(legacy[1].success, true)
    assert.equal((await state()).items[0].quantidade, 60)
    console.log('PASS automatic/legacy service consumption')

    await seed([[{ id: 2, quantidade: 10 }, { id: 1, quantidade: 20 }, { id: 2, quantidade: 5 }], [{ id: 1, quantidade: 20 }, { id: 2, quantidade: 10 }]])
    await concurrent(() => finalize(1), () => finalize(2))
    const repeated = await state()
    assert.deepEqual(repeated.items.map(item => item.quantidade), [60, 75])
    assert.deepEqual(repeated.ledger.filter(row => row.ordemId === 1).map(row => row.estoqueId), [2, 1, 2])
    console.log('PASS reversed lists/repeated IDs: no deadlock, separate ordered ledger entries')

    await seed()
    failLedger = true
    await assert.rejects(finalize(1), /Injected ledger failure/)
    assert.equal((await state()).items[0].quantidade, 100)
    const rolledBack = (await pool.query(`SELECT payload FROM ${schema}.ordens WHERE id=1`)).rows[0].payload
    assert.equal(rolledBack.estoqueBaixadoEm, null)
    assert.equal(Number((await pool.query(`SELECT count(*) FROM ${schema}.invoices`)).rows[0].count), 0)
    failLedger = false
    await finalize(1)
    assert.equal((await state()).items[0].quantidade, 80)
    console.log('PASS failed ledger rollback restores quantity/order reservation and prevents invoice')

    await seed([[{ id: 1, quantidade: 120 }]])
    const insufficient = await manual(120)
    assert.equal(insufficient.success, false)
    assert.equal(insufficient.error, 'Saldo insuficiente. Disponível: 100 g')
    assert.equal((await state()).items[0].quantidade, 100)
    await finalize(1)
    assert.equal((await state()).items[0].quantidade, -20)
    console.log('PASS existing manual/automatic negative-stock policies preserved')

    await seed()
    await concurrent(() => finalize(1), () => finalize(1))
    assert.equal((await state()).items[0].quantidade, 80)
    console.log('PASS repeated same-order finalization consumes once')
  } finally {
    releaseStock?.resolve()
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool?.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
