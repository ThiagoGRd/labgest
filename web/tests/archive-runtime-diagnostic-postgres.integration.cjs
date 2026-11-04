/* eslint-disable @typescript-eslint/no-require-imports */
// Fixed synthetic local database only; all fixture DDL is rolled back.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const { Client } = require('pg')
const url = new URL(process.env.LABGEST_TEST_DATABASE_URL || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
assert.equal(url.username, 'labgest_archive_test')
assert.equal(url.pathname, '/labgest_archive_test')
const client = new Client({ connectionString: url.href })
const exportsObject = {}
const source = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/external-archive-diagnostic/route.ts'), 'utf8')
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: exportsObject, Response,
  require(name) {
    if (name === '@/lib/auth-utils') return { requireAdmin: async () => ({ tipo: 'admin' }) }
    assert.equal(name, '@labgest/database')
    return { prisma: { $transaction: fn => fn({ $queryRaw: async (strings, ...values) => {
      const sql = strings.reduce((s, part, i) => s + (i ? `$${i}` : '') + part, '')
      assert.match(sql.trim(), /^SELECT/)
      return (await client.query(sql, values)).rows
    } }) } }
  },
})
async function inspect() {
  const response = await exportsObject.GET()
  assert.equal(response.status, 200)
  return response.json()
}
async function main() {
  await client.connect()
  try {
    await client.query('BEGIN')
    assert.equal((await client.query("SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','labgest_private')")).rows[0].count, '0')
    assert.equal((await inspect()).schema, 'absent')
    await client.query(fs.readFileSync(path.join(__dirname, 'fixtures/external-orders.sql'), 'utf8'))
    // Strip transaction wrapper only: keep every executable migration statement.
    const migration = fs.readFileSync(path.join(__dirname, '../../docs/proposals/external-lab-order-archive.sql'), 'utf8').replace(/^BEGIN;$/m, '').replace(/^COMMIT;$/m, '')
    await client.query(migration)
    let report = await inspect()
    assert.equal(report.schema, 'installed'); assert.equal(report.marker.enabled, false)
    assert.equal(report.runtime.current_user, 'labgest_archive_test')
    assert.ok(report.tables.every(t => t.select && !t.rls_active))
    assert.ok(report.views.every(v => v.owner_state_select && !v.owner_state_rls_applies))
    await client.query('CREATE ROLE synthetic_diagnostic_reader NOLOGIN')
    await client.query('GRANT USAGE ON SCHEMA labgest_private TO synthetic_diagnostic_reader')
    await client.query('GRANT SELECT ON ALL TABLES IN SCHEMA labgest_private TO synthetic_diagnostic_reader')
    await client.query('SET LOCAL ROLE synthetic_diagnostic_reader')
    report = await inspect()
    assert.equal(report.runtime.current_user, 'synthetic_diagnostic_reader')
    assert.equal(report.runtime.session_user, 'labgest_archive_test')
    assert.ok(report.tables.every(t => t.select && t.rls_active && !t.insert))
    assert.equal(report.marker, null)
    await client.query('RESET ROLE')
    await client.query('DROP TABLE labgest_private.external_order_archive_capability')
    assert.equal((await inspect()).schema, 'partial')
    console.log('PASS native PostgreSQL diagnostic: absent, installed/default-off, view owner visibility, effective/session role, ACL+RLS hidden marker, partial schema; all SQL SELECT-only')
  } finally { await client.query('ROLLBACK'); await client.end() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
