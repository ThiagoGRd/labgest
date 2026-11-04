/* eslint-disable @typescript-eslint/no-require-imports */
// Genuine Prisma read regressions; only externally provisioned disposable localhost schema.
// Run twice with TZ=UTC and TZ=America/Sao_Paulo. Synthetic fixtures remain for inspection.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:','postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1','[::1]'].includes(url.hostname))
assert.equal(url.pathname,'/labgest_finance_test')
assert.equal(url.searchParams.get('schema'),'labgest_prisma_test')
assert.equal(url.searchParams.getAll('schema').length,1)
assert.ok([...url.searchParams.keys()].every(k=>k==='schema'))
assert.equal(url.hash,'')
assert.equal(url.username,'labgest_archive_test');assert.equal(url.password,'synthetic-only')
const {PrismaClient,Prisma}=require('@prisma/client')
const prisma=new PrismaClient({datasources:{db:{url:url.toString()}}})
function load(file) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,console,process:{env:{}},require:n=>{if(n==='@labgest/shared')return load('../../packages/shared/src/date-civil.ts');if(n==='@labgest/database')return {prisma,Prisma};if(n==='@/lib/auth-utils')return {requireUser:async()=>({nome:'synthetic reports',permissoes:[]})};if(n==='next/cache')return {revalidatePath(){throw Error('Unexpected mutation')}};if(n==='@google/generative-ai')return {GoogleGenerativeAI:class{}};if(n.startsWith('@/lib/'))return load(n.slice(2)+'.ts');if(['zod','node:crypto'].includes(n))return require(n);throw Error(n)}});return exports}
const d=s=>new Date(s+'T00:00:00Z')
async function main(){try{
 const endpoint=(await prisma.$queryRaw`SELECT current_database() db,current_schema() schema,host(inet_server_addr()) address`)[0];assert.equal(endpoint.db,'labgest_finance_test');assert.equal(endpoint.schema,'labgest_prisma_test');assert.ok(['127.0.0.1','::1'].includes(endpoint.address));
 const label='reports-'+Date.now(), clientes=[]
 for(let i=0;i<2;i++)clientes.push(await prisma.cliente.create({data:{nome:label,cro:label+'-'+i,telefone:'00000000000'}}))
 const report=load('actions/relatorios.ts'), dashboard=load('actions/dashboard.ts'), finance=load('actions/financeiro.ts')
 const before=await dashboard.getDashboardData(), today=new Date();today.setUTCHours(0,0,0,0)
 const partial=await prisma.contaReceber.create({data:{descricao:label,clienteId:clientes[0].id,clienteNome:label,valor:100,valorRecebido:60,status:'Parcial',dataVencimento:today}})
 await prisma.contaReceber.create({data:{descricao:label,valor:200,status:'Cancelado',dataVencimento:today}})
 await prisma.movimentacaoFinanceira.createMany({data:[{tipo:'Entrada',valor:60,dataMovimentacao:today,contaReceberId:partial.id},{tipo:'Entrada',valor:99,dataMovimentacao:today,estornadaEm:new Date()}]})
 const after=await dashboard.getDashboardData();assert.equal(after.saldoEmAberto-before.saldoEmAberto,40);assert.equal(after.recebidoMes-before.recebidoMes,60);assert.equal(after.contasEmAberto-before.contasEmAberto,1)
 console.log('PASS F1 PostgreSQL partial/cancelled/reversed dashboard deltas')
 const charges=[];for(const clienteId of [clientes[0].id,clientes[1].id,null])charges.push(await prisma.contaReceber.create({data:{descricao:label,clienteId,clienteNome:label,valor:100,dataVencimento:d('2042-11-01')}}))
 await prisma.cliente.update({where:{id:clientes[0].id},data:{nome:label+' renamed'}})
 const result=await report.getRelatorioOrdensEntregues('2042-11',clientes[0].id);assert.deepEqual(Array.from(result.itens,x=>x.id),[charges[0].id])
 const invalid=await report.getRelatorioOrdensEntregues('2042-11',2147483647);assert.ok(invalid.error);assert.equal(invalid.itens.length,0)
 console.log('PASS F2 PostgreSQL homonym/rename/null-ID isolation and missing ID')
 for(const [clienteId,status,createdAt,value] of [[clientes[0].id,'Entregue','2042-11-01T03:00:00Z',80],[clientes[0].id,'Cancelado','2042-11-05T03:00:00Z',900],[clientes[0].id,'Entregue','2042-11-01T02:59:59Z',900],[clientes[1].id,'Entregue','2042-11-05T03:00:00Z',60]])await prisma.ordem.create({data:{clienteId,clienteNome:label,servicoNome:label,nomePaciente:label,valor:1000,valorFinal:value,dataEntrega:d('2042-11-15'),status,createdAt:new Date(createdAt)}})
 const ranking=await report.getRelatorioFinanceiro('2042-11');const ranked=ranking.topClientes.find(c=>c.id===clientes[0].id);assert.equal(ranked.total,80);assert.equal(ranked.qtd,1);assert.equal(ranked.nome,label+' renamed')
 console.log('PASS F4 PostgreSQL month/status/ID/current-name/final-value ranking')
 const payer=[];for(const day of ['2042-11-01','2042-11-30','2042-12-01'])payer.push(await prisma.contaPagar.create({data:{descricao:label,valor:7,dataVencimento:d(day)}}))
 const beforeGraph=await report.getRelatorioFinanceiro('2042-11');const beforeNovember=beforeGraph.grafico.find(c=>c.mes.includes('nov')).receita
 const cash=[];for(const day of ['2042-11-01','2042-11-30','2042-12-01'])cash.push(await prisma.movimentacaoFinanceira.create({data:{tipo:'Entrada',valor:7,dataMovimentacao:d(day)}}))
 const data=await finance.getFinanceiroPageData('2042-11');assert.ok(data.pagar.some(c=>c.id===payer[0].id));assert.ok(data.pagar.some(c=>c.id===payer[1].id));assert.ok(!data.pagar.some(c=>c.id===payer[2].id))
 assert.ok(data.movimentacoes.some(c=>c.id===cash[0].id));assert.ok(data.movimentacoes.some(c=>c.id===cash[1].id));assert.ok(!data.movimentacoes.some(c=>c.id===cash[2].id))
 const graph=await report.getRelatorioFinanceiro('2042-11');assert.equal(graph.grafico.find(c=>c.mes.includes('nov')).receita-beforeNovember,14)
 console.log('PASS F5 PostgreSQL civil date first/last/month-next payer and cash chart')
}finally{await prisma.$disconnect()}}
main().catch(e=>{console.error(e);process.exitCode=1})
