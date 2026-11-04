/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, dependencies) {
  const exports = {}
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  vm.runInNewContext(source, { exports, Response, require(name) { assert.ok(name in dependencies, name); return dependencies[name] } })
  return exports
}
const tableNames = ['external_order_archive', 'external_order_archive_event', 'external_order_archive_capability']
function fixture() {
  return [
    [{ current_user: 'synthetic_runtime', session_user: 'synthetic_login', role_setting: 'none', superuser: false, bypass_rls: true }],
    tableNames.map(name => ({ name, exists: true, schema_usage: true, owner: 'synthetic_owner', select: true, insert: true, update: true, rls_active: false, rls_enabled: true, rls_forced: true, sequence_usage: true })),
    ['labs_externos_atrasados', 'labs_externos_retrabalhos', 'labs_externos_dashboard'].map(name => ({ name, exists: true, owner: 'synthetic_owner', security_invoker: false, owner_superuser: false, owner_bypass_rls: true, owner_state_select: true, owner_schema_usage: true, owner_state_rls_applies: false })),
    [{ schema_version: 1, enabled: false }],
  ]
}
function route({ role = 'admin', rows = fixture(), failure = false } = {}) {
  let calls = 0
  const { requireAdmin } = load('lib/auth-utils.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: role === null ? null : { email: 'synthetic@example.invalid', user_metadata: { tipo: 'admin' } } } }) } }) },
    '@labgest/database': { prisma: { usuario: { findFirst: async () => ({ tipo: role, permissoes: [], ativo: true }) } } },
  })
  const { GET } = load('app/api/admin/external-archive-diagnostic/route.ts', {
    '@/lib/auth-utils': { requireAdmin },
    '@labgest/database': { prisma: { $transaction: async fn => fn({ $queryRaw: async () => { calls++; if (failure) throw new Error('SECRET postgres://do-not-return'); return rows.shift() } }) } },
  })
  return { GET, calls: () => calls }
}
for (const role of [null, 'operador']) test(`denies ${role} before metadata, ignoring admin user_metadata`, async () => {
  const r = route({ role }); const response = await r.GET()
  assert.equal(response.status, 403); assert.equal(r.calls(), 0)
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
})
test('admin receives only bounded diagnostic metadata and default-off marker', async () => {
  const r = route(); const response = await r.GET(); const body = await response.json()
  assert.equal(response.status, 200); assert.equal(body.schema, 'installed')
  assert.equal(body.permitted, true); assert.equal(body.full_visibility, true); assert.equal(body.marker_valid, true); assert.equal(body.marker.enabled, false); assert.equal(body.runtime.current_user, 'synthetic_runtime')
  assert.equal(body.tables.length, 3); assert.equal(body.views.length, 3)
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
})
for (const count of [0, 1]) test(`reports ${count ? 'partial' : 'absent'} storage without querying nonexistent marker`, async () => {
  const rows = fixture(); rows[1].forEach((t, i) => { t.exists = i < count }); rows.pop()
  const r = route({ rows }); const body = await (await r.GET()).json()
  assert.equal(body.schema, count ? 'partial' : 'absent'); assert.equal(body.marker, null); assert.equal(r.calls(), 3)
})
test('reports insufficient marker privilege without attempting SELECT', async () => {
  const rows = fixture(); rows[1][2].select = false; rows.pop()
  const r = route({ rows }); const body = await (await r.GET()).json()
  assert.equal(body.marker, null); assert.equal(body.tables[2].select, false); assert.equal(r.calls(), 3)
})
test('preserves RLS-filtered visibility and absent marker as blockers', async () => {
  const rows = fixture(); rows[1][2].rls_active = true; rows[3] = []
  const body = await (await route({ rows }).GET()).json()
  assert.equal(body.marker, null); assert.equal(body.tables[2].rls_active, true)
})
test('database failure is sanitized and not cached', async () => {
  const response = await route({ failure: true }).GET()
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /SECRET|postgres|SELECT/)
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
})

test('write ACL remains distinct from full visibility and disabled flag', async () => {
  const rows = fixture(); rows[1][0].update = false
  const body = await (await route({ rows }).GET()).json()
  assert.equal(body.permitted, false); assert.equal(body.full_visibility, true); assert.equal(body.marker.enabled, false)
})
