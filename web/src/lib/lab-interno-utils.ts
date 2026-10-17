// Indicadores do laboratório interno, isolados das telas e do banco para ficarem fáceis de testar.
import { diasEntre, paraIso, somarDias } from './labs-externos-utils'

export const JANELA_DESEMPENHO_DIAS = 90

export interface OrdemFinalizada {
  dataPedido: Date | string | null
  dataEntrega: Date | string | null
  dataFinalizacao: Date | string | null
  /** Quantidade de ciclos de prova registrados para a ordem. */
  ciclos: number
}

export interface DesempenhoLabInterno {
  finalizadas: number
  /** Percentual finalizado até a data de entrega combinada. */
  taxaNoPrazo: number | null
  /** Dias corridos entre o pedido e a finalização. */
  tempoMedio: number | null
  /** Quantas voltaram para mais de um ciclo de prova. */
  comMaisDeUmaProva: number
  taxaMaisDeUmaProva: number | null
}

export function resumirDesempenho(
  ordens: OrdemFinalizada[],
  hoje: string,
  janelaDias: number = JANELA_DESEMPENHO_DIAS,
): DesempenhoLabInterno {
  const inicio = somarDias(hoje, -janelaDias)
  const naJanela = ordens.filter((ordem) => {
    const fim = paraIso(ordem.dataFinalizacao)
    return fim !== null && fim >= inicio && fim <= hoje
  })

  const comPrazo = naJanela.filter((ordem) => paraIso(ordem.dataEntrega) !== null)
  const noPrazo = comPrazo.filter((ordem) => (diasEntre(ordem.dataEntrega, ordem.dataFinalizacao) ?? 1) <= 0)

  const tempos = naJanela
    .map((ordem) => diasEntre(ordem.dataPedido, ordem.dataFinalizacao))
    .filter((dias): dias is number => dias !== null && dias >= 0)
  const comMaisDeUmaProva = naJanela.filter((ordem) => ordem.ciclos > 1).length

  return {
    finalizadas: naJanela.length,
    taxaNoPrazo: comPrazo.length > 0 ? Math.round((noPrazo.length / comPrazo.length) * 100) : null,
    tempoMedio: tempos.length > 0 ? Math.round((tempos.reduce((s, d) => s + d, 0) / tempos.length) * 10) / 10 : null,
    comMaisDeUmaProva,
    taxaMaisDeUmaProva: naJanela.length > 0 ? Math.round((comMaisDeUmaProva / naJanela.length) * 100) : null,
  }
}

/** Conta ordens por etapa, mantendo a ordem do fluxo e incluindo etapas vazias. */
export function contarPorEtapa<T extends string>(etapas: readonly T[], ordens: readonly T[]): Record<T, number> {
  const contagem = Object.fromEntries(etapas.map((etapa) => [etapa, 0])) as Record<T, number>
  for (const etapa of ordens) if (etapa in contagem) contagem[etapa] += 1
  return contagem
}
