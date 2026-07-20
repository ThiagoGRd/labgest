import { getPassoProtese, isTipoProtese } from '@/lib/workflow-config'
import type { FilaProducao, OrdemProducao } from '@/components/producao/types'

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

export function filaDaOrdem(ordem: OrdemProducao): FilaProducao {
  if (!ordem.passoFluxoAtual) return 'sem_etapa'
  if (ordem.cicloStatus === 'em_prova') return 'clinica'
  if (isTipoProtese(ordem.tipoWorkflow)) {
    const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    return passo.responsavel === 'laboratorio' ? 'laboratorio' : passo.responsavel
  }
  return 'laboratorio'
}

export function prazoOperacional(ordem: OrdemProducao) {
  if (filaDaOrdem(ordem) === 'fornecedor') return ordem.prazoFornecedor
  return ordem.prazoEtapaAtual || ordem.cicloComprometido || ordem.entrega
}

export function ordenarOrdensOperacionais(ordens: OrdemProducao[]) {
  return [...ordens].sort((a, b) => {
    const retornoA = a.cicloDentistaDeci ? 0 : 1
    const retornoB = b.cicloDentistaDeci ? 0 : 1
    if (retornoA !== retornoB) return retornoA - retornoB

    const pausadaA = a.status === 'Pausado'
    const pausadaB = b.status === 'Pausado'
    const diasA = diasRestantes(prazoOperacional(a), pausadaA)
    const diasB = diasRestantes(prazoOperacional(b), pausadaB)
    const atrasadaA = diasA !== null && diasA < 0 ? 0 : 1
    const atrasadaB = diasB !== null && diasB < 0 ? 0 : 1
    if (atrasadaA !== atrasadaB) return atrasadaA - atrasadaB

    const prioridade = (PESO_PRIORIDADE[a.prioridade] ?? 2) - (PESO_PRIORIDADE[b.prioridade] ?? 2)
    if (prioridade !== 0) return prioridade

    return (timestampValido(prazoOperacional(a)) ?? Number.MAX_SAFE_INTEGER)
      - (timestampValido(prazoOperacional(b)) ?? Number.MAX_SAFE_INTEGER)
  })
}
