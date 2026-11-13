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
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8') + (file.endsWith('/recepcao-view.tsx') ? '\nexport { AcoesExternas as testAcoesExternas, TrabalhoCard as testTrabalhoCard };' : ''), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { exports, require: dep => load(dep, file), Date, Intl, Set, console, window: overrides.__window, process: { env: {} } }, { filename: file })
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

const base = { id: 7, status: 'Finalizado', situacaoLogistica: 'aguardando_distribuicao', localizacaoAtual: 'recepcao', movimentacaoLogisticaEm: new Date('2026-11-01T12:00:00Z'), historicoEtapas: [{ acao: 'recebeu_recepcao' }], finalidadeClinica: 'entrega' }
function actionsFixture(record = base, count = 1, tipo = 'recepcao') {
  const writes = [], invalidations = []
  const actions = loader({
    '@labgest/database': { prisma: { cicloProducao: { findFirst: async () => ({ decisao: 'aprovado' }) }, ordem: { findFirst: async () => record, updateMany: async query => { writes.push(query); return { count } }, update: async query => { writes.push(query); return {} } } } },
    '@/lib/auth-utils': { requireRecepcao: async () => ({ nome: 'Recepção teste', email: 'test@example.invalid', tipo, permissoes: [] }) },
    '@/lib/recepcao-externa-db': {},
    'next/cache': { revalidatePath: p => invalidations.push(p) },
  })('@/actions/recepcao')
  return { actions, writes, invalidations }
}
const command = { ordemId: 7, situacao: 'aguardando_distribuicao', movimentadoEm: '2026-11-01T12:00:00.000Z' }
test('reception can record lab location without changing clinical state and keeps history', async () => {
  const f = actionsFixture()
  assert.equal(typeof f.actions.registrarNoLaboratorio, 'function')
  assert.equal((await f.actions.registrarNoLaboratorio(command)).success, true)
  assert.equal(f.writes.length, 1)
  const { where, data } = f.writes[0]
  assert.equal(data.situacaoLogistica, 'no_laboratorio'); assert.equal(data.localizacaoAtual, 'laboratorio')
  assert.deepEqual(Object.keys(data).sort(), ['historicoEtapas', 'localizacaoAtual', 'movimentacaoLogisticaEm', 'situacaoLogistica'])
  assert.equal(data.historicoEtapas.length, 2); assert.equal(data.historicoEtapas[0].acao, 'recebeu_recepcao')
  assert.equal(data.historicoEtapas[1].acao, 'registrou_no_laboratorio')
  assert.equal(data.historicoEtapas[1].por, 'test@example.invalid')
  assert.equal(where.situacaoLogistica, base.situacaoLogistica)
  assert.ok(f.invalidations.includes('/recepcao'))
})
test('stale, forbidden and missing records never write', async () => {
  for (const record of [null, { ...base, situacaoLogistica: 'com_dentista' }, { ...base, situacaoLogistica: 'aguardando_resultado_dentista' }, { ...base, status: 'Entregue' }, { ...base, status: 'Cancelado' }, { ...base, movimentacaoLogisticaEm: new Date() }]) {
    const f = actionsFixture(record)
    assert.equal((await f.actions.registrarNoLaboratorio(command)).success, false)
    assert.equal(f.writes.length, 0)
  }
})
test('concurrent conditional update failure does not report success', async () => {
  const f = actionsFixture(base, 0)
  assert.equal((await f.actions.registrarNoLaboratorio(command)).success, false)
  assert.equal(f.invalidations.length, 0)
})
test('explicit lab location for Em Prova can be received normally', async () => {
  const f = actionsFixture({ ...base, status: 'Em Prova', situacaoLogistica: 'no_laboratorio', localizacaoAtual: 'laboratorio' })
  assert.equal((await f.actions.confirmarRecebimentoRecepcao(7)).success, true)
  assert.equal(f.writes[0].data.situacaoLogistica, 'aguardando_distribuicao')
})
test('reception role sees clear lab location button for both origins', () => {
  for (const origem of ['interno', 'externo']) {
    assert.match(view([{ ...row, origem, situacao: origem === 'externo' ? 'conferir_recebimento' : 'aguardando_recepcao' }]), /Está no laboratório/)
    assert.match(view([{ ...row, origem, situacao: 'aguardando_distribuicao' }]), /Está no laboratório/)
    assert.doesNotMatch(view([{ ...row, origem, situacao: 'com_dentista' }]), /Está no laboratório/)
    assert.match(view([{ ...row, origem, situacao: 'no_laboratorio' }]), /Confirmar recebimento/)
  }
})
test('explicit lab state survives legacy Em Prova normalization and stays in lab queue', async () => {
  let query
  const actions = loader({
    '@labgest/database': { prisma: { ordem: { findMany: async q => { query = q; return [{ ...base, status: 'Em Prova', situacaoLogistica: 'no_laboratorio', localizacaoAtual: 'laboratorio', ciclos: [], dataEntrega: new Date('2026-11-15') }] } }, cliente: { findMany: async () => [] } } },
    '@/lib/auth-utils': { requireRecepcao: async () => ({ nome: 'Teste', tipo: 'recepcao' }) },
    '@/lib/recepcao-externa-db': { consultarCustodiaExterna: async () => ({ disponivel: true, itens: [] }) },
    'next/cache': { revalidatePath: deny },
  })('@/actions/recepcao')
  const result = await actions.getPainelRecepcao()
  assert.equal(result.itens[0].situacao, 'no_laboratorio')
  assert.ok(query.where.OR.some(c => c.situacaoLogistica === 'no_laboratorio' && c.historicoEtapas?.array_contains?.[0]?.acao === 'registrou_no_laboratorio'))
})
test('receipt refuses concurrent location change instead of overwriting history', async () => {
  const f = actionsFixture({ ...base, situacaoLogistica: 'aguardando_recepcao' }, 0)
  assert.equal((await f.actions.confirmarRecebimentoRecepcao(7)).success, false)
  assert.equal(f.invalidations.length, 0)
  assert.ok(f.writes[0].where.historicoEtapas)
})
test('competing dispatch and distribution refuse overwriting a newer history', async () => {
  const f = actionsFixture(base, 0)
  assert.equal((await f.actions.distribuirParaDentista({ ordemId: 7, dentista: 'Teste', finalidade: 'entrega' })).success, false)
  assert.equal(f.invalidations.length, 0)
})

test('direct delivery exists only for ready external orders', () => {
  assert.match(view([{ ...row, status: 'Pronto', etapa: 'Pronto' }]), /Registrar entrega/)
  for (const status of ['Enviado', 'Provando', 'Entregue']) assert.doesNotMatch(view([{ ...row, status }]), /Registrar entrega/)
  assert.doesNotMatch(view([{ ...row, origem: 'interno', status: 'Finalizado' }]), />Registrar entrega<\/button>/)
})

test('external delivery shortcut requires confirmation and calls the restricted delivery action with external identity and revision', async () => {
  for (const confirmed of [false, true]) {
    const writes = [], pending = [], confirmations = []
    const Actions = loader({
      __window: { confirm: message => { confirmations.push(message); return confirmed } },
      '@/actions/recepcao-externa': { registrarEntregaExternaRecepcao: async (...args) => { writes.push(args); return { success: true } } },
      '@/actions/recepcao': {},
      '@/components/layout/dashboard-layout': {}, '@/components/layout/header': {}, '@/components/ui/modal': {},
      'next/navigation': {}, 'sonner': {},
    })('@/app/(dashboard)/recepcao/recepcao-view').testAcoesExternas
    const tree = Actions({ item: { ...row, status: 'Pronto' }, disabled: false, onDistribuir: deny, onExecutar: action => pending.push(action()) })
    function findButton(node) {
      if (!node?.props) return null
      const children = React.Children.toArray(node.props.children)
      if (children.includes('Registrar entrega')) return node
      return children.map(findButton).find(Boolean)
    }
    const button = findButton(tree)
    assert.ok(button)
    button.props.onClick()
    await Promise.all(pending)
    assert.equal(confirmations.length, 1)
    assert.match(confirmations[0], /será marcado como Entregue/)
    assert.equal(writes.length, confirmed ? 1 : 0)
    if (confirmed) assert.equal(JSON.stringify(writes[0]), JSON.stringify([{ origem: 'externo', id: 7, expectedRevision: 'a'.repeat(32), expectedVersion: 0 }]))
  }
})
test('delivery server action accepts reception auth and invalidates both lists only after success', async () => {
  const events = []
  const action = loader({
    '@labgest/database': { prisma: {} },
    '@/lib/auth-utils': { requireRecepcao: async () => { events.push('reception-auth'); return { id: 1 } }, requireUser: deny },
    '@/lib/recepcao-externa-db': { concluirPedidoExterno: async () => { events.push('write'); return { success: true } } },
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/recepcao-externa').registrarEntregaExternaRecepcao
  assert.equal(typeof action, 'function')
  assert.equal((await action({ origem: 'externo', id: 7, expectedRevision: 'a'.repeat(32), expectedVersion: 0 })).success, true)
  assert.deepEqual(events, ['reception-auth', 'write', '/recepcao', '/labs-externos'])
})
test('internal delivery shortcut exists only after internal production is Finalizado', () => {
  assert.match(view([{ ...row, origem: 'interno', status: 'Finalizado' }]), /Registrar entrega ao paciente/)
  for (const status of ['Em Prova', 'Em Produção', 'Entregue', 'Cancelado']) assert.doesNotMatch(view([{ ...row, origem: 'interno', status }]), /Registrar entrega ao paciente/)
  assert.doesNotMatch(view([{ ...row, status: 'Finalizado' }]), /Registrar entrega ao paciente/)
})
test('internal delivery action uses reception auth and invalidates financial and operational views after commit', async () => {
  const events = []
  const action = loader({
    '@labgest/database': { prisma: {} },
    '@/lib/auth-utils': { requireRecepcao: async () => { events.push('auth'); return { id: 1, nome: 'Recepção', email: 'test@example.invalid' } }, requireUser: deny },
    '@/lib/entrega-interna-recepcao': { concluirEntregaInterna: async () => { events.push('commit'); return { success: true, cobrancaCriada: false } } },
    'next/cache': { revalidatePath: p => events.push(p) },
  })('@/actions/recepcao').registrarEntregaInternaRecepcao
  assert.equal(typeof action, 'function')
  assert.equal((await action({ ordemId: 7, expectedUpdatedAt: null })).success, true)
  assert.equal(events[0], 'auth')
  assert.ok(events.indexOf('/recepcao') > events.indexOf('commit'))
  assert.ok(events.indexOf('/financeiro') > events.indexOf('commit'))
})

test('internal delivery confirmation discloses billing and never records payment or submits on cancel', async () => {
  for (const confirmed of [false, true]) {
    const calls = [], pending = [], confirmations = []
    const Card = loader({
      __window: { confirm: message => { confirmations.push(message); return confirmed } },
      '@/actions/recepcao': { registrarEntregaInternaRecepcao: async input => { calls.push(input); return { success: true } } },
      '@/actions/recepcao-externa': {},
      '@/components/layout/dashboard-layout': {}, '@/components/layout/header': {}, '@/components/ui/modal': {},
      'next/navigation': {}, 'sonner': {},
    })('@/app/(dashboard)/recepcao/recepcao-view').testTrabalhoCard
    const tree = Card({ item: { ...row, origem: 'interno', status: 'Finalizado', interno: { atualizadoEm: '2026-11-13T12:00:00.000Z' } }, disabled: false, emitidoEm: '2026-11-13T12:00:00Z', recepcaoSomente: true, onDistribuir: deny, onExecutar: action => pending.push(action()) })
    function findButton(node) {
      if (!node?.props) return null
      const children = React.Children.toArray(node.props.children)
      if (children.includes('Registrar entrega ao paciente')) return node
      return children.map(findButton).find(Boolean)
    }
    findButton(tree).props.onClick()
    await Promise.all(pending)
    assert.match(confirmations[0], /pagamentos serão preservados/)
    assert.match(confirmations[0], /não registra pagamento/)
    assert.equal(calls.length, confirmed ? 1 : 0)
    if (confirmed) assert.equal(JSON.stringify(calls[0]), JSON.stringify({ ordemId: 7, expectedUpdatedAt: '2026-11-13T12:00:00.000Z' }))
  }
})

test('remaining custody actions refuse stale writes after an internal delivery', async () => {
  for (const [method, situacao] of [['receberDoDentista', 'com_dentista'], ['enviarRetornoLaboratorio', 'aguardando_envio_laboratorio'], ['confirmarRecebimentoLaboratorio', 'em_transito_laboratorio']]) {
    const f = actionsFixture({ ...base, situacaoLogistica: situacao }, 0, 'admin')
    assert.equal((await f.actions[method](7)).success, false)
    assert.equal(f.invalidations.length, 0)
    assert.ok(f.writes[0].where.historicoEtapas)
    assert.equal(f.writes[0].where.status, 'Finalizado')
  }
})
