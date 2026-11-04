/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node CommonJS test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

// Execute the real source with explicit substitutes for every dependency.
// Never import the database client, auth provider, Next runtime or environment.
function load(relative, dependencies) {
  const filename = path.join(__dirname, '..', 'src', relative)
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unmocked dependency: ${name}`)
      return dependencies[name]
    },
    console,
  }, { filename })
  return exports
}

function view(save) {
  const components = {}
  const transitions = []
  let stateIndex = 0
  const dependencies = {
    react: {
      useState(initial) { return [stateIndex++ === 4 ? true : initial, () => {}] },
      useRef(initial) { return { current: initial } },
      useMemo(fn) { return fn() },
      useTransition() { return [false, fn => transitions.push(fn())] },
    },
    'react/jsx-runtime': {
      jsx(type, props) { components[type] = props; return { type, props } },
      jsxs(type, props) { components[type] = props; return { type, props } },
    },
    'lucide-react': {},
    '@/actions/labs-externos': { criarPedido: save },
    '@/components/labs-externos/etapas': { ETAPAS: [], ETAPA_POR_SITUACAO: Object.fromEntries(['Enviado', 'Provando', 'Pronto', 'Entregue'].map(s => [s, {}])) },
    '@/components/labs-externos/campos': {},
    sonner: { toast: { error() {}, success() {} } },
  }
  for (const [file, name] of [
    ['layout/dashboard-layout', 'DashboardLayout'], ['layout/header', 'Header'],
    ['ui/empty-state', 'EmptyState'], ['ui/reason-modal', 'ReasonModal'],
    ['labs-externos/modal-laboratorio', 'ModalLaboratorio'], ['labs-externos/modal-pedido', 'ModalPedido'],
    ['labs-externos/painel-laboratorios', 'PainelLaboratorios'], ['labs-externos/pedido-card', 'PedidoCard'],
    ['labs-externos/pipeline-labs', 'PipelineLabs'],
  ]) dependencies[`@/components/${file}`] = { [name]: name }
  const { LabsExternosView } = load('app/(dashboard)/labs-externos/labs-externos-view.tsx', dependencies)
  LabsExternosView({ pedidos: [], atrasados: [], retrabalhos: [], stats: {}, labs: [] })
  return { save: components.ModalPedido.onSave, settle: () => Promise.all(transitions) }
}

const pedido = { labId: 1, paciente: 'Paciente fictício', dataEnvio: '2026-11-04', prazo: '2026-11-19' }

test('two submissions before the pending render create only one external order', async () => {
  let count = 0
  let finish
  const waiting = new Promise(resolve => { finish = resolve })
  const screen = view(async () => { count++; await waiting; return { success: true } })
  screen.save(pedido)
  screen.save(pedido)
  finish()
  await screen.settle()
  assert.equal(count, 1)
})

for (const failure of ['validation', 'exception']) {
  test(`submission can be retried after ${failure}`, async () => {
    let count = 0
    const screen = view(async () => {
      count++
      if (failure === 'exception') throw new Error('Local simulated failure')
      return { success: false, error: 'Local validation failure' }
    })
    screen.save(pedido)
    await screen.settle()
    screen.save(pedido)
    await screen.settle()
    assert.equal(count, 2)
  })
}

test('legacy delete endpoint authenticates and preserves all data', async () => {
  let authenticated = 0
  let writes = 0
  const { excluirPedido } = load('actions/labs-externos.ts', {
    '@labgest/database': { prisma: { $executeRaw: async () => { writes++ } } },
    'next/cache': { revalidatePath() {} },
    zod: require('zod'),
    '@/lib/auth-utils': { requireUser: async () => { authenticated++ } },
    '@/lib/labs-externos-utils': {},
  })
  const result = await excluirPedido(123)
  assert.equal(authenticated, 1)
  assert.equal(writes, 0)
  assert.equal(result.success, false)
  assert.match(result.error, /cancelamento seguro/i)
})
