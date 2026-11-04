function orderFixtures(origin) {
  const one = {
    id: 1, paciente: 'Ana Sintética', cliente: { nome: 'Clínica Exemplo' }, servico: 'Prótese total sintética', status: 'Em Produção', prioridade: 'Alta', valor: 500,
    etapaAtual: 'confeccao', tipoWorkflow: 'protese_total_removivel', dataEntrada: '2026-11-04T00:00:00Z', dataEntrega: '2026-11-12T00:00:00Z',
    localizacaoAtual: 'laboratorio', situacaoLogistica: 'no_laboratorio', dentistaResponsavel: null, finalidadeClinica: 'prova', agendamentoClinico: '2026-11-09T14:00:00Z',
    corDentes: 'A2', elementos: '11, 21', material: 'Resina de teste', observacoes: 'Observação sintética preservada', checklistEstetico: { dvo: true, moldeiraIndividual: true, corGengiva: 'Rosa teste' },
    arquivos: [origin + '/modelo.stl', origin + '/ficha.pdf'], fotosCaso: [origin + '/foto.svg'],
    mensagens: [{ id: 'm1', role: 'dentista', nome: 'Dentista sintético', texto: 'Mensagem exclusiva da OS 1', fotoUrl: origin + '/foto.svg', createdAt: '2026-11-04T12:00:00Z' }],
    historicoEtapas: [{ acao: 'criou', data: '2026-11-04T12:00:00Z' }, { acao: 'recebeu_laboratorio', data: '2026-11-05T12:00:00Z', responsavel: 'Equipe sintética', observacao: 'Retorno sintético' }],
    ficha: { status: 'Em Produção', etapaAtual: 'confeccao', passoFluxoAtual: 'montagem_dentes', dataEntrada: '2026-11-04T00:00:00Z', dataEntrega: '2026-11-12T00:00:00Z', dataFinalizacao: null, dataEntregaReal: null, prazoEtapaAtual: '2026-11-05T01:00:00Z', prazoFornecedor: '2026-11-06T15:00:00Z', movimentacaoLogisticaEm: '2026-11-05T12:00:00Z',
      cobrancas: [{ id: 11, valor: 500, valorRecebido: 150, status: 'Parcial', dataVencimento: '2026-12-01T00:00:00Z', dataRecebimento: '2026-11-04T00:00:00Z', canceladoEm: null }, { id: 12, valor: 700, valorRecebido: 0, status: 'Pendente', dataVencimento: '2026-12-15T00:00:00Z', dataRecebimento: null, canceladoEm: '2026-11-03T12:00:00Z' }] },
  }
  const two = { ...one, id: 2, paciente: 'Bia Sintética', valor: 0, status: 'Entregue', arquivos: [], fotosCaso: [], historicoEtapas: [], mensagens: [{ id: 'm2', role: 'dentista', nome: 'Dentista sintético', texto: 'Mensagem exclusiva da OS 2', createdAt: '2026-11-04T13:00:00Z' }], ficha: { ...one.ficha, status: 'Entregue', dataFinalizacao: '2026-11-10T00:00:00Z', dataEntregaReal: '2026-11-12T15:00:00Z', cobrancas: [] } }
  return { 1: one, 2: two }
}
module.exports = { orderFixtures }
