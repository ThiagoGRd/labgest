/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
function load(file, prisma, Clock = Date) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date:Clock,Intl,console,require:n=>{
 if(n==='@labgest/shared')return load('../../packages/shared/src/date-civil.ts',prisma,Clock);if(n==='@labgest/database')return {prisma};if(n==='@/lib/auth-utils')return {requireUser:async()=>({id:1,nome:'Synthetic'})};if(n==='next/cache')return {revalidatePath(){}};if(n.startsWith('@/lib/'))return load(n.slice(2)+'.ts',prisma,Clock);if(['zod','node:crypto'].includes(n))return require(n);throw Error(n)
 }});return exports
}
function fixture(Clock) {
 const writes=[], locks=[]
 const account={id:1,valor:100,valorRecebido:0,valorPago:0,status:'Pendente'}
 const table=name=>({findUnique:async()=>account,create:async({data})=>{writes.push({name,...data});return {id:1,...data}},update:async({data})=>{writes.push({name,...data});return data}})
 const prisma={cliente:{findUnique:async()=>({nome:'Synthetic'})},contaReceber:table('receber'),contaPagar:table('pagar'),movimentacaoFinanceira:table('caixa'),contaFinanceira:{findFirst:async()=>null},$queryRaw:async strings=>{locks.push(strings[0]);return []}}
 prisma.$transaction=async fn=>typeof fn==='function'?fn(prisma):Promise.all(fn)
 return {a:load('actions/financeiro.ts',prisma,Clock),writes,locks,prisma}
}
for(const [due,expected] of [
 ['2026-12-31',['2026-12-31','2027-01-31','2027-02-28','2027-03-31']],
 ['2028-01-31',['2028-01-31','2028-02-29','2028-03-31','2028-04-30']],
])test(`installments preserve anchored civil month/year/end-month ${due}`,async()=>{
 const {a,writes}=fixture();assert.equal((await a.createConta({tipo:'pagar',descricao:'Synthetic installments',valor:100,vencimento:due,competencia:'2026-11-01',parcelas:4})).success,true)
 assert.deepEqual(writes.map(w=>w.dataVencimento.toISOString()),expected.map(s=>s+'T00:00:00.000Z'))
 assert.ok(writes.every(w=>w.dataCompetencia.toISOString()==='2026-11-01T00:00:00.000Z'))
 assert.equal(writes.reduce((sum,w)=>sum+w.valor,0),100)
})
for(const tipo of ['receber','pagar'])test(`${tipo} explicit create/edit/settlement dates are UTC civil carriers`,async()=>{
 const {a,writes,locks}=fixture()
 assert.equal((await a.createConta({tipo,clienteId:1,descricao:'Synthetic charge',valor:100,vencimento:'2026-11-01',competencia:'2026-10-31'})).success,true)
 assert.equal(writes[0].dataVencimento.toISOString(),'2026-11-01T00:00:00.000Z');assert.equal(writes[0].dataCompetencia.toISOString(),'2026-10-31T00:00:00.000Z')
 assert.equal((await a.editarConta(1,tipo,{descricao:'Edited charge',valor:100,vencimento:'2027-01-01'})).success,true)
 assert.equal(writes[1].dataVencimento.toISOString(),'2027-01-01T00:00:00.000Z')
 assert.equal((await a.liquidarConta({id:1,tipo,valor:100,data:'2027-01-01',formaPagamento:'PIX'})).success,true)
 assert.equal(writes[2].dataMovimentacao.toISOString(),'2027-01-01T00:00:00.000Z')
 assert.equal(writes[3][tipo==='receber'?'dataRecebimento':'dataPagamento'].toISOString(),'2027-01-01T00:00:00.000Z')
 assert.equal(locks.length,2)
})
test('invalid civil day rejects edits before opening mutation transaction',async()=>{
 const {a,writes,locks}=fixture();assert.equal((await a.editarConta(1,'receber',{descricao:'Invalid date',valor:100,vencimento:'2026-02-30'})).success,false);assert.equal(writes.length,0);assert.equal(locks.length,0)
})
for(const finalization of [new Date('2026-11-01T00:00:00Z'),null])test(`automatic billing preserves recorded civil date or uses lab day ${finalization}`,async()=>{
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2027-01-01T02:59:59Z']))}}
 const {a,prisma,writes}=fixture(Clock);prisma.ordem={findUnique:async()=>({id:1,dataFinalizacao:finalization,valorFinal:100})};prisma.contaReceber.findFirst=async()=>null
 assert.equal((await a.gerarCobrancaAutomatica(1)).success,true)
 const expected=finalization?'2026-11-01T00:00:00.000Z':'2026-12-31T00:00:00.000Z'
 assert.equal(writes[0].dataCompetencia.toISOString(),expected);assert.equal(writes[0].dataVencimento.toISOString(),expected)
})
test('legacy settlement default uses today in laboratory before UTC year changes',async()=>{
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2027-01-01T02:59:59Z']))}}
 const {a,writes}=fixture(Clock);assert.equal((await a.baixarConta(1,'receber')).success,true);assert.equal(writes[0].dataMovimentacao.toISOString(),'2026-12-31T00:00:00.000Z')
})
