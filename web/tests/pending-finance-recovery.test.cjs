/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS VM harness executes handler bodies without importing server dependencies. */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const root = path.join(__dirname, '../src')
// Run the actual handler body with controlled action promises. No database imports.
const cases = [
 ['components/financeiro/baixa-conta-modal.tsx', 'handleSubmit', 'liquidarConta'],
 ['components/financeiro/editar-conta-modal.tsx', 'handleSubmit', 'editarConta'],
 ['components/financeiro/nova-conta-modal.tsx', 'handleSubmit', 'createConta'],
 ['components/estoque/movimentar-estoque-modal.tsx', 'handleSubmit', 'registrarMovimentacaoEstoque'],
 ['components/estoque/novo-item-estoque-modal.tsx', 'handleSubmit', 'updateItemEstoque'],
 ['components/estoque/novo-item-estoque-modal.tsx', 'handleSubmit', 'createItemEstoque'],
 ['components/estoque/novo-item-estoque-modal.tsx', 'alterarStatus', 'alterarStatusItemEstoque'],
 ['components/producao/definir-etapa-fluxo-modal.tsx', 'salvar', 'definirEtapaFluxoProtese'],
 ['app/(dashboard)/financeiro/financeiro-view.tsx', 'confirmarCancelamento', 'cancelarConta'],
 ['app/(dashboard)/financeiro/financeiro-view.tsx', 'confirmarEstorno', 'estornarBaixa'],
]
function handler(file, name, context) {
 const src = fs.readFileSync(path.join(root, file), 'utf8')
 const start = src.search(new RegExp(`(?:async function ${name}\\([^\\n]*|const ${name} = async \\([^\\n]*)`))
 assert.ok(start >= 0)
 const open = src.indexOf('{', start)
 let depth = 1, end = open + 1
 for (; depth; end++) { if (src[end] === '{') depth++; if (src[end] === '}') depth-- }
 const body = src.slice(open + 1, end - 1)
 return vm.runInNewContext(`(async function(formData, event, motivo) {${body}})`, context)
}
for (const [file, name, action] of cases) {
 test(`${file}: ${name}/${action} rejects safely, prevents repeats and permits retry`, async () => {
  let pending = false, error = '', calls = 0, completed = 0
  const rejectors = []
  const actionFn = () => { calls++; return new Promise((_, r) => { rejectors.push(r) }) }
  const context = {
   pendingRef: { current: false }, cancelandoRef: { current: false }, estornandoRef: { current: false },
   setLoading: v => { pending = v }, setSalvando: v => { pending = v }, setCancelando: v => { pending = v }, setEstornando: v => { pending = v },
   setError: v => { error = v }, setErro: v => { error = v },
   onClose: () => { completed++ }, onSuccess: () => { completed++ },
   toast: { error: v => { error = v }, success: () => { completed++ } },
   setCancelamento: () => { completed++ }, setEstorno: () => { completed++ }, router: { refresh() {} },
   conta: { id: 1, tipo: 'receber' }, cancelamento: { id: 1, tipo: 'receber' }, estorno: { id: 1, tipo: 'receber' },
   item: action === 'createItemEstoque' ? undefined : { id: 1, ativo: true }, ordem: { id: 1 }, tipo: 'Entrada', passoId: 'passo', valor: '10', quantidade: '1', motivo: 'motivo', documento: '', valorUnitario: '10', parcelado: false, parcelas: 1,
   formData: {}, [action]: actionFn,
  }
  const fn = handler(file, name, context)
  // Stock handlers use event and formData closure; form handlers use FormData argument.
  const data = { get: () => '10', preventDefault() {} }
  context.event = data
  const first = fn(data, data, 'motivo')
  assert.equal(calls, 1)
  assert.equal(pending, true)
  const duplicate = fn(data, data, 'motivo')
  const duplicateCalls = calls
  rejectors.forEach(reject => reject(new Error('controlled connection rejection')))
  await Promise.allSettled([first, duplicate])
  assert.equal(duplicateCalls, 1, 'duplicate submission must not call the action')
  assert.equal(pending, false)
  assert.ok(error, 'failure should be visible')
  assert.equal(completed, 0, 'failure must keep modal open and values available')
  const retry = fn(data, data, 'motivo')
  assert.equal(calls, 2)
  rejectors.at(-1)(new Error('controlled retry rejection'))
  await retry
  assert.equal(pending, false)
  context[action] = async () => ({ success: false, error: 'Controlled business rejection' })
  await fn(data, data, 'motivo')
  assert.equal(pending, false)
  assert.equal(error, 'Controlled business rejection')
  assert.equal(completed, 0)
  context[action] = async () => ({ success: true })
  await fn(data, data, 'motivo')
  assert.equal(pending, false)
  assert.ok(completed > 0, 'success should invoke the existing completion path')
 })
}
test('mobile finance offers OS navigation and cancellation with desktop eligibility', () => {
 const src = fs.readFileSync(path.join(root, 'app/(dashboard)/financeiro/financeiro-view.tsx'), 'utf8')
 const mobile = src.slice(src.indexOf('md:hidden'))
 assert.match(mobile, /href=\{`\/ordens\?id=\$\{item.ordemId\}`\}/)
 assert.match(mobile, /item.liquidado === 0 && item.status !== 'Cancelado'/)
 assert.match(mobile, /onCancelar\(item.id\)/)
})
test('broad historical synchronization has no callable UI action', () => {
 const src = fs.readFileSync(path.join(root, 'app/(dashboard)/financeiro/financeiro-view.tsx'), 'utf8')
 assert.doesNotMatch(src, /sincronizarFinanceiroRetroativo/)
 assert.match(src, /Sincronização histórica indisponível/)
})
