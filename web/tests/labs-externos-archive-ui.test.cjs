/* eslint-disable @typescript-eslint/no-require-imports -- Isolated Node CommonJS test harness. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
function render({ review = { financial: 'unknown', stock: 'unknown', externalCommitment: 'unknown' }, confirmed = false, reason = '', action = 'archive', onConfirm = async () => ({ success: true }) } = {}) {
  let state = 0
  const jsx = (type, props) => ({ type, props })
  const deps = {
    react: { useEffect() {}, useRef: value => ({ current: value }), useState(initial) { return [[reason, review, confirmed][state++] ?? initial, () => {}] } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/actions/labs-externos': { getHistoricoArquivo: async () => [] },
    '@/components/ui/modal': { Modal: 'Modal' },
    './campos': {},
  }
  const filename = path.join(__dirname, '../src/components/labs-externos/modal-arquivo.tsx')
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, require(name) { assert.ok(Object.hasOwn(deps, name)); return deps[name] } }, { filename })
  const tree = exports.ModalArquivo({ pedido: { id: 10, arquivoVersao: 0, revisao: 'a'.repeat(32), situacao: 'Entregue' }, action, onClose() {}, onConfirm })
  const elements = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    elements.push(node)
    visit(node.props?.children)
  }
  visit(tree)
  return { form: elements.find(e => e.type === 'form'), submit: elements.find(e => e.type === 'button' && e.props.type === 'submit') }
}
const clear = { financial: 'clear', stock: 'clear', externalCommitment: 'clear' }

test('archive confirmation is disabled by default and refuses programmatic submit', async () => {
  let writes = 0
  const ui = render({ onConfirm: async () => { writes++; return { success: true } } })
  assert.equal(ui.submit.props.disabled, true)
  await ui.form.props.onSubmit({ preventDefault() {} })
  assert.equal(writes, 0)
})

test('explicit review, reason and confirmation permit one in-flight submission', async () => {
  let writes = 0
  let release
  const waiting = new Promise(resolve => { release = resolve })
  const ui = render({ review: clear, confirmed: true, reason: 'Duplicidade conferida', onConfirm: async input => {
    writes++
    assert.equal(input.id, 10)
    assert.equal(input.expectedVersion, 0)
    assert.equal(input.expectedRevision, 'a'.repeat(32))
    await waiting
    return { success: true }
  } })
  assert.equal(ui.submit.props.disabled, false)
  const first = ui.form.props.onSubmit({ preventDefault() {} })
  const second = ui.form.props.onSubmit({ preventDefault() {} })
  release()
  await Promise.all([first, second])
  assert.equal(writes, 1)
})

test('history has no mutation form', () => {
  const ui = render({ action: 'history' })
  assert.equal(ui.form, undefined)
  assert.equal(ui.submit, undefined)
})
