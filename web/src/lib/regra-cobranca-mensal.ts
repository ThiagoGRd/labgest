export interface CobrancaParaResumo {
  valor: number | string | { toString(): string }
  valorRecebido: number | string | { toString(): string }
  status?: string | null
  canceladoEm?: Date | string | null
}

/**
 * Regra única da competência de cobrança mensal:
 * - o período é definido pelo vencimento financeiro na consulta;
 * - cobranças canceladas não compõem os valores;
 * - previsto é o valor integral, mesmo quando já houve recebimento;
 * - recebido e saldo são demonstrados separadamente.
 */
export function resumirCobrancasMensais(cobrancas: CobrancaParaResumo[]) {
  return cobrancas.reduce((resumo, cobranca) => {
    if (cobranca.status === 'Cancelado' || cobranca.canceladoEm) return resumo

    const valor = Number(cobranca.valor)
    const recebido = Math.min(valor, Math.max(0, Number(cobranca.valorRecebido)))
    resumo.quantidade += 1
    resumo.valorPrevisto += valor
    resumo.valorRecebido += recebido
    resumo.saldo += Math.max(0, valor - recebido)
    return resumo
  }, {
    quantidade: 0,
    valorPrevisto: 0,
    valorRecebido: 0,
    saldo: 0,
  })
}
