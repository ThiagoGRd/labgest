/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const os = require('node:os')
const { spawn, spawnSync } = require('node:child_process')
const esbuild = require(require.resolve('esbuild', { paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')] }))

const web = path.resolve(__dirname, '..')

function findChrome() {
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const out = spawnSync('which', [bin], { encoding: 'utf8' })
    if (out.status === 0 && out.stdout.trim()) return out.stdout.trim()
  }
  return null
}

test('browser Chromium renderiza PainelTvView em modo Dual, TV Otávio e TV Napoleão sem erros ou overflow', async (t) => {
  const chrome = findChrome()
  if (!chrome) t.skip('Chromium não encontrado no ambiente')

  const browserEntry = `
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import { PainelTvView } from '@/components/tv/painel-tv-view'

    const nowLocal = new Date(Date.now() - 3 * 3600000)
    const hoje = nowLocal.toISOString().slice(0, 10)
    const hh = nowLocal.getUTCHours()
    const mm = nowLocal.getUTCMinutes()
    const pad = (n) => String(n).padStart(2, '0')
    const inicioAgora = pad(Math.max(0, hh)) + ':' + pad(Math.max(0, mm - 15))
    const fimAgora = pad(Math.min(23, hh + 1)) + ':' + pad(mm)

    const snapshot = {
      dataReferencia: hoje,
      dataHoje: hoje,
      atualizadoEm: pad(hh) + ':' + pad(mm) + ':00',
      ultimaSincronizacaoClinicorp: new Date().toISOString(),
      blocos: [
        {
          id: 1,
          ordemId: 1042,
          protetico: 'otavio',
          data: hoje,
          horaInicio: inicioAgora,
          horaFim: fimAgora,
          etapaNome: 'Montagem de dentes',
          modo: 'bancada',
          status: 'em_andamento',
          paciente: 'Rita de Cássia',
          servico: 'Prótese total removível',
          arcada: 'Sup + Inf (2 arcadas)',
          corDentes: 'A2',
          dentista: 'Dr. Marcos Silva',
          observacao: null,
          equipamento: null,
          iniciadoEm: new Date().toISOString(),
          concluidoEm: null,
          atualizadoEm: new Date().toISOString(),
          clinicorpConsultaLabel: 'Hoje 16:00',
          riscoClinicorp: false,
          prioridadeOrdem: 'Alta',
          diasVencidosTotal: 0,
          cicloObs: 'Subir linha média 1mm',
          cicloDentistaDeci: null,
        },
        {
          id: 2,
          ordemId: 1042,
          protetico: 'otavio',
          data: hoje,
          horaInicio: '10:00',
          horaFim: '12:00',
          etapaNome: 'Acrilização · Polimerização',
          modo: 'maquina',
          status: 'em_andamento',
          paciente: 'Rita de Cássia',
          servico: 'Prótese total removível',
          equipamento: 'Panela Térmica 1',
          atualizadoEm: new Date().toISOString(),
          clinicorpConsultaLabel: null,
          riscoClinicorp: false,
          prioridadeOrdem: 'Normal',
          diasVencidosTotal: 0,
          cicloObs: null,
          cicloDentistaDeci: null,
        },
        {
          id: 3,
          ordemId: 1055,
          protetico: 'napoleao',
          data: hoje,
          horaInicio: '09:00',
          horaFim: '10:30',
          etapaNome: 'Plano de orientação',
          modo: 'bancada',
          status: 'agendado',
          paciente: 'José Carlos',
          servico: 'PPR c/ estrutura',
          corDentes: 'A3',
          dentista: 'Dra. Ana',
          atualizadoEm: new Date().toISOString(),
          clinicorpConsultaLabel: null,
          riscoClinicorp: false,
          prioridadeOrdem: 'Normal',
          diasVencidosTotal: 0,
          cicloObs: null,
          cicloDentistaDeci: null,
        },
      ],
      ordensNoLab: [],
      perfisTempo: [
        {
          protetico: 'otavio',
          categoria: 'montagem',
          categoriaLabel: 'Montagem de dentes',
          amostras: 4,
          amostrasCronometradas: 4,
          tempoBaseMin: 60,
          mediaRealMin: 45,
          duracaoSugeridaMin: 45,
          desvioMin: -15,
          tendencia: 'diminuiu',
          ultimaExecucaoMin: 45,
          atualizadoEm: new Date().toISOString(),
        },
      ],
      briefingIa: 'Motor programou urgências Clinicorp e puxou 1 ordem normal no rodízio anti-pendência.',
    }

    createRoot(document.getElementById('root')).render(
      <PainelTvView inicial={snapshot} proteticoInicial={null} kioskInicial={false} temaInicial="dark" />
    )
  `

  const build = await esbuild.build({
    stdin: { contents: browserEntry, loader: 'tsx', resolveDir: web },
    bundle: true,
    write: false,
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'tv-mocks',
        setup(b) {
          b.onResolve({ filter: /^@\/actions\// }, (a) => ({ path: a.path, namespace: 'action' }))
          b.onLoad({ filter: /.*/, namespace: 'action' }, () => ({
            contents: `
              const ok = async () => ({ success: true, ids: [1] })
              export const atualizarStatusBlocoTv = ok
              export const excluirBlocoTv = ok
              export const moverOuReagendarBlocoTv = ok
              export const criarBlocosBancadaTv = ok
              export const executarAgendaAutomaticaIa = async () => ({
                success: true, aplicado: false, dataAlvo: '2026-11-16', blocosCriadosIds: [],
                estrategia: { motor: 'algoritmico', briefingTurno: 'Motor ativo', alertasIa: [], overrides: [] },
                plano: { dataAlvo: '2026-11-16', blocos: [], ordensAvaliadas: [], ordensNaoAlocadas: [], perfisUsados: [], resumo: { totalBlocos: 0, blocosOtavio: 0, blocosNapoleao: 0, urgentesAtendidas: 0, normaisPuxadas: 0, procedimentosAjustadosParaMenos: 0, procedimentosAjustadosParaMais: 0 } },
              })
            `,
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/lib\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'supabase' }))
          b.onLoad({ filter: /.*/, namespace: 'supabase' }, () => ({
            contents: `
              export function createClient() {
                const ch = { on(){ return ch }, subscribe(){ return ch } }
                return { channel(){ return ch }, removeChannel(){} }
              }
            `,
            loader: 'js',
          }))
          b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'next/link', namespace: 'nextlink' }))
          b.onLoad({ filter: /.*/, namespace: 'nextlink' }, () => ({
            contents: `import React from 'react'; export default function Link({ href, children, ...p }){ return <a href={href} {...p}>{children}</a> }`,
            loader: 'jsx',
            resolveDir: web,
          }))
          b.onResolve({ filter: /^@labgest\/shared$/ }, () => ({
            path: path.resolve(web, '../packages/shared/src/index.ts'),
          }))
          b.onResolve({ filter: /^@\// }, (a) => {
            const p = path.join(web, 'src', a.path.slice(2))
            const found = ['.tsx', '.ts'].map((ext) => p + ext).find((c) => fs.existsSync(c))
            return { path: found || p }
          })
        },
      },
    ],
  })

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:'production'}};</script><script>${build.outputFiles[0].text.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  const server = http.createServer((req, res) => {
    if (req.url?.startsWith('/api/tv/agenda')) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-chrome-'))
  const proc = spawn(chrome, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  let wsUrl = null
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout DevTools')), 10000)
    proc.stderr.on('data', (chunk) => {
      const m = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (m) { wsUrl = m[1]; clearTimeout(timer); resolve() }
    })
  })

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))
  let seq = 0
  const pending = new Map()
  const pageErrors = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data))
    if (msg.method === 'Runtime.exceptionThrown') pageErrors.push(msg.params.exceptionDetails?.text || 'Erro JS')
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  })

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })

  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const call = (m, p) => send(m, p, sessionId)
    await call('Runtime.enable')
    await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
    await call('Page.navigate', { url: `http://127.0.0.1:${port}/tv` })

    const waitReady = async () => {
      for (let i = 0; i < 60; i++) {
        const res = await call('Runtime.evaluate', {
          expression: 'document.body && document.body.innerText.includes("Rita de Cássia")',
          returnByValue: true,
        })
        if (res.result?.value) return
        await new Promise((r) => setTimeout(r, 50))
      }
      throw new Error('PainelTvView não renderizou a tempo')
    }
    await waitReady()

    const textoDual = (await call('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value
    assert.match(textoDual, /Tavá/)
    assert.match(textoDual, /Napoleão/)
    assert.match(textoDual, /Rita de Cássia/)
    assert.match(textoDual, /Montagem de dentes/)
    assert.match(textoDual, /Panela Térmica 1/)
    assert.match(textoDual, /José Carlos/)
    assert.match(textoDual, /45m/)
    assert.match(textoDual, /Motor IA/)

    const overflowDual = (await call('Runtime.evaluate', {
      expression: 'document.documentElement.scrollWidth > window.innerWidth',
      returnByValue: true,
    })).result.value
    assert.equal(overflowDual, false)

    // Alternar para TV Tavá
    await call('Runtime.evaluate', {
      expression: 'Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Tavá")?.click()',
    })
    await new Promise((r) => setTimeout(r, 80))
    const textoTava = (await call('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value
    assert.match(textoTava, /TV Bancada 1 — TAVÁ/)
    assert.doesNotMatch(textoTava, /José Carlos/)

    // Abrir modal Auto-Agendar IA
    await call('Runtime.evaluate', {
      expression: 'Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Auto-Agendar IA"))?.click()',
    })
    await new Promise((r) => setTimeout(r, 120))
    const textoModal = (await call('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true })).result.value
    assert.match(textoModal, /Motor Automático de Agenda/)

    assert.deepEqual(pageErrors, [])
  } finally {
    ws.close()
    proc.kill('SIGKILL')
    server.close()
    await new Promise((r) => setTimeout(r, 150))
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 })
  }
})
