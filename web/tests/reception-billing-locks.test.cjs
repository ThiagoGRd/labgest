/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic fixtures only. No database client, credentials or network loaded.
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root = path.resolve(__dirname, '../..')
function loader(overrides = {}) {
  const cache = new Map()
  function load(name, from = root + '/web/src/index.ts') {
    if (name in overrides) return overrides[name]
    let file
    if (name === '@labgest/shared') file = root + '/packages/shared/src/index.ts'
    else if (name.startsWith('@/')) file = root + '/web/src/' + name.slice(2)
    else if (name.startsWith('.')) file = path.resolve(path.dirname(from), name)
    else return require(require.resolve(name, { paths: [root + '/web', root] }))
    if (!fs.existsSync(file)) file = ['.ts', '.tsx'].map(ext => file + ext).find(fs.existsSync)
    assert.ok(file, name)
    if (cache.has(file)) return cache.get(file)
    const exports = {}; cache.set(file, exports)
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { exports, require: dep => load(dep, file), Date, Intl, Set, console, process: { env: {} } }, { filename: file })
    return exports
  }
  return load
}

test('legacy delivery locks order before reading status and billing', async () => {
  const events = []
  const actions = loader({
    '@labgest/database': { prisma: { $transaction: async fn => fn({
      $queryRaw: async (sql, id) => { assert.match(sql.join('?'), /SELECT id FROM ordens WHERE id = \? FOR UPDATE/); assert.equal(id, 7); events.push('lock'); return [{ id }] },
      ordem: { findUnique: async () => { events.push('read'); return { id: 7, status: 'Finalizado', contasReceber: [{ id: 1, valor: 100, valorRecebido: 0, dataVencimento: new Date('2099-01-01'), status: 'Pendente' }], historicoEtapas: [] } }, update: async () => { events.push('write-order') } },
      contaReceber: { update: async () => ({ id: 1, valor: 100, dataVencimento: new Date('2099-01-01') }) },
    }) } },
    '@/lib/auth-utils': { requireUser: async () => ({ id: 1, email: 'test@example.invalid' }) },
    'next/cache': { revalidatePath: () => {} },
  })('@/actions/ordens')
  const due = new Date(); due.setDate(due.getDate() + 1)
  assert.equal((await actions.marcarEntregue(7, { valor: 100, vencimento: due.toISOString().slice(0, 10) })).success, true)
  assert.deepEqual(events, ['lock', 'read', 'write-order'])
})
