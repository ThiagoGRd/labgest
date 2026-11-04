/* eslint-disable @typescript-eslint/no-require-imports */
// Usage: NODE_PATH=<tooling>/node_modules node this-file postgres://.../labgest_finance_test
// Source-executing PostgreSQL lock regression. Requires externally provided pg +
// typescript + zod, never imports application DB configuration or dotenv.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { Pool } = require('pg')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
assert.equal(url.pathname, '/labgest_finance_test', 'Disposable synthetic DB only')
const pool = new Pool({ connectionString: url.href, max: 5 })
const schema = `finance_lock_${process.pid}`
const source = fs.readFileSync(path.join(__dirname, '../src/actions/financeiro.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const query = (strings, values) => ({ text: strings.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), values })
let pauseFirst
let firstLocked
let releaseFirst
let lockCount = 0
function table(client, name) {
  return {
    async findUnique({ where }) { return (await client.query(`SELECT payload FROM ${name} WHERE id=$1`, [where.id])).rows[0]?.payload },
    async update({ where, data }) { return (await client.query(`UPDATE ${name} SET payload=payload || $2::jsonb WHERE id=$1 RETURNING payload`, [where.id, JSON.stringify(data)])).rows[0].payload },
  }
}
const prisma = { async $transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL search_path TO ${schema}`)
    const tx = {
      async $queryRaw(strings, ...values) {
        const rows = (await client.query(query(strings, values))).rows
        if (++lockCount === 1 && pauseFirst) { firstLocked(); await pauseFirst }
        return rows
      },
      cliente: { findFirst: async () => ({ id: 1 }) },
      ordem: {
        ...table(client, 'ordens'),
        async findUnique({ where }) {
          const order = await table(client, 'ordens').findUnique({ where })
          if (!order) return null
          const invoices = (await client.query("SELECT payload FROM contas_receber WHERE payload->>'ordemId'=$1 AND payload->>'status'<>'Cancelado'", [String(where.id)])).rows.map(r => r.payload)
          return { ...order, servico: { materiais: [] }, contasReceber: invoices }
        },
        async findFirst({ where }) { const order = await tx.ordem.findUnique({ where }); return order?.clienteId === where.clienteId ? order : null },
        async updateMany() { return { count: 0 } }, // synthetic order already consumed stock
      },
      contaReceber: {
        ...table(client, 'contas_receber'),
        async findFirst({ where }) { return (await client.query("SELECT payload FROM contas_receber WHERE payload->>'ordemId'=$1 LIMIT 1", [String(where.ordemId)])).rows[0]?.payload },
        async create({ data }) { await client.query('INSERT INTO contas_receber(id,payload) SELECT COALESCE(MAX(id),0)+1,$1::jsonb FROM contas_receber', [JSON.stringify(data)]) },
      }, contaPagar: table(client, 'contas_pagar'),
      contaFinanceira: { findFirst: async () => ({ id: 1 }) },
      movimentacaoFinanceira: {
        async create({ data }) { await client.query('INSERT INTO movimentos(payload) VALUES($1)', [JSON.stringify({ ...data, estornadaEm: null })]) },
        async updateMany({ where, data }) {
          const key = 'contaReceberId' in where ? 'contaReceberId' : 'contaPagarId'
          await client.query(`UPDATE movimentos SET payload=payload || $1::jsonb WHERE payload->>'${key}'=$2 AND payload->>'estornadaEm' IS NULL`, [JSON.stringify(data), String(where[key])])
        },
      },
    }
    const result = await fn(tx)
    await client.query('COMMIT')
    return result
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
} }
const actions = {}
vm.runInNewContext(code, { exports: actions, Date, console, require(name) {
  if (name === '@labgest/database') return { prisma, Prisma: { PrismaClientKnownRequestError: class extends Error {} } }
  if (name === 'next/cache') return { revalidatePath() {} }
  if (name === '@/lib/auth-utils') return { requireUser: async () => ({ id: 1, nome: 'Synthetic operator' }) }
  if (name === '@/lib/date-utils') return { parseDateLocal: value => new Date(`${value}T12:00:00Z`) }
  if (name.startsWith('@/lib/')) return {}
  if (['node:crypto', 'zod'].includes(name)) return require(name)
  throw new Error(`Unexpected import ${name}`)
} })
const finalization = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/finalizacao-ordem.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: finalization, Date })
const clinic = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../portal/src/actions/workflow-protese.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: clinic, Date, require(name) {
  if (name === '@labgest/database') return { prisma }
  if (name === 'next/cache') return { revalidatePath() {} }
  if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'clinic@example.test' } } }) } }) }
  if (name === '@/lib/workflow-config') return { isTipoProtese: () => true, getPassoProtese: () => ({ responsavel: 'clinica', entregaFinal: true, nome: 'Synthetic delivery' }) }
  throw new Error(`Unexpected clinic import ${name}`)
} })
async function main() {
  let created = false
  try {
    await pool.query(`CREATE SCHEMA ${schema}`); created = true
    for (const name of ['contas_receber', 'contas_pagar', 'ordens']) await pool.query(`CREATE TABLE ${schema}.${name}(id integer PRIMARY KEY, payload jsonb NOT NULL, cliente_id integer DEFAULT 1)`)
    await pool.query(`CREATE TABLE ${schema}.movimentos(id serial PRIMARY KEY, payload jsonb NOT NULL)`)
    for (const tipo of ['receber', 'pagar']) for (const [first, second] of [['pay','pay'], ['pay','cancel'], ['cancel','pay'], ['reverse','pay'], ['pay','reverse'], ['edit','pay'], ['pay','edit']]) {
      await pool.query(`TRUNCATE ${schema}.contas_receber, ${schema}.contas_pagar, ${schema}.movimentos`)
      const field = tipo === 'receber' ? 'valorRecebido' : 'valorPago'
      const fk = tipo === 'receber' ? 'contaReceberId' : 'contaPagarId'
      const initial = [first, second].includes('reverse') ? 20 : 0
      await pool.query(`INSERT INTO ${schema}.contas_${tipo} VALUES(1,$1,1)`, [JSON.stringify({ id: 1, valor: 100, [field]: initial, status: initial ? 'Parcial' : 'Pendente' })])
      if (initial) await pool.query(`INSERT INTO ${schema}.movimentos(payload) VALUES($1)`, [JSON.stringify({ valor: initial, [fk]: 1, estornadaEm: null })])
      const operations = {
        pay: () => actions.liquidarConta({ id: 1, tipo, valor: 80, data: '2026-11-04', formaPagamento: 'Pix' }),
        cancel: () => actions.cancelarConta(1, tipo, 'Synthetic cancellation'),
        reverse: () => actions.estornarBaixa(1, tipo, 'Synthetic reversal'),
        edit: () => actions.editarConta(1, tipo, { descricao: 'Synthetic edit', valor: 50, vencimento: '2026-11-04' }),
      }
      lockCount = 0
      const locked = new Promise(resolve => { firstLocked = resolve })
      pauseFirst = new Promise(resolve => { releaseFirst = resolve })
      const a = operations[first]()
      await Promise.race([locked, new Promise((_, reject) => setTimeout(() => reject(new Error('First action did not lock')), 5000).unref())])
      const b = operations[second]()
      try {
        let waiting = false
        const deadline = Date.now() + 3000
        while (Date.now() < deadline) {
          const result = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM contas_%' LIMIT 1")
          if (result.rowCount) { waiting = true; break }
          await new Promise(resolve => setTimeout(resolve, 20))
        }
        assert.ok(waiting, 'Second action must actually wait for PostgreSQL row lock')
      } finally { releaseFirst() }
      const results = await Promise.all([a, b])
      assert.equal(results[0].success, true)
      assert.equal(results[1].success, [first, second].includes('reverse'))
      const account = (await pool.query(`SELECT payload FROM ${schema}.contas_${tipo}`)).rows[0].payload
      const movements = (await pool.query(`SELECT payload FROM ${schema}.movimentos`)).rows.map(r => r.payload)
      assert.equal(account[field], movements.filter(m => !m.estornadaEm).reduce((sum, m) => sum + m.valor, 0))
      assert.ok(account[field] <= account.valor)
      if (account.status === 'Cancelado') assert.equal(account[field], 0)
      console.log(`PASS ${tipo}: ${first}/${second}`)
    }
    pauseFirst = null
    await pool.query(`TRUNCATE ${schema}.contas_receber`)
    await pool.query(`INSERT INTO ${schema}.ordens VALUES(1,$1,1)`, [JSON.stringify({ id: 1, clienteId: 1, valorFinal: 100, servicoNome: 'Synthetic', nomePaciente: 'Synthetic' })])
    const generated = await Promise.all([actions.gerarCobrancaAutomatica(1), actions.gerarCobrancaAutomatica(1)])
    assert.equal(generated.filter(result => result.success).length, 1)
    assert.equal(Number((await pool.query(`SELECT count(*) FROM ${schema}.contas_receber`)).rows[0].count), 1)
    console.log('PASS automatic generation: one invoice for concurrent requests')
    for (const pair of ['finalize/finalize', 'generate/finalize', 'clinic/finalize', 'generate/clinic', 'clinic/clinic']) {
      await pool.query(`TRUNCATE ${schema}.contas_receber`)
      const finalize = () => prisma.$transaction(tx => finalization.garantirEfeitosFinalizacao(tx, 1))
      const operations = { generate: () => actions.gerarCobrancaAutomatica(1), finalize, clinic: () => clinic.concluirEtapaClinica(1) }
      await Promise.all(pair.split('/').map(name => operations[name]()))
      assert.equal(Number((await pool.query(`SELECT count(*) FROM ${schema}.contas_receber`)).rows[0].count), 1)
      console.log(`PASS ${pair}: one invoice`)
    }
  } finally {
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
