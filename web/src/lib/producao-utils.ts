import { getPassoProtese, isTipoProtese } from '@/lib/workflow-config'
import { diasEntre, hojeIso, paraIso, somarDias } from '@/lib/labs-externos-utils'
import type { FilaProducao, OrdemProducao } from '@/components/producao/types'

export const PRAZO_RETORNO_LAB_DIAS = 10

const PESO_PRIORIDADE: Record<string, number> = {
  Urgente: 0,
  Alta: 1,
  Normal: 2,
  Baixa: 3,
}

export function timestampValido(valor?: string | null) {
  if (!valor) return null
  const data = new Date(valor)
  const timestamp = data.getTime()
  const anoMaximo = new Date().getFullYear() + 5
  return Number.isFinite(timestamp) && data.getFullYear() >= 2020 && data.getFullYear() <= anoMaximo
    ? timestamp
    : null
}

export function diasRestantes(valor?: string | null, prazoSuspenso = false) {
  if (prazoSuspenso) return null
  const timestamp = timestampValido(valor)
  if (timestamp === null) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const entrega = new Date(timestamp)
  entrega.setHours(0, 0, 0, 0)
  return Math.ceil((entrega.getTime() - hoje.getTime()) / 86_400_000)
}

export function extrairUltimoRetornoLabIso(historico: unknown): string | null {
  if (!Array.isArray(historico)) return null
  const acoesRetorno = new Set(['retorno_ciclo', 'recebeu_laboratorio', 'registrou_no_laboratorio'])
  for (let i = historico.length - 1; i >= 0; i--) {
    const item = historico[i]
    if (!item || typeof item !== 'object') continue
    const acao = (item as { acao?: unknown }).acao
    const data = (item as { data?: unknown }).data
    if (typeof acao === 'string' && acoesRetorno.has(acao) && typeof data === 'string') {
      const iso = paraIso(data)
      if (iso) return iso
    }
  }
  return null
}

export function filaDaOrdem(ordem: OrdemProducao): FilaProducao {
  if (!ordem.passoFluxoAtual) return 'sem_etapa'
  if (ordem.cicloStatus === 'em_prova') return 'clinica'
  if (isTipoProtese(ordem.tipoWorkflow)) {
    const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    if (
      passo.responsavel === 'clinica'
      && passo.macroetapa === 'recebimento'
      && ordem.status !== 'Em Prova'
      && (!ordem.localizacaoAtual || ordem.localizacaoAtual === 'laboratorio')
    ) {
      return 'laboratorio'
    }
    return passo.responsavel === 'laboratorio' ? 'laboratorio' : passo.responsavel
  }
  return 'laboratorio'
}

export function dataBaseRetornoLabIso(ordem: OrdemProducao): string | null {
  if (ordem.retornouAoLabEm) {
    const iso = paraIso(ordem.retornouAoLabEm)
    if (iso) return iso
  }
  if ((ordem.cicloNumero ?? 0) > 1 && ordem.dataEntradaCiclo) {
    const iso = paraIso(ordem.dataEntradaCiclo)
    if (iso) return iso
  }
  const entregaIso = paraIso(ordem.entrega)
  const movIso = paraIso(ordem.movimentacaoLogisticaEm)
  if (
    ordem.localizacaoAtual === 'laboratorio'
    && movIso
    && entregaIso
    && movIso >= entregaIso
  ) {
    return movIso
  }
  return null
}

export function prazoOperacional(ordem: OrdemProducao) {
  if (filaDaOrdem(ordem) === 'fornecedor') return ordem.prazoFornecedor
  const baseRetorno = dataBaseRetornoLabIso(ordem)
  if (baseRetorno && filaDaOrdem(ordem) === 'laboratorio') {
    const prazo10Dias = somarDias(baseRetorno, PRAZO_RETORNO_LAB_DIAS)
    const comprometidoIso = paraIso(ordem.cicloComprometido)
    if (comprometidoIso && comprometidoIso > prazo10Dias) return ordem.cicloComprometido
    return `${prazo10Dias}T23:59:59.000Z`
  }
  return ordem.prazoEtapaAtual || ordem.cicloComprometido || ordem.entrega
}

export interface RelogiosOrdemProducao {
  /** Data limite do ciclo atual (10 dias após retorno ao lab, ou prazo da etapa/entrega). */
  prazoCicloIso: string | null
  /** Dias restantes no ciclo atual de 10 dias (negativo se o próprio ciclo de 10 dias também venceu). */
  diasRestantesCiclo: number | null
  /** Quantos dias a OS original já está vencida no total (para dar prioridade máxima). 0 se no prazo. */
  diasVencidosTotal: number
  /** Data original combinada da OS (AAAA-MM-DD). */
  entregaOriginalIso: string | null
  /** Indica se a peça ganhou um novo prazo de 10 dias por ter retornado ao laboratório. */
  renovadoPorRetorno: boolean
  /** Data (AAAA-MM-DD) em que a peça retornou por último ao laboratório. */
  retornouAoLabEmIso: string | null
}

export function calcularRelogiosOrdem(ordem: OrdemProducao, hoje = hojeIso()): RelogiosOrdemProducao {
  const pausada = ordem.status === 'Pausado'
  const entregaOriginalIso = paraIso(ordem.entrega)
  const retornouAoLabEmIso = dataBaseRetornoLabIso(ordem)
  const renovadoPorRetorno = Boolean(retornouAoLabEmIso && filaDaOrdem(ordem) === 'laboratorio')

  const valorOperacional = prazoOperacional(ordem)
  const instanteOp = timestampValido(valorOperacional)
  const prazoCicloIso = !valorOperacional || instanteOp === null
    ? null
    : valorOperacional === ordem.entrega
      ? paraIso(valorOperacional)
      : hojeIso(new Date(instanteOp))

  const diasRestantesCiclo = pausada || !prazoCicloIso
    ? null
    : diasEntre(hoje, prazoCicloIso)

  const atrasoBruto = !pausada && entregaOriginalIso && entregaOriginalIso < hoje
    ? diasEntre(entregaOriginalIso, hoje) ?? 0
    : 0

  return {
    prazoCicloIso,
    diasRestantesCiclo,
    diasVencidosTotal: Math.max(0, atrasoBruto),
    entregaOriginalIso,
    renovadoPorRetorno,
    retornouAoLabEmIso,
  }
}

export function ordenarOrdensOperacionais(ordens: OrdemProducao[], hoje = hojeIso()) {
  return [...ordens].sort((a, b) => {
    const retornoA = a.cicloDentistaDeci ? 0 : 1
    const retornoB = b.cicloDentistaDeci ? 0 : 1
    if (retornoA !== retornoB) return retornoA - retornoB

    const relA = calcularRelogiosOrdem(a, hoje)
    const relB = calcularRelogiosOrdem(b, hoje)

    const cicloVencidoA = relA.diasRestantesCiclo !== null && relA.diasRestantesCiclo < 0 ? 0 : 1
    const cicloVencidoB = relB.diasRestantesCiclo !== null && relB.diasRestantesCiclo < 0 ? 0 : 1
    if (cicloVencidoA !== cicloVencidoB) return cicloVencidoA - cicloVencidoB

    const totalVencidoA = relA.diasVencidosTotal > 0 ? 0 : 1
    const totalVencidoB = relB.diasVencidosTotal > 0 ? 0 : 1
    if (totalVencidoA !== totalVencidoB) return totalVencidoA - totalVencidoB

    // Entre peças vencidas há muito tempo, quem está vencida há mais dias ganha prioridade máxima.
    if (relA.diasVencidosTotal !== relB.diasVencidosTotal) {
      return relB.diasVencidosTotal - relA.diasVencidosTotal
    }

    const prioridade = (PESO_PRIORIDADE[a.prioridade] ?? 2) - (PESO_PRIORIDADE[b.prioridade] ?? 2)
    if (prioridade !== 0) return prioridade

    return (timestampValido(prazoOperacional(a)) ?? Number.MAX_SAFE_INTEGER)
      - (timestampValido(prazoOperacional(b)) ?? Number.MAX_SAFE_INTEGER)
  })
}

