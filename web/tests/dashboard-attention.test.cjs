/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')
const read = p => fs.readFileSync(path.join(__dirname, '../src', p), 'utf8')
function helper() {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(read('lib/dashboard-attention.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, URLSearchParams })
  return exports
}
test('four attention shortcuts target distinct announced selections', () => {
  const src = read('app/(dashboard)/dashboard/dashboard-view.tsx')
  for (const url of ['/prioridades?atencao=atrasadas', '/prioridades?atencao=hoje', '/producao?atencao=retornos', '/producao?atencao=sem-etapa']) assert.ok(src.includes(url), url)
})
test('attention precedes metrics; monthly report is collapsed after search', () => {
  const dashboard = read('app/(dashboard)/dashboard/dashboard-view.tsx')
  assert.ok(dashboard.indexOf('O que precisa de atenção') < dashboard.indexOf('aria-label="Indicadores principais"'))
  const orders = read('app/(dashboard)/ordens/ordens-view.tsx')
  assert.match(orders, /<details[^>]*>\s*<summary[^>]*>Relatórios e impressão<\/summary>/)
  assert.ok(orders.indexOf('<form') < orders.indexOf('Relatórios e impressão'))
  assert.ok(orders.indexOf('<form') < orders.indexOf("label: 'Ordens ativas'"), 'search before order counters')
})
test('context validation and clearing preserve unrelated URL parameters', () => {
  const h = helper()
  for (const value of [null, '', 'invalid', 'retornos']) assert.equal(h.contextoAtencao(value, 'prioridades'), null)
  assert.equal(h.contextoAtencao('atrasadas', 'prioridades'), 'atrasadas')
  assert.equal(h.contextoAtencao('hoje', 'prioridades'), 'hoje')
  assert.equal(h.contextoAtencao('retornos', 'producao'), 'retornos')
  assert.equal(h.contextoAtencao('sem-etapa', 'producao'), 'sem-etapa')
  assert.equal(h.limparAtencao('/producao', 'atencao=retornos&busca=Ana'), '/producao?busca=Ana')
  assert.equal(h.limparAtencao('/prioridades', 'atencao=hoje'), '/prioridades')
})
test('production loads all responded cycles and exact no-stage IDs without latest-cycle shortcut', () => {
  const src = read('app/(dashboard)/producao/page.tsx')
  assert.match(src, /prisma\.cicloProducao\.findMany/)
  assert.match(src, /where: retornosRespondidos/)
  assert.match(src, /where: ordensSemEtapa/)
  assert.doesNotMatch(src, /take: 1/)
})
test('shared query predicates preserve paused, null and date boundary semantics', () => {
  const h = helper()
  const plain = x => JSON.parse(JSON.stringify(x))
  assert.deepEqual(plain(h.retornosRespondidos), {status:'em_prova',decisao:{not:null},ordem:{status:{notIn:['Finalizado','Cancelado','Entregue']}}})
  assert.deepEqual(plain(h.ordensSemEtapa), {status:{notIn:['Finalizado','Cancelado','Entregue','Pausado']},passoFluxoAtual:null})
  const hoje = new Date('2026-11-04Z'), amanha = new Date('2026-11-05Z')
  assert.equal(h.ordensAtrasadas(hoje).dataEntrega.lt, hoje)
  assert.equal(h.entregasDoDia(hoje, amanha).dataEntrega.lt, amanha)
  assert.equal(h.entregasDoDia(hoje, amanha).dataEntrega.gte, hoje)
})
test('priorities names the unchanged unfiltered report explicitly', () => {
  const src = read('app/(dashboard)/prioridades/prioridades-view.tsx')
  assert.ok(src.includes('Relatório geral'))
  assert.ok(src.includes('respostasDentista: props.respostasDentista'))
  assert.ok(src.includes('hoje: props.hoje'))
})
