// Regras de negócio do módulo "Labs Externos", isoladas das telas e do banco
// para ficarem fáceis de ler e de testar.

export type SituacaoPedido = 'Enviado' | 'Provando' | 'Pronto' | 'Entregue'

export const SITUACOES: readonly SituacaoPedido[] = ['Enviado', 'Provando', 'Pronto', 'Entregue']

// Mesmo prazo adotado para o fornecedor externo no fluxo de prótese (packages/shared).
export const PRAZO_PADRAO_DIAS = 15

// Janela usada nos indicadores de desempenho do laboratório.
export const JANELA_ANALISE_DIAS = 90

// O laboratório opera em Alagoas (UTC-3); evita "virar o dia" cedo demais no servidor (UTC).
const FUSO_HORARIO = 'America/Maceio'
const MS_POR_DIA = 86_400_000

type DataEntrada = Date | string | null | undefined

export function isSituacao(valor: unknown): valor is SituacaoPedido {
  return typeof valor === 'string' && (SITUACOES as readonly string[]).includes(valor)
}

/** Data de hoje no formato AAAA-MM-DD, no fuso do laboratório. */
export function hojeIso(agora: Date = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: FUSO_HORARIO })
}

/** Converte Date ou texto em AAAA-MM-DD. Retorna null quando não há data válida. */
export function paraIso(data: DataEntrada): string | null {
  if (!data) return null
  if (typeof data === 'string') return /^\d{4}-\d{2}-\d{2}/.test(data) ? data.slice(0, 10) : null
  return Number.isNaN(data.getTime()) ? null : data.toISOString().slice(0, 10)
}

/** Quantidade de dias corridos entre duas datas (negativa se `fim` for anterior). */
export function diasEntre(inicio: DataEntrada, fim: DataEntrada): number | null {
  const a = paraIso(inicio)
  const b = paraIso(fim)
  if (!a || !b) return null
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_POR_DIA)
}

export function somarDias(dataIso: string, dias: number): string {
  const data = new Date(`${dataIso}T00:00:00Z`)
  data.setUTCDate(data.getUTCDate() + dias)
  return data.toISOString().slice(0, 10)
}

export function prazoSugerido(dataEnvio: string, dias: number = PRAZO_PADRAO_DIAS): string {
  return somarDias(dataEnvio, dias)
}

/**
 * A "data de retorno" é o dia em que a peça voltou pronta do laboratório.
 * Ela é registrada ao marcar o pedido como Pronto (ou Entregue, se o passo foi pulado)
 * e é limpa se o pedido voltar para uma etapa anterior.
 */
export function dataRetornoPara(
  situacao: SituacaoPedido,
  retornoAtual: string | null,
  hoje: string,
): string | null {
  return situacao === 'Pronto' || situacao === 'Entregue' ? (retornoAtual ?? hoje) : null
}

export interface PedidoParaResumo {
  situacao: SituacaoPedido
  dataEnvio: DataEntrada
  prazo: DataEntrada
  dataRetorno: DataEntrada
  isRetrabalho: boolean
  createdAt?: DataEntrada
}

export interface ResumoLaboratorio {
  /** Pedidos enviados dentro da janela de análise. */
  totalPedidos: number
  /** Situação atual (considera todos os pedidos do laboratório, não só a janela). */
  emAberto: number
  atrasados: number
  /** Indicadores da janela de análise. */
  retrabalhos: number
  taxaRetrabalho: number | null
  prazoCombinadoMedio: number | null
  retornoMedio: number | null
  taxaNoPrazo: number | null
  comRetorno: number
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null
  return Math.round((valores.reduce((soma, valor) => soma + valor, 0) / valores.length) * 10) / 10
}

export function resumirLaboratorio(
  pedidos: PedidoParaResumo[],
  hoje: string,
  janelaDias: number = JANELA_ANALISE_DIAS,
): ResumoLaboratorio {
  const abertos = pedidos.filter((pedido) => pedido.situacao !== 'Entregue')
  const atrasados = abertos.filter((pedido) => {
    const prazo = paraIso(pedido.prazo)
    return prazo !== null && prazo < hoje
  })

  const inicioJanela = somarDias(hoje, -janelaDias)
  const naJanela = pedidos.filter((pedido) => {
    const envio = paraIso(pedido.dataEnvio) ?? paraIso(pedido.createdAt)
    return envio !== null && envio >= inicioJanela
  })

  const retrabalhos = naJanela.filter((pedido) => pedido.isRetrabalho).length
  const prazosCombinados = naJanela
    .map((pedido) => diasEntre(pedido.dataEnvio, pedido.prazo))
    .filter((dias): dias is number => dias !== null && dias >= 0)
  const retornos = naJanela.filter((pedido) => paraIso(pedido.dataRetorno) !== null)
  const temposDeRetorno = retornos
    .map((pedido) => diasEntre(pedido.dataEnvio, pedido.dataRetorno))
    .filter((dias): dias is number => dias !== null && dias >= 0)
  const comPrazoERetorno = retornos.filter((pedido) => paraIso(pedido.prazo) !== null)
  const noPrazo = comPrazoERetorno.filter((pedido) => (diasEntre(pedido.prazo, pedido.dataRetorno) ?? 0) <= 0)

  return {
    totalPedidos: naJanela.length,
    emAberto: abertos.length,
    atrasados: atrasados.length,
    retrabalhos,
    taxaRetrabalho: naJanela.length > 0 ? Math.round((retrabalhos / naJanela.length) * 100) : null,
    prazoCombinadoMedio: media(prazosCombinados),
    retornoMedio: media(temposDeRetorno),
    taxaNoPrazo: comPrazoERetorno.length > 0 ? Math.round((noPrazo.length / comPrazoERetorno.length) * 100) : null,
    comRetorno: retornos.length,
  }
}
