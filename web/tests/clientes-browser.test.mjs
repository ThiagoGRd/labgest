import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')

test('Clients browser: details, close, edit error/retry, double-submit guard, filtered CSV', async () => {
  const result = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {ClientesView} from './web/src/app/(dashboard)/clientes/clientes-view';
      window.calls=[];window.outcome='fail';window.refreshes=0;
      const common={telefone:'+11999',email:'a@example.com',cro:'CRO 1',endereco:'Rua teste',observacoes:'Observação teste',totalPedidos:3,valorTotal:12,ultimoPedido:null};
      createRoot(document.getElementById('root')).render(<ClientesView initialData={[
      {...common,id:1,nome:'Alpha',ativo:true},{...common,id:2,nome:'Beta',ativo:false},{...common,id:3,nome:'=Formula',ativo:true}]}/>);`,
      resolveDir: process.cwd(), loader:'tsx' },
    bundle: true, write:false, format:'iife', jsx:'automatic', define: {'process.env.NODE_ENV': '"development"', 'process.env': '{}'},
    plugins:[{name:'fixtures',setup(build) {
      build.onResolve({filter:/^@\/actions\/clientes$/},args=>({path:args.path,namespace:'fixture'}))
      build.onResolve({filter:/^next\/navigation$/},args=>({path:args.path,namespace:'fixture'}))
      build.onResolve({filter:/^@\/components\/layout\//},args=>({path:args.path,namespace:'fixture'}))
      build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.includes('/actions/') ? `export async function updateCliente(id,data){window.calls.push({id,data});await new Promise(r=>setTimeout(r,250));if(window.outcome==='throw')throw Error('failed');return window.outcome==='success'?{success:true}:{success:false,error:'Falha de teste. Tente novamente.'}};export const createCliente=data=>updateCliente(0,data);` : args.path==='next/navigation' ? `export const useRouter=()=>({refresh(){window.refreshes++}})` : `import React from 'react'; export const DashboardLayout=({children})=><main>{children}</main>;export const Header=()=>null;`,loader:'tsx',resolveDir:process.cwd()}))
      build.onResolve({filter:/^@\//},args=>{ const base=`${process.cwd()}/web/src/${args.path.slice(2)}`; return {path: ['.tsx','.ts'].map(ext=>base+ext).find(existsSync)} })
    }}],
  })
  const server = createServer((req,res)=>{res.setHeader('content-type',req.url==='/app.js'?'text/javascript':'text/html');res.end(req.url==='/app.js'?result.outputFiles[0].text:'<html><body><div id="root"></div><script src="/app.js"></script></body></html>')})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',headless:true,args:['--no-sandbox']})
  try {
    const page=await browser.newPage({acceptDownloads:true})
    page.setDefaultTimeout(5000)
    page.on('pageerror',error=>console.error(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button',{name:'Ver Alpha',exact:true}).click()
    await page.getByRole('dialog').waitFor()
    assert.match(await page.getByRole('dialog').innerText(),/Observação teste/)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(),0)
    await page.getByRole('button',{name:'Editar Alpha',exact:true}).click()
    await page.getByLabel('Nome Completo *',{exact:true}).fill('Alpha editado')
    const save=page.getByRole('button',{name:'Salvar alterações'})
    await save.dblclick({force:true})
    await page.keyboard.press('Escape')
    assert.ok(await page.getByRole('dialog').isVisible())
    assert.ok(await page.getByRole('button',{name:'Fechar',exact:true}).isDisabled())
    await page.getByRole('alert').waitFor()
    assert.equal(await page.evaluate(()=>window.calls.length),1)
    assert.equal(await page.getByLabel('Nome Completo *',{exact:true}).inputValue(),'Alpha editado')
    await page.evaluate(()=>window.outcome='throw')
    await save.click()
    await page.getByRole('alert').filter({hasText:'Não foi possível salvar'}).waitFor()
    assert.equal(await page.getByLabel('Nome Completo *',{exact:true}).inputValue(),'Alpha editado')
    await page.evaluate(()=>window.outcome='success')
    await save.click()
    await page.getByRole('dialog').waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>window.refreshes),1)
    await page.getByRole('button',{name:'Editar Alpha',exact:true}).click()
    assert.equal(await page.getByLabel('Nome Completo *',{exact:true}).inputValue(),'Alpha')
    await page.getByRole('button',{name:'Cancelar',exact:true}).click()
    await page.getByPlaceholder('Buscar por nome, email ou CRO...').fill('=Formula')
    const downloadPromise=page.waitForEvent('download')
    await page.getByRole('button',{name:'Exportar clientes filtrados'}).click()
    const download=await downloadPromise
    const csv=await readFile(await download.path(),'utf8')
    assert.ok(csv.includes("'=Formula"))
    assert.ok(!csv.includes('Alpha'))
    assert.ok(!csv.includes('Beta'))
    await page.getByPlaceholder('Buscar por nome, email ou CRO...').fill('missing')
    assert.ok(await page.getByRole('button',{name:'Exportar clientes filtrados'}).isDisabled())
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)) }
})
