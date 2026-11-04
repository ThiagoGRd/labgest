/* eslint-disable @typescript-eslint/no-require-imports -- Standalone disposable PostgreSQL runner. */
// Requires pg + typescript on NODE_PATH. Never loads dotenv or application clients.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), test = require('node:test')
const ts = require('typescript'), { Pool } = require('pg')
const url = new URL(process.env.LABGEST_TEST_DATABASE_URL || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Explicit test URL required')
assert.equal(url.hostname, '127.0.0.1', 'Only literal loopback allowed')
assert.equal(url.password, 'synthetic-only')
assert.equal(url.hash, '')
assert.equal(url.username, 'labgest_archive_test')
assert.equal(url.pathname, '/labgest_external_link_test')
assert.equal(url.search, '', 'Connection overrides forbidden')
const pool = new Pool({ connectionString: url.href, max: 5, connectionTimeoutMillis: 3000 })
const root = path.join(__dirname, '..')
function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Date, Number, Error, require(n) { assert.ok(n in dependencies, 'Unexpected import ' + n); return dependencies[n] } })
  return exports
}
const helpers = load('labs-externos-vinculo', { '@/lib/labs-externos-arquivo': load('labs-externos-arquivo') })
function adapter(c) {
  const statement = (s, v) => ({ text: s.reduce((q, part, i) => q + (i ? '$' + i : '') + part, ''), values: v })
  return { $queryRaw: async (s, ...v) => (await c.query(statement(s, v))).rows, $executeRaw: async (s, ...v) => (await c.query(statement(s, v))).rowCount }
}
async function locked(id, fn) {
  const c = await pool.connect()
  try { await c.query('BEGIN'); await c.query('SELECT id FROM ordens WHERE id=$1 FOR UPDATE', [id]); const result = await fn(adapter(c)); await c.query('COMMIT'); return result }
  catch(e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
}
const order = id => ({ id, nomePaciente: 'Paciente OS ' + id, clienteNome: 'Dentista OS', servicoNome: 'Servico OS' })
const send = (id, lab = 7) => locked(id, tx => helpers.registrarPedidoFornecedor(tx, order(id), lab, new Date('2026-11-01T12:00:00Z'), new Date('2026-11-10T12:00:00Z')))
async function main() {
 try {
  assert.equal((await pool.query('SELECT host(inet_server_addr()) AS address')).rows[0].address, '127.0.0.1')
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'labgest_external_link_test')
  assert.equal((await pool.query("SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','labgest_private')")).rows[0].count, '0', 'Refuse non-empty database')
  await pool.query(`CREATE TABLE ordens(id INTEGER PRIMARY KEY); INSERT INTO ordens VALUES(42),(43),(44),(45);
    CREATE TABLE labs_externos(id INTEGER PRIMARY KEY,nome TEXT NOT NULL,ativo BOOLEAN NOT NULL); INSERT INTO labs_externos VALUES(7,'Mesmo nome',true),(8,'Mesmo nome',true),(9,'Inativo',false);
    CREATE TABLE labs_externos_pedidos(id SERIAL PRIMARY KEY,lab_id INTEGER,lab_nome TEXT,paciente TEXT,dentista TEXT,servico TEXT,data_envio DATE,prazo DATE,data_retorno DATE,situacao TEXT DEFAULT 'Enviado',updated_at TIMESTAMP DEFAULT NOW());
    INSERT INTO labs_externos_pedidos(lab_id,lab_nome,paciente,situacao,data_retorno) VALUES(7,'Mesmo nome','Historico','Pronto','2020-01-01');`)
  const before = (await pool.query('SELECT * FROM labs_externos_pedidos')).rows[0]
  const migration = fs.readFileSync(path.join(root, '../packages/database/prisma/migrations/20261104000000_external_order_link/migration.sql'), 'utf8')
  console.log('Migration SHA256:', crypto.createHash('sha256').update(migration).digest('hex'))
  await test('migration preserves existing rows; raw replay fails atomically without changing data', async () => {
    await pool.query('BEGIN'); await pool.query(migration); await pool.query('COMMIT')
    let after = (await pool.query('SELECT * FROM labs_externos_pedidos')).rows[0]
    assert.deepEqual(after, { ...before, ordem_id: null, fornecedor_confirmado_em: null })
    await pool.query('BEGIN'); await assert.rejects(pool.query(migration), { code: '42701' }); await pool.query('ROLLBACK')
    assert.deepEqual((await pool.query('SELECT * FROM labs_externos_pedidos')).rows[0], after)
  })
  await test('exact lab ID, FK restrict, invalid IDs and inactive lab', async () => {
    await send(42, 8)
    const row = (await pool.query('SELECT * FROM labs_externos_pedidos WHERE ordem_id=42')).rows[0]
    assert.equal(row.lab_id, 8); assert.equal(row.paciente, 'Paciente OS 42')
    await assert.rejects(pool.query('DELETE FROM ordens WHERE id=42'), { code: '23503' })
    await assert.rejects(send(999), { code: '23503' })
    await assert.rejects(send(43, 9), /válido/)
  })
  await test('order lock serializes concurrent sends and partial index blocks bypass', async () => {
    const results = await Promise.allSettled([send(43), send(43)])
    assert.equal(results.filter(x => x.status === 'fulfilled').length, 1)
    assert.match(results.find(x => x.status === 'rejected').reason.message, /aberto/)
    await assert.rejects(pool.query('INSERT INTO labs_externos_pedidos(ordem_id) VALUES(43)'), { code: '23505' })
  })
  await test('return preserves first date, closes same row once and allows next historical cycle', async () => {
    await pool.query("UPDATE labs_externos_pedidos SET data_retorno='2026-11-05',situacao='Pronto' WHERE ordem_id=42")
    const first = await locked(42, tx => helpers.confirmarPedidoFornecedor(tx, 42))
    assert.equal(first.dataRetorno.getDate(), 5)
    assert.equal(await locked(42, tx => helpers.confirmarPedidoFornecedor(tx, 42)), null)
    await send(42)
    const rows = (await pool.query('SELECT * FROM labs_externos_pedidos WHERE ordem_id=42 ORDER BY id')).rows
    assert.equal(rows.length, 2); assert.ok(rows[0].fornecedor_confirmado_em); assert.equal(rows[1].fornecedor_confirmado_em, null)
    assert.equal(rows[0].data_retorno.getDate(), 5)
    assert.deepEqual((await pool.query('SELECT * FROM labs_externos_pedidos WHERE id=1')).rows[0], { ...before, ordem_id: null, fornecedor_confirmado_em: null })
  })
  for (const [index, timezone] of ['UTC', 'Pacific/Auckland'].entries()) {
    await test(`supplier civil dates and event timestamp are session-independent: ${timezone}`, async () => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query("SELECT set_config('TimeZone', $1, true)", [timezone])
        const id = 44 + index
        await client.query('SELECT id FROM ordens WHERE id=$1 FOR UPDATE', [id])
        const tx = adapter(client), event = new Date('2026-11-02T01:30:00.000Z')
        await helpers.registrarPedidoFornecedor(tx, order(id), 7, event, new Date('2026-11-17T01:30:00.000Z'))
        const result = await helpers.confirmarPedidoFornecedor(tx, id, event)
        assert.equal(result.dataRetorno.toISOString(), '2026-11-01T00:00:00.000Z')
        const row = (await client.query('SELECT data_envio::text, prazo::text, data_retorno::text, fornecedor_confirmado_em::text FROM labs_externos_pedidos WHERE ordem_id=$1', [id])).rows[0]
        assert.deepEqual(row, { data_envio: '2026-11-01', prazo: '2026-11-16', data_retorno: '2026-11-01', fornecedor_confirmado_em: '2026-11-02 01:30:00' })
        // A previous civil return has no inferred hour and is never overwritten.
        await client.query("UPDATE labs_externos_pedidos SET fornecedor_confirmado_em=NULL, data_retorno='2026-10-31' WHERE ordem_id=$1", [id])
        const preserved = await helpers.confirmarPedidoFornecedor(tx, id, event)
        assert.equal(preserved.dataRetorno.toISOString().slice(0, 10), '2026-10-31')
        assert.equal((await client.query('SELECT data_retorno::text FROM labs_externos_pedidos WHERE ordem_id=$1', [id])).rows[0].data_retorno, '2026-10-31')
      } finally {
        await client.query('ROLLBACK')
        client.release()
      }
    })
  }
  await test('archive absence permits; installed incomplete archive fails closed with rollback', async () => {
    await helpers.garantirPedidoNaoArquivado(adapter(pool), 1)
    await pool.query('CREATE SCHEMA labgest_private; CREATE TABLE labgest_private.external_order_archive_capability(id INTEGER PRIMARY KEY)')
    await assert.rejects(locked(43, tx => helpers.confirmarPedidoFornecedor(tx, 43)))
    assert.equal((await pool.query('SELECT fornecedor_confirmado_em FROM labs_externos_pedidos WHERE ordem_id=43')).rows[0].fornecedor_confirmado_em, null)
  })
  await test('archived row refuses supplier confirmation; restored row succeeds with same ID', async () => {
    await pool.query(`ALTER TABLE labgest_private.external_order_archive_capability ADD COLUMN schema_version INTEGER, ADD COLUMN enabled BOOLEAN;
      INSERT INTO labgest_private.external_order_archive_capability VALUES(1,1,true);
      CREATE TABLE labgest_private.external_order_archive(pedido_id INTEGER PRIMARY KEY,archived BOOLEAN,version INTEGER);
      CREATE TABLE labgest_private.external_order_archive_event(id SERIAL PRIMARY KEY);
      INSERT INTO labgest_private.external_order_archive SELECT id,true,1 FROM labs_externos_pedidos WHERE ordem_id=43;`)
    await assert.rejects(locked(43, tx => helpers.confirmarPedidoFornecedor(tx, 43)), /arquivado/)
    await pool.query('UPDATE labgest_private.external_order_archive SET archived=false')
    await locked(43, tx => helpers.confirmarPedidoFornecedor(tx, 43))
    const row = (await pool.query('SELECT * FROM labs_externos_pedidos WHERE ordem_id=43')).rows[0]
    assert.equal(row.situacao, 'Pronto'); assert.ok(row.data_retorno); assert.ok(row.fornecedor_confirmado_em)
  })
 } finally { await pool.end() }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
