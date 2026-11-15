import assert from 'node:assert/strict'
import test from 'node:test'
import {
  alertasDevidos,
  analisarConsultas,
  avaliarTratamento,
  categoriaContaParaProtese,
  consultasPrevistas,
  detectarRiscosOperacionais,
  dividirTempo,
  limitePadrao,
  limiteValido,
  nomesParecidos,
  normalizarNome,
  type ConsultaClinica,
} from '../src/treatment-control'

test('protocolo definitivo: atenção na 4ª consulta e máximo na 5ª', () => {
  assert.equal(consultasPrevistas('protocolo_definitivo'), 3)
  const limite = limitePadrao('protocolo_definitivo')
  assert.equal(limite.consultasAtencao, 4)
  assert.equal(limite.consultasMax, 5)
  assert.equal(avaliarTratamento(3, 10, limite).geral, 'ok')
  assert.equal(avaliarTratamento(4, 10, limite).consultas, 'atencao')
  assert.equal(avaliarTratamento(5, 10, limite).consultas, 'critico')
})

test('prótese total tem mais etapas clínicas e por isso um teto maior', () => {
  assert.equal(consultasPrevistas('protese_total_removivel'), 5)
  assert.deepEqual(
    [limitePadrao('protese_total_removivel').consultasAtencao, limitePadrao('protese_total_removivel').consultasMax],
    [6, 7],
  )
})

test('tempo aberto gera alerta independente do número de consultas', () => {
  const limite = limitePadrao('protocolo_definitivo')
  const avaliacao = avaliarTratamento(1, 95, limite)
  assert.equal(avaliacao.consultas, 'ok')
  assert.equal(avaliacao.tempo, 'critico')
  assert.equal(avaliacao.geral, 'critico')
  assert.deepEqual(alertasDevidos(avaliacao), ['tempo_atencao', 'tempo_critico'])
  assert.deepEqual(alertasDevidos(avaliarTratamento(4, 61, limite)), ['consultas_atencao', 'tempo_atencao'])
  assert.deepEqual(alertasDevidos(avaliarTratamento(0, 0, limite)), [])
})

test('limite inválido é rejeitado', () => {
  assert.equal(limiteValido({ consultasAtencao: 4, consultasMax: 5, diasAtencao: 60, diasMax: 90 }), true)
  assert.equal(limiteValido({ consultasAtencao: 6, consultasMax: 5, diasAtencao: 60, diasMax: 90 }), false)
  assert.equal(limiteValido({ consultasAtencao: 4, consultasMax: 5, diasAtencao: 0, diasMax: 90 }), false)
  assert.equal(limiteValido({ consultasAtencao: 4.5, consultasMax: 5, diasAtencao: 60, diasMax: 90 }), false)
})

test('nomes são comparados sem acento, caixa ou espaços extras', () => {
  assert.equal(normalizarNome('  José  da Conceição '), 'jose da conceicao')
  assert.equal(normalizarNome('JOSE DA CONCEICAO'), normalizarNome('José da Conceição'))
  assert.equal(normalizarNome(null), '')
})

test('sugere vínculo quando falta um sobrenome, mas não entre pessoas diferentes', () => {
  assert.equal(nomesParecidos('Maria Silva', 'Maria Aparecida da Silva'), true)
  assert.equal(nomesParecidos('Maria Aparecida Silva', 'Maria Silva'), true)
  assert.equal(nomesParecidos('Maria Silva', 'Maria Souza'), false)
  assert.equal(nomesParecidos('Maria Silva', 'Mario Silva'), false)
  assert.equal(nomesParecidos('Maria Silva', 'MARIA SILVA'), false) // iguais: não é sugestão
  assert.equal(nomesParecidos('Maria', 'Maria Silva'), false) // um nome só é ambíguo demais
})

test('categorias de agenda que não são de prótese ficam fora da conta', () => {
  assert.equal(categoriaContaParaProtese('Prótese'), true)
  assert.equal(categoriaContaParaProtese(''), true)
  assert.equal(categoriaContaParaProtese(null), true)
  assert.equal(categoriaContaParaProtese('AVALIAÇÃO MARKETING'), false)
  assert.equal(categoriaContaParaProtese('RETORNO DE 6 MÊSES'), false)
  assert.equal(categoriaContaParaProtese('Clareamento'), false)
})

test('conta consultas dentro da janela do tratamento e separa faltas e futuras', () => {
  const consultas: ConsultaClinica[] = [
    { id: 'antiga', data: '2026-01-10', status: 'compareceu', categoria: 'Prótese' },
    { id: 'moldagem', data: '2026-03-08', status: 'compareceu', categoria: 'Prótese' }, // 2 dias antes do pedido
    { id: 'prova', data: '2026-03-20', status: 'compareceu', categoria: '' },
    { id: 'falta', data: '2026-03-27', status: 'faltou', categoria: 'Prótese' },
    { id: 'esquecida', data: '2026-04-02', status: 'agendado', categoria: 'Prótese' },
    { id: 'avaliacao', data: '2026-04-03', status: 'compareceu', categoria: 'Avaliação' },
    { id: 'futura', data: '2026-04-20', status: 'agendado', categoria: 'Prótese' },
  ]
  const resumo = analisarConsultas(consultas, { inicio: '2026-03-10', fim: null, hoje: '2026-04-10' })
  assert.equal(resumo.realizadas, 3)
  assert.equal(resumo.semConfirmacao, 1)
  assert.equal(resumo.faltas, 1)
  assert.equal(resumo.futuras, 1)
  assert.deepEqual(resumo.lista.map((c) => [c.id, c.situacao]), [
    ['moldagem', 'realizada'],
    ['prova', 'realizada'],
    ['falta', 'falta'],
    ['esquecida', 'sem_confirmacao'],
    ['avaliacao', 'fora'],
    ['futura', 'futura'],
  ])
})

test('decisão manual do gestor prevalece sobre a categoria', () => {
  const consultas: ConsultaClinica[] = [
    { id: 'a', data: '2026-03-12', status: 'compareceu', categoria: 'Prótese', contaManual: false },
    { id: 'b', data: '2026-03-13', status: 'compareceu', categoria: 'Avaliação', contaManual: true },
  ]
  const resumo = analisarConsultas(consultas, { inicio: '2026-03-10', fim: null, hoje: '2026-04-10' })
  assert.equal(resumo.realizadas, 1)
  assert.deepEqual(resumo.lista.map((c) => c.situacao), ['fora', 'realizada'])
})

test('tratamento encerrado ignora consultas posteriores à entrega', () => {
  const consultas: ConsultaClinica[] = [
    { id: 'a', data: '2026-03-12', status: 'compareceu' },
    { id: 'controle', data: '2026-05-01', status: 'compareceu' },
  ]
  assert.equal(analisarConsultas(consultas, { inicio: '2026-03-10', fim: '2026-04-01', hoje: '2026-06-01' }).realizadas, 1)
})

test('divide o tempo entre laboratório, clínica e fornecedor pelas movimentações', () => {
  const divisao = dividirTempo([
    { acao: 'criou', data: '2026-03-01T12:00:00Z' },
    { acao: 'enviado_fornecedor', data: '2026-03-03T12:00:00Z' },
    { acao: 'recebeu_fornecedor', data: '2026-03-13T12:00:00Z' },
    { acao: 'concluiu_etapa_laboratorial', data: '2026-03-14T12:00:00Z' },
    { acao: 'enviou_recepcao', data: '2026-03-14T12:00:00Z' },
    { acao: 'recebeu_laboratorio', data: '2026-04-03T12:00:00Z' },
  ], '2026-03-01T12:00:00Z', '2026-04-05T12:00:00Z')
  assert.deepEqual(divisao, {
    laboratorio: 5, clinica: 20, fornecedor: 10, temRegistro: true, comQuem: 'laboratorio', desde: '2026-04-03',
  })
})

test('sem movimentação registrada a divisão é marcada como não confiável', () => {
  const divisao = dividirTempo([{ acao: 'criou', data: '2026-03-01T12:00:00Z' }, {}], '2026-03-01T12:00:00Z', '2026-03-11T12:00:00Z')
  assert.equal(divisao.temRegistro, false)
  assert.equal(divisao.laboratorio, 10)
})

test('trabalho parado na clínica aparece como estando com a clínica', () => {
  const divisao = dividirTempo([{ acao: 'enviou_recepcao', data: '2026-03-05T12:00:00Z' }], '2026-03-01T12:00:00Z', '2026-05-04T12:00:00Z')
  assert.equal(divisao.comQuem, 'clinica')
  assert.equal(divisao.desde, '2026-03-05')
  assert.equal(divisao.clinica, 60)
})

test('retorno_ciclo e registrou_no_laboratorio devolvem a custódia ao laboratório', () => {
  const divisao = dividirTempo([
    { acao: 'enviou_recepcao', data: '2026-03-05T12:00:00Z' },
    { acao: 'retorno_ciclo', data: '2026-03-10T12:00:00Z' },
    { acao: 'enviou_recepcao', data: '2026-03-12T12:00:00Z' },
    { acao: 'registrou_no_laboratorio', data: '2026-03-14T12:00:00Z' },
  ], '2026-03-01T12:00:00Z', '2026-03-20T12:00:00Z')
  assert.equal(divisao.comQuem, 'laboratorio')
  assert.equal(divisao.desde, '2026-03-14')
  assert.equal(divisao.clinica, 7)
  assert.equal(divisao.laboratorio, 12)
})

test('detectarRiscosOperacionais identifica consulta próxima sem peça, peça sem agenda e faltas repetidas', () => {
  const consultaSemPeca = detectarRiscosOperacionais({
    encerrado: false,
    pausado: false,
    hoje: '2026-11-15',
    tempo: { comQuem: 'laboratorio', desde: '2026-11-10' },
    consultas: {
      futuras: 1,
      faltas: 0,
      lista: [{ id: 'f1', data: '2026-11-16', hora: '10:00', status: 'agendado', situacao: 'futura' }],
    },
  })
  assert.deepEqual(consultaSemPeca.map((r) => r.tipo), ['consulta_sem_peca'])
  assert.equal(consultaSemPeca[0].nivel, 'critico')

  const pecaSemAgenda = detectarRiscosOperacionais({
    encerrado: false,
    pausado: false,
    hoje: '2026-11-15',
    tempo: { comQuem: 'clinica', desde: '2026-11-01' },
    consultas: { futuras: 0, faltas: 2, lista: [] },
  })
  assert.deepEqual(pecaSemAgenda.map((r) => r.tipo), ['peca_sem_agenda', 'faltas_recorrentes'])

  assert.deepEqual(
    detectarRiscosOperacionais({
      encerrado: false,
      pausado: true,
      hoje: '2026-11-15',
      tempo: { comQuem: 'clinica', desde: '2026-10-01' },
      consultas: { futuras: 0, faltas: 3, lista: [] },
    }),
    [],
  )
})
