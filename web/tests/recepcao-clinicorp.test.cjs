/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')
const test = require('node:test')
const ts = require('typescript')

require('./attention-typescript-register.cjs')

const {
  historicoIndicaNoLabAtual,
  ordenarItensRecepcao,
  resumirAgendaClinicorpParaOrdem,
  situacaoVisualItem,
} = require('../src/lib/recepcao-clinicorp.ts')

test('situacaoVisualItem resolve contradicao quando dentista ja respondeu no portal', () => {
  assert.equal(situacaoVisualItem('aguardando_resultado_dentista', null), 'aguardando_resultado_dentista')
  assert.equal(situacaoVisualItem('aguardando_resultado_dentista', 'aprovado'), 'aguardando_envio_laboratorio')
  assert.equal(situacaoVisualItem('aguardando_resultado_dentista', 'ajustes'), 'aguardando_envio_laboratorio')
})

test('resumirAgendaClinicorpParaOrdem detecta riscos clinicos por proximidade e situacao fisica', () => {
  const consultaHoje = {
    clinicorpId: 'c1',
    data: '2026-11-15',
    horaInicio: '14:30',
    horaFim: '15:00',
    status: 'agendado',
    dentistaNome: 'Dra. Camila Mendes',
    categoria: 'Prótese',
    observacoes: null,
  }
  const consultaAmanha = { ...consultaHoje, clinicorpId: 'c2', data: '2026-11-16', horaInicio: '09:00' }

  assert.equal(resumirAgendaClinicorpParaOrdem([consultaHoje], 'no_laboratorio', '2026-11-15').risco, 'hoje_sem_peca')
  assert.equal(resumirAgendaClinicorpParaOrdem([consultaHoje], 'aguardando_resultado_dentista', '2026-11-15').risco, 'resposta_pendente_com_consulta')
  assert.equal(resumirAgendaClinicorpParaOrdem([consultaHoje], 'aguardando_distribuicao', '2026-11-15').risco, null)
  assert.equal(resumirAgendaClinicorpParaOrdem([consultaAmanha], 'conferir_recebimento', '2026-11-15').risco, 'amanha_sem_peca')
})

test('ordenarItensRecepcao mistura internos e externos por urgencia clinica e agenda', () => {
  const internoSemAgenda = {
    id: 1,
    origem: 'interno',
    movimentadoEm: '2026-11-10T10:00:00Z',
    entregaPrevista: '2026-11-25',
    agendamento: null,
    agendamentoConfirmado: false,
    clinicorp: { proximaConsulta: null, consultasFuturas: 0, risco: null },
  }
  const externoUrgente = {
    id: 2,
    origem: 'externo',
    movimentadoEm: '2026-11-14T10:00:00Z',
    entregaPrevista: '2026-11-20',
    agendamento: null,
    agendamentoConfirmado: false,
    clinicorp: {
      proximaConsulta: {
        clinicorpId: 'c1',
        data: '2026-11-15',
        horaInicio: '14:00',
        horaFim: null,
        status: 'agendado',
        dentistaNome: 'Dra. Camila',
        categoria: null,
        observacoes: null,
      },
      consultasFuturas: 1,
      risco: 'hoje_sem_peca',
    },
  }
  const ordenado = ordenarItensRecepcao([internoSemAgenda, externoUrgente], 'urgencia')
  assert.equal(ordenado[0].id, 2)
  assert.equal(ordenado[1].id, 1)
})

test('historicoIndicaNoLabAtual nao deixa registrou_no_laboratorio antigo preso apos novos ciclos', () => {
  assert.equal(historicoIndicaNoLabAtual([{ acao: 'registrou_no_laboratorio' }]), true)
  assert.equal(historicoIndicaNoLabAtual([{ acao: 'registrou_no_laboratorio' }, { acao: 'retorno_ciclo' }]), false)
  assert.equal(historicoIndicaNoLabAtual([{ acao: 'enviou_recepcao' }, { acao: 'registrou_no_laboratorio' }]), true)
})

function buildRecepcaoBundle() {
  const root = path.resolve(__dirname, '../..')
  const mods = {}
  const ids = new Map()
  const R = `const React=require('react');const e=React.createElement;`

  function stub(name) {
    if (name === 'next/navigation') {
      return `${R}
        exports.usePathname=()=>'/recepcao';
        exports.useRouter=()=>({push(){},replace(){},refresh(){window.__refreshes=(window.__refreshes||0)+1}});`
    }
    if (name === 'next/link') {
      return `${R}exports.__esModule=true;exports.default=({href,children,...props})=>e('a',{...props,href},children);`
    }
    if (name === 'sonner') {
      return `window.__toasts=[];exports.toast={error(m){window.__toasts.push({type:'error',m})},success(m){window.__toasts.push({type:'success',m})}}`
    }
    if (name === '@/actions/recepcao') {
      return `window.__calls=[];
        exports.sincronizarClinicorpRecepcao=async()=>{window.__calls.push({action:'sincronizarClinicorpRecepcao'});return {success:true,mensagem:'18 consulta(s) sincronizada(s) com o Clinicorp.'}};
        exports.registrarAgendamentoInternoRecepcao=async(input)=>{window.__calls.push({action:'registrarAgendamentoInternoRecepcao',input});return {success:true}};
        exports.confirmarRecebimentoRecepcao=async(id)=>{window.__calls.push({action:'confirmarRecebimentoRecepcao',id});return {success:true}};
        exports.distribuirParaDentista=async(d)=>{window.__calls.push({action:'distribuirParaDentista',d});return {success:true}};
        exports.enviarParaRecepcao=async(id)=>{window.__calls.push({action:'enviarParaRecepcao',id});return {success:true}};
        exports.enviarRetornoLaboratorio=async(id)=>{window.__calls.push({action:'enviarRetornoLaboratorio',id});return {success:true}};
        exports.receberDoDentista=async(id)=>{window.__calls.push({action:'receberDoDentista',id});return {success:true}};
        exports.registrarNoLaboratorio=async(d)=>{window.__calls.push({action:'registrarNoLaboratorio',d});return {success:true}};
        exports.registrarEntregaInternaRecepcao=async(d)=>{window.__calls.push({action:'registrarEntregaInternaRecepcao',d});return {success:true}};
        exports.retornarAgendadoDaRecepcao=async(d)=>{window.__calls.push({action:'retornarAgendadoDaRecepcao',d});return {success:true}};
        exports.confirmarRecebimentoLaboratorio=async(id)=>{window.__calls.push({action:'confirmarRecebimentoLaboratorio',id});return {success:true}};`
    }
    if (name === '@/actions/recepcao-externa') {
      return `exports.movimentarRecepcaoExterna=async(d)=>{window.__calls.push({action:'movimentarRecepcaoExterna',d});return {success:true}};
        exports.registrarEntregaExternaRecepcao=async(d)=>{window.__calls.push({action:'registrarEntregaExternaRecepcao',d});return {success:true}};
        exports.registrarAgendamentoExternoRecepcao=async(d)=>{window.__calls.push({action:'registrarAgendamentoExternoRecepcao',d});return {success:true}};`
    }
    if (name === '@/components/layout/dashboard-layout') return `${R}exports.DashboardLayout=({children})=>e('div',{className:'min-h-screen bg-slate-50 dark:bg-zinc-950'},children)`
    if (name === '@/components/layout/header') return `${R}exports.Header=({title,subtitle})=>e('header',{className:'border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-zinc-900'},e('h1',{className:'text-xl font-bold text-slate-900 dark:text-white'},title),e('p',{className:'text-sm text-slate-500 dark:text-slate-400'},subtitle))`
    if (name === '@/components/ui/modal') return `${R}exports.Modal=({isOpen,onClose,title,description,children})=>isOpen?e('div',{role:'dialog','aria-label':title,className:'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'},e('div',{className:'max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900'},e('div',{className:'mb-4 flex items-start justify-between'},e('div',null,e('h2',{className:'text-lg font-bold'},title),description&&e('p',{className:'text-sm text-slate-500'},description)),e('button',{type:'button',onClick:onClose,className:'rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100'},'✕')),children)):null`
    return null
  }

  function load(name, from = path.join(root, 'entry.js')) {
    const mocked = stub(name)
    let filename
    if (mocked !== null) filename = 'mock:' + name
    else if (name.startsWith('@/')) filename = path.join(root, 'web/src', name.slice(2))
    else if (name === '@labgest/shared') filename = path.join(root, 'packages/shared/src/index.ts')
    else if (name.startsWith('.')) filename = path.resolve(path.dirname(from), name)
    else filename = require.resolve(name, { paths: from.startsWith('mock:') ? [root] : [path.dirname(from), root] })

    if (!filename.startsWith('mock:') && !fs.existsSync(filename)) {
      filename = ['.ts', '.tsx', '.js', '/index.ts'].map((ext) => filename + ext).find((candidate) => fs.existsSync(candidate)) || filename
    }
    if (ids.has(filename)) return ids.get(filename)
    const id = ids.size
    ids.set(filename, id)
    let src = mocked ?? fs.readFileSync(filename, 'utf8')
    if (/\.tsx?$/.test(filename)) {
      src = ts.transpileModule(src, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText
    }
    src = src.replace(/require\(["']([^"']+)["']\)/g, (_, dep) => `require(${load(dep, filename)})`)
    mods[id] = `function(module,exports,require){${src}\n}`
    return id
  }

  const reactId = load('react')
  const clientId = load('react-dom/client')
  const viewId = load('@/app/(dashboard)/recepcao/recepcao-view')

  const propsFixture = {
    externosDisponiveis: true,
    hoje: '2026-11-15',
    emitidoEm: '2026-11-15T15:00:00.000Z',
    clinicorpConfigurado: true,
    ultimaSincronizacao: { em: '2026-11-15T12:00:00.000Z', sucesso: true, erro: null, consultas: 18 },
    dentistas: ['Dra. Camila Mendes', 'Dr. Rafael Costa'],
    clinicas: ['Clínica Sorriso Prime', 'Lab Cerâmica Sul'],
    usuario: { nome: 'Marina Recepção', email: 'marina@clinica.com', tipo: 'admin' },
    itens: [
      {
        origem: 'externo',
        externo: { revisao: 'a'.repeat(32), version: 1 },
        id: 214,
        paciente: 'Maria Clara Oliveira',
        clinica: 'Lab Cerâmica Sul',
        servico: 'COROA ZIRCÔNIA 11\nCOR A2',
        etapa: 'Enviado',
        status: 'Enviado',
        localizacao: 'Não confirmada',
        situacao: 'conferir_recebimento',
        dentista: 'Dra. Camila Mendes',
        finalidade: null,
        agendamento: null,
        agendamentoConfirmado: false,
        agendamentoDentista: null,
        movimentadoEm: '2026-11-13T10:00:00.000Z',
        entregaPrevista: '2026-11-18T00:00:00.000Z',
        decisaoDentista: null,
        observacaoDentista: null,
        clinicorp: {
          proximaConsulta: {
            clinicorpId: 'cc-1',
            data: '2026-11-15',
            horaInicio: '16:30',
            horaFim: '17:00',
            status: 'agendado',
            dentistaNome: 'Dra. Camila Mendes',
            categoria: 'Prótese',
            observacoes: null,
          },
          consultasFuturas: 1,
          risco: 'hoje_sem_peca',
        },
      },
      {
        origem: 'interno',
        interno: { atualizadoEm: '2026-11-14T12:00:00.000Z' },
        id: 1042,
        paciente: 'João Pedro Silva',
        clinica: 'Clínica Sorriso Prime',
        servico: 'Protocolo definitivo superior',
        etapa: 'Prova dos dentes',
        status: 'Em Prova',
        localizacao: 'recepcao',
        situacao: 'aguardando_distribuicao',
        dentista: 'Dr. Rafael Costa',
        finalidade: 'prova',
        agendamento: null,
        agendamentoConfirmado: false,
        agendamentoDentista: null,
        movimentadoEm: '2026-11-14T12:00:00.000Z',
        entregaPrevista: '2026-11-20T00:00:00.000Z',
        decisaoDentista: null,
        observacaoDentista: null,
        clinicorp: {
          proximaConsulta: {
            clinicorpId: 'cc-2',
            data: '2026-11-16',
            horaInicio: '09:30',
            horaFim: '10:00',
            status: 'agendado',
            dentistaNome: 'Dr. Rafael Costa',
            categoria: 'Prova',
            observacoes: null,
          },
          consultasFuturas: 1,
          risco: null,
        },
      },
      {
        origem: 'interno',
        interno: { atualizadoEm: '2026-11-14T08:00:00.000Z' },
        id: 1048,
        paciente: 'Ana Beatriz Ferreira',
        clinica: 'Clínica Sorriso Prime',
        servico: 'Prótese parcial removível inferior',
        etapa: 'Prova de armação',
        status: 'Em Prova',
        localizacao: 'dentista',
        situacao: 'com_dentista',
        dentista: 'Dra. Camila Mendes',
        finalidade: 'prova',
        agendamento: null,
        agendamentoConfirmado: false,
        agendamentoDentista: null,
        movimentadoEm: '2026-11-14T08:00:00.000Z',
        entregaPrevista: '2026-11-21T00:00:00.000Z',
        decisaoDentista: null,
        observacaoDentista: null,
        clinicorp: { proximaConsulta: null, consultasFuturas: 0, risco: null },
      },
      {
        origem: 'interno',
        interno: { atualizadoEm: '2026-11-13T08:00:00.000Z' },
        id: 1055,
        paciente: 'Carlos Eduardo Lima',
        clinica: 'Clínica Sorriso Prime',
        servico: 'Coroa unitária',
        etapa: 'Prova em cera',
        status: 'Pausado',
        localizacao: 'recepcao',
        situacao: 'aguardando_resultado_dentista',
        dentista: 'Dr. Rafael Costa',
        finalidade: 'prova',
        agendamento: null,
        agendamentoConfirmado: false,
        agendamentoDentista: null,
        movimentadoEm: '2026-11-13T08:00:00.000Z',
        entregaPrevista: '2026-11-22T00:00:00.000Z',
        decisaoDentista: 'aprovado',
        observacaoDentista: null,
        clinicorp: { proximaConsulta: null, consultasFuturas: 0, risco: null },
      },
    ],
  }

  const bootstrap = `
    (function(){
      const mods={${Object.entries(mods).map(([k, v]) => `${k}:${v}`).join(',')}};
      const cache={};
      function req(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};mods[id](m,m.exports,req);return m.exports;}
      const React=req(${reactId});
      const {createRoot}=req(${clientId});
      const {RecepcaoView}=req(${viewId});
      const props=${JSON.stringify(propsFixture)};
      createRoot(document.getElementById('app')).render(React.createElement(RecepcaoView,props));
    })();
  `

  return {
    bundle: bootstrap,
    html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview — Recepção LabGest + Clinicorp</title><style>body{font:14px system-ui;margin:0;padding:16px}</style></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${bootstrap.replace(/<\/script/g, '<\\/script')}</script></body></html>`,
  }
}

function findChrome() {
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const out = require('node:child_process').spawnSync('which', [bin], { encoding: 'utf8' })
    if (out.status === 0 && out.stdout.trim()) return out.stdout.trim()
  }
  return null
}

test('RecepcaoView integrada ao Clinicorp funciona no Chromium real', async (t) => {
  const chrome = findChrome()
  if (!chrome) t.skip('Chromium não encontrado no ambiente')

  const { bundle, html } = buildRecepcaoBundle()
  if (process.env.LABGEST_RECEPCAO_PREVIEW) {
    const previewHtml = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recepção + Clinicorp — Prévia local LabGest</title><script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script><style>:root{--background:#f8fafc;--card:#ffffff;--foreground:#0f172a;--border:#e2e8f0;--muted-foreground:#64748b;--primary:#4f46e5;--primary-foreground:#ffffff;--input:#cbd5e1;--ring:#4f46e5}body{background:var(--background);color:var(--foreground);font:14px system-ui;margin:0;padding:16px}</style></head><body><div id="app"></div><script>window.process={env:{NODE_ENV:'development'}};</script><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`
    fs.writeFileSync(process.env.LABGEST_RECEPCAO_PREVIEW, previewHtml)
  }

  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  const userDataDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'recepcao-chrome-'))
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
    const timer = setTimeout(() => reject(new Error('Timeout esperando DevTools')), 10000)
    proc.stderr.on('data', (chunk) => {
      const m = String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (m) { wsUrl = m[1]; clearTimeout(timer); resolve() }
    })
  })

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve))

  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data))
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    }
  })

  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }

  try {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const evalPage = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails))
      }
      return r.result?.value
    }

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` }, sessionId)
    for (let i = 0; i < 60; i++) {
      if (await evalPage('!!document.querySelector("h1")')) break
      await new Promise((r) => setTimeout(r, 30))
    }

    const initial = await evalPage(`(() => ({
      text: document.body.innerText,
      firstCardTitle: document.querySelector('article h2')?.textContent,
      tabs: [...document.querySelectorAll('[role="tab"]')].map(b => b.textContent.trim()),
      links: [...document.querySelectorAll('article a')].map(a => a.getAttribute('href')),
    }))()`)

    // Externo urgente de hoje precisa aparecer ANTES dos internos sem risco
    assert.equal(initial.firstCardTitle, 'Maria Clara Oliveira')
    assert.match(initial.text, /Agenda Clinicorp integrada à recepção/)
    assert.match(initial.text, /paciente agendado hoje no Clinicorp e o trabalho ainda não está pronto na recepção/)
    assert.match(initial.text, /Pausado/)
    assert.match(initial.text, /Retorno disponível/)
    assert.doesNotMatch(initial.text, /ainda precisa registrar no portal/)
    assert.ok(initial.links.includes('/labs-externos'))
    assert.ok(initial.links.includes('/ordens?busca=1042&status=todos'))

    // Aba "Com dentista (sem agenda)" encontra Ana Beatriz (antes órfã)
    await evalPage(`[...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.includes('Com dentista (sem agenda)')).click()`)
    await new Promise((r) => setTimeout(r, 100))
    assert.equal(await evalPage(`[...document.querySelectorAll('article h2')].map(h => h.textContent).join(',')`), 'Ana Beatriz Ferreira')

    // Volta para Todos e testa 1-clique "Confirmar agenda do Clinicorp" no João Pedro
    await evalPage(`[...document.querySelectorAll('[role="tab"]')].find(b => b.textContent.startsWith('Todos')).click()`)
    await new Promise((r) => setTimeout(r, 100))
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Confirmar agenda do Clinicorp')).click()`)
    await new Promise((r) => setTimeout(r, 150))

    // Testa modal de agendamento -> "Preencher com Clinicorp"
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Registrar agendamento')).click()`)
    await new Promise((r) => setTimeout(r, 100))
    await evalPage(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes('Preencher com Clinicorp')).click()`)
    await new Promise((r) => setTimeout(r, 100))
    const modalValues = await evalPage(`(() => {
      const d = document.querySelector('[role="dialog"]');
      const inputs = [...d.querySelectorAll('input')];
      return { dentista: inputs[0]?.value, data: inputs[1]?.value };
    })()`)
    assert.equal(modalValues.dentista, 'Dr. Rafael Costa')
    assert.equal(modalValues.data, '2026-11-16T09:30')

    // Testa botão Sincronizar Clinicorp
    await evalPage(`[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.includes('Fechar')).click()`)
    await new Promise((r) => setTimeout(r, 100))
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Sincronizar Clinicorp')).click()`)
    await new Promise((r) => setTimeout(r, 150))

    const calls = await evalPage(`window.__calls`)
    assert.ok(calls.some((c) => c.action === 'registrarAgendamentoInternoRecepcao' && c.input.dentista === 'Dr. Rafael Costa'))
    assert.ok(calls.some((c) => c.action === 'sincronizarClinicorpRecepcao'))
  } finally {
    ws.close()
    proc.kill('SIGKILL')
    server.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  }
})
