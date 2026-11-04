export interface ContaComPeriodo {
  dataVencimento: Date
  dataCompetencia: Date | null
}

export function contasNoPeriodo<T extends ContaComPeriodo>(
  contas: T[], inicio: Date, fimExclusivo: Date, criterio: 'vencimento' | 'competencia',
): T[] {
  return contas.filter((conta) => {
    // Sem competência registrada, a conta aparece somente pelo vencimento.
    const data = criterio === 'competencia'
      ? conta.dataCompetencia
      : conta.dataVencimento
    return data !== null && data >= inicio && data < fimExclusivo
  })
}

export function filtroReceberPeriodo(inicio: Date, fimExclusivo: Date) {
  const intervalo = { gte: inicio, lt: fimExclusivo }
  return { OR: [{ dataVencimento: intervalo }, { dataCompetencia: intervalo }] }
}
