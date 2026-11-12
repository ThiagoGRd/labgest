/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic fixtures only. No database client, credentials or network loaded.
const test = require('node:test'), assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server')
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
const deny = () => { throw Error('Unexpected write') }
const row = { origem: 'externo', id: 7, externo: { revisao: 'a'.repeat(32), version: 0 }, paciente: 'Paciente sintético com nome muito longo', clinica: 'Laboratório de teste', servico: 'COROA SOB IMPLANTE\nELEMENTO 36\nCOR A3 VITA\nINFORMAÇÃO NO FIM', etapa: 'Enviado', status: 'Enviado', localizacao: 'Não confirmada', situacao: 'conferir_recebimento', dentista: '', finalidade: null, agendamento: null, movimentadoEm: null, entregaPrevista: '', decisaoDentista: null, observacaoDentista: null }
function view(items) {
  const passthrough = ({ children }) => React.createElement('div', null, children)
  const View = loader({
    'sonner': { toast: { error: deny, success: deny } },
    'next/navigation': { useRouter: () => ({ refresh: deny }) },
    '@/actions/recepcao': {}, '@/actions/recepcao-externa': {},
    '@/components/layout/dashboard-layout': { DashboardLayout: passthrough },
    '@/components/layout/header': { Header: () => null },
    '@/components/ui/modal': { Modal: () => null },
  })('@/app/(dashboard)/recepcao/recepcao-view').RecepcaoView
  return renderToStaticMarkup(React.createElement(View, { itens: items, dentistas: [], emitidoEm: '2026-11-12T12:00:00Z', externosDisponiveis: true, usuario: { nome: 'Teste', email: 'test@example.invalid', tipo: 'recepcao' } }))
}
test('external card exposes full multiline description without clipping and keeps explicit physical receipt', () => {
  const html = view([row])
  assert.ok(html.includes('INFORMAÇÃO NO FIM'))
  const paragraph = html.match(/<p[^>]*>COROA SOB IMPLANTE[\s\S]*?<\/p>/)[0]
  assert.doesNotMatch(paragraph, /truncate|line-clamp/)
  assert.match(paragraph, /whitespace-pre-wrap/)
  assert.ok(html.includes('Externo #7')); assert.ok(html.includes('Confirmar recebimento físico'))
  assert.ok(html.includes('A chegada física ainda não foi confirmada'))
})
test('long internal patient names and service remain readable; identities stay separate', () => {
  const html = view([row, { ...row, origem: 'interno', externo: undefined }])
  assert.ok(html.includes('Interno · OS #7')); assert.ok(html.includes('Externo #7'))
  assert.doesNotMatch(html.match(/<h2[^>]*>Paciente sintético[\s\S]*?<\/h2>/)[0], /truncate|line-clamp/)
})
test('recording external delivery invalidates reception after successful write', async () => {
  const events = []
  const actions = loader({
    '@labgest/database': { prisma: { $queryRaw: async () => [{ id: 7, situacao: 'Pronto', data_retorno: null }], $executeRaw: async () => { events.push('write'); return 1 } } },
    '@/lib/auth-utils': { requireUser: async () => ({}) },
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/labs-externos')
  assert.equal((await actions.atualizarSituacao(7, 'Entregue')).success, true)
  assert.ok(events.indexOf('/recepcao') > events.indexOf('write'))
})
test('recording internal delivery invalidates reception only after successful transaction', async () => {
  const events = []
  const actions = loader({
    '@labgest/database': { prisma: { $transaction: async fn => {
      const result = await fn({ ordem: { findUnique: async () => ({ id: 7, status: 'Finalizado', contasReceber: [], historicoEtapas: [], servicoNome: 'Sintético', nomePaciente: 'Teste', clienteId: 1, clienteNome: 'Clínica teste' }), update: async () => {} }, contaReceber: { create: async ({ data }) => ({ id: 1, ...data }) } })
      events.push('commit'); return result
    } } },
    '@/lib/auth-utils': { requireUser: async () => ({ id: 1, email: 'test@example.invalid' }) },
    '@/lib/finalizacao-ordem': {}, '@/lib/exclusao-ordem': {},
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/ordens')
  const nextYear = new Date().getFullYear() + 1
  assert.equal((await actions.marcarEntregue(7, { valor: 100, vencimento: `${nextYear}-01-01` })).success, true)
  assert.ok(events.indexOf('/recepcao') > events.indexOf('commit'))
})

test('failed external delivery does not invalidate caches or claim success', async () => {
  const events = []
  const actions = loader({
    '@labgest/database': { prisma: { $queryRaw: async () => [], $executeRaw: deny } },
    '@/lib/auth-utils': { requireUser: async () => ({}) },
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/labs-externos')
  assert.equal((await actions.atualizarSituacao(7, 'Entregue')).success, false)
  assert.deepEqual(events, [])
})
test('invalid internal delivery does not invalidate caches or write', async () => {
  const events = []
  const actions = loader({
    '@labgest/database': { prisma: { $transaction: deny } },
    '@/lib/auth-utils': { requireUser: async () => ({}) },
    '@/lib/finalizacao-ordem': {}, '@/lib/exclusao-ordem': {},
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/ordens')
  assert.equal((await actions.marcarEntregue(7, { valor: 0, vencimento: '2027-01-01' })).success, false)
  assert.deepEqual(events, [])
})
if (process.env.LABGEST_RECEPTION_HTML) {
  const css = fs.readFileSync(path.join(root, 'delivery/tailwind.css'), 'utf8')
  const html = view([row, { ...row, id: 8, origem: 'interno', externo: undefined, situacao: 'aguardando_distribuicao' }])
  fs.writeFileSync(process.env.LABGEST_RECEPTION_HTML, `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${html}<script>
  const descriptions=[...document.querySelectorAll('article p')].filter(p=>p.textContent.includes('INFORMAÇÃO NO FIM'));
  const result={viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,descriptions:descriptions.map(p=>({client:p.clientWidth,scroll:p.scrollWidth,whiteSpace:getComputedStyle(p).whiteSpace,overflow:getComputedStyle(p).overflow,height:p.clientHeight})),confirmations:document.querySelectorAll('button').length};
  const report=document.createElement('pre');report.id='browser-verification';report.textContent=JSON.stringify(result);document.body.append(report);
  </script></body></html>`)
}
