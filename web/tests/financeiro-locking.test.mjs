import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = readFileSync(new URL('../src/actions/financeiro.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

// Source-executing contract test. The transaction adapter enforces account-first
// locking and models queued row locks; PostgreSQL behavior needs integration tests.
function fixture(tipo, initial = 0) {
  const field = tipo === 'receber' ? 'valorRecebido' : 'valorPago'
  const foreignKey = tipo === 'receber' ? 'contaReceberId' : 'contaPagarId'
  let account = { id: 1, valor: 100, [field]: initial, status: initial ? 'Parcial' : 'Pendente' }
  let movements = initial ? [{ valor: initial, [foreignKey]: 1, estornadaEm: null }] : []
  let queue = Promise.resolve()
  let locks = 0
  const updates = []
  const prisma = { async $transaction(fn) {
    let release
    let locked = false
    let localAccount, localMovements
    const check = () => assert.ok(locked, 'account must be locked before reading/writing financial state')
    const table = {
      async findUnique() { check(); await Promise.resolve(); return { ...localAccount } },
      async update({ data }) { check(); updates.push({ ...data }); Object.assign(localAccount, data); return { ...localAccount } },
    }
    const tx = {
      async $queryRaw(strings, ...values) {
        assert.equal(strings.join('?'), `SELECT id FROM contas_${tipo} WHERE id = ? FOR UPDATE`)
        assert.deepEqual(values, [1])
        assert.equal(locked, false)
        const previous = queue
        queue = new Promise(resolve => { release = resolve })
        await previous
        locked = true; locks++
        localAccount = { ...account }
        localMovements = movements.map(m => ({ ...m }))
        return [{ id: 1 }]
      },
      contaReceber: table, contaPagar: table,
      contaFinanceira: { async findFirst() { check(); return { id: 1 } } },
      movimentacaoFinanceira: {
        async create({ data }) { check(); localMovements.push({ ...data, estornadaEm: null }) },
        async updateMany({ where, data }) { check(); for (const m of localMovements) if (m[foreignKey] === where[foreignKey] && m.estornadaEm === null) Object.assign(m, data) },
      },
    }
    try {
      const result = await fn(tx)
      account = localAccount; movements = localMovements
      return result
    } finally { if (locked) release() }
  } }
  const exports = {}
  runInNewContext(code, { exports, Date, console: { error() {} }, require(name) {
    if (name === '@labgest/database') return { prisma, Prisma: { PrismaClientKnownRequestError: class extends Error {} } }
    if (name === 'next/cache') return { revalidatePath() {} }
    if (name === '@/lib/auth-utils') return { requireUser: async () => ({ id: 1, nome: 'Synthetic operator' }) }
    if (name === '@/lib/date-utils') return { parseDateLocal: date => new Date(`${date}T12:00:00Z`) }
    if (name.startsWith('@/lib/')) return {}
    if (name === 'node:crypto' || name === 'zod') return require(name)
    throw new Error(`Unexpected import ${name}`)
  } })
  return {
    pay: (valor = 80) => exports.liquidarConta({ id: 1, tipo, valor, data: '2026-11-04', formaPagamento: 'Pix' }),
    cancel: (reason = 'Synthetic cancellation') => exports.cancelarConta(1, tipo, reason),
    reverse: () => exports.estornarBaixa(1, tipo, 'Synthetic reversal'),
    edit: () => exports.editarConta(1, tipo, { descricao: 'Synthetic account', valor: 50, vencimento: '2026-11-04' }),
    state: () => ({ account, movements, locks, updates }),
    consistent() {
      assert.equal(account[field], movements.filter(m => !m.estornadaEm).reduce((sum, m) => sum + m.valor, 0))
      assert.ok(account[field] <= account.valor)
      if (account.status === 'Cancelado') assert.equal(account[field], 0)
    },
  }
}

for (const tipo of ['receber', 'pagar']) {
  for (const concurrent of [false, true]) test(`${tipo}: ${concurrent ? 'concurrent' : 'sequential'} repeated cancellation preserves first audit`, async () => {
    const f = fixture(tipo)
    const first = f.cancel('First cancellation reason')
    const results = concurrent
      ? await Promise.all([first, f.cancel('Second cancellation reason')])
      : [await first, await f.cancel('Second cancellation reason')]
    assert.equal(results[0].success, true)
    assert.equal(results[1].success, false)
    assert.equal(results[1].error, 'Esta conta já está cancelada.')
    const { account, updates, locks, movements } = f.state()
    assert.equal(locks, 2)
    assert.equal(updates.length, 1, 'The repeated request must not update any audit field')
    assert.equal(account.motivoCancelamento, 'First cancellation reason')
    assert.equal(account.canceladoPor, updates[0].canceladoPor)
    assert.equal(account.canceladoEm, updates[0].canceladoEm)
    assert.equal(account.status, 'Cancelado')
    assert.equal(movements.length, 0)
    f.consistent()
  })
  test(`${tipo}: simultaneous 80 + 80 on 100 accepts one settlement`, async () => {
    const f = fixture(tipo)
    const results = await Promise.all([f.pay(), f.pay()])
    assert.equal(results.filter(r => r.success).length, 1)
    assert.equal(f.state().movements.length, 1)
    assert.equal(f.state().locks, 2)
    f.consistent()
  })
  for (const first of ['pay', 'cancel']) test(`${tipo}: settlement/cancellation, ${first} first`, async () => {
    const f = fixture(tipo)
    const second = first === 'pay' ? 'cancel' : 'pay'
    const results = await Promise.all([f[first](), f[second]()])
    assert.equal(results[0].success, true)
    assert.equal(results[1].success, false)
    if (first === 'cancel') assert.equal(f.state().account.canceladoPor, 'Synthetic operator')
    f.consistent()
  })
  for (const first of ['pay', 'reverse']) test(`${tipo}: reversal/settlement, ${first} first`, async () => {
    const f = fixture(tipo, 20)
    const second = first === 'pay' ? 'reverse' : 'pay'
    const results = await Promise.all([f[first](), f[second]()])
    assert.ok(results.every(r => r.success))
    const reversed = f.state().movements.filter(m => m.estornadaEm)
    assert.equal(reversed.length, first === 'pay' ? 2 : 1)
    assert.ok(reversed.every(m => m.estornadaPor === 'Synthetic operator' && m.motivoEstorno === 'Synthetic reversal'))
    f.consistent()
  })
  for (const first of ['pay', 'edit']) test(`${tipo}: edit/settlement, ${first} first`, async () => {
    const f = fixture(tipo)
    const second = first === 'pay' ? 'edit' : 'pay'
    const results = await Promise.all([f[first](), f[second]()])
    assert.equal(results[0].success, true)
    assert.equal(results[1].success, false)
    f.consistent()
  })
}

test('automatic generation serializes order checks and bulk recovery cannot insert', async () => {
  let queue = Promise.resolve()
  const invoices = []
  const prisma = { async $transaction(fn) {
    let release
    let locked = false
    try { return await fn({
      async $queryRaw(strings, ...values) {
        assert.ok(['SELECT id FROM ordens WHERE id = ? FOR UPDATE', 'SELECT id FROM ordens WHERE id = ? AND cliente_id = ? FOR UPDATE'].includes(strings.join('?')))
        assert.deepEqual(values, strings.length === 3 ? [1, 1] : [1])
        const previous = queue
        queue = new Promise(resolve => { release = resolve })
        await previous
        locked = true
        return [{ id: 1 }]
      },
      cliente: { findFirst: async () => ({ id: 1 }) },
      ordem: {
        async findUnique() { assert.ok(locked); return { id: 1, valorFinal: 100, dataFinalizacao: new Date('2026-11-04'), servicoNome: 'Synthetic', nomePaciente: 'Synthetic' } },
        async findFirst() { assert.ok(locked); return { id: 1, clienteId: 1, valorFinal: 100, contasReceber: [...invoices], historicoEtapas: [] } },
        async update() { assert.ok(locked); return {} },
      },
      contaReceber: {
        async findFirst() { assert.ok(locked); return invoices[0] },
        async create({ data }) { assert.ok(locked); invoices.push(data) },
      },
    }) } finally { if (locked) release() }
  } }
  const exports = {}
  runInNewContext(code, { exports, Date, console, require(name) {
    if (name === '@labgest/database') return { prisma }
    if (name === 'next/cache') return { revalidatePath() {} }
    if (name === '@/lib/auth-utils') return { requireUser: async () => ({ id: 1 }) }
    if (name.startsWith('@/lib/')) return {}
    return require(name)
  } })
  const results = await Promise.all([exports.gerarCobrancaAutomatica(1), exports.gerarCobrancaAutomatica(1)])
  assert.equal(results.filter(r => r.success).length, 1)
  assert.equal(invoices.length, 1)
  assert.equal((await exports.sincronizarFinanceiroRetroativo()).success, false)
  assert.equal(invoices.length, 1)
  const clinic = {}
  const clinicCode = ts.transpileModule(readFileSync(new URL('../../portal/src/actions/workflow-protese.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  runInNewContext(clinicCode, { exports: clinic, Date, require(name) {
    if (name === '@labgest/database') return { prisma }
    if (name === 'next/cache') return { revalidatePath() {} }
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'clinic@example.test' } } }) } }) }
    if (name === '@/lib/workflow-config') return { isTipoProtese: () => true, getPassoProtese: () => ({ responsavel: 'clinica', entregaFinal: true, nome: 'Synthetic delivery' }) }
    throw new Error(`Unexpected clinic import ${name}`)
  } })
  for (const first of ['web', 'clinic']) {
    invoices.length = 0
    const web = () => exports.gerarCobrancaAutomatica(1)
    const portal = () => clinic.concluirEtapaClinica(1)
    await Promise.all(first === 'web' ? [web(), portal()] : [portal(), web()])
    assert.equal(invoices.length, 1, `${first} first must not produce duplicate cross-app invoices`)
  }

})
