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

test('browser Chromium valida abas e acoes reais de Financeiro, Lab Interno, Configuracoes, Estoque e Check-in 1-Toque', async (t) => {
  const chrome = findChrome()
  if (!chrome) t.skip('Chromium não encontrado no ambiente')

  const browserEntry = `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { FinanceiroView } from '@/app/(dashboard)/financeiro/financeiro-view'
    import { LabInternoView } from '@/app/(dashboard)/lab-interno/lab-interno-view'
    import { ConfiguracoesView } from '@/app/(dashboard)/configuracoes/configuracoes-view'
    import { CheckinRapidoPanel } from '@/components/ordens/checkin-rapido-panel'
    import { MovimentarEstoqueModal } from '@/components/estoque/movimentar-estoque-modal'

    window.__actionCalls = []

    const dadosFinanceiro = {
      periodo: '2026-11',
      receber: [],
      receberCompetencia: [],
      pagar: [],
      clientes: [{ id: 1, nome: 'Dra. Estrela' }],
      contasFinanceiras: [{ id: 1, nome: 'Conta Principal', tipo: 'Banco' }],
      movimentacoes: [],
      resumo: {
        entradas: 12000, saidas: 3500, resultadoRealizado: 8500,
        recebidoCompetencia: 10000, pagoCompetencia: 3000,
        previstoReceber: 15000, totalPrevistoReceber: 15000,
        previstoPagar: 4000, totalPrevistoPagar: 4000,
        resultadoProjetado: 11000, vencidoReceber: 500, quantidadeVencidas: 1,
      },
      mesesDisponiveis: ['2026-11'],
      inteligencia: {
        reajusteServicos: [
          {
            servicoId: 10, servicoNome: 'Coroa Zircônia', categoria: 'Prótese Fixa',
            precoAtual: 300, custoInsumosAoVivo: 180, taxaRetrabalhoPercentual: 40,
            custoRetrabalhoMedio: 36, custoTotalReal: 216, margemRealPercentual: 28,
            precoSugerido: 617.14, reajusteSugeridoPercentual: 105.7,
            statusMargem: 'defasado', recomendacao: 'Defasado pelo custo de insumos + retrabalho',
          },
        ],
        rentabilidadeClientes: [
          {
            clienteNome: 'Dra. Estrela', totalOrdens: 10, totalAjustesRetorno: 0,
            taxaRetrabalhoPercentual: 0, receitaBruta: 8000, custoInsumos: 1200,
            custoRetrabalhoEstimado: 0, inadimplenciaAtual: 0, lucroLiquidoReal: 6800,
            margemRealPercentual: 85, classificacao: 'estrela',
            insightGestor: 'Parceria altamente lucrativa sem retrabalho',
          },
        ],
        reposicaoEstoque: {
          alertas: [
            {
              estoqueId: 1, nome: 'Bloco Zircônia A2', categoria: 'Cerâmica',
              quantidadeAtual: 2, quantidadeMinima: 5, unidade: 'un',
              precoUnitario: 120, quantidadeSugeridaCompra: 8, custoReposicaoEstimado: 960,
              motivo: 'estoque_baixo', fornecedor: 'Dental Sul',
            },
          ],
          custoTotalReposicao: 960,
          valorTotalEmEstoque: 240,
        },
      },
    }

    const ordensLab = [
      {
        id: 777, paciente: 'Thaís de Souza', dentista: 'Dra. Carla', servico: 'Protocolo Definitivo',
        status: 'Em Produção', prioridade: 'Urgente', etapa: 'execucao',
        subetapaAtual: 'Montagem em cera', tipoWorkflow: 'protocolo_definitivo',
        passoFluxoAtual: 'montagem_dentes', arcadas: 1,
        prazoEtapaAtual: '2026-11-25T12:00:00.000Z',
        fornecedorEstrutura: null, dataEnvioFornecedor: null, prazoFornecedor: null,
        progresso: 55, tentativaAtual: 1, entrada: '2026-10-01T12:00:00.000Z',
        entrega: '2026-10-20T12:00:00.000Z', valor: 2400,
        cicloAtivoId: 5, cicloStatus: 'no_lab', cicloNumero: 2,
        cicloComprometido: '2026-11-25T12:00:00.000Z',
        dataEntradaCiclo: '2026-11-15T10:00:00.000Z',
        retornouAoLabEm: '2026-11-15T10:00:00.000Z',
        cicloDentistaDeci: null, cicloObs: 'Checar linha média',
        localizacaoAtual: 'laboratorio', situacaoLogistica: 'no_laboratorio',
        historicoEtapas: [{ acao: 'confirmou_retorno_lab', data: '2026-11-15T10:00:00.000Z' }],
      },
    ]

    const triagemInicial = [
      {
        id: 88, textoOriginal: 'Paciente Tais de Souza - Protocolo A2',
        arquivosStl: ['uploads/Tais_Souza_A2.stl'],
        remetenteNome: 'Dra. Carla', remetenteTelefone: '5511999999999',
        pacienteExtraido: 'Tais de Souza', pacienteSugerido: 'Thaís de Souza',
        dentistaSugerido: 'Dra. Carla', servicoSugerido: 'Protocolo Definitivo',
        corSugerida: 'A2', elementosSugeridos: '11-26',
        scoreConciliacao: 96, motivoConciliacao: 'Conciliado com agenda Clinicorp',
        createdAt: '2026-11-15T12:00:00.000Z',
      },
    ]

    function AppHarness() {
      const [view, setView] = useState('financeiro')
      return (
        <div>
          <nav style={{ display: 'flex', gap: 8, padding: 12, borderBottom: '1px solid #e2e8f0' }}>
            <button id="nav-financeiro" onClick={() => setView('financeiro')}>View Financeiro</button>
            <button id="nav-lab" onClick={() => setView('lab')}>View Lab Interno</button>
            <button id="nav-config" onClick={() => setView('config')}>View Config</button>
            <button id="nav-checkin" onClick={() => setView('checkin')}>View Checkin</button>
            <button id="nav-estoque" onClick={() => setView('estoque')}>View Estoque Modal</button>
          </nav>

          {view === 'financeiro' && <FinanceiroView dados={dadosFinanceiro} criterioReceber="vencimento" />}
          {view === 'lab' && <LabInternoView ordens={ordensLab} historico={[]} triagem={triagemInicial} />}
          {view === 'config' && (
            <ConfiguracoesView
              initialConfig={{ nome: 'LabGest', telefone: '', email: '', endereco: '', cnpj: '' }}
              usuarios={[]}
              initialNotificacoes={{
                recepcaoTelefone: '5511999999999', labTelefone: '5511988888888',
                gestorTelefone: '5511977777777', grupoOsJid: '12036304958291@g.us',
                notificarSaidaLabParaRecepcao: true, notificarChegadaRecepcaoParaDentista: true,
                cobrarRetornoProvaSemDecisao: true, notificarProblemaTecnico: true,
                estoqueBaixo: true, resumoDiario: true,
              }}
            />
          )}
          {view === 'checkin' && <CheckinRapidoPanel tokenOuId="token-777" ordemId={777} statusAtual="Em Prova" />}
          {view === 'estoque' && (
            <MovimentarEstoqueModal
              item={{ id: 1, nome: 'Bloco Zircônia A2', marca: 'VITA', categoria: 'Cerâmica', quantidade: 4, quantidadeMinima: 5, unidade: 'un', precoUnitario: 100, fornecedor: 'Dental Sul', localizacao: 'Prateleira A', dataValidade: null, codigoBarras: '', ativo: true, updatedAt: null }}
              onClose={() => {}}
              onSuccess={() => {}}
            />
          )}
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<AppHarness />)
  `

  const build = await esbuild.build({
    stdin: { contents: browserEntry, loader: 'tsx', resolveDir: web },
    bundle: true,
    write: false,
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{
      name: 'labgest-browser-mocks',
      setup(b) {
        b.onResolve({ filter: /^@\/actions\// }, (a) => ({ path: a.path, namespace: 'action' }))
        b.onLoad({ filter: /.*/, namespace: 'action' }, () => ({
          contents: `
            const ok = async (...args) => { window.__actionCalls.push(args); return { success: true, mensagem: 'OK' } }
            export const cancelarConta = ok
            export const estornarBaixa = ok
            export const liquidarConta = ok
            export const editarConta = ok
            export const createConta = ok
            export const sincronizarFinanceiroRetroativo = async () => ({ success: true, criadas: 0 })
            export const aplicarReajusteServico = ok
            export const registrarMovimentacaoEstoque = ok
            export const concluirEtapaLaboratorial = async () => ({ success: true, proximo: 'Acabamento' })
            export const confirmarRecebimentoFornecedor = async () => ({ success: true, proximo: 'Acabamento' })
            export const iniciarFluxoNoLaboratorio = async () => ({ success: true, etapa: 'Recebimento' })
            export const confirmarRetorno = ok
            export const reportarProblemaTecnicoOrdem = ok
            export const executarCheckinRapidoOrdem = async () => ({ success: true, mensagem: 'Movimentação registrada!' })
            export const aprovarTriagemGerarOrdem = async () => ({ success: true, ordemId: 900, paciente: 'Thaís de Souza' })
            export const descartarTriagemWhatsapp = ok
            export const registrarMensagemGrupoWhatsappManual = async () => ({ success: true })
            export const updateLabConfig = ok
            export const criarUsuario = ok
            export const toggleStatusUsuario = ok
            export const excluirUsuario = ok
            export const saveNotificacoesConfig = ok
            export const dispararResumoMatinalWhatsapp = async () => ({ success: true, enviados: 2 })
            export const getMensagensNaoLidasLab = async () => 0
            export const aplicarEtapaClinicorpNaOrdem = ok
            export const sincronizarEtapasClinicorpLab = async () => ({ sincronizadas: 0, consultas: 0 })
            export const getOrdemById = async () => null
            export const enviarMensagemLab = ok
            export const definirEtapaFluxoProtese = ok
            export const logout = ok
          `,
        }))
        b.onResolve({ filter: /^next\/(link|navigation|image|themes)$/ }, (a) => ({ path: a.path, namespace: 'next' }))
        b.onLoad({ filter: /.*/, namespace: 'next' }, (a) => {
          if (a.path === 'next/image') {
            return { contents: `import React from 'react'; export default function Image(props){ return <img {...props} /> }`, loader: 'jsx', resolveDir: web }
          }
          if (a.path === 'next/link') {
            return { contents: `import React from 'react'; export default function Link({ href, children, ...props }){ return <a href={href} {...props}>{children}</a> }`, loader: 'jsx', resolveDir: web }
          }
          if (a.path === 'next/themes') {
            return { contents: `export function useTheme(){ return { theme: 'light', setTheme: () => {} } }`, loader: 'js', resolveDir: web }
          }
          return { contents: `export function useRouter(){ return { push: () => {}, refresh: () => {} } } export function usePathname(){ return '/financeiro' } export function useSearchParams(){ return new URLSearchParams() }`, loader: 'js', resolveDir: web }
        })
        b.onResolve({ filter: /^@\/components\/layout\/dashboard-layout$/ }, (a) => ({ path: a.path, namespace: 'layout' }))
        b.onLoad({ filter: /.*/, namespace: 'layout' }, () => ({
          contents: `import React from 'react'; export function DashboardLayout({ children }){ return <div>{children}</div> }`,
          loader: 'jsx',
          resolveDir: web,
        }))
        b.onResolve({ filter: /^@\// }, (a) => {
          const p = path.join(web, 'src', a.path.slice(2))
          const found = ['.tsx', '.ts'].map((ext) => p + ext).find((c) => fs.existsSync(c))
          return { path: found || p }
        })
      },
    }],
  })

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:'production'}};</script><script>${build.outputFiles[0].text.replace(/<\/script/g, '<\\/script')}</script></body></html>`
  const server = http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'melhorias-chrome-'))
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
    await send('Runtime.enable', {}, sessionId)
    const runtimeErrors = []
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data))
      if (msg.method === 'Runtime.exceptionThrown') runtimeErrors.push(JSON.stringify(msg.params))
    })

    const evalPage = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || JSON.stringify(r.exceptionDetails))
      return r.result?.value
    }

    await send('Page.navigate', { url: `http://127.0.0.1:${port}/` }, sessionId)
    for (let i = 0; i < 60; i++) {
      if (await evalPage('!!document.querySelector("#nav-financeiro")')) break
      await new Promise((r) => setTimeout(r, 30))
    }

    // 1. Financeiro -> verifica aba Inteligência & Custos e clica nela
    const finTabExists = await evalPage(`[...document.querySelectorAll('[role="tab"]')].some(b => b.textContent.includes('Inteligência'))`)
    assert.equal(finTabExists, true, 'Aba Inteligência & Custos deve aparecer no Financeiro')
    await evalPage(`(() => { const b = [...document.querySelectorAll('[role="tab"]')].find(el => el.textContent.includes('Inteligência')); b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); b.click(); })()`)
    await new Promise((r) => setTimeout(r, 120))
    const finBody = await evalPage('document.body.innerText')
    assert.match(finBody, /Termômetro de Reajuste de Preços/)
    assert.match(finBody, /Coroa Zircônia/)
    assert.match(finBody, /Ranking de Rentabilidade Real por Dentista/)
    assert.match(finBody, /Previsão Financeira de Compra de Insumos/)

    // 2. Lab Interno -> Triagem WhatsApp + 2 Relógios + Problema + Form manual
    await evalPage(`document.querySelector('#nav-lab').click()`)
    await new Promise((r) => setTimeout(r, 120))
    let labBody = await evalPage('document.body.innerText')
    assert.match(labBody, /Triagem Automática do Grupo WhatsApp/)
    assert.match(labBody, /Tais_Souza_A2\.stl/)
    assert.match(labBody, /Novo ciclo \(10d\):/)
    assert.match(labBody, /Vencida há \d+d no total · Prioridade/)
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Colar OS')).click()`)
    await new Promise((r) => setTimeout(r, 80))
    labBody = await evalPage('document.body.innerText')
    assert.match(labBody, /Analisar e Conciliar com Clinicorp/)

    // 3. Configurações -> Notificações
    await evalPage(`document.querySelector('#nav-config').click()`)
    await new Promise((r) => setTimeout(r, 120))
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Notificações')).click()`)
    await new Promise((r) => setTimeout(r, 80))
    const cfgBody = await evalPage('document.body.innerText')
    assert.match(cfgBody, /Automações e Lembretes por WhatsApp/)
    assert.match(cfgBody, /Enviar Resumo Matinal Agora/)
    assert.match(cfgBody, /Saída do Laboratório → Avisar Recepção/)

    // 4. Check-in 1-Toque -> Solicitar Ajuste
    await evalPage(`document.querySelector('#nav-checkin').click()`)
    await new Promise((r) => setTimeout(r, 100))
    await evalPage(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Solicitar Ajuste')).click()`)
    await new Promise((r) => setTimeout(r, 80))
    const checkinBody = await evalPage('document.body.innerText')
    assert.match(checkinBody, /Chegou na Recepção/)
    assert.match(checkinBody, /Confirmar Pedido de Ajuste/)

    // 5. Estoque Modal -> Checkbox Contas a Pagar + Custo Médio Ponderado
    await evalPage(`document.querySelector('#nav-estoque').click()`)
    await new Promise((r) => setTimeout(r, 100))
    const estoqueBody = await evalPage('document.body.innerText')
    assert.match(estoqueBody, /Lançar compra no Contas a Pagar do Financeiro/)

    assert.deepEqual(runtimeErrors, [])
  } finally {
    ws.close()
    proc.kill('SIGKILL')
    await new Promise((resolve) => server.close(resolve))
    await new Promise((r) => setTimeout(r, 150))
    fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})
