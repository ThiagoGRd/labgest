/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')
const test = require('node:test')
const ts = require('typescript')

require('./attention-typescript-register.cjs')
const clinicorp = require('../src/lib/clinicorp.ts')
const { dividirTempo } = require('@labgest/shared')

test('extrairMapaProfissionais resolve diferentes formatos de resposta do Clinicorp', () => {
  const mapa = clinicorp.extrairMapaProfissionais([
    { PersonId: 101, Name: 'Dra. Camila Mendes' },
    { id: '202', ProfessionalName: 'Dr. Rafael Costa' },
  ])
  clinicorp.extrairMapaProfissionais({
    users: [
      { UserId: '303', FullName: 'Dra. Beatriz Alencar' },
      { PersonId: 101, Name: 'Nome duplicado que não deve sobrescrever' },
    ],
  }, mapa)

  assert.equal(mapa.get('101'), 'Dra. Camila Mendes')
  assert.equal(mapa.get('202'), 'Dr. Rafael Costa')
  assert.equal(mapa.get('303'), 'Dra. Beatriz Alencar')
})

test('converterConsulta usa mapa de profissionais quando DentistName não vem na agenda', () => {
  const profissionais = new Map([['5501', 'Dra. Camila Mendes']])
  const consulta = clinicorp.converterConsulta({
    id: '9001',
    date: '2026-11-10T03:00:00.000Z',
    fromTime: '14:30',
    toTime: '15:00',
    PatientName: 'Maria Clara Oliveira',
    StatusId: '5042370073067520',
    Dentist_PersonId: 5501,
    CategoryDescription: 'Prótese',
    Notes: 'Prova dos dentes',
  }, profissionais)

  assert.ok(consulta)
  assert.equal(consulta.dentistaId, '5501')
  assert.equal(consulta.dentistaNome, 'Dra. Camila Mendes')
  assert.equal(consulta.status, 'compareceu')

  const comInline = clinicorp.converterConsulta({
    id: '9002',
    date: '2026-11-11',
    PatientName: 'João Pedro',
    Dentist_PersonId: '5501',
    DentistName: 'Dr. Inline Prioridade',
  }, profissionais)
  assert.equal(comInline.dentistaNome, 'Dr. Inline Prioridade')
})

test('dividirTempo reconhece retorno_ciclo e registrou_no_laboratorio', () => {
  const divisao = dividirTempo([
    { acao: 'enviou_recepcao', data: '2026-10-02T12:00:00Z' },
    { acao: 'retorno_ciclo', data: '2026-10-06T12:00:00Z' },
    { acao: 'enviou_recepcao', data: '2026-10-08T12:00:00Z' },
    { acao: 'registrou_no_laboratorio', data: '2026-10-10T12:00:00Z' },
  ], '2026-10-01T12:00:00Z', '2026-10-12T12:00:00Z')

  assert.equal(divisao.comQuem, 'laboratorio')
  assert.equal(divisao.clinica, 6)
  assert.equal(divisao.laboratorio, 5)
})

function buildTratamentosBundle() {
  const root = path.resolve(__dirname, '../..')
  const mods = {}
  const ids = new Map()
  const R = `const React=require('react');const e=React.createElement;`

  function stub(name) {
    if (name === 'next/navigation') {
      return `${R}
        exports.usePathname=()=>'/tratamentos';
        exports.useRouter=()=>({push(){},replace(){},refresh(){}});`
    }
    if (name === 'next/link') {
      return `${R}exports.__esModule=true;exports.default=({href,children,...props})=>e('a',{...props,href},children);`
    }
    if (name === 'sonner') {
      return `window.__toasts=[];exports.toast={error(m){window.__toasts.push({type:'error',m})},success(m){window.__toasts.push({type:'success',m})}}`
    }
    if (name === '@/actions/tratamentos') {
      return `window.__calls=[];
        exports.sincronizarAgora=async()=>{window.__calls.push({action:'sincronizarAgora'});return {success:true,mensagem:'24 consulta(s) atualizada(s).'}};
        exports.darCienciaAlertas=async(ordemId,nota)=>{window.__calls.push({action:'darCienciaAlertas',ordemId,nota});return {success:true}};
        exports.salvarLimite=async(tipo,limite)=>{window.__calls.push({action:'salvarLimite',tipo,limite});return {success:true}};
        exports.definirContagemConsulta=async(id,conta)=>{window.__calls.push({action:'definirContagemConsulta',id,conta});return {success:true}};
        exports.vincularPaciente=async(ordemId,nome)=>{window.__calls.push({action:'vincularPaciente',ordemId,nome});return {success:true,mensagem:'Paciente vinculado.'}};`
    }
    if (name === '@/components/layout/dashboard-layout') return `${R}exports.DashboardLayout=({children})=>e('div',{className:'min-h-screen bg-slate-50 dark:bg-zinc-950'},children)`
    if (name === '@/components/layout/header') return `${R}exports.Header=({title,subtitle})=>e('header',{className:'border-b border-slate-200 bg-white px-6 py-4 dark:border-white/10 dark:bg-zinc-900'},e('h1',{className:'text-xl font-bold text-slate-900 dark:text-white'},title),e('p',{className:'text-sm text-slate-500 dark:text-slate-400'},subtitle))`
    if (name === '@/components/ui/empty-state') return `${R}exports.EmptyState=({title,description})=>e('div',{className:'rounded-2xl border border-slate-200 bg-white p-8 text-center'},e('p',{className:'font-semibold text-slate-900'},title),e('p',{className:'mt-1 text-sm text-slate-500'},description))`
    if (name === '@/components/ui/modal') return `${R}exports.Modal=({isOpen,onClose,title,description,children})=>isOpen?e('div',{role:'dialog','aria-label':title,className:'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4'},e('div',{className:'max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900'},e('div',{className:'mb-4 flex items-start justify-between'},e('div',null,e('h2',{className:'text-lg font-bold'},title),description&&e('p',{className:'text-sm text-slate-500'},description)),e('button',{type:'button',onClick:onClose,className:'rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100'},'Fechar')),children)):null`
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
  const viewId = load('@/app/(dashboard)/tratamentos/tratamentos-view')

  const painelFixture = {
    hoje: '2026-11-15',
    clinicorpConfigurado: true,
    ultimaSincronizacao: { em: '2026-11-15T12:00:00Z', sucesso: true, erro: null, consultas: 24 },
    limites: [
      { tipo: 'protocolo_definitivo', nome: 'Protocolo definitivo', previstas: 3, limite: { consultasAtencao: 4, consultasMax: 5, diasAtencao: 60, diasMax: 90 }, personalizado: false },
      { tipo: 'protocolo_carga_imediata', nome: 'Protocolo provisório de carga imediata', previstas: 3, limite: { consultasAtencao: 4, consultasMax: 5, diasAtencao: 10, diasMax: 20 }, personalizado: false },
      { tipo: 'protese_total_removivel', nome: 'Prótese total removível', previstas: 5, limite: { consultasAtencao: 6, consultasMax: 7, diasAtencao: 45, diasMax: 60 }, personalizado: false },
      { tipo: 'ppr_com_estrutura', nome: 'Prótese parcial removível com estrutura', previstas: 4, limite: { consultasAtencao: 5, consultasMax: 6, diasAtencao: 60, diasMax: 90 }, personalizado: false },
      { tipo: 'ppr_sem_estrutura', nome: 'Prótese parcial removível sem estrutura', previstas: 4, limite: { consultasAtencao: 5, consultasMax: 6, diasAtencao: 45, diasMax: 60 }, personalizado: false },
    ],
    tratamentos: [
      {
        ordemId: 1042,
        paciente: 'Maria Clara Oliveira',
        clinica: 'Clínica Sorriso Prime',
        servico: 'Protocolo definitivo superior',
        tipo: 'protocolo_definitivo',
        tipoNome: 'Protocolo definitivo',
        status: 'Em Prova',
        etapa: 'Prova dos dentes',
        encerrado: false,
        pausado: false,
        dataPedido: '2026-09-01',
        dataFim: null,
        diasAberto: 75,
        limite: { consultasAtencao: 4, consultasMax: 5, diasAtencao: 60, diasMax: 90 },
        consultasPrevistas: 3,
        consultas: {
          realizadas: 5,
          semConfirmacao: 1,
          faltas: 1,
          futuras: 1,
          lista: [
            { id: 'c1', data: '2026-09-02', hora: '09:00', status: 'compareceu', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: 'Escaneamento inicial', situacao: 'realizada' },
            { id: 'c2', data: '2026-09-18', hora: '10:30', status: 'compareceu', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: 'Registro intermaxilar', situacao: 'realizada' },
            { id: 'c3', data: '2026-10-05', hora: '14:00', status: 'faltou', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: null, situacao: 'falta' },
            { id: 'c4', data: '2026-10-19', hora: '14:00', status: 'compareceu', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: '1ª prova — ajuste linha média', situacao: 'realizada' },
            { id: 'c5', data: '2026-11-02', hora: '11:00', status: 'compareceu', dentista: 'Dr. Rafael Costa', categoria: 'Prótese', observacoes: '2ª prova em cera', situacao: 'realizada' },
            { id: 'c6', data: '2026-11-11', hora: '16:00', status: 'agendado', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: null, situacao: 'sem_confirmacao' },
            { id: 'c7', data: '2026-11-22', hora: '09:30', status: 'agendado', dentista: 'Dra. Camila Mendes', categoria: 'Prótese', observacoes: 'Reprova agendada', situacao: 'futura' },
          ],
        },
        dentistas: ['Dra. Camila Mendes', 'Dr. Rafael Costa'],
        dentistaOrdem: 'Dra. Camila Mendes',
        tempo: { laboratorio: 31, clinica: 44, fornecedor: 0, temRegistro: true, comQuem: 'clinica', desde: '2026-10-19' },
        provas: 2,
        ajustes: 1,
        motivosAjuste: [{ ciclo: 2, etapa: 'Prova dos dentes', data: '2026-11-03', motivo: 'Linha média desviada e DVO baixa' }],
        avaliacao: { consultas: 'critico', tempo: 'atencao', geral: 'critico' },
        riscos: [],
        alertas: [
          { id: 1, tipo: 'consultas_critico', mensagem: 'Maria Clara Oliveira (Protocolo definitivo) atingiu o máximo de consultas: 5 de 5.', criadoEm: '2026-11-11T18:00:00Z', cienteEm: null, cientePor: null, cienteNota: null },
        ],
        vinculo: null,
        sugestoes: [],
      },
      {
        ordemId: 1114,
        paciente: 'Fernanda Souza',
        clinica: 'Odonto Maceió',
        servico: 'Protocolo provisório de carga imediata',
        tipo: 'protocolo_carga_imediata',
        tipoNome: 'Carga imediata',
        status: 'Em Produção',
        etapa: 'Acrilização',
        encerrado: false,
        pausado: false,
        dataPedido: '2026-11-09',
        dataFim: null,
        diasAberto: 6,
        limite: { consultasAtencao: 4, consultasMax: 5, diasAtencao: 10, diasMax: 20 },
        consultasPrevistas: 3,
        consultas: {
          realizadas: 2,
          semConfirmacao: 0,
          faltas: 0,
          futuras: 1,
          lista: [
            { id: 'c20', data: '2026-11-09', hora: '08:00', status: 'compareceu', dentista: 'Dr. Henrique Bastos', categoria: 'Prótese', observacoes: null, situacao: 'realizada' },
            { id: 'c21', data: '2026-11-11', hora: '09:00', status: 'compareceu', dentista: 'Dr. Henrique Bastos', categoria: 'Prótese', observacoes: null, situacao: 'realizada' },
            { id: 'c22', data: '2026-11-16', hora: '10:00', status: 'agendado', dentista: 'Dr. Henrique Bastos', categoria: 'Prótese', observacoes: 'Instalação', situacao: 'futura' },
          ],
        },
        dentistas: ['Dr. Henrique Bastos'],
        dentistaOrdem: 'Dr. Henrique Bastos',
        tempo: { laboratorio: 6, clinica: 0, fornecedor: 0, temRegistro: true, comQuem: 'laboratorio', desde: '2026-11-09' },
        provas: 0,
        ajustes: 0,
        motivosAjuste: [],
        avaliacao: { consultas: 'ok', tempo: 'ok', geral: 'ok' },
        riscos: [
          { tipo: 'consulta_sem_peca', nivel: 'critico', titulo: 'Consulta próxima sem peça na clínica', detalhe: 'Paciente agendado amanhã às 10:00, mas a peça consta no laboratório.' },
        ],
        alertas: [],
        vinculo: null,
        sugestoes: [],
      },
      {
        ordemId: 1089,
        paciente: 'José Antônio Ferreira',
        clinica: 'Instituto Odonto',
        servico: 'PPR com estrutura',
        tipo: 'ppr_com_estrutura',
        tipoNome: 'PPR com estrutura',
        status: 'Pausado',
        etapa: 'Montagem dos dentes',
        encerrado: false,
        pausado: true,
        dataPedido: '2026-08-20',
        dataFim: null,
        diasAberto: 87,
        limite: { consultasAtencao: 5, consultasMax: 6, diasAtencao: 60, diasMax: 90 },
        consultasPrevistas: 4,
        consultas: { realizadas: 2, semConfirmacao: 0, faltas: 0, futuras: 0, lista: [] },
        dentistas: [],
        dentistaOrdem: 'Dr. Henrique Bastos',
        tempo: { laboratorio: 20, clinica: 15, fornecedor: 18, temRegistro: true, comQuem: 'laboratorio', desde: '2026-10-12' },
        provas: 1,
        ajustes: 0,
        motivosAjuste: [],
        avaliacao: { consultas: 'ok', tempo: 'atencao', geral: 'atencao' },
        riscos: [],
        alertas: [],
        vinculo: null,
        sugestoes: ['José Ferreira'],
      },
      {
        ordemId: 980,
        paciente: 'Roberto Almeida',
        clinica: 'Odonto Maceió',
        servico: 'PPR sem estrutura',
        tipo: 'ppr_sem_estrutura',
        tipoNome: 'PPR sem estrutura',
        status: 'Entregue',
        etapa: 'Entrega ao paciente',
        encerrado: true,
        pausado: false,
        dataPedido: '2026-09-02',
        dataFim: '2026-10-28',
        diasAberto: 56,
        limite: { consultasAtencao: 5, consultasMax: 6, diasAtencao: 45, diasMax: 60 },
        consultasPrevistas: 4,
        consultas: { realizadas: 5, semConfirmacao: 0, faltas: 0, futuras: 0, lista: [] },
        dentistas: ['Dr. Henrique Bastos'],
        dentistaOrdem: 'Dr. Henrique Bastos',
        tempo: { laboratorio: 24, clinica: 32, fornecedor: 0, temRegistro: true, comQuem: 'clinica', desde: '2026-10-28' },
        provas: 2,
        ajustes: 1,
        motivosAjuste: [],
        avaliacao: { consultas: 'atencao', tempo: 'atencao', geral: 'atencao' },
        riscos: [],
        alertas: [],
        vinculo: null,
        sugestoes: [],
      },
    ],
  }

  return `const process={env:{NODE_ENV:'development'}};const modules={${Object.entries(mods).map(([id, src]) => `${id}:${src}`).join(',')}};const cache={};function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports}const React=require(${reactId});const {TratamentosView}=require(${viewId});require(${clientId}).createRoot(document.getElementById('root')).render(React.createElement(TratamentosView,{painel:${JSON.stringify(painelFixture)}}));`
}

test('TratamentosView e TratamentoCard em Chromium: nomes dos profissionais, cancelar ciência e ordem pausada', async () => {
  const bundle = buildTratamentosBundle()
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(`<!doctype html><html><head><meta charset="utf-8"><style>body{font:14px system-ui;margin:0}table{width:100%}</style></head><body><div id="root"></div><script>${bundle.replace(/<\/script/g, '<\\/script')}</script></body></html>`)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port

  const chrome = spawn('/usr/bin/chromium', [
    '--headless', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0',
    '--user-data-dir=/tmp/labgest-tratamentos-test-chromium', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  try {
    const wsurl = await new Promise((resolve, reject) => {
      let stderr = ''
      chrome.stderr.on('data', (chunk) => {
        stderr += chunk
        const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/)
        if (m) resolve(m[1])
      })
      chrome.on('exit', () => reject(new Error(stderr)))
    })

    const ws = new WebSocket(wsurl)
    await new Promise((resolve) => { ws.onopen = resolve })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id) {
        const p = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) p.reject(new Error(msg.error.message))
        else p.resolve(msg.result)
      }
    }
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId)
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + JSON.stringify(r.exceptionDetails.exception))
      return r.result.value
    }

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/tratamentos` }, sessionId)
    for (let i = 0; i < 60; i++) {
      if (await evalJs('!!document.querySelector("h1")')) break
      await new Promise((r) => setTimeout(r, 30))
    }

    const bodyText = await evalJs('document.body.innerText')
    // 1) Resolved dentist names appear in "Por dentista" table
    assert.match(bodyText, /Dra\. Camila Mendes/)
    assert.match(bodyText, /Dr\. Rafael Costa/)
    assert.doesNotMatch(bodyText, /Profissional 5501/)

    // 2) Paused order (José Antônio Ferreira) is NOT in "Precisam de ação" tab
    assert.match(bodyText, /Maria Clara Oliveira/)
    assert.doesNotMatch(bodyText, /José Antônio Ferreira/)

    // 3) Switching to "Em andamento" shows paused order with "Pausado" badge
    await evalJs(`Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent.includes('Em andamento')).click()`)
    const textAndamento = await evalJs('document.body.innerText')
    assert.match(textAndamento, /José Antônio Ferreira/)
    assert.match(textAndamento, /Pausado/)

    // 4) Switch back to "Precisam de ação", test inline "Dar ciência": Cancel must NOT call action; Confirm must call action
    await evalJs(`Array.from(document.querySelectorAll('button[role="tab"]')).find(b => b.textContent.includes('Precisam de ação')).click()`)
    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dar ciência')).click()`)
    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Cancelar').click()`)
    assert.equal(await evalJs('window.__calls.length'), 0, 'Cancelar não deve disparar darCienciaAlertas')

    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dar ciência')).click()`)
    await evalJs(`(()=>{const el=document.querySelector('input[aria-label="Providência para ciência"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Ajuste combinado com a Dra. Camila');el.dispatchEvent(new Event('input',{bubbles:true}))})()`)
    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Confirmar').click()`)
    await new Promise((r) => setTimeout(r, 50))
    const calls = await evalJs('window.__calls')
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { action: 'darCienciaAlertas', ordemId: 1042, nota: 'Ajuste combinado com a Dra. Camila' })

    // 5) Expand consultations and verify resolved dentist names, OS link, adjustment note, operational risk, and 180-day efficiency
    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Ver consultas')).click()`)
    const cardText = await evalJs('document.body.innerText')
    assert.match(cardText, /Atendido por: Dra\. Camila Mendes, Dr\. Rafael Costa/)
    assert.match(cardText, /Linha média desviada e DVO baixa/)
    assert.match(cardText, /Consulta próxima sem peça na clínica/)
    assert.match(cardText, /Eficiência \(180 dias\)/)
    const osHref = await evalJs(`document.querySelector('a[href*="/ordens?busca=1042"]')?.getAttribute('href')`)
    assert.equal(osHref, '/ordens?busca=1042&status=todos')

    // 6) Clickable dentist filter in "Por dentista" table + operational risk chip
    await evalJs(`Array.from(document.querySelectorAll('table button')).find(b => b.textContent.trim() === 'Dr. Henrique Bastos').click()`)
    const filteredByDentist = await evalJs('document.body.innerText')
    assert.match(filteredByDentist, /Fernanda Souza/)
    assert.doesNotMatch(filteredByDentist, /Maria Clara Oliveira/)
    assert.match(filteredByDentist, /Dentista: Dr\. Henrique Bastos/)

    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dentista: Dr. Henrique Bastos')).click()`)
    await evalJs(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Consulta ≤48h sem peça')).click()`)
    const filteredByRisk = await evalJs('document.body.innerText')
    assert.match(filteredByRisk, /Fernanda Souza/)
    assert.doesNotMatch(filteredByRisk, /Maria Clara Oliveira/)

    ws.close()
  } finally {
    chrome.kill('SIGKILL')
    server.close()
  }
})
