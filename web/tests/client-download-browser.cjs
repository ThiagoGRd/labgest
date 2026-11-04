/* eslint-disable @typescript-eslint/no-require-imports */
// Real Chromium downloads: no patches to anchor.click or object URL APIs. Synthetic data only.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http')
const {createRequire}=require('node:module'),esbuild=require('esbuild'),{chromium}=require('playwright')
const web=path.resolve(__dirname,'..'),root=path.dirname(web),req=createRequire(path.join(web,'package.json'))
const qa=process.env.CLIENT_QA||path.join(root,'delivery/client-qa')
const fixtures=[{"id": 1, "nome": "Clínica \"Árvore\"; Sul\nFictícia", "telefone": "+55 000000", "email": "qa@example.invalid", "cro": " \t=1+1", "endereco": "\r\n@FICTICIO", "ativo": true, "totalPedidos": 2, "valorTotal": 123, "ultimoPedido": null, "observacoes": "PRIVATE-NOT-EXPORTED"}, {"id": 2, "nome": "Outra clínica", "telefone": "00002", "email": "outro@example.invalid", "cro": "QA-B", "endereco": "Rua B", "ativo": true, "totalPedidos": 0, "valorTotal": 0, "ultimoPedido": null}]
async function main(){let server,browser,runtime;const errors=[],external=[],results=[],requests=[]
 try{
 await fs.mkdir(qa,{recursive:true})
 const build=await esbuild.build({stdin:{contents:`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{ClientesView}from'@/app/(dashboard)/clientes/clientes-view';import{VERSAO_ATUAL}from'@/lib/release-notes';window.store=${JSON.stringify(fixtures)};localStorage.setItem('labgest_seen_version',VERSAO_ATUAL);function App(){const[data,setData]=useState(window.store);window.refreshData=()=>setData([...window.store]);return <ClientesView initialData={data}/>};createRoot(document.getElementById('root')).render(<App/>);`,loader:'tsx',resolveDir:web},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'local',setup(b){
 b.onResolve({filter:/^@\/actions\//},a=>({path:a.path,namespace:'action'}));b.onLoad({filter:/.*/,namespace:'action'},a=>({contents:a.path.endsWith('/clientes')?`export async function createCliente(){throw Error('Unexpected write')};export async function updateCliente(){throw Error('Unexpected write')}`:a.path.endsWith('/auth')?`export async function logout(){throw Error('Unexpected logout')}`:`export async function getMensagensNaoLidasLab(){return 0}`}))
 b.onResolve({filter:/^next\/(link|navigation|image)$/},a=>({path:a.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},a=>({contents:a.path==='next/image'?`import React from'react';export default function Image({unoptimized,...props}){return <img {...props}/>} `:a.path==='next/link'?`import React from'react';export default function Link({href,onClick,...props}){return <a {...props} href={href} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&!e.ctrlKey&&!e.metaKey){e.preventDefault();history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'))}}}/>} `:`import{useSyncExternalStore}from'react';const subscribe=f=>{window.addEventListener('popstate',f);return()=>window.removeEventListener('popstate',f)};export function usePathname(){return useSyncExternalStore(subscribe,()=>location.pathname)};export const useRouter=()=>({refresh:()=>window.refreshData()});`,loader:'jsx',resolveDir:web}))
 b.onResolve({filter:/^@\//},a=>{const p=path.join(web,'src',a.path.slice(2));return{path:require('node:fs').existsSync(p+'.tsx')?p+'.tsx':p+'.ts'}})
 }}]})
 const cssPath=path.join(web,'src/app/globals.css'),css=(await req('postcss')([req('@tailwindcss/postcss')({base:web})]).process(await fs.readFile(cssPath,'utf8'),{from:cssPath})).css
 server=http.createServer((r,s)=>{requests.push({method:r.method,path:new URL(r.url,'http://127.0.0.1').pathname});if(r.url==='/app.js'){s.setHeader('Content-Type','text/javascript');s.end(build.outputFiles[0].text)}else if(r.url==='/app.css'){s.setHeader('Content-Type','text/css');s.end(css)}else{s.setHeader('Content-Type','text/html');s.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>')}})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;runtime={pid:process.pid,origin,backend:'static only; writes blocked; native Chromium downloads'}
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']})
 const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();page.setDefaultTimeout(3000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>{if(r.request().url().startsWith(origin+'/'))return r.continue();external.push(r.request().url());return r.abort()})
 const check=async(name,fn)=>{try{await fn();results.push('PASS '+name)}catch(e){results.push('FAIL '+name+': '+e.stack)}}
 for(const width of [1280,390]){
 await page.setViewportSize({width,height:900})
 await check(width+' native Chromium download: event, filename, BOM, exact filtered safe bytes',async()=>{
 await page.goto(origin+'/clientes');await page.getByRole('heading',{name:'Clientes',exact:true}).waitFor()
 assert.ok(await page.evaluate(()=>[HTMLAnchorElement.prototype.click,URL.createObjectURL,URL.revokeObjectURL].every(f=>Function.prototype.toString.call(f).includes('[native code]'))))
 await page.getByPlaceholder('Buscar por nome, email ou CRO...').fill('Árvore')
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:4000}),page.locator('button:has(svg.lucide-download)').click()])
 assert.equal(download.suggestedFilename(),'clientes-filtrados.csv');assert.equal(await download.failure(),null)
 const target=path.join(qa,'download-'+width+'.csv');await download.saveAs(target);const bytes=await fs.readFile(target)
 assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf')
 const expected='\uFEFF"Nome";"CRO";"Telefone";"Email";"Endereço";"Situação"\r\n"Clínica ""Árvore""; Sul\nFictícia";"\' \t=1+1";"\'+55 000000";"qa@example.invalid";"\'\r\n@FICTICIO";"Ativo"'
 assert.deepEqual(bytes,Buffer.from(expected,'utf8'))
 console.log(JSON.stringify({width,filename:download.suggestedFilename(),bytes:bytes.length,sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),failure:await download.failure(),native_apis:true}))
 })
 }
 for(const result of results)console.log(result);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);console.log('External requests: 0; page errors: 0; real components/Tailwind; native download; no persistence.');console.log(JSON.stringify({runtime,local_requests:requests.length}));if(results.some(r=>r.startsWith('FAIL')))process.exitCode=1
 }finally{await browser?.close();await new Promise(r=>server?server.close(r):r());await fs.writeFile(path.join(qa,'requests.json'),JSON.stringify({runtime,requests,external,page_errors:errors,servers_closed:true},null,2))}
}
main().catch(e=>{console.error(e);process.exitCode=1})
