/* Isolated actual React chat components; synthetic actions only, no credentials. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const tooling=process.env.LABGEST_TEST_TOOLS || path.resolve(__dirname,'../node_modules');
const {build}=require(path.join(tooling,'esbuild'));
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/codex/cua_node/lib/node_modules/playwright');
(async()=>{
const bundles={};
for(const app of ['web','portal']) {
 const root=path.resolve(app),name=app==='web'?'ChatOrdem':'ChatPedido',file=app==='web'?'ordens/chat-ordem':'pedidos/chat-pedido';
 const plugin={name:'synthetic',setup(b){
  if(process.argv.includes('--baseline')) b.onLoad({filter:/chat-(?:ordem|pedido)\.tsx$/},a=>({contents:require('node:child_process').execFileSync('git',['show','2608c194:'+path.relative(process.cwd(),a.path)],{encoding:'utf8'}),loader:'tsx',resolveDir:path.dirname(a.path)}));
  b.onResolve({filter:/^@\/actions\/mensagens$/},a=>({path:a.path,namespace:'actions'}));
  b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:`export const lerMensagens=async()=>({success:true,mensagens:structuredClone(window.serverMessages)});export const marcarMensagensLidas=async(id,ids)=>{window.receipts.push(ids);return {success:true}};const send=async(...args)=>{window.sends.push(args);throw new Error('synthetic failed response')};export const enviarMensagem=send;export const enviarMensagemLab=send;`}));
  b.onResolve({filter:/^(next\/image|@\/components\/ui\/(button|input|modal)|@\/lib\/supabase\/client|@supabase\/supabase-js)$/},a=>({path:a.path,namespace:'stub'}));
  b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'tsx',resolveDir:root,contents:a.path.includes('supabase')?`export const createClient=()=>({storage:{from:()=>({upload:async()=>({data:{path:'synthetic-photo'}}),getPublicUrl:()=>({data:{publicUrl:'https://example.invalid/photo'}})})}})`:`import React from 'react';export const Button=({children,variant,...p})=><button {...p}>{children}</button>;export const Input=p=><input {...p}/>;export const Modal=({children})=><div>{children}</div>;export default ({fill,unoptimized,...p})=><img {...p}/>;`}));
 }};
 const built=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {${name}} from './src/components/${file}';window.serverMessages=[];window.sends=[];window.receipts=[];createRoot(document.getElementById('root')).render(<${name} ordemId={1} mensagensIniciais={[]} dentistaNome="Synthetic" supabaseUrl="https://example.invalid"/>);`,resolveDir:root,loader:'tsx'},bundle:true,write:false,plugins:[plugin],tsconfig:path.join(root,'tsconfig.json'),jsx:'automatic',define:{'process.env.NODE_ENV':'"test"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'"synthetic"'}});bundles[app]=built.outputFiles[0].text;
}
const server=http.createServer((req,res)=>{const app=req.url.startsWith('/web')?'web':'portal';res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url.endsWith('.js')?bundles[app]:`<div id="root"></div><script src="/${app}.js"></script>`)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'/usr/bin/chromium',args:['--no-sandbox']});
try{for(const app of ['web','portal']){
 const page=await browser.newPage();page.setDefaultTimeout(3000);await page.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());await page.clock.install();await page.goto(base+'/'+app);
 const draft=page.locator('input:not([type=file])');await draft.fill('draft survives refresh');
 await page.evaluate(role=>{window.serverMessages=[{id:'remote',role,nome:'Remote',texto:'New remote message',createdAt:new Date().toISOString()}]},app==='web'?'dentista':'lab');
 await page.clock.fastForward(10001);await page.getByText('New remote message',{exact:true}).waitFor();assert.equal(await draft.inputValue(),'draft survives refresh');await page.waitForFunction(()=>window.receipts.some(ids=>ids.includes('remote')));
 await page.locator('input[type=file]').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:Buffer.from('synthetic')});await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
 await page.locator('form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>window.sends.length===1);await page.locator('form').evaluate(f=>f.requestSubmit());await page.waitForFunction(()=>window.sends.length===2);
 const sends=await page.evaluate(()=>window.sends);assert.equal(sends[0][3],sends[1][3]);assert.equal(sends[1][2],'https://example.invalid/photo');assert.equal(await draft.inputValue(),'draft survives refresh');
 await page.evaluate(()=>{window.serverMessages.push({id:'focus',role:'lab',nome:'Remote',texto:'Focus refresh',createdAt:new Date().toISOString()});window.dispatchEvent(new Event('focus'))});await page.getByText('Focus refresh',{exact:true}).waitFor();assert.equal(await draft.inputValue(),'draft survives refresh');
 console.log(`PASS ${app} actual chat: 10s poll + focus, displayed receipts, draft/photo retention, stable retry ID`);await page.close();
}}finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
