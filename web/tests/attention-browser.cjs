/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated real-React/Chromium component harness. No Next server, DB or env loading.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http')
const { spawn, execFileSync } = require('node:child_process')
const assert = require('node:assert/strict'), ts = require('typescript')
const root = path.resolve(__dirname, '../..')
const out = path.join(root, 'delivery')
const R = `const React=require('react');const e=React.createElement;`
const navigation = `${R}
const subscribers=new Set();window.addEventListener('popstate',()=>subscribers.forEach(f=>f()));
const notify=()=>subscribers.forEach(f=>f());
const subscribe=f=>{subscribers.add(f);return()=>subscribers.delete(f)};
const push=url=>{history.pushState({},'',url);notify()};
exports.useSearchParams=()=>new URLSearchParams(React.useSyncExternalStore(subscribe,()=>location.search));
exports.usePathname=()=>React.useSyncExternalStore(subscribe,()=>location.pathname);
exports.useRouter=()=>({push,replace:url=>{history.replaceState({},'',url);notify()},refresh:notify});
exports.Link=({href,children,...props})=>e('a',{...props,href,onClick:ev=>{ev.preventDefault();push(href)}},children);`
function stub(name) {
  if(name==='next/navigation') return navigation
  if(name==='next/link') return `exports.__esModule=true;exports.default=require('next/navigation').Link`
  if(name==='lucide-react') return `module.exports=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:()=>null})`
  if(name==='sonner') return `exports.toast={error(){},success(){},info(){}}`
  if(name==='react-to-print') return `exports.useReactToPrint=()=>()=>{window.blockedActions++}`
  if(name.startsWith('@/actions/')) return `module.exports=new Proxy({}, {get:()=>()=>{window.blockedActions++;throw Error('External action blocked')}})`
  if(name==='@/components/layout/header') return `${R}exports.Header=({title,subtitle,action})=>e('header',null,e('h1',null,title),e('p',null,subtitle),action&&e('button',{onClick:action.onClick},action.label))`
  if(name==='@/components/layout/dashboard-layout') return `${R}exports.DashboardLayout=({children})=>e('div',null,children)`
  if(name.startsWith('@/components/') && !['@/components/ui/button','@/components/ui/input','@/components/ui/card','@/components/ui/badge'].includes(name)) return `${R}module.exports=new Proxy({}, {get:(_,name)=>name==='__esModule'?true:({children})=>e('div',{'data-stub':String(name)},children)})`
  return null
}
function bundle(version) {
  const mods={}, ids=new Map()
  function load(name, from=root+'/entry.js') {
    const mocked=stub(name)
    let filename
    if(mocked!==null) filename='mock:'+name
    else if(name.startsWith('@/')) filename=path.join(root,'web/src',name.slice(2))
    else if(name==='@labgest/shared') filename=path.join(root,'packages/shared/src/index.ts')
    else if(name.startsWith('.')) filename=path.resolve(path.dirname(from),name)
    else filename=require.resolve(name,{paths:[root]})
    if(!filename.startsWith('mock:')&&!fs.existsSync(filename)) filename=['.ts','.tsx','.js','/index.ts'].map(x=>filename+x).find(x=>fs.existsSync(x))||filename
    if(ids.has(filename)) return ids.get(filename)
    const id=ids.size;ids.set(filename,id)
    let src=mocked ?? fs.readFileSync(filename,'utf8')
    if(version==='before'&&filename.includes('/app/(dashboard)/')) src=execFileSync('git',['show','b8ee4012:'+path.relative(root,filename)],{cwd:root,encoding:'utf8'})
    if(/\.tsx?$/.test(filename)) src=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
    src=src.replace(/require\(["']([^"']+)["']\)/g,(_,dep)=>`require(${load(dep,filename)})`)
    mods[id]=`function(module,exports,require){${src}\n}`
    return id
  }
  const react=load('react'), client=load('react-dom/client'), nav=load('next/navigation')
  const views={}
  for(const [route,file,exp] of [['dashboard','dashboard-view','DashboardView'],['prioridades','prioridades-view','PrioridadesView'],['producao','producao-view','ProducaoView'],['ordens','ordens-view','OrdensView']]) views[route]=[load(`@/app/(dashboard)/${route}/${file}`),exp]
  const fixture=fs.readFileSync(path.join(__dirname,'attention-fixtures.cjs'),'utf8')
  return `const process={env:{NODE_ENV:'development'}};const modules={${Object.entries(mods).map(([id,src])=>`${id}:${src}`).join(',')}};const cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports}window.blockedActions=0;${fixture};const React=require(${react});function App(){const pathname=require(${nav}).usePathname();const route=pathname.slice(1);const v=${JSON.stringify(views)}[route];return v?React.createElement(require(v[0])[v[1]],fixtures[route]):React.createElement('p',null,'Relatório simulado: '+location.search)}require(${client}).createRoot(document.getElementById('root')).render(React.createElement(App));`
}
async function main(){
 fs.mkdirSync(out,{recursive:true})
 const bundles={after:bundle('after'),before:bundle('before')}
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:16px system-ui;margin:16px}button,input,select,summary{font:inherit;margin:4px;padding:8px}article,section{margin:12px 0}a{display:inline-block;margin:6px}svg{width:20px;height:20px} .hidden{display:none} .sr-only{position:absolute;clip:rect(0,0,0,0)}</style></head><body><p>Harness local — dados sintéticos, layout sem Tailwind</p><div id="root"></div><script>${bundles[req.url.includes('before=1')?'before':'after'].replace(/<\/script/g,'<\\/script')}</script></body></html>`)})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port
 const chrome=spawn('/usr/bin/chromium',['--headless','--no-sandbox','--disable-gpu','--remote-debugging-port=0','--user-data-dir=/tmp/labgest-attention-chromium','about:blank'],{stdio:['ignore','ignore','pipe']})
 let debug='';const wsurl=await new Promise((resolve,reject)=>{chrome.stderr.on('data',d=>{debug+=d;const m=debug.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m)resolve(m[1])});chrome.on('exit',()=>reject(Error(debug)))})
 const ws=new WebSocket(wsurl);await new Promise(r=>ws.onopen=r);let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')console.error(JSON.stringify(m.params));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)}}
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++n;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}))})
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});const call=(m,p)=>send(m,p,sessionId)
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+JSON.stringify(r.exceptionDetails.exception));return r.result.value}
 const wait=async expression=>{for(let i=0;i<100;i++){try{if(await evaluate(expression))return}catch{};await new Promise(r=>setTimeout(r,30))}throw Error('Timed out '+expression)}
 const go=async url=>{await call('Page.navigate',{url:`http://127.0.0.1:${port}${url}`});await wait('document.readyState === "complete" && !!document.querySelector("h1")')}
 const click=async text=>evaluate(`Array.from(document.querySelectorAll('button,summary,a')).find(e=>e.textContent.trim()===${JSON.stringify(text)})?.click()`)
 const search=async(label,value)=>{await evaluate(`(()=>{const el=document.querySelector('input[aria-label=${JSON.stringify(label)}]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}))})()`);await new Promise(r=>setTimeout(r,40))}
 const text=()=>evaluate('document.body.innerText')
 await call('Runtime.enable');const logs=[]
 try {
  await call('Network.enable');await call('Network.setBlockedURLs',{urls:['https://*','http://*.com/*']})
  for(const width of [1280,390]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390})
   for(const version of ['before','after']){
    await go('/dashboard'+(version==='before'?'?before=1':''));await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync(`${out}/${version}-${width}.png`,Buffer.from(r.data,'base64')))
   }
   for(const [label,url,expected] of [['Ordens atrasadas','/prioridades?atencao=atrasadas','Prazo vencido — em prova clínica'],['Entregas para hoje','/prioridades?atencao=hoje','Entregas para hoje'],['Retornos respondidos','/producao?atencao=retornos','Ciclo #1'],['Etapa a definir','/producao?atencao=sem-etapa','Definir tipo e etapa']]){
    await go('/dashboard');await evaluate(`Array.from(document.querySelectorAll('a')).find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);await wait(`location.pathname+location.search===${JSON.stringify(url)}`);await wait(`document.body.innerText.includes(${JSON.stringify(expected)})`)
    await go(url);assert.ok((await text()).includes(expected));await call('Page.reload');await wait(`document.body.innerText.includes(${JSON.stringify(expected)})`)
    const input=url.startsWith('/prioridades')?'Buscar prioridades':'Buscar na seleção do painel'
    await search(input,'ZZZ');assert.ok((await text()).match(/Nenhum/));await search(input,'Ana');assert.ok((await text()).includes('Ana'));assert.ok(!(await text()).includes('Bia'))
    await click('Limpar seleção');await wait('!location.search.includes("atencao")');await evaluate('history.back()');await wait('location.search.includes("atencao")');await wait(`document.body.innerText.includes('Limpar seleção')`);await evaluate('history.forward()');await wait('!location.search.includes("atencao")');await wait(`!document.body.innerText.includes('Limpar seleção')`)
    await go(url+'&empty=1');assert.ok((await text()).match(/Nenhum/))
   }
   for(const route of ['producao','prioridades']){await go('/'+route+'?atencao=invalido');assert.ok(!(await text()).includes('Limpar seleção'))}
   await go('/producao?atencao=retornos');assert.ok((await text()).includes('Pausado'));assert.ok((await text()).includes('Ciclo #1'));assert.ok((await text()).includes('Ciclo #2'))
   await go('/producao?atencao=sem-etapa');assert.ok(!(await text()).includes('Pausado'));assert.ok(!(await text()).includes('Bia'))
   for(const cliente of ['', '7']){
    await go('/ordens');assert.equal(await evaluate('document.querySelector("details").open'),false);await click('Relatórios e impressão');
    await evaluate(`(()=>{const m=document.querySelector('input[type=month]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(m,'2026-10');m.dispatchEvent(new Event('input',{bubbles:true}));const s=document.querySelector('select[aria-label="Clínica do demonstrativo"]');s.value='${cliente}';s.dispatchEvent(new Event('change',{bubbles:true}))})()`);await new Promise(r=>setTimeout(r,40));await click('Imprimir mês');await wait('location.pathname==="/relatorios"');assert.equal(await evaluate('location.search'),'?mes=2026-10&imprimir=1'+(cliente?'&cliente=7':''))
   }
   assert.equal(await evaluate('window.blockedActions'),0);logs.push(`PASS ${width}px: links, direct/reload, search/empty, clear/back/forward, invalid, cycle distinctions, report with/without clinic`)
  }
  fs.writeFileSync(path.join(out,'browser.log'),logs.join('\n')+'\nHarness: actual view components and React; Next navigation simulated using native history; external actions blocked; no Tailwind layout verification.\n');console.log(logs.join('\n'))
 } finally {ws.close();chrome.kill();server.close()}
}
main().catch(e=>{console.error(e);process.exit(1)})
