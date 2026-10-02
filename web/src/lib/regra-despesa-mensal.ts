export interface DespesaParaResumo {
  valor: number | string | { toString(): string }
  valorPago: number | string | { toString(): string }
  status?: string | null
  canceladoEm?: Date | string | null
}

/**
 * Regra única da competência mensal de despesas:
 * - o período é definido pelo vencimento financeiro na consulta;
 * - contas canceladas não compõem os valores;
 * - previsto é o valor integral da conta;
 * - pago e saldo são demonstrados separadamente da saída de caixa.
 */
export function resumirDespesasMensais(despesas: DespesaParaResumo[]) {
  return despesas.reduce((resumo, despesa) => {
    if (despesa.status === 'Cancelado' || despesa.canceladoEm) return resumo

    const valor = Number(despesa.valor)
    const pago = Math.min(valor, Math.max(0, Number(despesa.valorPago)))
    resumo.quantidade += 1
    resumo.valorPrevisto += valor
    resumo.valorPago += pago
    resumo.saldo += Math.max(0, valor - pago)
    return resumo
  }, {
    quantidade: 0,
    valorPrevisto: 0,
    valorPago: 0,
    saldo: 0,
  })
}
