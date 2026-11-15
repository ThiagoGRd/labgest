/* eslint-disable @typescript-eslint/no-require-imports */
// Real detail, chat, Radix modal and Tailwind. Actions and scene environment are local substitutes.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http')
const esbuild=require('esbuild'),{chromium}=require('playwright'),{createRequire}=require('node:module')
const {orderFixtures}=require('./order-detail-fixtures.cjs')
const webRoot=path.resolve(__dirname,'..'),root=path.dirname(webRoot),webRequire=createRequire(path.join(webRoot,'package.json'))
const qa=process.env.ORDER_DETAIL_QA || path.join(root,'delivery/order-detail-qa')
const entry=`
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{VisualizarOrdemModal}from'@/components/ordens/visualizar-ordem-modal';
import{PrioridadesView}from'@/app/(dashboard)/prioridades/prioridades-view';
import{ProducaoView}from'@/app/(dashboard)/producao/producao-view';
window.actionCalls=[];
function App(){const[id,setId]=useState(null);const[revision,setRevision]=useState(0);window.selectOrder=id=>{setId(id);setRevision(x=>x+1)};
 if(location.pathname==='/producao'){const o=window.orders[1];return <ProducaoView initialOrdens={[{id:1,paciente:o.paciente,dentista:o.cliente.nome,servico:o.servico,status:o.status,etapa:o.etapaAtual,entrega:o.dataEntrega,prioridade:o.prioridade,tipoWorkflow:o.tipoWorkflow,passoFluxoAtual:null,cicloAtivoId:11,cicloStatus:'em_prova',cicloDentistaDeci:'aprovado'}]} semEtapaIds={[1]} retornosDashboard={[{id:11,numeroCiclo:1,decisao:'aprovado',ordemId:1,paciente:o.paciente,cliente:o.cliente.nome,status:o.status}]}/>};
 if(location.pathname==='/prioridades'){const o=window.orders[1];const row={id:1,nomePaciente:o.paciente,clienteNome:o.cliente.nome,servicoNome:o.servico,dataEntrega:o.dataEntrega,etapaAtual:o.etapaAtual,status:o.status,prioridade:o.prioridade,cpfCadastrado:false};return <PrioridadesView user={{nome:'Teste',email:'test@example.invalid',tipo:'Administrador'}} respostasDentista={[]} fornecedorAtrasado={[]} atrasados={[row]} prazoVencido={[row]} provasPendentesClinicorp={[]} hoje={[row]} urgentes={[]} proximos={[]} clinicorpConfigurado={false} dataReferencia="2026-11-04T00:00:00Z"/>}
 return <main><p>QA local — ficha existente, dados sintéticos e Tailwind real</p><button onClick={()=>setId(1)}>Abrir OS 1</button><button onClick={()=>setId(2)}>Abrir OS 2</button><VisualizarOrdemModal isOpen={id!==null} ordem={id?window.orders[id]:null} onClose={()=>setId(null)}/></main>;
}createRoot(document.getElementById('root')).render(<App/>);`
async function main(){
 let server,browser
 await fs.mkdir(qa,{recursive:true})
 const unexpected=[];let stlRequests=0
 try{
  const result=await esbuild.build({stdin:{contents:entry,loader:'tsx',resolveDir:webRoot},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"','process.env.NEXT_PUBLIC_SUPABASE_URL':'""','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'""'},plugins:[{name:'isolated',setup(build){
   build.onResolve({filter:/^@\/actions\//},args=>({path:path.join(webRoot,'src',args.path.slice(2)+'.ts'),namespace:'actions'}))
   build.onLoad({filter:/.*/,namespace:'actions'},async args=>{const src=await fs.readFile(args.path,'utf8');const names=[...src.matchAll(/export async function (\w+)/g)].map(m=>m[1]);return {contents:names.map(name=> name==='getOrdemById'?`export async function getOrdemById(id){window.actionCalls.push({action:'read',id});return window.orders[id]}`:name==='enviarMensagemLab'?`export async function enviarMensagemLab(id,texto,foto){window.actionCalls.push({action:'message',id,texto,foto});return{success:true,mensagem:{id:'sent-'+Date.now(),role:'lab',nome:'Equipe QA',texto,createdAt:'2026-11-04T12:00:00Z'}}}`:`export async function ${name}(){throw Error('Unexpected action: ${name}')}`).join('\n'),loader:'js'}})
   build.onResolve({filter:/^next\/(navigation|image)$/},args=>({path:args.path,namespace:'next'}))
   build.onLoad({filter:/.*/,namespace:'next'},args=>({contents:args.path==='next/image'?`import React from'react';export default function Image({fill,unoptimized,...props}){return <img {...props}/>} `:`import React from'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export function useSearchParams(){return new URLSearchParams(React.useSyncExternalStore(subscribe,()=>location.search))};export function usePathname(){return location.pathname};export function useRouter(){return{push:url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'))},refresh(){}}}`,loader:'jsx',resolveDir:webRoot}))
   build.onResolve({filter:/^@\/components\/layout\/(dashboard-layout|header)$/},args=>({path:args.path,namespace:'shell'}))
   build.onLoad({filter:/.*/,namespace:'shell'},()=>({contents:`import React from'react';export const DashboardLayout=({children})=><main>{children}</main>;export const Header=({title})=><h1>{title}</h1>`,loader:'jsx',resolveDir:webRoot}))
   build.onResolve({filter:/^@react-three\/drei$/},()=>({path:'scene',namespace:'scene'}))
   build.onLoad({filter:/.*/,namespace:'scene'},()=>({contents:`import React from'react';export {OrbitControls} from '@react-three/drei/core/OrbitControls';export const Stage=({children})=><group><ambientLight intensity={2}/>{children}</group>`,loader:'jsx',resolveDir:webRoot}))
   build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'blocked',namespace:'storage'}))
   build.onLoad({filter:/.*/,namespace:'storage'},()=>({contents:`export function createClient(){throw Error('External storage blocked in QA')}`,loader:'js'}))
   build.onResolve({filter:/^@\//},args=>{const base=path.join(webRoot,'src',args.path.slice(2));return {path:require('node:fs').existsSync(base+'.tsx')?base+'.tsx':base+'.ts'}})
  }}]})
  const cssPath=path.join(webRoot,'src/app/globals.css');const css=(await webRequire('postcss')([webRequire('@tailwindcss/postcss')({base:webRoot})]).process(await fs.readFile(cssPath,'utf8'),{from:cssPath})).css
  const stl='solid qa\nfacet normal 0 0 1\nouter loop\nvertex -40 -30 0\nvertex 40 -30 0\nvertex 0 40 0\nendloop\nendfacet\nendsolid qa'
  server=http.createServer((req,res)=>{
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(result.outputFiles[0].text)}
   else if(req.url==='/app.css'){res.setHeader('Content-Type','text/css');res.end(css)}
   else if(req.url==='/modelo.stl'){stlRequests++;res.setHeader('Content-Type','model/stl');res.end(stl)}
   else if(req.url==='/foto.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#c7d2fe"/><text x="8" y="50">Foto QA</text></svg>')}
   else if(req.url==='/ficha.pdf'){res.setHeader('Content-Type','application/pdf');res.end('%PDF-1.4\n% synthetic QA only')}
   else{const origin='http://'+req.headers.host;res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script>window.orders=${JSON.stringify(orderFixtures(origin))}</script><script src="/app.js"></script>`)}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']})
  const context=await browser.newContext({timezoneId:'America/Sao_Paulo'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER ERROR:',e.message)})
  await page.route('**/*',route=>{if(route.request().url().startsWith(origin+'/'))return route.continue();unexpected.push(route.request().url());return route.abort()})
  const shot=async name=>{await page.waitForTimeout(250);await page.screenshot({path:path.join(qa,name+'.png')})}
  const fit=async()=>assert.ok(await page.locator('[role=dialog]').evaluate(el=>el.scrollWidth<=el.clientWidth),'dialog horizontal fit')
  const logs=[]
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/ficha-teste');await page.getByText('Abrir OS 1',{exact:true}).click();await page.getByRole('dialog').waitFor();await fit()
   assert.ok(await page.getByRole('region',{name:'Resumo da OS'}).isVisible());await shot('resumo-'+width)
   for(const [scenario,expected] of [['null','Não informado'],['unknown','passo_desconhecido'],['missing','Não informado'],['normal','Montagem dos dentes']]){
    await page.evaluate(scenario=>{const o=window.orders[1];window.originalFicha??=structuredClone(o.ficha);o.ficha=scenario==='missing'?undefined:{...window.originalFicha,passoFluxoAtual:scenario==='null'?null:scenario==='unknown'?'passo_desconhecido':'montagem_dentes'};window.selectOrder(1)},scenario)
    const step=page.getByText('Passo detalhado',{exact:true}).locator('..').locator('dd');await step.getByText(expected,{exact:true}).waitFor();assert.equal(await step.textContent(),expected);assert.equal(await page.getByText('Moldagem de estudo',{exact:true}).count(),0);await step.scrollIntoViewIfNeeded();await shot('passo-'+scenario+'-'+width)
   }
   for(const status of ['Em Produção','Finalizado','Entregue','Cancelado','Pausado']){
    await page.evaluate(status=>{const o=window.orders[1];o.status=status;o.ficha.status=status;o.motivoPausa=status==='Pausado'?'Aguardando material sintético':null;o.ficha.dataFinalizacao=['Finalizado','Entregue'].includes(status)?'2026-11-10T00:00:00Z':null;o.ficha.dataEntregaReal=status==='Entregue'?'2026-11-12T15:00:00Z':null;window.selectOrder(1)},status);await page.getByRole('region',{name:'Resumo da OS'}).getByText(status,{exact:true}).waitFor()
    assert.ok((await page.getByRole('region',{name:'Resumo da OS'}).textContent()).includes(status));assert.ok((await page.getByRole('region',{name:'Localização física'}).textContent()).includes('No laboratório'))
    await page.getByRole('region',{name:'Prazos e eventos'}).scrollIntoViewIfNeeded();const dates=await page.getByRole('region',{name:'Prazos e eventos'}).textContent();assert.ok(dates.includes('12/11/2026'));assert.ok(dates.includes('04/11/2026'));assert.ok(dates.includes('22:00'));if(status==='Entregue')assert.ok(dates.includes('12:00'))
    await shot(status.replaceAll(' ','-')+'-'+width);await fit()
   }
   const finance=page.getByRole('region',{name:'Situação financeira'});await finance.scrollIntoViewIfNeeded();assert.ok((await finance.textContent()).includes('Parcial'));assert.ok((await finance.textContent()).includes('Cobrança cancelada'));await shot('financeiro-'+width)
   await page.getByText('Histórico da OS (2)',{exact:true}).click();assert.ok(await page.getByText('Retorno sintético',{exact:false}).isVisible());assert.ok(await page.getByText('Recebido pelo laboratório',{exact:true}).isVisible())
   assert.equal(await page.getByRole('link',{name:'Baixar ficha.pdf'}).getAttribute('href'),origin+'/ficha.pdf');assert.equal(await page.getByAltText('Foto do Caso 1').getAttribute('src'),origin+'/foto.svg')
   await page.getByRole('button',{name:'Visualizar STL modelo.stl'}).click();await page.locator('canvas').waitFor();await page.waitForFunction(()=>!!document.querySelector('canvas')?.width);await page.waitForTimeout(1000);assert.ok(stlRequests>0);assert.equal(await page.getByText('Erro ao carregar visualização 3D',{exact:true}).count(),0);await page.locator('canvas').scrollIntoViewIfNeeded();await shot('stl-'+width)
   await page.getByRole('button',{name:'Fechar visualização STL'}).click();await page.getByText('Conversa da OS',{exact:true}).click();await page.getByPlaceholder('Escreva uma mensagem...').fill('Mensagem local de teste');await page.locator('form').filter({has:page.getByPlaceholder('Escreva uma mensagem...')}).locator('button[type=submit]').click();await page.getByText('Mensagem local de teste',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.actionCalls.filter(c=>c.action==='message').map(c=>[c.id,c.texto])),[[1,'Mensagem local de teste']]);await shot('chat-'+width)
   await page.getByRole('button',{name:'Visualizar STL modelo.stl'}).click();await page.evaluate(()=>window.selectOrder(2));await page.getByRole('dialog',{name:'Ficha da OS #2'}).waitFor();assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.getByText('Mensagem local de teste',{exact:true}).count(),0);await page.getByText('Conversa da OS',{exact:true}).click();assert.ok(await page.getByText('Mensagem exclusiva da OS 2',{exact:true}).isVisible());assert.equal(await page.getByText('Mensagem exclusiva da OS 1',{exact:true}).count(),0)
   await page.evaluate(()=>{const o=window.orders[2];o.localizacaoAtual=undefined;o.situacaoLogistica=undefined;o.ficha={...o.ficha,status:null,etapaAtual:null,passoFluxoAtual:null,dataEntrada:null,dataEntrega:null,dataFinalizacao:null,dataEntregaReal:null,prazoEtapaAtual:null,prazoFornecedor:null};window.selectOrder(2)});await page.getByText('Etapa não informada',{exact:true}).waitFor();assert.ok((await page.getByRole('region',{name:'Etapa de produção'}).textContent()).includes('Etapa não informada'));assert.ok((await page.getByRole('region',{name:'Localização física'}).textContent()).includes('Localização não informada'));assert.ok((await finance.textContent()).includes('Nenhuma cobrança vinculada'));assert.ok((await finance.textContent()).includes('R$ 0,00'));await shot('ausencias-'+width)
   await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.getByText('Abrir OS 1',{exact:true}).click();assert.equal(await page.locator('canvas').count(),0);await page.getByRole('button',{name:'Fechar',exact:true}).click()
   await page.goto(origin+'/prioridades?atencao=hoje');await page.getByRole('button',{name:'Abrir detalhes da ordem de Ana Sintética'}).click();await page.getByRole('dialog',{name:'Ficha da OS #1'}).waitFor();await page.getByRole('button',{name:'Fechar',exact:true}).click();assert.ok(page.url().endsWith('/prioridades?atencao=hoje'));assert.ok(await page.getByRole('button',{name:'Limpar seleção'}).isVisible());await page.getByRole('button',{name:'Limpar seleção'}).click();await page.goBack();assert.ok(page.url().endsWith('atencao=hoje'));await page.getByRole('button',{name:'Abrir detalhes da ordem de Ana Sintética'}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Fechar',exact:true}).click()
   for(const route of ['/prioridades?atencao=atrasadas','/producao?atencao=sem-etapa','/producao?atencao=retornos']){
    await page.goto(origin+route);await page.getByRole('button',{name:route.startsWith('/prioridades')?'Abrir detalhes da ordem de Ana Sintética':'Ana Sintética · OS #1',exact:true}).click();await page.getByRole('dialog',{name:'Ficha da OS #1'}).waitFor();await page.getByRole('button',{name:'Fechar',exact:true}).click();assert.ok(page.url().endsWith(route));assert.ok(await page.getByRole('button',{name:'Limpar seleção'}).isVisible())
   }
   logs.push(`PASS ${width}px: statuses, original/missing data, zero, partial/cancelled billing, Brazil civil dates, history/photos/files, real STL local load (scene lighting stub), chat local send, order switch/reset, close/reopen and all four contextual queues and priorities history`)
  }
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);console.log(logs.join('\n'));await fs.writeFile(path.join(qa,'results.log'),logs.join('\n')+'\nExternal requests: 0. Real components and CSS; shell/navigation/actions/scene lighting simulated. Screenshots internal only.\n')
 }finally{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r))}
}
main().catch(error=>{console.error(error);process.exitCode=1})
