/* eslint-disable @typescript-eslint/no-require-imports */
// PREPARED, not executed in cloud. Requires a clean generated @prisma/client and
// externally provisioned schema from packages/database/prisma/schema.prisma.
// node web/tests/prisma-finance.integration.cjs 'postgresql://USER:PASS@127.0.0.1:5432/labgest_finance_test?schema=labgest_prisma_test'
// No dotenv, app DB module, migrations, schema setup or destructive cleanup.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
assert.equal(url.pathname, '/labgest_finance_test')
assert.equal(url.searchParams.get('schema'), 'labgest_prisma_test')
assert.ok([...url.searchParams.keys()].every(key => key === 'schema'), 'No URL overrides allowed')
url.searchParams.set('connection_limit', '8')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient({ datasources: { db: { url: url.href } } })
let actor
function load(relative) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relative), 'utf8')
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Date, console,
    require(name) {
      if (name === '@labgest/database') return { Prisma, prisma }
      if (name === '@/lib/auth-utils') return { requireUser: async () => actor }
      if (name === 'next/cache') return { revalidatePath() {} }
      if (name.startsWith('@/lib/')) return load(`${name.slice(2)}.ts`)
      if (name === 'zod' || name === 'node:crypto') return require(name)
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return exports
}
const actions = load('actions/financeiro.ts')
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
// Hold the same row with a REAL Prisma interactive transaction until both action
// transactions are observed waiting in PostgreSQL, then let them serialize.
async function overlap(table, id, first, second) {
  assert.ok(['contas_receber', 'contas_pagar', 'ordens'].includes(table))
  const locked = deferred(), release = deferred()
  const blocker = prisma.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, id)
    locked.resolve()
    await release.promise
  }, { timeout: 10000 })
  await Promise.race([locked.promise, blocker])
  const a = first(), b = second()
  try {
    let waiting = false
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const rows = await prisma.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM %FOR UPDATE'`
      if (rows[0].count >= 2) { waiting = true; break }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.ok(waiting, 'Both action transactions must wait for the real PostgreSQL row lock')
  } finally { release.resolve(); await blocker }
  return Promise.all([a, b])
}
async function check(tipo, id) {
  const receive = tipo === 'receber'
  const account = await (receive ? prisma.contaReceber : prisma.contaPagar).findUnique({ where: { id } })
  const movements = await prisma.movimentacaoFinanceira.findMany({ where: receive ? { contaReceberId: id } : { contaPagarId: id } })
  const balance = Number(receive ? account.valorRecebido : account.valorPago)
  assert.equal(balance, movements.filter(m => !m.estornadaEm).reduce((total, m) => total + Number(m.valor), 0))
  assert.ok(balance <= Number(account.valor))
  if (account.status === 'Cancelado') assert.equal(balance, 0)
  return { account, movements, balance }
}
async function main() {
  try {
    assert.equal((await prisma.$queryRaw`SELECT current_database() AS db, current_schema() AS schema`)[0].db, 'labgest_finance_test')
    assert.equal((await prisma.$queryRaw`SELECT current_schema() AS schema`)[0].schema, 'labgest_prisma_test')
    for (const model of ['usuario', 'cliente', 'ordem', 'contaReceber', 'contaPagar', 'contaFinanceira', 'movimentacaoFinanceira']) {
      assert.equal(await prisma[model].count(), 0, `Refuse populated test model ${model}`)
    }
    actor = await prisma.usuario.create({ data: { nome: 'Synthetic finance tester', email: 'finance@example.test', senha: 'synthetic-not-a-login' } })
    for (const tipo of ['receber', 'pagar']) {
      const model = tipo === 'receber' ? prisma.contaReceber : prisma.contaPagar
      for (const scenario of ['double', 'cancel']) {
        const account = await model.create({ data: { descricao: `Synthetic ${tipo} ${scenario}`, valor: 100, dataVencimento: new Date('2026-11-04T12:00:00Z') } })
        const pay = () => actions.liquidarConta({ id: account.id, tipo, valor: 80, data: '2026-11-04', formaPagamento: 'Pix' })
        const results = await overlap(`contas_${tipo}`, account.id, pay, scenario === 'double' ? pay : () => actions.cancelarConta(account.id, tipo, 'Synthetic cancellation'))
        assert.equal(results.filter(r => r.success).length, 1)
        const state = await check(tipo, account.id)
        if (scenario === 'double') { assert.equal(state.balance, 80); assert.equal(state.movements.length, 1) }
        console.log(`PASS real Prisma ${tipo}: ${scenario}`)
      }
    }
    const order = await prisma.ordem.create({ data: { clienteNome: 'Synthetic clinic', servicoNome: 'Synthetic service', nomePaciente: 'Synthetic patient', valor: 100, valorFinal: 100, status: 'Finalizado', dataEntrega: new Date('2026-11-04T12:00:00Z'), dataFinalizacao: new Date('2026-11-04T12:00:00Z') } })
    const generated = await overlap('ordens', order.id, () => actions.gerarCobrancaAutomatica(order.id), () => actions.gerarCobrancaAutomatica(order.id))
    assert.equal(generated.filter(r => r.success).length, 1)
    assert.equal(await prisma.contaReceber.count({ where: { ordemId: order.id } }), 1)
    console.log('PASS real Prisma automatic invoice generation')
    console.log('Synthetic rows retained for inspection; externally discard disposable schema after review.')
  } finally { await prisma.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
