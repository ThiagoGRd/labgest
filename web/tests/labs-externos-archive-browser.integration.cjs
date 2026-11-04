/* eslint-disable @typescript-eslint/no-require-imports -- Standalone isolated Chromium UI runner. */
// Run from a sanitized checkout with Linux esbuild and playwright installed.
// All server actions are synthetic; outbound browser requests are blocked.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const esbuild = require('esbuild')
const { chromium } = require('playwright')
const webRoot = path.join(__dirname, '..')
const entry = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LabsExternosView } from '@/app/(dashboard)/labs-externos/labs-externos-view';
window.syntheticEvents = []; window.syntheticSubmissions = []; window.syntheticCapability = 'absent'; window.syntheticResult = 'success';
window.syntheticOrder = { id: 10, labId: 1, labNome: 'Synthetic Laboratory', paciente: 'Synthetic Patient', dentista: 'Synthetic Dentist', servico: 'Synthetic piece', situacao: 'Enviado', dataEnvio: new Date('2026-11-01'), prazo: new Date('2026-11-16'), dataRetorno: null, createdAt: new Date('2026-11-01'), updatedAt: new Date('2026-11-04'), arquivoVersao: 0, arquivado: false, revisao: 'a'.repeat(32), isRetrabalho: false };
function App() {
 const [, setRevision] = useState(0);
 window.syntheticRedraw = ()=>setRevision(v=>v+1);
 const pedido = window.syntheticOrder;
 window.syntheticConfirm = async input=>{
  window.syntheticSubmissions.push(input);
  await new Promise(resolve=>setTimeout(resolve, 100));
  if(window.syntheticResult==='stale') return {success:false,error:'O registro foi alterado. Atualize a página e confira novamente.'};
  if(window.syntheticResult==='error') throw new Error('Synthetic transport failure');
  window.syntheticEvents.push({id:String(window.syntheticEvents.length+1), action:input.action, version:pedido.arquivoVersao+1, occurred_at:new Date(), actor_name:'Synthetic Administrator', reason:input.reason, snapshot:{paciente:pedido.paciente,lab_nome:pedido.labNome,situacao:pedido.situacao,servico:pedido.servico}, reconciliation_review:input.review});
  window.syntheticOrder={...pedido,arquivado:input.action==='archive',arquivoVersao:pedido.arquivoVersao+1}; window.syntheticRedraw(); return {success:true};
 };
 return <div data-testid="synthetic-render" data-capability={window.syntheticCapability}><LabsExternosView pedidos={pedido.arquivado?[]:[pedido]} arquivados={pedido.arquivado?[pedido]:[]} arquivamentoDisponivel={window.syntheticCapability==='enabled'} atrasados={[]} retrabalhos={[]} stats={{total_enviados:pedido.arquivado?0:1,total_provando:0,total_prontos:0,total_entregues:0,total_atrasados:0,total_retrabalhos:0}} labs={[{id:1,nome:'Synthetic Laboratory',ativo:true}]} /></div>;
}
createRoot(document.getElementById('app')).render(<App/>);
`
async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'labgest-browser-'))
  let server; let browser
  try {
    const bundle = await esbuild.build({
      stdin: { contents: entry, loader: 'tsx', resolveDir: webRoot },
      bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
      plugins: [{ name: 'synthetic-server-actions', setup(build) {
        build.onResolve({ filter: /^@\/actions\/labs-externos$/ }, () => ({ path: 'actions', namespace: 'synthetic' }))
        build.onLoad({ filter: /.*/, namespace: 'synthetic' }, () => ({ contents: `
          export async function getHistoricoArquivo(){return [...window.syntheticEvents].reverse()}
          export async function alterarArquivoPedido(input){return window.syntheticConfirm(input)}
          export const criarPedido=async()=>{throw new Error('Unexpected synthetic creation')};
          export const criarLab=criarPedido, atualizarSituacao=criarPedido, marcarRetrabalho=criarPedido, desmarcarRetrabalho=criarPedido, atualizarPedido=criarPedido;
        `, loader: 'js' }))
        build.onResolve({ filter: /^@\/components\/layout\/(dashboard-layout|header)$/ }, args => ({ path: args.path, namespace: 'shell' }))
        build.onLoad({ filter: /.*/, namespace: 'shell' }, () => ({ contents: `import React from 'react';export function DashboardLayout({children}){return <div>{children}</div>};export function Header({title}){return <h1>{title}</h1>}`, loader: 'jsx', resolveDir: webRoot }))
        build.onResolve({ filter: /^@\// }, args => { const base=path.join(webRoot, 'src', args.path.slice(2)); return {path:require('node:fs').existsSync(base+'.tsx')?base+'.tsx':base+'.ts'} })
      } }],
    })
    const postcss = require('postcss')
    const tailwind = require('@tailwindcss/postcss')
    const cssFile = path.join(webRoot, 'src/app/globals.css')
    const css = (await postcss([tailwind({ base: webRoot })]).process(await fs.readFile(cssFile, 'utf8'), { from: cssFile })).css
    const html = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Synthetic archive validation</title><link rel="stylesheet" href="/app.css"><div id="app"></div><script src="/bundle.js"></script>'
    server = http.createServer((req, res) => {
      if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle.outputFiles[0].text) }
      else if (req.url === '/app.css') { res.setHeader('Content-Type', 'text/css'); res.end(css) }
      else { res.setHeader('Content-Type', 'text/html'); res.end(html) }
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    const base = `http://127.0.0.1:${server.address().port}`
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort())
    await page.goto(base)
    async function menu(label) {
      await page.getByRole('button', { name: 'Mais ações para Synthetic Patient' }).click()
      await page.getByRole('menuitem', { name: label, exact: true }).click()
    }
    async function review(reason) {
      await page.getByLabel('Financeiro', { exact: true }).selectOption('clear')
      await page.getByLabel('Estoque', { exact: true }).selectOption('clear')
      await page.getByLabel('Produção no laboratório', { exact: true }).selectOption('clear')
      await page.getByLabel('Motivo e conferência realizada').fill(reason)
      await page.getByRole('checkbox').check()
    }
    for (const capability of ['absent', 'disabled']) {
      await page.evaluate(value => { window.syntheticCapability=value; window.syntheticRedraw() }, capability)
      await page.waitForFunction(value => document.querySelector('[data-testid=synthetic-render]')?.getAttribute('data-capability') === value, capability)
      await page.getByRole('button', { name: 'Mais ações para Synthetic Patient' }).click()
      assert.equal(await page.getByRole('menuitem', { name: 'Arquivar registro duplicado', exact: true }).count(), 0)
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('button', { name: /^Arquivados/ }).count(), 0)
    }
    await page.evaluate(() => { window.syntheticCapability='enabled'; window.syntheticRedraw() })
    // Await the React commit, not merely the scheduling of a synthetic prop update.
    await page.waitForFunction(() => document.querySelector('[data-testid=synthetic-render]')?.getAttribute('data-capability') === 'enabled')
    await menu('Arquivar registro duplicado')
    await page.getByRole('button', {name:'Voltar',exact:true}).click()
    assert.equal(await page.evaluate(()=>window.syntheticSubmissions.length),0)
    await menu('Arquivar registro duplicado')
    await page.getByRole('button', {name:'Fechar',exact:true}).click()
    await menu('Arquivar registro duplicado')
    const confirm = page.getByRole('button', { name: 'Confirmar arquivamento', exact: true })
    assert.equal(await confirm.isDisabled(), true)
    await review('Synthetic duplicate reviewed')
    await page.getByLabel('Estoque', { exact: true }).selectOption('pending')
    assert.equal(await confirm.isDisabled(), true)
    await page.getByLabel('Estoque', { exact: true }).selectOption('clear')
    assert.equal(await confirm.isEnabled(), true)
    await page.evaluate(() => { window.syntheticResult='stale' })
    await confirm.click()
    await page.getByRole('alert').filter({hasText:'O registro foi alterado'}).waitFor()
    assert.equal(await page.evaluate(()=>window.syntheticEvents.length),0)
    await page.evaluate(() => { window.syntheticResult='error' })
    await confirm.click()
    await page.getByRole('alert').filter({hasText:'Não foi possível confirmar'}).waitFor()
    assert.equal(await page.evaluate(()=>window.syntheticEvents.length),0)
    await page.evaluate(() => { window.syntheticResult='success' })
    const beforeSave = await page.evaluate(()=>window.syntheticSubmissions.length)
    await page.locator('form').evaluate(form => {
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
      form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    })
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await page.evaluate(() => window.syntheticSubmissions.length), beforeSave + 1)
    assert.equal(await page.getByRole('button', { name: 'Mais ações para Synthetic Patient' }).count(),0)
    await page.getByRole('button',{name:'Arquivados (1)',exact:true}).click()
    await page.getByText('Arquivado · #10', { exact: true }).waitFor()
    assert.notEqual(await page.evaluate(() => document.body.style.pointerEvents), 'none')
    await page.getByRole('button', { name: 'Mais ações para Synthetic Patient' }).click()
    assert.equal(await page.getByRole('menuitem', { name: 'Editar pedido', exact: true }).count(), 0)
    await page.getByRole('menuitem', { name: 'Histórico de arquivamento', exact: true }).click()
    await page.getByText('Synthetic duplicate reviewed', { exact: true }).waitFor({ state: 'attached' })
    assert.equal(await page.locator('form').count(), 0)
    await page.getByRole('button', { name: 'Fechar', exact: true }).click()
    await page.setViewportSize({width:390,height:844})
    await menu('Restaurar registro')
    const dialog = page.getByRole('dialog')
    const bounds = await dialog.boundingBox()
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390, 'Mobile dialog fits viewport')
    await page.screenshot({path:path.join(temporary,'mobile-restore.png'),fullPage:true})
    await review('Synthetic restoration reviewed')
    await page.getByRole('button', { name: 'Confirmar restauração', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await page.getByText('Arquivado · #10', { exact: true }).count(), 0)
    await page.getByRole('button',{name:'Pedidos',exact:true}).click()
    await page.getByRole('button',{name:'Mais ações para Synthetic Patient'}).waitFor()
    assert.equal(await page.evaluate(() => window.syntheticEvents.length), 2)
    assert.equal(await page.evaluate(() => window.syntheticSubmissions.at(-1).expectedVersion), 1)
    assert.equal(await page.evaluate(() => window.syntheticEvents.every(event => event.snapshot.situacao === 'Enviado')), true)
    assert.deepEqual(errors, [])
    await page.screenshot({ path: path.join(temporary, 'restored.png'), fullPage: true })
    console.log('PASS Chromium: real view/card/modal and app CSS; absent/disabled controls, confirmation/reconciliation, cancel/close, stale/error, repeated-submit guard, active/archived/restore navigation, edit protection, history, mobile dialog fit. Server actions and dashboard shell were synthetic.')
    console.log(`Screenshot: ${path.join(temporary, 'restored.png')}`)
  } finally {
    if (browser) await browser.close()
    if (server) await new Promise(resolve => server.close(resolve))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
