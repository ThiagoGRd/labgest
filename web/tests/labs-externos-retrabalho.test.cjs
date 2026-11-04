/* eslint-disable @typescript-eslint/no-require-imports -- Isolated source regression tests. */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
function fixture({ archived = false, exists = true, linked = true } = {}) {
  const writes = [], locks = [], reads = [], invalidations = []
  const row = { id: 1, ordem_id: linked ? 42 : null }
  const tx = {
    async $queryRaw(s) { const sql = s.join('?'); reads.push(sql); if (sql.includes('FOR UPDATE')) locks.push(sql); return sql.includes('SELECT *') && exists ? [row] : [] },
    async $executeRaw(s, ...values) { writes.push({ sql: s.join('?'), values }); return 1 },
  }
  const dependencies = {
    '@labgest/database': { prisma: { ...tx, $transaction: async fn => fn(tx) } },
    './workflow-protese': {}, '@/lib/labs-externos-utils': {}, '@/lib/labs-externos-arquivo': {},
    '@/lib/labs-externos-vinculo': { garantirPedidoNaoArquivado: async () => { if (archived) throw Error('Pedido arquivado') } },
    'next/cache': { revalidatePath: p => invalidations.push(p) },
    '@/lib/auth-utils': { requireUser: async () => ({ id: 1 }) }, zod: require('zod'),
  }
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/actions/labs-externos.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, Number, console: { error() {} }, require(n) { assert.ok(n in dependencies, n); return dependencies[n] } })
  return { api: exports, writes, locks, reads, invalidations }
}
for (const action of ['marcarRetrabalho', 'desmarcarRetrabalho']) {
  test(action + ' refuses archived records without mutation or invalidation', async () => {
    const f = fixture({ archived: true }); assert.equal((await f.api[action](1, 'Motivo sintético')).success, false)
    assert.equal(f.writes.length, 0); assert.equal(f.invalidations.length, 0)
  })
  test(action + ' preserves existing linked and standalone behavior under locks', async () => {
    for (const linked of [true, false]) {
      const f = fixture({ linked }); assert.equal((await f.api[action](1, '  Motivo sintético  ')).success, true)
      assert.equal(f.writes.length, 1); assert.equal(f.locks.length, linked ? 2 : 1)
      assert.match(f.locks[0], linked ? /FROM ordens/ : /FROM labs_externos_pedidos/)
      assert.match(f.writes[0].sql, action === 'marcarRetrabalho' ? /is_retrabalho = true/ : /is_retrabalho = false/)
      if (action === 'marcarRetrabalho') assert.equal(f.writes[0].values[0], 'Motivo sintético')
      assert.equal(f.invalidations.length, 3)
    }
  })
  test(action + ' rejects invalid or absent IDs', async () => {
    for (const id of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      const f = fixture(); assert.equal((await f.api[action](id, 'Motivo sintético')).success, false)
      assert.equal(f.writes.length, 0); assert.equal(f.reads.length, 0)
    }
    const f = fixture({ exists: false }); assert.equal((await f.api[action](999, 'Motivo sintético')).success, false); assert.equal(f.writes.length, 0)
  })
}
