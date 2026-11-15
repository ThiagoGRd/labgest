import { prisma, type Prisma } from '@labgest/database'
import {
  calcularPrazoPasso,
  getFluxoProtese,
  getPassoProtese,
  inferirEtapaClinicorp,
  inferirTipoProtese,
  isTipoProtese,
  normalizarNome,
  statusParaPassoProtese,
  type ConsultaClinica,
  type ResultadoInferenciaClinicorp,
  type StatusConsulta,
  type TipoProteseId,
} from '@labgest/shared'
import { garantirEfeitosFinalizacao } from '@/lib/finalizacao-ordem'
import { hojeIso } from '@/lib/labs-externos-utils'
import type { ItemCasoOrdem } from '@/components/producao/types'

export function extrairItensCaso(checklistEstetico: unknown): ItemCasoOrdem[] {
  if (!checklistEstetico || typeof checklistEstetico !== 'object' || Array.isArray(checklistEstetico)) {
    return []
  }
  const bruto = (checklistEstetico as Record<string, unknown>).itensCaso
  if (!Array.isArray(bruto)) return []

  return bruto
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item)))
    .map((item) => ({
      servicoId: typeof item.servicoId === 'number' ? item.servicoId : null,
      servicoNome: typeof item.servicoNome === 'string' ? item.servicoNome : 'Serviço',
      arcada: typeof item.arcada === 'string' ? item.arcada : null,
      elementos: typeof item.elementos === 'string' ? item.elementos : null,
      corDentes: typeof item.corDentes === 'string' ? item.corDentes : null,
      material: typeof item.material === 'string' ? item.material : null,
      tipoProtese: typeof item.tipoProtese === 'string' ? item.tipoProtese : null,
      valor: typeof item.valor === 'number' ? item.valor : null,
      origemOrdemId: typeof item.origemOrdemId === 'number' ? item.origemOrdemId : null,
    }))
}

export interface EntradaInferenciaOrdem {
  id: number
  nomePaciente: string
  servicoNome: string
  tipoWorkflow: string | null
  passoFluxoAtual: string | null
  dataPedido: string | Date | null
  localizacaoAtual?: string | null
}

const isoDia = (valor: string | Date | null | undefined, fallback: string) => {
  if (!valor) return fallback
  if (typeof valor === 'string') return valor.slice(0, 10)
  return valor.toISOString().slice(0, 10)
}

export async function carregarInferenciasClinicorpParaOrdens(
  ordens: EntradaInferenciaOrdem[],
  hoje = hojeIso(),
): Promise<Map<number, ResultadoInferenciaClinicorp>> {
  const resultado = new Map<number, ResultadoInferenciaClinicorp>()
  if (ordens.length === 0) return resultado

  const ids = ordens.map((o) => o.id)
  const vinculos = await prisma.tratamentoVinculo.findMany({
    where: { ordemId: { in: ids } },
    select: { ordemId: true, pacienteChave: true },
  })
  const vinculoPorOrdem = new Map(vinculos.map((v) => [v.ordemId, v.pacienteChave]))
  const chaveDe = (o: EntradaInferenciaOrdem) => vinculoPorOrdem.get(o.id) ?? normalizarNome(o.nomePaciente)
  const chaves = [...new Set(ordens.map(chaveDe).filter(Boolean))]

  const consultas = chaves.length > 0
    ? await prisma.clinicorpConsulta.findMany({
        where: { pacienteChave: { in: chaves } },
        orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }],
      })
    : []

  const consultasPorChave = new Map<string, ConsultaClinica[]>()
  for (const c of consultas) {
    const lista = consultasPorChave.get(c.pacienteChave) ?? []
    lista.push({
      id: c.clinicorpId,
      data: c.data.toISOString().slice(0, 10),
      hora: c.horaInicio,
      status: c.status as StatusConsulta,
      dentista: c.dentistaNome ?? (c.dentistaId ? `Profissional ${c.dentistaId}` : null),
      categoria: c.categoria,
      observacoes: c.observacoes,
      contaManual: c.contaManual,
    })
    consultasPorChave.set(c.pacienteChave, lista)
  }

  for (const ordem of ordens) {
    const tipo: TipoProteseId | null = isTipoProtese(ordem.tipoWorkflow)
      ? ordem.tipoWorkflow
      : inferirTipoProtese(ordem.servicoNome || '', ordem.tipoWorkflow)
    if (!tipo) continue

    const inferencia = inferirEtapaClinicorp({
      tipoWorkflow: tipo,
      passoFluxoAtual: ordem.passoFluxoAtual,
      dataPedido: isoDia(ordem.dataPedido, hoje),
      hoje,
      consultas: consultasPorChave.get(chaveDe(ordem)) ?? [],
      localizacaoAtual: ordem.localizacaoAtual,
    })
    resultado.set(ordem.id, inferencia)
  }

  return resultado
}

export async function aplicarPassoInferidoNaOrdem(
  tx: Prisma.TransactionClient,
  ordemId: number,
  inferencia: ResultadoInferenciaClinicorp,
  por = 'clinicorp-sync',
) {
  if (!inferencia.passoSugeridoId) return false
  const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
  if (!ordem || ['Finalizado', 'Entregue', 'Cancelado', 'Pausado'].includes(ordem.status || '')) {
    return false
  }

  const tipo: TipoProteseId | null = isTipoProtese(ordem.tipoWorkflow)
    ? ordem.tipoWorkflow
    : inferirTipoProtese(ordem.servicoNome || '', ordem.tipoWorkflow)
  if (!tipo) return false

  const fluxo = getFluxoProtese(tipo)
  const passo = fluxo.passos.find((p) => p.id === inferencia.passoSugeridoId) ?? getPassoProtese(tipo, inferencia.passoSugeridoId)
  if (!passo || ordem.passoFluxoAtual === passo.id) return false

  const agora = new Date()
  const statusCalculado = statusParaPassoProtese(passo)
  const vaiParaClinica = passo.responsavel === 'clinica'
  const progresso = Math.round((fluxo.passos.indexOf(passo) / Math.max(1, fluxo.passos.length - 1)) * 100)
  const historicoAtual = Array.isArray(ordem.historicoEtapas) ? (ordem.historicoEtapas as Prisma.JsonObject[]) : []

  await tx.ordem.update({
    where: { id: ordemId },
    data: {
      tipoWorkflow: tipo,
      passoFluxoAtual: passo.id,
      etapaAtual: passo.macroetapa,
      subetapaAtual: passo.nome,
      status: statusCalculado,
      progresso,
      prazoEtapaAtual: calcularPrazoPasso(agora, passo, ordem.arcadas),
      dataFinalizacao: statusCalculado === 'Finalizado' ? agora : null,
      ...(vaiParaClinica ? {
        localizacaoAtual: 'em_transito_recepcao',
        situacaoLogistica: 'aguardando_recepcao',
        finalidadeClinica: passo.entregaFinal ? 'entrega' : passo.prova ? 'prova' : 'instalacao',
        movimentacaoLogisticaEm: agora,
      } : {
        localizacaoAtual: passo.responsavel === 'laboratorio' ? 'laboratorio' : ordem.localizacaoAtual,
        situacaoLogistica: passo.responsavel === 'laboratorio' ? 'no_laboratorio' : ordem.situacaoLogistica,
      }),
      historicoEtapas: [
        ...historicoAtual,
        {
          acao: 'sincronizou_etapa_clinicorp',
          de: ordem.subetapaAtual || ordem.passoFluxoAtual || null,
          para: passo.nome,
          motivo: inferencia.motivo,
          data: agora.toISOString(),
          por,
        },
      ] as Prisma.JsonArray,
    },
  })

  if (statusCalculado === 'Finalizado') {
    await garantirEfeitosFinalizacao(tx, ordemId, agora)
  }

  return true
}

/**
 * Avança automaticamente ordens ativas cujo histórico de consultas no Clinicorp
 * traz confirmação clara (confiança alta) de uma etapa mais adiantada do que a atual.
 */
export async function aplicarInferenciasClinicorpAutomaticas(por = 'clinicorp-sync'): Promise<number> {
  const hoje = hojeIso()
  const ordens = await prisma.ordem.findMany({
    where: { status: { notIn: ['Finalizado', 'Entregue', 'Cancelado', 'Pausado'] } },
    select: {
      id: true,
      nomePaciente: true,
      servicoNome: true,
      tipoWorkflow: true,
      passoFluxoAtual: true,
      dataPedido: true,
      localizacaoAtual: true,
    },
  })

  const inferencias = await carregarInferenciasClinicorpParaOrdens(ordens, hoje)
  let atualizadas = 0

  for (const ordem of ordens) {
    const inf = inferencias.get(ordem.id)
    if (!inf || inf.confianca !== 'alta' || !inf.divergente || !inf.passoSugeridoId) continue

    const aplicou = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${ordem.id} FOR UPDATE`
      return aplicarPassoInferidoNaOrdem(tx, ordem.id, inf, por)
    })
    if (aplicou) atualizadas += 1
  }

  return atualizadas
}
