/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const date = s => new Date(s + 'T00:00:00Z')
function matches(row, where = {}) {
  return Object.entries(where).every(([k,v]) => {
    if(k === 'OR') return v.some(w => matches(row,w))
    if(k === 'AND') return v.every(w => matches(row,w))
    if(v === null) return row[k] == null
    if(typeof v !== 'object') return row[k] === v
    return Object.entries(v).every(([op,x]) => op === 'not' ? row[k] !== x : op === 'notIn' ? !x.includes(row[k]) : op === 'in' ? x.includes(row[k]) : op === 'equals' ? row[k]?.toLowerCase() === x.toLowerCase() : op === 'mode' ? true : op === 'gte' ? row[k] >= x : op === 'lt' ? row[k] < x : op === 'lte' ? row[k] <= x : false)
  })
}
function table(rows) { return { findMany: async (q={}) => rows.filter(r=>matches(r,q.where)), aggregate: async q => {const r=rows.filter(r=>matches(r,q.where));return {_sum:{valor:r.reduce((s,c)=>s+c.valor,0)},_count:r.length}}, count:async()=>0 } }
function load(file, prisma) {
 const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,console,process:{env:{}},require:n=>{
 if(n==='@labgest/database')return {prisma};if(n==='@/lib/auth-utils')return {requireUser:async()=>({nome:'test',permissoes:[]})};if(n==='@google/generative-ai')return {GoogleGenerativeAI:class{}};if(n==='next/cache')return {revalidatePath(){throw Error('mutation')}};if(n.startsWith('@/lib/'))return load('web/src/'+n.slice(2)+'.ts',prisma);if(['zod','node:crypto'].includes(n))return require(n);throw Error(n)
 }});return exports
}
function base() {return {ordem:{...table([]),groupBy:async()=>[]},cicloProducao:table([]),cliente:{...table([{id:1,nome:'Renamed'},{id:2,nome:'Same'}]),findUnique:async q=>q.where.id===1?{id:1,nome:'Same'}:null},contaReceber:table([]),contaPagar:table([]),contaFinanceira:table([]),movimentacaoFinanceira:table([])}}
test('F1 dashboard residual active balance and real nonreversed cash',async()=>{
 const p=base(), today=new Date(); today.setUTCHours(0,0,0,0)
 p.contaReceber=table([{valor:100,valorRecebido:60,status:'Parcial',dataVencimento:today},{valor:200,valorRecebido:0,status:'Cancelado',dataVencimento:today},{valor:50,valorRecebido:0,status:'Pendente',canceladoEm:today,dataVencimento:today},{valor:20,valorRecebido:20,status:'Recebido',dataVencimento:today}]);p.movimentacaoFinanceira=table([{tipo:'Entrada',valor:60,dataMovimentacao:today,estornadaEm:null},{tipo:'Entrada',valor:40,dataMovimentacao:today,estornadaEm:today},{tipo:'Saida',valor:5,dataMovimentacao:today,estornadaEm:null}])
 const r=await load('web/src/actions/dashboard.ts',p).getDashboardData();assert.equal(r.saldoEmAberto,40);assert.equal(r.recebidoMes,60);assert.equal(r.contasEmAberto,1);assert.equal(r.vencendoSeteDias,40)
})
const charge=(id,clienteId,clienteNome)=>({id,clienteId,clienteNome,valor:100,valorRecebido:0,status:'Pendente',canceladoEm:null,dataVencimento:date('2026-11-01')})
test('F2 selected identity excludes homonyms and unlinked legacy; omitted selection stays global',async()=>{
 const p=base();p.contaReceber=table([charge(1,1,'Old name'),charge(2,2,'Same'),charge(3,null,'Same')]);const a=load('web/src/actions/relatorios.ts',p)
 assert.deepEqual(Array.from((await a.getRelatorioOrdensEntregues('2026-11',1)).itens,x=>x.id),[1]);assert.equal((await a.getRelatorioOrdensEntregues('2026-11')).itens.length,3)
})
test('F2 invalid/nonexistent selected ID fails closed with explicit error',async()=>{
 const p=base();p.contaReceber=table([charge(1,1,'Same')]);const a=load('web/src/actions/relatorios.ts',p)
 for(const id of [999,0,-1,NaN,1.5]){const r=await a.getRelatorioOrdensEntregues('2026-11',id);assert.equal(r.itens.length,0);assert.ok(r.error)}
})
test('F4 ranking uses selected valid order sales by ID with current names',async()=>{
 const p=base();let query;p.ordem.groupBy=async q=>{query=q;return [{clienteId:1,_sum:{valorFinal:80},_count:{id:2}},{clienteId:2,_sum:{valorFinal:60},_count:{id:1}}]}
 const r=await load('web/src/actions/relatorios.ts',p).getRelatorioFinanceiro('2026-11');assert.deepEqual(Array.from(query.by),['clienteId']);assert.equal(query.where.createdAt.gte.toISOString(),'2026-11-01T03:00:00.000Z');assert.equal(query.where.createdAt.lt.toISOString(),'2026-12-01T03:00:00.000Z');assert.equal(matches({clienteId:1,status:'Cancelado',createdAt:date('2026-11-05')},query.where),false);assert.equal(matches({clienteId:null,status:'Entregue',createdAt:date('2026-11-05')},query.where),false);assert.equal(r.topClientes[0].nome,'Renamed');assert.equal(r.topClientes[0].ticket,40);assert.equal(r.periodoRanking,'2026-11')
})
test('F3 portal preserves civil first-day dates',()=>{const source=fs.readFileSync(path.join(root,'portal/src/app/(dashboard)/financeiro/financeiro-view.tsx'),'utf8'); const body=source.match(/function formatDate\(value: string\) \{([^\n]+)\}/)[1];const f=new Function('value',body);assert.equal(f('2026-11-01T00:00:00.000Z'),'01/11/2026');assert.equal(f('2027-01-01T00:00:00.000Z'),'01/01/2027')})
test('F5 payer and ledger civil month boundaries match receiver',async()=>{
 const p=base();let payer,ledger;p.contaPagar.findMany=async q=>{if(q.where)payer=q.where.dataVencimento;return []};p.movimentacaoFinanceira.findMany=async q=>{ledger=q.where.dataMovimentacao;return []};await load('web/src/actions/financeiro.ts',p).getFinanceiroPageData('2026-11');for(const q of [payer,ledger]){assert.equal(q.gte.toISOString(),'2026-11-01T00:00:00.000Z');assert.equal(q.lt?.toISOString(),'2026-12-01T00:00:00.000Z')}
})
test('F2 conflicting linked order never exposes another clinic patient',async()=>{
 const p=base();p.contaReceber=table([{...charge(1,1,'Same'),ordemId:99,descricao:'Safe charge',ordem:{clienteId:2,nomePaciente:'SECRET OTHER PATIENT',servicoNome:'OTHER SERVICE',dataEntrega:date('2026-11-01')}}]);const r=await load('web/src/actions/relatorios.ts',p).getRelatorioOrdensEntregues('2026-11',1);assert.equal(r.itens[0].paciente,'Vínculo da ordem requer revisão');assert.equal(r.itens[0].ordemId,null);assert.equal(r.itens[0].servico,'Vínculo da ordem requer revisão')
})
