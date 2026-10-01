interface DadosExclusaoOrdem {
  status: string | null
  historicoEtapas: unknown
  dataFinalizacao: Date | null
  dataEntregaReal: Date | null
  estoqueBaixadoEm: Date | null
  cobrancaGeradaEm: Date | null
  totalCiclos: number
  totalContasReceber: number
  totalMovimentacoesEstoque: number
}

export function validarExclusaoOrdem(ordem: DadosExclusaoOrdem) {
  if (ordem.status !== 'Aguardando') {
    return { permitida: false, erro: 'Somente ordens aguardando o início da produção podem ser excluídas.' }
  }

  const historico = Array.isArray(ordem.historicoEtapas) ? ordem.historicoEtapas : []
  const possuiMovimentacaoNoHistorico = historico.some((evento) => {
    if (!evento || typeof evento !== 'object' || Array.isArray(evento)) return true
    return (evento as { acao?: unknown }).acao !== 'criou'
  })
  const possuiEfeitoOperacional = Boolean(
    ordem.dataFinalizacao
    || ordem.dataEntregaReal
    || ordem.estoqueBaixadoEm
    || ordem.cobrancaGeradaEm
    || ordem.totalCiclos
    || ordem.totalContasReceber
    || ordem.totalMovimentacoesEstoque,
  )

  if (possuiMovimentacaoNoHistorico || possuiEfeitoOperacional) {
    return {
      permitida: false,
      erro: 'Esta ordem já possui movimentações. Cancele-a para preservar o histórico financeiro e operacional.',
    }
  }

  return { permitida: true }
}
