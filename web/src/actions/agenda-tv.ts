'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { getProducao } from '@/actions/producao'
import { concluirEtapaLaboratorial } from '@/actions/workflow-protese'
import { carregarInferenciasClinicorpParaOrdens } from '@/lib/clinicorp-etapas'
import { hojeIso, somarDias } from '@/lib/labs-externos-utils'
import { calcularRelogiosOrdem, filaDaOrdem } from '@/lib/producao-utils'
import type { OrdemProducao } from '@/components/producao/types'
import {
  TIPO_AGENDA_BANCADA,
  agoraMaceioInfo,
  calcularRiscoClinicorp,
  formatarConsultaClinicorpCurta,
  normalizarProteticoId,
  paraMinutos,
  parseBlocoNotificacao,
  somarMinutosHora,
  type BlocoAgendaTv,
  type BlocoTvEnriquecido,
  type ModoBlocoTv,
  type OrigemAgendamentoTv,
  type PayloadBlocoAgendaTv,
  type StatusBlocoTv,
} from '@/lib/agenda-tv'
import {
  aprenderTemposProteticos,
  calcularDuracaoRealExecucao,
  gerarPlanoAgendaAutomatico,
  recalibrarAgendaPorExecucao,
  type PerfilTempoProtetico,
  type PlanoAgendaAutomaticoResultado,
} from '@/lib/agenda-ia'
import {
  refinarEstrategiaComGemini,
  type EstrategiaIaResultado,
} from '@/lib/agenda-ia-gemini'

const TIPO_AGENDA_IA_LOG = 'agenda_ia_log'

export interface PainelTvSnapshot {
  dataReferencia: string
  dataHoje: string
  atualizadoEm: string
  blocos: BlocoTvEnriquecido[]
  ordensNoLab: OrdemProducao[]
  ultimaSincronizacaoClinicorp: string | null
  perfisTempo: PerfilTempoProtetico[]
  briefingIa: string | null
}

function revalidarPainelTv() {
  revalidatePath('/tv')
  revalidatePath('/lab-interno')
  revalidatePath('/prioridades')
}

function construirTituloBloco(payload: Pick<PayloadBlocoAgendaTv, 'protetico' | 'data' | 'horaInicio' | 'horaFim' | 'ordemId' | 'paciente'>) {
  const nome = payload.protetico === 'otavio' ? 'Tavá' : 'Napoleão'
  const ref = payload.ordemId ? `OS #${payload.ordemId}` : payload.paciente
  return `${nome} | ${payload.data} | ${payload.horaInicio}-${payload.horaFim} | ${ref}`.slice(0, 255)
}

function arcadaLabelDaOrdem(ordem: OrdemProducao): string | null {
  if (ordem.itensCaso && ordem.itensCaso.length > 0) {
    const arcadas = [...new Set(ordem.itensCaso.map((i) => i.arcada).filter(Boolean))]
    if (arcadas.length > 0) return arcadas.join(' + ')
  }
  if ((ordem.arcadas ?? 1) >= 2) return 'Sup + Inf (2 arcadas)'
  return null
}

function parseJsonSeguro<T>(bruto?: string | null): T | null {
  if (!bruto) return null
  try {
    return JSON.parse(bruto) as T
  } catch {
    return null
  }
}

export async function carregarBlocosAgendaPorData(dataIso: string): Promise<BlocoAgendaTv[]> {
  if (typeof prisma.notificacao?.findMany !== 'function') return []

  const inicio = new Date(`${somarDias(dataIso, -1)}T00:00:00Z`)
  const fim = new Date(`${somarDias(dataIso, 2)}T00:00:00Z`)

  const registros = await prisma.notificacao.findMany({
    where: {
      tipo: TIPO_AGENDA_BANCADA,
      data: { gte: inicio, lt: fim },
    },
    orderBy: [{ data: 'asc' }, { id: 'asc' }],
    take: 200,
  })

  const blocos: BlocoAgendaTv[] = []
  for (const reg of registros) {
    const parsed = parseBlocoNotificacao(reg)
    if (parsed && parsed.data === dataIso) {
      blocos.push(parsed)
    }
  }
  return blocos
}

export async function carregarHistoricoConcluidosTv(dias = 60): Promise<BlocoAgendaTv[]> {
  if (typeof prisma.notificacao?.findMany !== 'function') return []

  const hoje = hojeIso()
  const inicio = new Date(`${somarDias(hoje, -dias)}T00:00:00Z`)

  const registros = await prisma.notificacao.findMany({
    where: {
      tipo: TIPO_AGENDA_BANCADA,
      data: { gte: inicio },
    },
    orderBy: [{ data: 'asc' }, { id: 'asc' }],
    take: 400,
  })

  const concluidos: BlocoAgendaTv[] = []
  for (const reg of registros) {
    const parsed = parseBlocoNotificacao(reg)
    if (parsed && parsed.status === 'concluido') {
      concluidos.push(parsed)
    }
  }
  return concluidos
}

async function carregarUltimoBriefingIa(dataIso: string): Promise<string | null> {
  if (typeof prisma.notificacao?.findFirst !== 'function') return null
  const registro = await prisma.notificacao.findFirst({
    where: {
      tipo: TIPO_AGENDA_IA_LOG,
      titulo: { startsWith: dataIso },
    },
    orderBy: { id: 'desc' },
    select: { mensagem: true },
  })
  const parsed = parseJsonSeguro<{ briefingTurno?: string }>(registro?.mensagem)
  return parsed?.briefingTurno ?? null
}

async function salvarBriefingIa(dataIso: string, estrategia: EstrategiaIaResultado) {
  if (typeof prisma.notificacao?.create !== 'function') return
  await prisma.notificacao.create({
    data: {
      tipo: TIPO_AGENDA_IA_LOG,
      titulo: `${dataIso} | Briefing IA (${estrategia.motor})`.slice(0, 255),
      mensagem: JSON.stringify({
        motor: estrategia.motor,
        briefingTurno: estrategia.briefingTurno,
        alertasIa: estrategia.alertasIa,
        atualizadoEm: new Date().toISOString(),
      }),
      data: new Date(`${dataIso}T12:00:00Z`),
      lida: true,
    },
  })
}

async function carregarContextoOrdensNoLab(hoje: string) {
  const [ordensBase, ultimaSync] = await Promise.all([
    getProducao(),
    typeof prisma.clinicorpSincronizacao?.findFirst === 'function'
      ? prisma.clinicorpSincronizacao.findFirst({
          where: { concluidaEm: { not: null } },
          orderBy: { id: 'desc' },
          select: { concluidaEm: true },
        })
      : Promise.resolve(null),
  ])

  const inferencias = await carregarInferenciasClinicorpParaOrdens(
    ordensBase.map((o) => ({
      id: o.id,
      nomePaciente: o.paciente,
      servicoNome: o.servico,
      tipoWorkflow: o.tipoWorkflow ?? null,
      passoFluxoAtual: o.passoFluxoAtual ?? null,
      dataPedido: o.dataPedido ?? o.entrega,
      localizacaoAtual: o.localizacaoAtual ?? null,
    })),
    hoje,
  )

  const ordensEnriquecidas: OrdemProducao[] = ordensBase.map((o) => ({
    ...o,
    clinicorpEtapa: inferencias.get(o.id) ?? null,
  }))

  const ordensNoLab = ordensEnriquecidas.filter(
    (o) => o.status !== 'Pausado' && ['laboratorio', 'sem_etapa'].includes(filaDaOrdem(o)),
  )

  return {
    ordensEnriquecidas,
    ordensNoLab,
    ultimaSincronizacaoClinicorp: ultimaSync?.concluidaEm?.toISOString() ?? null,
  }
}

export async function getPainelTvData(dataIsoParam?: string): Promise<PainelTvSnapshot> {
  await requireUser()

  const hoje = hojeIso()
  const dataReferencia = /^\d{4}-\d{2}-\d{2}$/.test(dataIsoParam || '') ? (dataIsoParam as string) : hoje

  const [contexto, blocosBrutos, historicoConcluidos, briefingIa] = await Promise.all([
    carregarContextoOrdensNoLab(hoje),
    carregarBlocosAgendaPorData(dataReferencia),
    carregarHistoricoConcluidosTv(60),
    carregarUltimoBriefingIa(dataReferencia),
  ])

  const mapaOrdens = new Map(contexto.ordensEnriquecidas.map((o) => [o.id, o]))

  const blocos: BlocoTvEnriquecido[] = blocosBrutos.map((bloco) => {
    const ordem = bloco.ordemId ? mapaOrdens.get(bloco.ordemId) : undefined
    const proxima = ordem?.clinicorpEtapa?.proximaConsulta ?? null
    const relogios = ordem ? calcularRelogiosOrdem(ordem, hoje) : null
    return {
      ...bloco,
      paciente: ordem?.paciente ?? bloco.paciente,
      servico: ordem?.servico ?? bloco.servico,
      corDentes: ordem?.cor ?? bloco.corDentes ?? null,
      dentista: ordem?.dentista ?? bloco.dentista ?? null,
      arcada: (ordem ? arcadaLabelDaOrdem(ordem) : null) ?? bloco.arcada ?? null,
      clinicorpConsultaLabel: formatarConsultaClinicorpCurta(proxima, hoje),
      riscoClinicorp: calcularRiscoClinicorp(bloco, proxima),
      prioridadeOrdem: ordem?.prioridade ?? null,
      diasVencidosTotal: relogios?.diasVencidosTotal ?? 0,
      cicloObs: ordem?.cicloObs ?? null,
      cicloDentistaDeci: ordem?.cicloDentistaDeci ?? null,
    }
  })

  const perfisTempo = aprenderTemposProteticos(historicoConcluidos)

  return {
    dataReferencia,
    dataHoje: hoje,
    atualizadoEm: agoraMaceioInfo().relogioCompleto,
    blocos,
    ordensNoLab: contexto.ordensNoLab,
    ultimaSincronizacaoClinicorp: contexto.ultimaSincronizacaoClinicorp,
    perfisTempo,
    briefingIa,
  }
}

export interface CriarBlocoTvItemInput {
  horaInicio: string
  horaFim: string
  etapaNome: string
  modo: ModoBlocoTv
  equipamento?: string | null
  observacao?: string | null
  duracaoPlanejadaMin?: number | null
  origemAgendamento?: OrigemAgendamentoTv | null
  motivoIa?: string | null
  ajusteTempoNota?: string | null
  grupoSequenciaId?: string | null
}

export async function criarBlocosBancadaTv(input: {
  ordemId: number | null
  protetico: string
  data: string
  blocos: CriarBlocoTvItemInput[]
  pacienteAvulso?: string
  servicoAvulso?: string
  corDentes?: string | null
  arcada?: string | null
}) {
  await requireUser()

  const protetico = normalizarProteticoId(input.protetico)
  if (!protetico) {
    return { success: false, error: 'Selecione Tavá ou Napoleão.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) {
    return { success: false, error: 'Data inválida para o agendamento.' }
  }
  if (!Array.isArray(input.blocos) || input.blocos.length === 0) {
    return { success: false, error: 'Adicione pelo menos um bloco de horário.' }
  }

  let paciente = (input.pacienteAvulso || '').trim() || 'Trabalho na bancada'
  let servico = (input.servicoAvulso || '').trim() || 'Serviço laboratorial'
  let corDentes = input.corDentes ?? null
  let dentista: string | null = null
  let arcada = input.arcada ?? null
  let arcadasQtd = 1

  if (input.ordemId) {
    const ordem = await prisma.ordem.findUnique({
      where: { id: input.ordemId },
      include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } },
    })
    if (!ordem) {
      return { success: false, error: 'Ordem de serviço não encontrada.' }
    }
    paciente = ordem.nomePaciente
    servico = ordem.servicoNome || ordem.servico?.nome || servico
    corDentes = ordem.corDentes || corDentes
    dentista = ordem.clienteNome || ordem.cliente?.nome || null
    arcadasQtd = Math.max(1, Math.min(2, ordem.arcadas ?? 1))
    arcada = arcada || (arcadasQtd >= 2 ? 'Sup + Inf (2 arcadas)' : null)
  }

  const agoraIso = new Date().toISOString()
  const dataRegistro = new Date(`${input.data}T12:00:00Z`)
  const criados: number[] = []

  for (const item of input.blocos) {
    const inicio = String(item.horaInicio || '').trim().slice(0, 5)
    const fim = String(item.horaFim || '').trim().slice(0, 5)
    if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim) || fim <= inicio) {
      return { success: false, error: `Horário inválido no bloco "${item.etapaNome}" (${inicio}–${fim}).` }
    }

    const durPlanejada = item.duracaoPlanejadaMin ?? Math.max(15, paraMinutos(fim) - paraMinutos(inicio))

    const payload: PayloadBlocoAgendaTv = {
      ordemId: input.ordemId ?? null,
      protetico,
      data: input.data,
      horaInicio: inicio,
      horaFim: fim,
      etapaNome: String(item.etapaNome || 'Execução em bancada').trim(),
      modo: item.modo === 'maquina' ? 'maquina' : 'bancada',
      status: 'agendado',
      paciente,
      servico,
      arcada,
      arcadasQtd,
      corDentes,
      dentista,
      observacao: item.observacao?.trim() || null,
      equipamento: item.equipamento?.trim() || null,
      iniciadoEm: null,
      concluidoEm: null,
      duracaoPlanejadaMin: durPlanejada,
      duracaoRealMin: null,
      medicaoTempo: null,
      origemAgendamento: item.origemAgendamento ?? 'manual',
      motivoIa: item.motivoIa ?? null,
      ajusteTempoNota: item.ajusteTempoNota ?? null,
      grupoSequenciaId: item.grupoSequenciaId ?? null,
      atualizadoEm: agoraIso,
    }

    const criado = await prisma.notificacao.create({
      data: {
        tipo: TIPO_AGENDA_BANCADA,
        titulo: construirTituloBloco(payload),
        mensagem: JSON.stringify(payload),
        data: dataRegistro,
        lida: false,
      },
    })
    criados.push(criado.id)
  }

  revalidarPainelTv()
  return { success: true, ids: criados }
}

async function aplicarRecalibracaoNoBanco(
  blocosDoDia: BlocoAgendaTv[],
  blocoAlteradoId: number,
  novoFimMin: number,
  inicioRealMin?: number,
) {
  const recalc = recalibrarAgendaPorExecucao({
    blocosDoDia,
    blocoAlteradoId,
    novoFimMin,
    inicioRealMin,
  })

  if (recalc.blocosAtualizados.length === 0) {
    return {
      deltaMin: recalc.deltaMin,
      direcao: recalc.direcao,
      blocosAjustados: 0,
    }
  }

  const agoraIso = new Date().toISOString()
  for (const patch of recalc.blocosAtualizados) {
    const original = blocosDoDia.find((b) => b.id === patch.id)
    if (!original) continue

    const payloadAtualizado: PayloadBlocoAgendaTv = {
      ordemId: original.ordemId,
      protetico: original.protetico,
      data: original.data,
      horaInicio: patch.horaInicio,
      horaFim: patch.horaFim,
      etapaNome: original.etapaNome,
      modo: original.modo,
      status: original.status,
      paciente: original.paciente,
      servico: original.servico,
      arcada: original.arcada,
      arcadasQtd: original.arcadasQtd ?? 1,
      corDentes: original.corDentes,
      dentista: original.dentista,
      observacao: original.observacao,
      equipamento: original.equipamento,
      iniciadoEm: original.iniciadoEm,
      concluidoEm: original.concluidoEm,
      duracaoPlanejadaMin: original.duracaoPlanejadaMin ?? Math.max(15, paraMinutos(original.horaFim) - paraMinutos(original.horaInicio)),
      duracaoRealMin: original.duracaoRealMin ?? null,
      medicaoTempo: original.medicaoTempo ?? null,
      origemAgendamento: original.origemAgendamento ?? 'manual',
      motivoIa: original.motivoIa ?? null,
      ajusteTempoNota: patch.ajusteTempoNota,
      grupoSequenciaId: original.grupoSequenciaId ?? null,
      atualizadoEm: agoraIso,
    }

    await prisma.notificacao.update({
      where: { id: patch.id },
      data: {
        titulo: construirTituloBloco(payloadAtualizado),
        mensagem: JSON.stringify(payloadAtualizado),
      },
    })
  }

  return {
    deltaMin: recalc.deltaMin,
    direcao: recalc.direcao,
    blocosAjustados: recalc.blocosAtualizados.length,
  }
}

export async function atualizarStatusBlocoTv(
  blocoId: number,
  novoStatus: StatusBlocoTv,
  opcoes: { avancarEtapaOs?: boolean; recalibrarAutomaticamente?: boolean } = {},
) {
  await requireUser()

  const reg = await prisma.notificacao.findUnique({ where: { id: blocoId } })
  if (!reg || reg.tipo !== TIPO_AGENDA_BANCADA) {
    return { success: false, error: 'Bloco da agenda não encontrado.' }
  }

  const parsed = parseBlocoNotificacao(reg)
  if (!parsed) {
    return { success: false, error: 'Registro de agenda inválido.' }
  }

  const agora = new Date()
  const agoraIso = agora.toISOString()
  const maceioAgora = agoraMaceioInfo(agora)

  const iniciadoEm = novoStatus === 'em_andamento' ? (parsed.iniciadoEm || agoraIso) : parsed.iniciadoEm
  const concluidoEm = novoStatus === 'concluido' ? agoraIso : null

  let duracaoRealMin = parsed.duracaoRealMin ?? null
  let medicaoTempo = parsed.medicaoTempo ?? null

  if (novoStatus === 'concluido') {
    const calc = calcularDuracaoRealExecucao({
      data: parsed.data,
      horaInicio: parsed.horaInicio,
      horaFim: parsed.horaFim,
      iniciadoEm,
      concluidoEm,
    })
    duracaoRealMin = calc.duracaoRealMin
    medicaoTempo = calc.medicao
  }

  const duracaoPlanejadaMin =
    parsed.duracaoPlanejadaMin ?? Math.max(15, paraMinutos(parsed.horaFim) - paraMinutos(parsed.horaInicio))

  const payloadAtualizado: PayloadBlocoAgendaTv = {
    ordemId: parsed.ordemId,
    protetico: parsed.protetico,
    data: parsed.data,
    horaInicio: parsed.horaInicio,
    horaFim: parsed.horaFim,
    etapaNome: parsed.etapaNome,
    modo: parsed.modo,
    status: novoStatus,
    paciente: parsed.paciente,
    servico: parsed.servico,
    arcada: parsed.arcada,
    arcadasQtd: parsed.arcadasQtd ?? 1,
    corDentes: parsed.corDentes,
    dentista: parsed.dentista,
    observacao: parsed.observacao,
    equipamento: parsed.equipamento,
    iniciadoEm,
    concluidoEm,
    duracaoPlanejadaMin,
    duracaoRealMin,
    medicaoTempo,
    origemAgendamento: parsed.origemAgendamento ?? 'manual',
    motivoIa: parsed.motivoIa ?? null,
    ajusteTempoNota: parsed.ajusteTempoNota ?? null,
    grupoSequenciaId: parsed.grupoSequenciaId ?? null,
    atualizadoEm: agoraIso,
  }

  await prisma.notificacao.update({
    where: { id: blocoId },
    data: {
      titulo: construirTituloBloco(payloadAtualizado),
      mensagem: JSON.stringify(payloadAtualizado),
      lida: novoStatus === 'concluido',
    },
  })

  let recalibracao: { deltaMin: number; direcao: 'diminuiu' | 'estendeu' | 'no_prazo'; blocosAjustados: number } | null = null
  if (
    novoStatus === 'concluido' &&
    opcoes.recalibrarAutomaticamente !== false &&
    parsed.data === maceioAgora.dataIso &&
    parsed.modo === 'bancada'
  ) {
    const blocosDoDia = await carregarBlocosAgendaPorData(parsed.data)
    recalibracao = await aplicarRecalibracaoNoBanco(
      blocosDoDia,
      blocoId,
      maceioAgora.horaMin,
      paraMinutos(parsed.horaInicio),
    )
  }

  let etapaAvancada: string | null = null
  if (novoStatus === 'concluido' && opcoes.avancarEtapaOs && parsed.ordemId) {
    const res = await concluirEtapaLaboratorial(parsed.ordemId)
    if (res.success && 'proximo' in res && res.proximo) {
      etapaAvancada = res.proximo
    }
  }

  revalidarPainelTv()
  return {
    success: true,
    etapaAvancada,
    duracaoRealMin,
    duracaoPlanejadaMin,
    recalibracao,
  }
}

export async function moverOuReagendarBlocoTv(
  blocoId: number,
  patch: {
    protetico?: string
    data?: string
    horaInicio?: string
    horaFim?: string
    adiarMinutos?: number
    estenderMinutos?: number
  },
) {
  await requireUser()

  const reg = await prisma.notificacao.findUnique({ where: { id: blocoId } })
  if (!reg || reg.tipo !== TIPO_AGENDA_BANCADA) {
    return { success: false, error: 'Bloco da agenda não encontrado.' }
  }

  const parsed = parseBlocoNotificacao(reg)
  if (!parsed) {
    return { success: false, error: 'Registro de agenda inválido.' }
  }

  const protetico = patch.protetico ? normalizarProteticoId(patch.protetico) : parsed.protetico
  if (!protetico) {
    return { success: false, error: 'Protético inválido.' }
  }

  let horaInicio = patch.horaInicio?.slice(0, 5) ?? parsed.horaInicio
  let horaFim = patch.horaFim?.slice(0, 5) ?? parsed.horaFim
  let ajusteTempoNota = parsed.ajusteTempoNota ?? null

  if (typeof patch.estenderMinutos === 'number' && patch.estenderMinutos !== 0) {
    horaFim = somarMinutosHora(horaFim, patch.estenderMinutos)
    ajusteTempoNota =
      patch.estenderMinutos > 0
        ? `Prazo estendido +${patch.estenderMinutos}m na bancada`
        : `Prazo reduzido ${patch.estenderMinutos}m na bancada`
  } else if (typeof patch.adiarMinutos === 'number' && patch.adiarMinutos !== 0) {
    horaInicio = somarMinutosHora(horaInicio, patch.adiarMinutos)
    horaFim = somarMinutosHora(horaFim, patch.adiarMinutos)
  }

  if (horaFim <= horaInicio) {
    return { success: false, error: 'Horário final precisa ser posterior ao inicial.' }
  }

  const data = patch.data && /^\d{4}-\d{2}-\d{2}$/.test(patch.data) ? patch.data : parsed.data
  const payloadAtualizado: PayloadBlocoAgendaTv = {
    ordemId: parsed.ordemId,
    protetico,
    data,
    horaInicio,
    horaFim,
    etapaNome: parsed.etapaNome,
    modo: parsed.modo,
    status: parsed.status,
    paciente: parsed.paciente,
    servico: parsed.servico,
    arcada: parsed.arcada,
    arcadasQtd: parsed.arcadasQtd ?? 1,
    corDentes: parsed.corDentes,
    dentista: parsed.dentista,
    observacao: parsed.observacao,
    equipamento: parsed.equipamento,
    iniciadoEm: parsed.iniciadoEm,
    concluidoEm: parsed.concluidoEm,
    duracaoPlanejadaMin: parsed.duracaoPlanejadaMin ?? Math.max(15, paraMinutos(horaFim) - paraMinutos(horaInicio)),
    duracaoRealMin: parsed.duracaoRealMin ?? null,
    medicaoTempo: parsed.medicaoTempo ?? null,
    origemAgendamento: parsed.origemAgendamento ?? 'manual',
    motivoIa: parsed.motivoIa ?? null,
    ajusteTempoNota,
    grupoSequenciaId: parsed.grupoSequenciaId ?? null,
    atualizadoEm: new Date().toISOString(),
  }

  await prisma.notificacao.update({
    where: { id: blocoId },
    data: {
      titulo: construirTituloBloco(payloadAtualizado),
      mensagem: JSON.stringify(payloadAtualizado),
      data: new Date(`${data}T12:00:00Z`),
    },
  })

  let recalibracao: { deltaMin: number; direcao: 'diminuiu' | 'estendeu' | 'no_prazo'; blocosAjustados: number } | null = null
  if (typeof patch.estenderMinutos === 'number' && patch.estenderMinutos !== 0 && parsed.modo === 'bancada') {
    const blocosDoDia = await carregarBlocosAgendaPorData(data)
    recalibracao = await aplicarRecalibracaoNoBanco(
      blocosDoDia,
      blocoId,
      paraMinutos(horaFim),
      paraMinutos(horaInicio),
    )
  }

  revalidarPainelTv()
  return { success: true, recalibracao }
}

export async function excluirBlocoTv(blocoId: number) {
  await requireUser()

  const reg = await prisma.notificacao.findUnique({ where: { id: blocoId } })
  if (!reg || reg.tipo !== TIPO_AGENDA_BANCADA) {
    return { success: false, error: 'Bloco da agenda não encontrado.' }
  }

  await prisma.notificacao.delete({ where: { id: blocoId } })
  revalidarPainelTv()
  return { success: true }
}

export interface ResultadoMotorAgendaIa {
  success: boolean
  error?: string
  aplicado: boolean
  dataAlvo: string
  plano: PlanoAgendaAutomaticoResultado
  estrategia: EstrategiaIaResultado
  blocosCriadosIds: number[]
}

export async function executarAgendaAutomaticaIa(input: {
  data?: string
  modoReotimizacao?: 'preencher_livres' | 'reorganizar_pendentes'
  dividirAcrilizacao?: boolean
  usarGemini?: boolean
  aplicar?: boolean
}): Promise<ResultadoMotorAgendaIa> {
  await requireUser()

  const maceio = agoraMaceioInfo()
  const dataAlvo = input.data && /^\d{4}-\d{2}-\d{2}$/.test(input.data) ? input.data : maceio.dataIso
  const modoReotimizacao = input.modoReotimizacao ?? 'preencher_livres'
  const dividirAcrilizacao = input.dividirAcrilizacao ?? true
  const aplicar = input.aplicar ?? true

  const [contexto, blocosExistentes, historicoConcluidos] = await Promise.all([
    carregarContextoOrdensNoLab(maceio.dataIso),
    carregarBlocosAgendaPorData(dataAlvo),
    carregarHistoricoConcluidosTv(60),
  ])

  const planoBase = gerarPlanoAgendaAutomatico({
    dataAlvo,
    dataHoje: maceio.dataIso,
    horaMinAtual: maceio.horaMin,
    ordensNoLab: contexto.ordensNoLab,
    blocosExistentesNoDia: blocosExistentes,
    historicoConcluidos,
    dividirAcrilizacao,
    ignorarBlocosAgendadosIa: modoReotimizacao === 'reorganizar_pendentes',
  })

  const estrategia = await refinarEstrategiaComGemini({
    dataAlvo,
    ordensAvaliadas: planoBase.ordensAvaliadas,
    perfis: planoBase.perfisUsados,
    planoBase,
    usarGemini: input.usarGemini ?? true,
  })

  const planoFinal =
    estrategia.overrides.length > 0
      ? gerarPlanoAgendaAutomatico({
          dataAlvo,
          dataHoje: maceio.dataIso,
          horaMinAtual: maceio.horaMin,
          ordensNoLab: contexto.ordensNoLab,
          blocosExistentesNoDia: blocosExistentes,
          historicoConcluidos,
          dividirAcrilizacao,
          overridesGemini: estrategia.overrides,
          ignorarBlocosAgendadosIa: modoReotimizacao === 'reorganizar_pendentes',
        })
      : planoBase

  const blocosCriadosIds: number[] = []

  if (aplicar) {
    if (modoReotimizacao === 'reorganizar_pendentes') {
      const idsParaSubstituir = blocosExistentes
        .filter((b) => b.status === 'agendado' && b.origemAgendamento === 'motor_ia')
        .map((b) => b.id)

      if (idsParaSubstituir.length > 0) {
        await prisma.notificacao.deleteMany({
          where: { id: { in: idsParaSubstituir } },
        })
      }
    }

    const mapaOrdens = new Map(contexto.ordensNoLab.map((o) => [o.id, o]))
    const agoraIso = new Date().toISOString()
    const dataRegistro = new Date(`${dataAlvo}T12:00:00Z`)

    for (const bloco of planoFinal.blocos) {
      const ordem = mapaOrdens.get(bloco.ordemId)
      if (!ordem) continue

      const payload: PayloadBlocoAgendaTv = {
        ordemId: ordem.id,
        protetico: bloco.protetico,
        data: bloco.data,
        horaInicio: bloco.horaInicio,
        horaFim: bloco.horaFim,
        etapaNome: bloco.etapaNome,
        modo: bloco.modo,
        status: 'agendado',
        paciente: ordem.paciente,
        servico: ordem.servico,
        arcada: arcadaLabelDaOrdem(ordem),
        arcadasQtd: bloco.arcadasQtd,
        corDentes: ordem.cor ?? null,
        dentista: ordem.dentista ?? null,
        observacao: null,
        equipamento: bloco.equipamento,
        iniciadoEm: null,
        concluidoEm: null,
        duracaoPlanejadaMin: bloco.duracaoPlanejadaMin,
        duracaoRealMin: null,
        medicaoTempo: null,
        origemAgendamento: 'motor_ia',
        motivoIa: bloco.motivoIa,
        ajusteTempoNota: bloco.ajusteTempoNota,
        grupoSequenciaId: bloco.grupoSequenciaId,
        atualizadoEm: agoraIso,
      }

      const criado = await prisma.notificacao.create({
        data: {
          tipo: TIPO_AGENDA_BANCADA,
          titulo: construirTituloBloco(payload),
          mensagem: JSON.stringify(payload),
          data: dataRegistro,
          lida: false,
        },
      })
      blocosCriadosIds.push(criado.id)
    }

    await salvarBriefingIa(dataAlvo, estrategia)
    revalidarPainelTv()
  }

  return {
    success: true,
    aplicado: aplicar,
    dataAlvo,
    plano: planoFinal,
    estrategia,
    blocosCriadosIds,
  }
}
