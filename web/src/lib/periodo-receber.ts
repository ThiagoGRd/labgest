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

/** Prisma retorna @db.Date à meia-noite UTC, independentemente do fuso do servidor. */
export function limitesMesReceber(ano: number, mes: number) {
  return {
    inicio: new Date(Date.UTC(ano, mes - 1, 1)),
    fimExclusivo: new Date(Date.UTC(ano, mes, 1)),
  }
}

export function mesDataFinanceira(data: Date): string {
  return data.toISOString().slice(0, 7)
}
