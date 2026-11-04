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
const { lookup } = require('node:dns/promises')
const sharedRules = {}
for (const file of ['order-transition', 'date-civil']) vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../packages/shared/src/' + file + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: sharedRules, Date })

const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
assert.equal(url.pathname, '/labgest_finance_test', 'Disposable synthetic DB only')
assert.equal(url.search, '', 'Connection overrides are forbidden')
assert.equal(url.hash, '', 'URL fragments are forbidden')
let pool
const schema = `finance_lock_${process.pid}`
const source = fs.readFileSync(path.join(__dirname, '../src/actions/financeiro.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const query = (strings, values) => ({ text: strings.reduce((s, p, i) => s + (i ? `$${i}` : '') + p, ''), values })
let pauseFirst
let firstLocked
let releaseFirst
let lockCount = 0
const unexpectedErrors = []
const actionConsole = { error(...args) { unexpectedErrors.push(args.map(String).join(' ')) } }
const dateFields = new Set(['dataFinalizacao', 'dataEntregaReal', 'dataCompetencia', 'dataVencimento', 'dataRecebimento', 'dataPagamento', 'canceladoEm', 'estornadaEm', 'estoqueBaixadoEm', 'cobrancaGeradaEm', 'createdAt', 'updatedAt'])
function hydrate(record) {
  if (!record) return record
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, dateFields.has(key) && value != null ? new Date(value) : value]))
}
function table(client, name) {
  return {
    async findUnique({ where }) { return hydrate((await client.query(`SELECT payload FROM ${name} WHERE id=$1`, [where.id])).rows[0]?.payload) },
    async update({ where, data }) { return (await client.query(`UPDATE ${name} SET payload=payload || $2::jsonb WHERE id=$1 RETURNING payload`, [where.id, JSON.stringify(name === 'ordens' ? { ...data, updatedAt: data.updatedAt || new Date() } : data)])).rows[0].payload },
  }
}
const prisma = { async $transaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL search_path TO ${schema}`)
    await client.query("SET LOCAL statement_timeout TO '7000ms'")
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
vm.runInNewContext(code, { exports: actions, Date, console: actionConsole, require(name) {
  if (name === '@labgest/database') return { prisma, Prisma: { PrismaClientKnownRequestError: class extends Error {} } }
  if (name === 'next/cache') return { revalidatePath() {} }
  if (name === '@/lib/auth-utils') return { requireUser: async () => ({ id: 1, nome: 'Synthetic operator' }) }
  if (name === '@/lib/date-utils') return { parseDateLocal: value => new Date(`${value}T12:00:00Z`) }
  if (name === '@/lib/data-civil') return sharedRules
    if (name.startsWith('@/lib/')) return {}
  if (['node:crypto', 'zod'].includes(name)) return require(name)
  throw new Error(`Unexpected import ${name}`)
} })
const stockLocks = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/estoque-bloqueio.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: stockLocks })
const finalization = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/finalizacao-ordem.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: finalization, Date, require(name) {
  if (name === '@labgest/shared') return sharedRules
  if (name === './data-civil') return sharedRules
  if (name === './estoque-bloqueio') return stockLocks
  throw new Error(`Unexpected finalization import ${name}`)
} })
const transition = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../packages/shared/src/order-transition.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: transition })
const clinic = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../portal/src/actions/workflow-protese.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: clinic, Date, require(name) {
  if (name === '@labgest/database') return { prisma }
  if (name === 'next/cache') return { revalidatePath() {} }
  if (name === '@labgest/shared') return sharedRules
  if (name === '@/lib/cliente-identity') return { resolveClienteIdentity: async () => ({ ok: true, cliente: { id: 1 } }) }
  if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'clinic@example.test', email_confirmed_at: '2026-11-01T00:00:00Z' } } }) } }) }
  if (name === '@/lib/workflow-config') return { isTipoProtese: () => true, getPassoProtese: () => ({ responsavel: 'clinica', entregaFinal: true, nome: 'Synthetic delivery' }) }
  throw new Error(`Unexpected clinic import ${name}`)
} })
async function overlap(first, second) {
  lockCount = 0
  const locked = new Promise(resolve => { firstLocked = resolve })
  pauseFirst = new Promise(resolve => { releaseFirst = resolve })
  const jobs = [Promise.resolve().then(first)]
  // Attach handlers immediately: a transaction may fail before taking its lock.
  const settled = [jobs[0].then(value => ({ value }), error => ({ error }))]
  let failure, timer
  try {
    await Promise.race([locked, jobs[0].then(() => { throw new Error('First operation did not hold its lock') }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('First lock timed out')), 5000) })])
    clearTimeout(timer)
    jobs.push(Promise.resolve().then(second))
    settled.push(jobs[1].then(value => ({ value }), error => ({ error })))
    let waiting = false
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const result = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT id FROM %FOR UPDATE' LIMIT 1", [schema])
      if (result.rowCount) { waiting = true; break }
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.ok(waiting, 'Second operation must wait on a row lock in this test pool')
  } catch (error) { failure = error }
  finally { clearTimeout(timer); releaseFirst(); pauseFirst = null }
  const results = await Promise.all(settled)
  if (failure) throw failure
  for (const result of results) if (result.error) throw result.error
  assert.deepEqual(unexpectedErrors, [], 'Unexpected server-action console.error must fail the regression')
  return results.map(result => result.value)
}
async function connectLocal() {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = await lookup(hostname, { all: true })
  assert.ok(addresses.length && addresses.every(row => row.address === '127.0.0.1' || row.address === '::1'), 'All resolved addresses must be loopback')
  // Pin the verified address; do not pass the caller URL to pg for reparsing.
  pool = new Pool({ host: addresses[0].address, port: Number(url.port || 5432), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: 'labgest_finance_test', ssl: false, application_name: schema, max: 5, connectionTimeoutMillis: 3000 })
  const target = (await pool.query('SELECT current_database() AS db, host(inet_server_addr()) AS address')).rows[0]
  assert.equal(target.db, 'labgest_finance_test')
  assert.ok(['127.0.0.1', '::1'].includes(target.address))
}
async function main() {
  let created = false
  try {
    await connectLocal()
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
      const results = await overlap(operations[first], operations[second])
      assert.equal(results[0].success, true)
      assert.equal(results[1].success, [first, second].includes('reverse'))
      if (!results[1].success) {
        const expected = second === 'cancel'
          ? tipo === 'receber' ? 'Uma conta com recebimentos precisa ter as baixas estornadas antes.' : 'Uma conta com pagamentos precisa ter as baixas estornadas antes.'
          : second === 'edit'
            ? tipo === 'receber' ? 'O valor não pode ser menor que o total já recebido.' : 'O valor não pode ser menor que o total já pago.'
            : first === 'cancel'
              ? tipo === 'receber' ? 'Conta indisponível para recebimento.' : 'Conta indisponível para pagamento.'
              : 'O valor informado ultrapassa o saldo da conta.'
        assert.equal(results[1].error, expected, 'Only the expected business rejection is acceptable')
      }
      const account = (await pool.query(`SELECT payload FROM ${schema}.contas_${tipo}`)).rows[0].payload
      const movements = (await pool.query(`SELECT payload FROM ${schema}.movimentos`)).rows.map(r => r.payload)
      assert.equal(account[field], movements.filter(m => !m.estornadaEm).reduce((sum, m) => sum + m.valor, 0))
      assert.ok(account[field] <= account.valor)
      if (account.status === 'Cancelado') assert.equal(account[field], 0)
      console.log(`PASS ${tipo}: ${first}/${second}`)
    }
    for (const pair of ['generate/generate', 'finalize/finalize', 'generate/finalize', 'finalize/generate', 'clinic/finalize', 'finalize/clinic', 'generate/clinic', 'clinic/generate', 'clinic/clinic']) {
      // Reset ALL shared state; a preceding clinic action must not leak dates.
      await pool.query(`TRUNCATE ${schema}.contas_receber, ${schema}.contas_pagar, ${schema}.ordens, ${schema}.movimentos`)
      await pool.query(`INSERT INTO ${schema}.ordens VALUES(1,$1,1)`, [JSON.stringify({ id: 1, clienteId: 1, status: 'Finalizado', passoFluxoAtual: 'entrega_clinica', updatedAt: '2026-11-04T12:00:00.000Z', valorFinal: 100, servicoNome: 'Synthetic', nomePaciente: 'Synthetic', dataFinalizacao: '2026-11-04T12:00:00.000Z', cobrancaGeradaEm: null })])
      const finalize = () => prisma.$transaction(tx => finalization.garantirEfeitosFinalizacao(tx, 1))
      const operations = { generate: () => actions.gerarCobrancaAutomatica(1), finalize, clinic: () => clinic.concluirEtapaClinica(1, 'entrega_clinica', '2026-11-04T12:00:00.000Z') }
      const names = pair.split('/')
      const results = await overlap(operations[names[0]], operations[names[1]])
      for (let index = 0; index < names.length; index++) {
        if (names[index] === 'finalize') assert.equal(results[index], undefined)
        else if (names[index] === 'clinic' && index === 1 && names[0] === 'clinic') {
          assert.equal(results[index].success, false)
          assert.equal(results[index].error, 'Esta ordem já está encerrada.')
        } else if (names[index] === 'clinic' && index === 1 && names[0] === 'finalize') {
          assert.equal(results[index].success, false)
          assert.equal(results[index].error, 'A ordem foi alterada. Atualize antes de continuar.')
        } else if (names[index] === 'generate' && index === 1) {
          assert.equal(results[index].success, false)
          assert.equal(results[index].error, 'Já existe uma cobrança para esta ordem.')
        } else assert.equal(results[index].success, true, `${pair}: ${names[index]} must succeed`)
      }
      assert.equal(Number((await pool.query(`SELECT count(*) FROM ${schema}.contas_receber`)).rows[0].count), 1)
      assert.deepEqual(unexpectedErrors, [])
      console.log(`PASS ${pair}: observed order-lock wait; both outcomes checked; one invoice`)
    }
  } finally {
    if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`)
    await pool?.end()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
