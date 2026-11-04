/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated PostgreSQL integration runner. */
// Requires pg@8.16.3 on NODE_PATH and a FRESH disposable local PostgreSQL database.
// Does not load dotenv or the application's database client.
const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { Pool } = require('pg')
const url = new URL(process.env.LABGEST_TEST_DATABASE_URL || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'Explicit test URL required')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only local disposable PostgreSQL allowed')
assert.equal(url.username, 'labgest_archive_test')
assert.equal(url.pathname, '/labgest_archive_test')
const pool = new Pool({ connectionString: url.href, max: 5, connectionTimeoutMillis: 3000 })
const root = path.join(__dirname, '..')
const exportsObject = {}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/labs-externos-arquivo.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: exportsObject })
const { alterarArquivamento } = exportsObject
function statement(strings, values) {
  return { text: strings.reduce((sql, part, i) => sql + (i ? `$${i}` : '') + part, ''), values }
}
function queryAdapter(client, afterWrite) {
  return {
    async $queryRaw(strings, ...values) { return (await client.query(statement(strings, values))).rows },
    async $executeRaw(strings, ...values) {
      const sql = statement(strings, values)
      const result = await client.query(sql)
      if (afterWrite) await afterWrite(sql.text)
      return result.rowCount
    },
  }
}
function database(afterWrite) {
  return {
    ...queryAdapter(pool),
    async $transaction(fn) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(queryAdapter(client, afterWrite))
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    },
  }
}
const actor = { id: 1, nome: 'Synthetic Administrator' }
async function inputFor(id) {
  const { rows } = await pool.query('SELECT md5(to_jsonb(p)::text) AS revision FROM public.labs_externos_pedidos p WHERE id=$1', [id])
  return { id, action: 'archive', expectedRevision: rows[0].revision, expectedVersion: 0,
    reason: 'Synthetic duplicate reviewed', confirmed: true,
    review: { financial: 'clear', stock: 'clear', externalCommitment: 'clear' } }
}
async function eventCount(id) {
  return Number((await pool.query('SELECT count(*) FROM labgest_private.external_order_archive_event WHERE pedido_id=$1', [id])).rows[0].count)
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
async function waitForLock() {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const { rows } = await pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")
    if (Number(rows[0].count) > 0) return
    await new Promise(resolve => setTimeout(resolve, 25))
  }
  throw new Error('Concurrent request did not wait for a PostgreSQL lock')
}
async function main() {
  try {
    assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name, 'labgest_archive_test')
    assert.equal((await pool.query("SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','labgest_private')")).rows[0].count, '0', 'Refuse a non-empty database')
    await pool.query(fs.readFileSync(path.join(__dirname, 'fixtures/external-orders.sql'), 'utf8'))
    await pool.query(fs.readFileSync(path.join(root, '../docs/proposals/external-lab-order-archive.sql'), 'utf8'))
    // Test-only activation on the brand-new synthetic database, never production.
    await pool.query('UPDATE labgest_private.external_order_archive_capability SET enabled=true WHERE id=1')

    await test('simultaneous archive requests serialize and append only one event', async () => {
      const input = await inputFor(1)
      const results = await Promise.all([alterarArquivamento(database(), input, actor), alterarArquivamento(database(), input, actor)])
      assert.equal(results.filter(result => result.changed).length, 1)
      assert.equal(await eventCount(1), 1)
    })

    await test('original edit waits for archive commit and is rejected by the archived-row trigger', async () => {
      const entered = deferred(); const release = deferred()
      const input = await inputFor(2)
      const archive = alterarArquivamento(database(async sql => {
        if (sql.includes('INSERT INTO labgest_private.external_order_archive\n')) { entered.resolve(); await release.promise }
      }), input, actor)
      await entered.promise
      const edit = pool.query("UPDATE public.labs_externos_pedidos SET servico='Synthetic concurrent edit' WHERE id=2")
        .then(() => null, error => error)
      try { await waitForLock() } finally { release.resolve() }
      await archive
      const error = await edit
      assert.equal(error?.code, '55000')
      assert.equal((await pool.query('SELECT servico FROM public.labs_externos_pedidos WHERE id=2')).rows[0].servico, null)
    })

    await test('archive waiting behind an original edit rejects the stale row revision', async () => {
      const input = await inputFor(3)
      const editor = await pool.connect()
      try {
        await editor.query('BEGIN')
        await editor.query("UPDATE public.labs_externos_pedidos SET servico='Synthetic edit first' WHERE id=3")
        const archive = alterarArquivamento(database(), input, actor).then(() => null, error => error)
        await waitForLock()
        await editor.query('COMMIT')
        const error = await archive
        assert.match(error?.message ?? '', /registro foi alterado/)
        assert.equal(await eventCount(3), 0)
      } finally { await editor.query('ROLLBACK'); editor.release() }
    })

    await test('restore waiting behind archive rejects its stale archive version', async () => {
      const entered = deferred(); const release = deferred()
      const input = await inputFor(4)
      const archive = alterarArquivamento(database(async sql => {
        if (sql.includes('INSERT INTO labgest_private.external_order_archive\n')) { entered.resolve(); await release.promise }
      }), input, actor)
      await entered.promise
      const restore = alterarArquivamento(database(), { ...input, action: 'restore' }, actor).then(() => null, error => error)
      try { await waitForLock() } finally { release.resolve() }
      await archive
      const error = await restore
      assert.match(error?.message ?? '', /arquivamento foi alterado/)
      assert.equal(await eventCount(4), 1)
      assert.equal((await pool.query('SELECT archived FROM labgest_private.external_order_archive WHERE pedido_id=4')).rows[0].archived, true)
    })

    await test('failed real audit INSERT rolls back previously written archive state', async () => {
      await pool.query("CREATE FUNCTION labgest_private.fixture_reject_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.pedido_id=5 THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$")
      await pool.query('CREATE TRIGGER fixture_reject_event BEFORE INSERT ON labgest_private.external_order_archive_event FOR EACH ROW EXECUTE FUNCTION labgest_private.fixture_reject_event()')
      await assert.rejects(alterarArquivamento(database(), await inputFor(5), actor), /Synthetic audit failure/)
      assert.equal(await eventCount(5), 0)
      assert.equal((await pool.query('SELECT count(*) FROM labgest_private.external_order_archive WHERE pedido_id=5')).rows[0].count, '0')
    })
  } finally { await pool.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
