/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Intl,Set,Map,URLSearchParams,require(name){assert.ok(name in deps,`Unexpected dependency ${name}`);return deps[name]}});return exports}
const h=load('lib/dashboard-attention.ts')
const statuses=['Em Produção','Em Prova','Pausado','Finalizado','Entregue','Cancelado']
const orders=statuses.map((status,i)=>({id:i+1,status,nomePaciente:'Paciente sintético '+i,clienteNome:'Clínica fictícia',dataEntrega:new Date('2020-01-01Z'),passoFluxoAtual:null,etapaAtual:status==='Em Prova'?'em_prova':'confeccao',prioridade:'Normal',prazoFornecedor:new Date('2020-01-01Z'),dataRecebimentoFornecedor:null}))
orders.push({...orders[0],id:7,passoFluxoAtual:''},{...orders[0],id:8,passoFluxoAtual:'confeccao'})
const cycles=[...orders.map((ordem,i)=>({id:i+1,ordemId:ordem.id,ordem,numeroCiclo:1,status:'em_prova',decisao:'aprovado',updatedAt:new Date()})),{id:20,ordemId:1,ordem:orders[0],numeroCiclo:2,status:'em_prova',decisao:'ajuste',updatedAt:new Date()},{id:21,ordemId:1,ordem:orders[0],numeroCiclo:3,status:'no_lab',decisao:null,updatedAt:new Date()}]
function matches(row,where){return Object.entries(where).every(([key,condition])=>{const value=row[key];if(condition===null)return value===null;if(typeof condition!=='object')return value===condition;if('in'in condition)return condition.in.includes(value);if('notIn'in condition)return value!==null&&!condition.notIn.includes(value);if('not'in condition)return value!==condition.not;if('lt'in condition||'gte'in condition)return (!('lt'in condition)||value<condition.lt)&&(!('gte'in condition)||value>=condition.gte);return matches(value,condition)})}
const db={ordem:{findMany:async({where})=>where?.id?orders.filter(o=>matches(o,where)):orders.filter(o=>matches(o,where)),count:async({where})=>orders.filter(o=>matches(o,where)).length},cicloProducao:{findMany:async({where})=>cycles.filter(o=>matches(o,where)),count:async({where})=>cycles.filter(o=>matches(o,where)).length},contaReceber:{aggregate:async()=>({_sum:{valor:0},_count:0})},clinicorpSincronizacao:{findFirst:async()=>null}}
const jsx={jsx:(type,props)=>({type,props})}
test('exact selections include proof/vendor/response overlaps, paused cycles and multiple responses; exclude paused/no-stage empty string',async()=>{
 const labInternoAction=load('actions/lab-interno.ts',{
  '@labgest/database':{prisma:db},
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/auth-utils':{requireUser:async()=>({nome:'Teste',email:'test@example.invalid',tipo:'admin'})},
  '@/actions/producao':{getProducao:async()=>[]},
  '@/actions/triagem-whatsapp':{listarTriagemWhatsappOs:async()=>[]},
  '@/lib/clinicorp':{clinicorpConfigurado:()=>false},
  '@/lib/clinicorp-etapas':{aplicarPassoInferidoNaOrdem:async()=>false,carregarInferenciasClinicorpParaOrdens:async()=>new Map()},
  '@/lib/controle-tratamentos':{sincronizarClinicorp:async()=>({})},
  '@/lib/dashboard-attention':h,
  '@/lib/labs-externos-utils':{hojeIso:()=>'2026-11-04',somarDias:()=>'2026-10-05'},
  '@/lib/lab-interno-utils':{JANELA_DESEMPENHO_DIAS:30},
 })
 const labInternoPage=load('app/(dashboard)/lab-interno/page.tsx',{
  '@/actions/lab-interno':{getLabInterno:labInternoAction.getLabInterno},
  './lab-interno-view':{LabInternoView:'view'},
  'react/jsx-runtime':jsx,
 })
 const props=(await labInternoPage.default()).props
 assert.deepEqual(Array.from(props.semEtapaIds),[1,2])
 assert.deepEqual(Array.from(props.retornosDashboard,c=>c.id),[1,2,3,7,8,20])
 const dashboard=load('actions/dashboard.ts',{'@labgest/database':{prisma:db},'@/lib/auth-utils':{requireUser:async()=>({nome:'Teste',email:'test@example.invalid',tipo:'admin'})},'@/lib/dashboard-attention':h})
 const counts=await dashboard.getDashboardData()
 assert.equal(counts.retornosPendentes,props.retornosDashboard.length)
 assert.equal(counts.semEtapa,props.semEtapaIds.length)
 const priorities=load('app/(dashboard)/prioridades/page.tsx',{'@labgest/database':{prisma:db},'@/lib/auth-utils':{requireUser:async()=>({})},'@/lib/workflow-config':{normalizarEtapa:s=>s},'@/lib/dashboard-attention':h,'./prioridades-view':{PrioridadesView:'view'},'react/jsx-runtime':jsx})
 const p=(await priorities.default()).props
 assert.equal(p.prazoVencido.length,counts.atrasadas)
 assert.deepEqual(Array.from(p.prazoVencido,o=>o.id),[1,2,7,8])
 assert.equal(p.atrasados.length,0,'standard action list still deduplicates responses')
 assert.equal(p.hoje.length,counts.entregasHoje)
})
test('day selection includes midnight and excludes next midnight, paused and closed',()=>{
 const today=new Date('2026-11-04Z'),tomorrow=new Date('2026-11-05Z')
 const rows=[{...orders[0],dataEntrega:today},{...orders[0],dataEntrega:tomorrow},{...orders[0],dataEntrega:new Date('2026-11-03T23:59:59Z')},{...orders[2],dataEntrega:today}]
 assert.equal(rows.filter(o=>matches(o,h.entregasDoDia(today,tomorrow))).length,1)
 assert.equal(rows.filter(o=>matches(o,h.ordensAtrasadas(today))).length,1)
})
