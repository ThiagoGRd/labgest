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
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8') + (file.endsWith('/recepcao-view.tsx') ? '\nexport { AcoesExternas as testAcoesExternas, TrabalhoCard as testTrabalhoCard, pertenceFiltro as testPertenceFiltro, AgendamentoModal as testAgendamentoModal };' : ''), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, { exports, require: dep => load(dep, file), Date, Intl, Set, Error, console, window: overrides.__window, process: { env: {} } }, { filename: file })
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
  assert.deepEqual(Object.keys(data).sort(), ['agendamentoConfirmado', 'historicoEtapas', 'localizacaoAtual', 'movimentacaoLogisticaEm', 'situacaoLogistica'])
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

test('internal scheduling explicitly sets, edits and cancels without physical or financial changes', async () => {
  const timestamp = new Date('2026-11-13T10:00:00Z')
  const record = { ...base, updatedAt: timestamp, agendamentoConfirmado: false, agendamentoClinico: new Date('2020-01-01'), agendamentoDentista: null }
  for (const [active, input] of [[false, { agendado: true }], [true, { agendado: true, dentista: 'Dra Teste', agendamento: '2026-11-15T12:00:00Z' }], [true, { agendado: false }]]) {
    const f = actionsFixture({ ...record, agendamentoConfirmado: active })
    const result = await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: timestamp.toISOString(), ...input })
    assert.equal(result.success, true)
    const { where, data } = f.writes[0]
    assert.equal(where.updatedAt, timestamp)
    assert.equal(data.agendamentoConfirmado, input.agendado)
    assert.equal(data.historicoEtapas[0].acao, 'recebeu_recepcao')
    assert.equal(data.historicoEtapas[1].acao, input.agendado ? 'agendou_recepcao' : 'cancelou_agendamento_recepcao')
    assert.ok(!('localizacaoAtual' in data) && !('situacaoLogistica' in data) && !('status' in data))
    if (!input.agendado) assert.ok(!('agendamentoClinico' in data))
  }
})
test('internal scheduling rejects stale, repeated cancel and concurrent modification', async () => {
  const timestamp = new Date('2026-11-13T10:00:00Z')
  const record = { ...base, updatedAt: timestamp, agendamentoConfirmado: false }
  let f = actionsFixture(record)
  assert.equal((await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: null, agendado: true })).success, false)
  assert.equal((await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: timestamp.toISOString(), agendado: false })).success, false)
  assert.equal(f.writes.length, 0)
  f = actionsFixture(record, 0)
  assert.equal((await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: timestamp.toISOString(), agendado: true })).success, false)
  assert.equal(f.invalidations.length, 0)
})
test('legacy historical date is not an active appointment; legacy custody remains visible', () => {
  const html = view([{ ...row, situacao: 'com_dentista', agendamento: '2020-01-01T12:00:00Z', agendamentoConfirmado: false }])
  assert.match(html, /Histórico não confirmado/)
  assert.match(html, /Custódia registrada com dentista/)
  assert.match(html, /Agendamento realizado/)
})
test('direct scheduled return from reception changes custody only, closes schedule and checks revision', async () => {
  const updatedAt = new Date('2026-11-13T10:00:00Z')
  const f = actionsFixture({ ...base, updatedAt, agendamentoConfirmado: true })
  const result = await f.actions.retornarAgendadoDaRecepcao({ ordemId: 7, expectedUpdatedAt: updatedAt.toISOString() })
  assert.equal(result.success, true)
  const { where, data } = f.writes[0]
  assert.equal(where.updatedAt, updatedAt)
  assert.equal(data.agendamentoConfirmado, false)
  assert.equal(data.situacaoLogistica, 'em_transito_laboratorio')
  assert.equal(data.historicoEtapas[1].agendamentoEncerrado, 'sim')
  assert.ok(!('status' in data) && !('finalidadeClinica' in data))
  const stale = actionsFixture({ ...base, updatedAt, agendamentoConfirmado: true })
  assert.equal((await stale.actions.retornarAgendadoDaRecepcao({ ordemId: 7, expectedUpdatedAt: null })).success, false)
  assert.equal(stale.writes.length, 0)
})
test('scheduling audit retains previous flag, historical date and scheduling dentist', async () => {
  const updatedAt = new Date('2026-11-13T10:00:00Z')
  const f = actionsFixture({ ...base, updatedAt, agendamentoConfirmado: false, agendamentoClinico: new Date('2020-01-01T12:00:00Z'), agendamentoDentista: 'Anterior' })
  assert.equal((await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: updatedAt.toISOString(), agendado: true })).success, true)
  const event = f.writes[0].data.historicoEtapas[1]
  assert.equal(event.agendamentoAnterior, '2020-01-01T12:00:00.000Z')
  assert.equal(event.dentistaAgendamentoAnterior, 'Anterior')
  assert.equal(event.agendamentoConfirmadoAnterior, 'não')
})
test('scheduling filters follow flag independently of custody and legacy dates', () => {
  const mod = loader({ '@/actions/recepcao': {}, '@/actions/recepcao-externa': {} })('@/app/(dashboard)/recepcao/recepcao-view')
  const filter = mod.testPertenceFiltro
  const scheduled = { ...row, situacao: 'aguardando_distribuicao', agendamentoConfirmado: true }
  assert.equal(filter(scheduled, 'dentista'), true)
  assert.equal(filter(scheduled, 'recepcao'), false)
  assert.equal(filter({ ...scheduled, agendamentoConfirmado: false }, 'recepcao'), true)
  const legacy = { ...row, situacao: 'com_dentista', agendamento: '2020-01-01', agendamentoConfirmado: false }
  assert.equal(filter(legacy, 'todos'), true)
  assert.equal(filter(legacy, 'dentista'), false)
})
test('new appointment modal starts empty despite historical date, optional submit and close do not invent data', () => {
  const captured = []
  const fakeReact = { ...React, useState: initial => [initial, () => {}] }
  const mod = loader({ react: fakeReact, '@/actions/recepcao': {}, '@/actions/recepcao-externa': {}, '@/components/ui/modal': { Modal: () => null } })('@/app/(dashboard)/recepcao/recepcao-view')
  const modal = mod.testAgendamentoModal({ item: { ...row, situacao: 'aguardando_distribuicao', agendamento: '2020-01-01T12:00:00Z', agendamentoConfirmado: false }, disabled: false, onClose: () => captured.push('close'), onConfirm: (...args) => captured.push(args) })
  const form = modal.props.children
  const children = form.props.children
  assert.equal(children[1].props.children[1].props.value, '')
  assert.equal(children[2].props.children[1].props.value, '')
  form.props.onSubmit({ preventDefault() {} })
  assert.deepEqual(captured[0], [true, '', undefined])
  children[3].props.children[0].props.onClick()
  assert.equal(captured[1], 'close')
})
test('cancel confirmation aborts without action, confirms once when accepted, and disabled submission does nothing', () => {
  const calls = []
  let accepted = false
  const fakeReact = { ...React, useState: initial => [initial, () => {}] }
  const mod = loader({ react: fakeReact, __window: { confirm: () => accepted }, '@/actions/recepcao': {}, '@/actions/recepcao-externa': {}, '@/components/ui/modal': { Modal: () => null } })('@/app/(dashboard)/recepcao/recepcao-view')
  const props = { item: { ...row, situacao: 'aguardando_distribuicao', agendamentoConfirmado: true, agendamentoDentista: null }, disabled: false, onClose: () => {}, onConfirm: (...args) => calls.push(args) }
  const form = mod.testAgendamentoModal(props).props.children
  const cancel = form.props.children[3].props.children[1]
  cancel.props.onClick(); assert.equal(calls.length, 0)
  accepted = true; cancel.props.onClick(); assert.deepEqual(calls[0], [false])
  const disabledForm = mod.testAgendamentoModal({ ...props, disabled: true }).props.children
  disabledForm.props.onSubmit({ preventDefault() {} }); assert.equal(calls.length, 1)
})
test('stale scheduling returns structured conflict before or during conditional update', async () => {
  const updatedAt = new Date('2026-11-13T10:00:00Z')
  for (const [f, expected] of [[actionsFixture({ ...base, updatedAt, agendamentoConfirmado: false }), null], [actionsFixture({ ...base, updatedAt, agendamentoConfirmado: false }, 0), updatedAt.toISOString()]]) {
    const result = await f.actions.registrarAgendamentoInternoRecepcao({ ordemId: 7, expectedUpdatedAt: expected, agendado: true })
    assert.equal(result.code, 'CONFLICT')
  }
})
test('real view closes stale scheduling modal on conflict, refreshes, and reopen uses refreshed revision', async () => {
  let hooks=[], index=0, pending, refreshes=0; const calls=[]
  const fakeReact={...React,useState:init=>{const i=index++; if (!(i in hooks)) hooks[i]=init; return [hooks[i],v=>{hooks[i]=v}]}, useRef:init=>{const i=index++;if(!(i in hooks))hooks[i]={current:init};return hooks[i]}, useTransition:()=>[false,fn=>{pending=fn()}]}
  let result={success:false,code:'CONFLICT',error:'Atualize'}
  const mod=loader({react:fakeReact,'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})},'sonner':{toast:{error:()=>{},success:()=>{}}},'@/actions/recepcao':{registrarAgendamentoInternoRecepcao:async x=>{calls.push(x);return result}},'@/actions/recepcao-externa':{}})('@/app/(dashboard)/recepcao/recepcao-view')
  const old={...row,origem:'interno',situacao:'aguardando_distribuicao',agendamentoConfirmado:false,interno:{atualizadoEm:'old'}}
  function render(item){index=0;return mod.RecepcaoView({itens:[item],dentistas:[],emitidoEm:'2026-11-13T12:00:00Z',externosDisponiveis:true,usuario:{nome:'T',email:'t',tipo:'recepcao'}})}
  function find(el,name){if(!el||typeof el!=='object')return; if(typeof el.type==='function'&&el.type.name===name)return el; const c=el.props?.children;for(const v of Array.isArray(c)?c:[c]){const x=find(v,name);if(x)return x}}
  find(render(old),'TrabalhoCard').props.onAgendar(); let modal=find(render(old),'AgendamentoModal'); assert.ok(modal)
  modal.props.onConfirm(true,'',''); await pending; assert.equal(calls[0].expectedUpdatedAt,'old'); assert.equal(refreshes,1)
  const fresh={...old,interno:{atualizadoEm:'new'}}; assert.equal(find(render(fresh),'AgendamentoModal'),undefined)
  find(render(fresh),'TrabalhoCard').props.onAgendar(); modal=find(render(fresh),'AgendamentoModal'); result={success:true}; modal.props.onConfirm(true,'',''); await pending
  assert.equal(calls[1].expectedUpdatedAt,'new'); assert.equal(find(render(fresh),'AgendamentoModal'),undefined)
})
test('rapid repeated scheduling submits dispatch only one request before rerender', async () => {
  let hooks=[], index=0, pending, release, calls=0; const wait=new Promise(r=>release=r)
  const fakeReact={...React,useState:init=>{const i=index++;if(!(i in hooks))hooks[i]=init;return [hooks[i],v=>{hooks[i]=v}]},useRef:init=>{const i=index++;if(!(i in hooks))hooks[i]={current:init};return hooks[i]},useTransition:()=>[false,fn=>{pending=fn()}]}
  const mod=loader({react:fakeReact,'next/navigation':{useRouter:()=>({refresh:()=>{}})},'sonner':{toast:{error:()=>{},success:()=>{}}},'@/actions/recepcao':{registrarAgendamentoInternoRecepcao:async()=>{calls++;await wait;return {success:true}}},'@/actions/recepcao-externa':{}})('@/app/(dashboard)/recepcao/recepcao-view')
  const item={...row,origem:'interno',situacao:'aguardando_distribuicao',agendamentoConfirmado:false,interno:{atualizadoEm:'old'}}
  function render(){index=0;return mod.RecepcaoView({itens:[item],dentistas:[],emitidoEm:'2026-11-13T12:00:00Z',externosDisponiveis:true,usuario:{nome:'T',email:'t',tipo:'recepcao'}})}
  function find(el,name){if(!el||typeof el!=='object')return;if(typeof el.type==='function'&&el.type.name===name)return el;const c=el.props?.children;for(const v of Array.isArray(c)?c:[c]){const x=find(v,name);if(x)return x}}
  find(render(),'TrabalhoCard').props.onAgendar(); const modal=find(render(),'AgendamentoModal'); modal.props.onConfirm(true,'',''); const first=pending; modal.props.onConfirm(true,'',''); assert.equal(calls,1);release();await first
})
test('external scheduling surfaces revision and version conflicts as structured conflict', async () => {
  for (const message of ['O pedido foi alterado. Atualize a página.', 'O registro foi alterado. Atualize a página.']) {
    const actions=loader({'@labgest/database':{prisma:{}},'@/lib/auth-utils':{requireRecepcao:async()=>({id:1,nome:'Teste'})},'next/cache':{revalidatePath:()=>{}},'@/lib/recepcao-externa-db':{movimentarCustodiaExterna:async()=>{throw Error(message)}}})('@/actions/recepcao-externa')
    const result=await actions.registrarAgendamentoExternoRecepcao({origem:'externo',id:1,expectedRevision:'a'.repeat(32),expectedVersion:1,agendado:true})
    assert.equal(result.code,'CONFLICT')
  }
})
