/* eslint-disable @typescript-eslint/no-require-imports */
// Disposable-only migration/ACL regression; no application environment or live credentials.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/labgest_identity_test')
assert.equal(url.username, 'labgest_archive_test')
assert.equal(url.password, 'synthetic-only')
assert.equal(url.search, '')
assert.equal(url.hash, '')
const root = path.resolve(__dirname, '../..')
const migration = fs.readFileSync(path.join(root, 'packages/database/prisma/migrations/20261104010000_portal_client_binding/migration.sql'), 'utf8')

;(async () => {
  const c = new Client({ connectionString: url.href })
  await c.connect()
  try {
    const row = (await c.query('SELECT current_database() db,host(inet_server_addr()) address')).rows[0]
    assert.equal(row.db, 'labgest_identity_test')
    assert.equal(row.address, '127.0.0.1')
    assert.equal((await c.query("SELECT count(*)::int count FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")).rows[0].count, 0, 'Refuse nonempty DB')
    await c.query('CREATE TABLE public.clientes(id serial PRIMARY KEY,nome text,telefone text,cro text,ativo boolean)')
    // All cluster roles and default ACL changes are synthetic and rolled back.
    await c.query('BEGIN')
    try {
      for (const role of ['labgest_binding_anon_test', 'labgest_binding_authenticated_test', 'labgest_binding_inherited_test']) {
        await c.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS INHERIT`)
      }
      await c.query('GRANT labgest_binding_inherited_test TO labgest_binding_authenticated_test')
      await c.query('ALTER DEFAULT PRIVILEGES GRANT ALL ON TABLES TO labgest_binding_anon_test, labgest_binding_inherited_test')
      await c.query(migration)
      await c.query("INSERT INTO clientes(nome,ativo) VALUES('Synthetic ACL',true)")
      await c.query("INSERT INTO labgest_private.portal_client_binding(auth_user_id,cliente_id,authorized_by) SELECT '44444444-4444-4444-8444-444444444444',id,'synthetic reviewer' FROM clientes")
      // Schema usage alone must not make inherited/default table rights effective.
      await c.query('GRANT USAGE ON SCHEMA labgest_private TO labgest_binding_anon_test, labgest_binding_authenticated_test, labgest_binding_inherited_test')
      for (const role of ['labgest_binding_anon_test', 'labgest_binding_authenticated_test', 'labgest_binding_inherited_test']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
          assert.equal((await c.query("SELECT has_table_privilege($1, 'labgest_private.portal_client_binding', $2) allowed", [role, privilege])).rows[0].allowed, false, `${role} retains ${privilege} from default/inherited ACL`)
        }
        for (const statement of [
          'SELECT count(*) FROM labgest_private.portal_client_binding',
          'SELECT * FROM labgest_private.portal_client_binding',
          "INSERT INTO labgest_private.portal_client_binding(auth_user_id,cliente_id,authorized_by) VALUES('55555555-5555-4555-8555-555555555555',1,'unauthorized')",
          "UPDATE labgest_private.portal_client_binding SET authorized_by='unauthorized'",
          'DELETE FROM labgest_private.portal_client_binding',
          'TRUNCATE labgest_private.portal_client_binding',
        ]) {
          await c.query('SAVEPOINT denied_operation')
          await c.query(`SET LOCAL ROLE ${role}`)
          let error
          try { await c.query(statement) } catch (caught) { error = caught }
          await c.query('ROLLBACK TO SAVEPOINT denied_operation')
          await c.query('RESET ROLE')
          await c.query('RELEASE SAVEPOINT denied_operation')
          assert.equal(error?.code, '42501', `${role} must be denied: ${statement}`)
        }
      }
      assert.equal((await c.query('SELECT count(*)::int count FROM labgest_private.portal_client_binding')).rows[0].count, 1, 'Owner remains able to read preserved binding')
      assert.equal((await c.query("SELECT count(*)::int count FROM pg_policies WHERE schemaname='labgest_private' AND tablename='portal_client_binding'")).rows[0].count, 0)
      console.log('PASS binding: default and inherited non-owner ACLs removed; enumerate/read/insert/update/delete/TRUNCATE denied even with schema USAGE; owner unaffected')
      await c.query('GRANT SELECT ON labgest_private.portal_client_binding TO labgest_binding_anon_test')
      await c.query('SET LOCAL ROLE labgest_binding_anon_test')
      assert.equal((await c.query('SELECT count(*)::int count FROM labgest_private.portal_client_binding')).rows[0].count, 0)
      await c.query('RESET ROLE')
      console.log('PASS binding: explicitly granted SELECT still requires RLS authorization')
    } finally {
      await c.query('ROLLBACK')
    }
    await c.query(migration)
    await c.query(fs.readFileSync(path.join(root, 'packages/database/tests/portal-client-binding.sql'), 'utf8'))
    assert.equal((await c.query('SELECT count(*)::int count FROM labgest_private.portal_client_binding')).rows[0].count, 0)
    console.log('PASS binding: UUID cardinality, conflicting assignment rollback, reviewer, FK, RLS; no fixtures or assignments persisted')
  } finally { await c.end() }
})().catch(error => { console.error(error); process.exitCode = 1 })
