/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root=path.resolve(__dirname,'../..')
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const e=React.createElement
function loader(overrides={}) {
 const cache=new Map()
 function load(name,from=path.join(root,'web/src/index.ts')) {
  if(name in overrides)return overrides[name]
  if(name==='next/navigation')return {useRouter:()=>({refresh(){}})}
  if(name==='next/image')return {__esModule:true,default:({src,alt})=>e('img',{src,alt})}
  if(name==='@/components/ui/modal')return {Modal:({isOpen,title,children})=>isOpen?e('section',{'aria-label':title},children):null}
  if(name==='@/components/ui/stl-viewer')return {STLViewer:({url})=>e('div',{'data-stl':url})}
  if(name==='@/actions/mensagens')return {enviarMensagemLab:()=>{throw Error('Unexpected external action')}}
  let filename
  if(name==='@labgest/shared')filename=path.join(root,'packages/shared/src/index.ts')
  else if(name.startsWith('@/'))filename=path.join(root,'web/src',name.slice(2))
  else if(name.startsWith('.'))filename=path.resolve(path.dirname(from),name)
  else return require(require.resolve(name,{paths:[root+'/web',root]}))
  if(!fs.existsSync(filename))filename=['.ts','.tsx','.js'].map(ext=>filename+ext).find(fs.existsSync)
  assert.ok(filename,'Missing '+name)
  if(cache.has(filename))return cache.get(filename)
  const exports={};cache.set(filename,exports)
  const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  vm.runInNewContext(source,{exports,require:dep=>load(dep,filename),Date,Intl,console,process:{env:{}}},{filename})
  return exports
 }
 return load
}
const detalhe={status:'Em Produção',etapaAtual:'confeccao',passoFluxoAtual:'montagem_dentes',dataEntrada:'2026-11-04T00:00:00.000Z',dataEntrega:'2026-11-12T00:00:00.000Z',dataFinalizacao:null,dataEntregaReal:null,prazoEtapaAtual:'2026-11-05T01:00:00Z',prazoFornecedor:null,movimentacaoLogisticaEm:null,cobrancas:[{id:11,valor:500,valorRecebido:150,status:'Parcial',dataVencimento:'2026-12-01T00:00:00Z',dataRecebimento:null,canceladoEm:null},{id:12,valor:700,valorRecebido:0,status:'Cancelado',dataVencimento:'2026-12-15T00:00:00Z',dataRecebimento:null,canceladoEm:'2026-11-03T12:00:00Z'}]}
const ordem={id:1,paciente:'Ana Sintética',cliente:{nome:'Clínica de teste'},servico:'Prótese sintética',status:'Em Produção',prioridade:'Alta',etapaAtual:'confeccao',tipoWorkflow:'protese_total_removivel',valor:500,dataEntrega:'2026-11-12T00:00:00Z',localizacaoAtual:'laboratorio',situacaoLogistica:'no_laboratorio',ficha:detalhe,historicoEtapas:[{acao:'criou',data:'2026-11-04T12:00:00Z'}],mensagens:[{id:'1',role:'dentista',nome:'Dentista teste',texto:'Mensagem da OS 1',createdAt:'2026-11-04T12:00:00Z'}],arquivos:['https://example.invalid/modelo.stl'],fotosCaso:['https://example.invalid/foto.png']}
const load=loader(), Modal=load('@/components/ordens/visualizar-ordem-modal').VisualizarOrdemModal
const render=o=>renderToStaticMarkup(e(Modal,{isOpen:true,onClose(){},ordem:o}))
test('existing OS detail separates four domains, civil dates and billing without conflating order value',()=>{
 const html=render(ordem)
 for(const label of ['Resumo da OS','Etapa de produção','Localização física','Prazos e eventos','Situação financeira','Valor da OS','Valor da cobrança','Recebido registrado','Parcial','Cobrança cancelada','Previsão de entrega','Conclusão da produção','Entrega física registrada','Vencimento financeiro','12/11/2026','01/12/2026','04/11/2026'])assert.ok(html.includes(label),label)
 assert.ok(html.includes('Montagem dos dentes'))
 assert.ok(html.includes('Mensagem da OS 1'))
 assert.ok(html.includes('modelo.stl'))
 assert.ok(html.includes('Fotos Clínicas do Caso'))
 assert.ok(html.indexOf('Resumo da OS')<html.indexOf('Etapa de produção'))
})
test('missing original data never turns into fabricated stage, current date or settled finances; zero survives',()=>{
 const html=render({...ordem,valor:0,localizacaoAtual:undefined,situacaoLogistica:undefined,ficha:{...detalhe,status:null,etapaAtual:null,passoFluxoAtual:null,dataEntrada:null,dataEntrega:null,prazoEtapaAtual:null,cobrancas:[]}})
 for(const label of ['Etapa não informada','Localização não informada','Não informado','Nenhuma cobrança vinculada','R$ 0,00'])assert.ok(html.includes(label),label)
 assert.ok(!html.includes('Quitado'));assert.ok(!html.includes('12/11/2026'))
})
test('order status is retained independently from location and financial status',()=>{
 for(const status of ['Em Produção','Finalizado','Entregue','Cancelado','Pausado']){
  const html=render({...ordem,status,ficha:{...detalhe,status}})
  assert.ok(html.includes(status));assert.ok(html.includes('No laboratório'));assert.ok(html.includes('Parcial'))
 }
})
test('authenticated getter adds original nullable facts and all linked accounts; public getter remains unchanged',async()=>{
 const calls=[];let query
 const record={id:1,nomePaciente:'Ana',valor:999,valorFinal:0,dataPedido:null,dataEntrega:null,etapaAtual:null,status:null,contasReceber:[{id:11,valor:500,valorRecebido:150,status:'Parcial',dataVencimento:new Date('2026-12-01Z'),dataRecebimento:null,canceladoEm:null},{id:12,valor:700,valorRecebido:0,status:'Cancelado',dataVencimento:new Date('2026-12-02Z'),dataRecebimento:null,canceladoEm:new Date('2026-11-03Z')}]}
 const deny=()=>{throw Error('Unexpected write')}
 const actions=loader({'@labgest/database':{prisma:{ordem:{findUnique:async q=>{calls.push('read');query=q;return record}},$transaction:deny}},'next/cache':{revalidatePath:deny},'@/lib/auth-utils':{requireUser:async()=>{calls.push('auth');return {}}},'@/lib/finalizacao-ordem':{},'@/lib/exclusao-ordem':{}})('@/actions/ordens')
 const result=await actions.getOrdemById(1)
 assert.deepEqual(calls,['auth','read']);assert.ok(query.include.contasReceber?.select)
 assert.equal(query.include.contasReceber.where,undefined,'do not hide cancelled accounts')
 assert.equal(result.valor,0);assert.equal(result.ficha.dataEntrega,null);assert.equal(result.ficha.etapaAtual,null)
 assert.equal(result.ficha.cobrancas.length,2);assert.equal(result.ficha.cobrancas[0].valorRecebido,150)
 const source=fs.readFileSync(path.join(root,'web/src/actions/ordens.ts'),'utf8').split('export async function getOrdemPublic')[1].split('export async function deleteOrdem')[0]
 assert.ok(!source.includes('contasReceber'));assert.ok(!source.includes('ficha:'))
})
test('civil dates do not shift, timestamps use laboratory time across midnight, and unloaded billing is honest',()=>{
 const helpers=load('@/components/ordens/resumo-ordem')
 assert.equal(helpers.dataCivilFicha('2026-11-05T00:00:00Z'),'05/11/2026')
 assert.ok(helpers.instanteFicha('2026-11-05T01:00:00Z').includes('04/11/2026'))
 assert.ok(helpers.instanteFicha('2026-11-05T01:00:00Z').includes('22:00'))
 assert.equal(helpers.instanteFicha(null),'Não informado')
 const html=render({...ordem,ficha:undefined});assert.ok(html.includes('Informações de cobrança não carregadas.'));assert.ok(!html.includes('Quitado'))
})
test('detail rejects unauthenticated reads before accessing linked financial data',async()=>{
 let reads=0
 const actions=loader({'@labgest/database':{prisma:{ordem:{findUnique:async()=>{reads++;return null}}}},'next/cache':{},'@/lib/auth-utils':{requireUser:async()=>{throw Error('unauthenticated')}},'@/lib/finalizacao-ordem':{},'@/lib/exclusao-ordem':{}})('@/actions/ordens')
 await assert.rejects(actions.getOrdemById(1),/unauthenticated/);assert.equal(reads,0)
})

for (const [name,ficha,expected] of [
 ['null step',{...detalhe,passoFluxoAtual:null},'Não informado'],
 ['unknown step',{...detalhe,passoFluxoAtual:'passo_desconhecido'},'passo_desconhecido'],
 ['missing ficha',undefined,'Não informado'],
]) test(`valid workflow with ${name} never invents the first step`,()=>{
 const html=render({...ordem,ficha})
 assert.ok(!html.includes('Moldagem de estudo'))
 assert.match(html,new RegExp('Passo detalhado</dt><dd[^>]*>'+expected+'</dd>'))
})
