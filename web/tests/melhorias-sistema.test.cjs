/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')
function loader(overrides = {}) {
  const cache = new Map()
  function load(name, from = root + '/web/src/index.ts') {
    if (name in overrides) return overrides[name]
    let file
    if (name === '@labgest/shared') file = root + '/packages/shared/src/index.ts'
    else if (name.startsWith('web/src/')) file = root + '/' + name
    else if (name.startsWith('@/')) file = root + '/web/src/' + name.slice(2)
    else if (name.startsWith('.')) file = path.resolve(path.dirname(from), name)
    else return require(require.resolve(name, { paths: [root + '/web', root] }))
    if (!fs.existsSync(file)) file = ['.ts', '.tsx'].map((ext) => file + ext).find(fs.existsSync)
    assert.ok(file, name)
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
      }).outputText,
      { exports, require: (dep) => load(dep, file), Date, Intl, Set, Map, Math, JSON, RegExp, Array, Object, Number, String, Boolean, Error, console, process },
      { filename: file },
    )
    return exports
  }
  return load
}

const load = loader()

test('regra dos dois relogios: retorno da clinica gera novo prazo de 10 dias no lab mantendo o total de dias vencidos visivel e priorizado', () => {
  const {
    PRAZO_RETORNO_LAB_DIAS,
    calcularRelogiosOrdem,
    ordenarOrdensOperacionais,
  } = load('web/src/lib/producao-utils.ts')

  assert.equal(PRAZO_RETORNO_LAB_DIAS, 10)

  const hoje = '2026-11-15'
  const ordemRetornouHojeMuitoVencida = {
    id: 101,
    paciente: 'Maria Aparecida',
    dentista: 'Dra. Carla',
    servico: 'Protocolo Superior',
    status: 'Em Produção',
    prioridade: 'Normal',
    etapa: 'execucao',
    subetapaAtual: 'Montagem em cera',
    tipoWorkflow: 'protocolo_definitivo',
    passoFluxoAtual: 'montagem_dentes',
    arcadas: 1,
    prazoEtapaAtual: '2026-11-25T12:00:00.000Z',
    fornecedorEstrutura: null,
    dataEnvioFornecedor: null,
    prazoFornecedor: null,
    progresso: 50,
    tentativaAtual: 2,
    entrada: '2026-10-01T12:00:00.000Z',
    entrega: '2026-10-20T12:00:00.000Z', // 26 dias vencida no total
    valor: 1800,
    cicloAtivo: false,
    cicloId: 10,
    cicloEtapa: 'Prova dos dentes',
    cicloComprometido: '2026-11-25T12:00:00.000Z',
    cicloDentistaDeci: 'ajustar',
    cicloObsDentista: 'Subir linha do sorriso',
    totalCiclos: 1,
    localizacaoAtual: 'laboratorio',
    situacaoLogistica: 'no_laboratorio',
    finalidadeClinica: 'prova',
    dentistaResponsavel: 'Dra. Carla',
    agendamentoClinico: null,
    agendamentoConfirmado: false,
    agendamentoDentista: null,
    movimentacaoLogisticaEm: '2026-11-15T10:00:00.000Z',
    dataEntradaCiclo: '2026-11-15T10:00:00.000Z',
    retornouAoLabEm: '2026-11-15T10:00:00.000Z',
    historicoEtapas: [
      { acao: 'confirmou_retorno_lab', data: '2026-11-15T10:00:00.000Z' },
    ],
  }

  const relogios = calcularRelogiosOrdem(ordemRetornouHojeMuitoVencida, hoje)
  assert.equal(relogios.renovadoPorRetorno, true)
  assert.equal(relogios.diasVencidosTotal, 26)
  assert.ok(relogios.diasRestantesCiclo >= 10, `Esperado >= 10 dias no novo ciclo, obtido ${relogios.diasRestantesCiclo}`)

  const ordemPoucoVencida = {
    ...ordemRetornouHojeMuitoVencida,
    id: 102,
    paciente: 'João Menos Antigo',
    entrega: '2026-11-10T12:00:00.000Z', // 5 dias vencida no total
  }

  const ordenadas = ordenarOrdensOperacionais([ordemPoucoVencida, ordemRetornouHojeMuitoVencida], hoje)
  assert.equal(ordenadas[0].id, 101, 'A OS com mais dias vencidos no total deve vir primeiro no topo da bancada')
})

test('OrdemCard em /lab-interno exibe os dois relogios e botoes operacionais de 1 clique', () => {
  const { OrdemCard } = load('web/src/components/lab-interno/ordem-card.tsx')
  const ordem = {
    id: 501,
    paciente: 'Thaís de Souza',
    dentista: 'Dr. Marcos',
    servico: 'Prótese Protocolo',
    status: 'Em Produção',
    prioridade: 'Alta',
    etapa: 'execucao',
    subetapaAtual: 'Acrilização',
    tipoWorkflow: 'protocolo_definitivo',
    passoFluxoAtual: 'acrilizacao',
    arcadas: 1,
    prazoEtapaAtual: '2026-11-26T12:00:00.000Z',
    fornecedorEstrutura: null,
    dataEnvioFornecedor: null,
    prazoFornecedor: null,
    progresso: 80,
    tentativaAtual: 1,
    entrada: '2026-10-01T12:00:00.000Z',
    entrega: '2026-10-25T12:00:00.000Z',
    valor: 2100,
    cicloAtivo: false,
    cicloId: 9,
    cicloEtapa: 'Prova em cera',
    cicloComprometido: '2026-11-26T12:00:00.000Z',
    cicloDentistaDeci: null,
    cicloObsDentista: null,
    totalCiclos: 1,
    localizacaoAtual: 'laboratorio',
    situacaoLogistica: 'no_laboratorio',
    finalidadeClinica: 'prova',
    dentistaResponsavel: 'Dr. Marcos',
    agendamentoClinico: null,
    agendamentoConfirmado: false,
    agendamentoDentista: null,
    movimentacaoLogisticaEm: '2026-11-15T10:00:00.000Z',
    dataEntradaCiclo: '2026-11-15T10:00:00.000Z',
    retornouAoLabEm: '2026-11-15T10:00:00.000Z',
    historicoEtapas: [{ acao: 'confirmou_retorno_lab', data: '2026-11-15T10:00:00.000Z' }],
  }

  const html = renderToStaticMarkup(
    React.createElement(OrdemCard, {
      ordem,
      onConcluirEtapa: () => {},
      onReportarProblema: () => {},
    }),
  )

  assert.match(html, /Novo ciclo \(10d\)/)
  assert.match(html, /Vencida há \d+d no total · Prioridade/)
  assert.match(html, /Concluir etapa/)
  assert.match(html, /Problema/)

  const htmlRetorno = renderToStaticMarkup(
    React.createElement(OrdemCard, {
      ordem: { ...ordem, cicloDentistaDeci: 'ajustar' },
      onConfirmarRetorno: () => {},
    }),
  )
  assert.match(htmlRetorno, /Confirmar retorno \(\+10d\)/)
})

test('triagem WhatsApp OS + STL concilia paciente com erro de grafia na agenda do Clinicorp', () => {
  const {
    normalizarFoneticoPtBr,
    conciliarPacienteClinicorp,
    extrairDadosMensagemGrupoOs,
  } = load('web/src/lib/triagem-whatsapp-os.ts')

  assert.equal(normalizarFoneticoPtBr('Thaís Philipe de Souza'), normalizarFoneticoPtBr('Tais Filipe Souza'))
  assert.equal(normalizarFoneticoPtBr('Matheus Luiz Oliveira'), normalizarFoneticoPtBr('Mateus Luis de Oliveira'))

  const extraido = extrairDadosMensagemGrupoOs(
    'Paciente: Tais de Souza\nDentista: Dra. Carla\nServiço: Protocolo Superior\nCor: A2\nDentes: 11 ao 26',
    'uploads/Tais_Souza_Protocolo_A2.stl',
  )
  assert.equal(extraido.pacienteExtraido, 'Tais de Souza')
  assert.equal(extraido.corExtraida, 'A2')
  assert.equal(extraido.tipoProteseInferido, 'protocolo_definitivo')

  const conciliado = conciliarPacienteClinicorp(
    extraido.pacienteExtraido,
    [
      {
        nome: 'Thaís de Souza',
        cpf: '12345678909',
        dentista: 'Dra. Carla Mendes',
        dataConsultaIso: '2026-11-15',
        origem: 'clinicorp',
      },
      {
        nome: 'Carlos Eduardo',
        cpf: null,
        dentista: 'Dr. João',
        dataConsultaIso: '2026-11-15',
        origem: 'clinicorp',
      },
    ],
    extraido.dentistaExtraido,
  )

  assert.ok(conciliado.melhorMatch)
  assert.equal(conciliado.melhorMatch.nome, 'Thaís de Souza')
  assert.equal(conciliado.corrigidoAutomaticamente, true)
  assert.ok(conciliado.melhorMatch.score >= 90)
})

test('inteligencia financeira calcula custo medio ponderado, termometro de reajuste e rentabilidade real por dentista', () => {
  const {
    calcularCustoMedioPonderado,
    avaliarReajusteServico,
    calcularRentabilidadePorCliente,
  } = load('web/src/lib/inteligencia-financeira.ts')

  // 10 unidades a R$ 100 + 10 unidades a R$ 150 = R$ 125,00 de custo médio ponderado
  assert.equal(calcularCustoMedioPonderado(10, 100, 10, 150), 125)

  const reajuste = avaliarReajusteServico({
    servicoId: 1,
    servicoNome: 'Coroa Zircônia',
    categoria: 'Prótese Fixa',
    precoAtual: 300,
    custoCadastrado: 80,
    materiaisVinculados: [{ id: 10, quantidade: 2 }],
    precosEstoquePorId: new Map([[10, 90]]), // Custo vivo subiu para R$ 180
    totalOrdens: 10,
    ordensComRetrabalho: 4, // 40% de retrabalho
  })

  assert.equal(reajuste.custoInsumosAoVivo, 180)
  assert.ok(reajuste.custoRetrabalhoMedio > 0)
  assert.equal(reajuste.statusMargem, 'defasado')
  assert.ok(reajuste.precoSugerido > 300)

  const ranking = calcularRentabilidadePorCliente({
    ordens: [
      { clienteNome: 'Dra. Estrela', valor: 2000, custoInsumoEstimado: 300, ajustesRetorno: 0 },
      { clienteNome: 'Dra. Estrela', valor: 2000, custoInsumoEstimado: 300, ajustesRetorno: 0 },
      { clienteNome: 'Dr. Retrabalho', valor: 1000, custoInsumoEstimado: 300, ajustesRetorno: 3 },
    ],
    inadimplenciaPorCliente: new Map(),
  })

  assert.equal(ranking[0].clienteNome, 'Dra. Estrela')
  assert.equal(ranking[0].classificacao, 'estrela')
  assert.equal(ranking[1].clienteNome, 'Dr. Retrabalho')
  assert.equal(ranking[1].classificacao, 'atencao_retrabalho')
})

test('resolverUrlArquivoLab resolve caminhos relativos do Supabase sem alterar URLs completas', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto-exemplo.supabase.co'
  try {
    const customLoad = loader({
      '@/components/ui/modal': { Modal: () => null },
      '@/components/ordens/stl-viewer-modal': { StlViewerModal: () => null },
      '@/actions/ordens': {},
      '@/actions/mensagens': {},
      '@/actions/workflow-protese': {},
    })
    const { resolverUrlArquivoLab } = customLoad('web/src/components/ordens/visualizar-ordem-modal.tsx')
    assert.equal(
      resolverUrlArquivoLab('https://example.invalid/modelo.stl'),
      'https://example.invalid/modelo.stl',
    )
    assert.equal(
      resolverUrlArquivoLab('uploads/123-arcada.stl'),
      'https://projeto-exemplo.supabase.co/storage/v1/object/public/lab-files/uploads/123-arcada.stl',
    )
  } finally {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl
  }
})
