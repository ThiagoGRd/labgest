import type { OrdemProducao } from '@/components/producao/types'
import { ordenarOrdensOperacionais } from '@/lib/producao-utils'

export const TIPO_AGENDA_BANCADA = 'agenda_bancada'

export type ProteticoId = 'otavio' | 'napoleao'
export type ModoBlocoTv = 'bancada' | 'maquina'
export type StatusBlocoTv = 'agendado' | 'em_andamento' | 'concluido'

export interface InfoProtetico {
  id: ProteticoId
  nome: string
  especialidade: string
  cor: 'indigo' | 'emerald'
}

export const PROTETICOS_BANCADA: readonly InfoProtetico[] = [
  {
    id: 'otavio',
    nome: 'Tavá',
    especialidade: 'Montagem Estética & Protocolos',
    cor: 'indigo',
  },
  {
    id: 'napoleao',
    nome: 'Napoleão',
    especialidade: 'PPR, Planos, Placas & Acabamento',
    cor: 'emerald',
  },
] as const

export type OrigemAgendamentoTv = 'manual' | 'motor_ia'
export type MedicaoTempoTv = 'cronometrada' | 'estimada'

export interface PayloadBlocoAgendaTv {
  ordemId: number | null
  protetico: ProteticoId
  data: string
  horaInicio: string
  horaFim: string
  etapaNome: string
  modo: ModoBlocoTv
  status: StatusBlocoTv
  paciente: string
  servico: string
  arcada?: string | null
  arcadasQtd?: number | null
  corDentes?: string | null
  dentista?: string | null
  observacao?: string | null
  equipamento?: string | null
  iniciadoEm?: string | null
  concluidoEm?: string | null
  duracaoPlanejadaMin?: number | null
  duracaoRealMin?: number | null
  medicaoTempo?: MedicaoTempoTv | null
  origemAgendamento?: OrigemAgendamentoTv | null
  motivoIa?: string | null
  ajusteTempoNota?: string | null
  grupoSequenciaId?: string | null
  atualizadoEm: string
}

export interface BlocoAgendaTv extends PayloadBlocoAgendaTv {
  id: number
}

export interface BlocoTvEnriquecido extends BlocoAgendaTv {
  clinicorpConsultaLabel: string | null
  riscoClinicorp: boolean
  prioridadeOrdem: string | null
  diasVencidosTotal: number
  cicloObs: string | null
  cicloDentistaDeci: string | null
}

export type EstadoTemporalBloco = 'concluido' | 'agora' | 'excedido' | 'proximo' | 'futuro' | 'passado_pendente'

export interface BlocoTimelineTv extends BlocoTvEnriquecido {
  inicioMin: number
  fimMin: number
  duracaoMin: number
  estadoTemporal: EstadoTemporalBloco
  progressoPct: number
  excedidoMin: number
}

export interface MaquinaEmCicloTv extends BlocoTvEnriquecido {
  inicioMin: number
  fimMin: number
  restanteMin: number
  prontoParaRetirar: boolean
}

export interface ResumoBancadaProtetico {
  protetico: InfoProtetico
  blocoAtual: BlocoTimelineTv | null
  sugeridoDaFila: OrdemProducao | null
  timeline: BlocoTimelineTv[]
  emMaquina: MaquinaEmCicloTv[]
  backlog: OrdemProducao[]
  indicadores: {
    concluidos: number
    totalBancada: number
    minutosPlanejados: number
    minutosConcluidos: number
    atrasadosNoDia: number
  }
}

export function normalizarProteticoId(valor?: string | null): ProteticoId | null {
  if (!valor) return null
  const limpo = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
  if (limpo === 'otavio' || limpo === 'tava' || limpo === 'tavar') return 'otavio'
  if (limpo === 'napoleao') return 'napoleao'
  return null
}

export function getInfoProtetico(id: ProteticoId): InfoProtetico {
  return PROTETICOS_BANCADA.find((p) => p.id === id) ?? PROTETICOS_BANCADA[0]
}

export function paraMinutos(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || '').trim())
  if (!match) return 0
  const horas = Math.min(23, Math.max(0, Number(match[1])))
  const mins = Math.min(59, Math.max(0, Number(match[2])))
  return horas * 60 + mins
}

export function formatarMinutos(minutos: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutos)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function somarMinutosHora(hhmm: string, deltaMin: number): string {
  return formatarMinutos(paraMinutos(hhmm) + deltaMin)
}

export function agoraMaceioInfo(now = new Date()) {
  // Maceió (UTC-3, sem horário de verão)
  const local = new Date(now.getTime() - 3 * 3600_000)
  const ano = local.getUTCFullYear()
  const mes = String(local.getUTCMonth() + 1).padStart(2, '0')
  const dia = String(local.getUTCDate()).padStart(2, '0')
  const hora = local.getUTCHours()
  const min = local.getUTCMinutes()
  const seg = local.getUTCSeconds()
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return {
    dataIso: `${ano}-${mes}-${dia}`,
    horaMin: hora * 60 + min,
    horaStr: `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
    relogioCompleto: `${String(hora).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(seg).padStart(2, '0')}`,
    diaSemanaLabel: diasSemana[local.getUTCDay()] ?? '',
  }
}

export interface BlocoSugeridoInput {
  horaInicio: string
  horaFim: string
  etapaNome: string
  modo: ModoBlocoTv
  equipamento?: string | null
  observacao?: string | null
}

export function sugerirBlocosEtapa(params: {
  etapaNome: string
  arcadas?: number
  horaInicioBase?: string
  dividirAcrilizacao?: boolean
}): BlocoSugeridoInput[] {
  const inicio = params.horaInicioBase || '09:00'
  const etapaLower = (params.etapaNome || '').toLowerCase()
  const arcadas = Math.max(1, Math.min(2, params.arcadas || 1))

  if (etapaLower.includes('acriliz') && params.dividirAcrilizacao) {
    const fimInclusao = somarMinutosHora(inicio, 35)
    const fimPanela = somarMinutosHora(fimInclusao, 75)
    const fimAcabamento = somarMinutosHora(fimPanela, 35)
    return [
      {
        horaInicio: inicio,
        horaFim: fimInclusao,
        etapaNome: 'Acrilização · Inclusão e Prensagem',
        modo: 'bancada',
        observacao: 'Prensa na bancada — após prensar, liberar para Panela',
      },
      {
        horaInicio: fimInclusao,
        horaFim: fimPanela,
        etapaNome: 'Acrilização · Polimerização',
        modo: 'maquina',
        equipamento: 'Panela Térmica 1',
        observacao: 'Ciclo automático na panela (bancada livre para outro caso)',
      },
      {
        horaInicio: fimPanela,
        horaFim: fimAcabamento,
        etapaNome: 'Acrilização · Desinclusão e Polimento',
        modo: 'bancada',
        observacao: 'Retirar da panela e finalizar polimento',
      },
    ]
  }

  let duracaoMin = 60
  if (etapaLower.includes('acriliz')) {
    duracaoMin = 120
  } else if (etapaLower.includes('montagem')) {
    duracaoMin = 60 * arcadas
  } else if (etapaLower.includes('plano') || etapaLower.includes('moldeira')) {
    duracaoMin = 45 * arcadas
  } else if (etapaLower.includes('placa') || etapaLower.includes('conserto')) {
    duracaoMin = 60
  } else if (etapaLower.includes('protocolo')) {
    duracaoMin = 90
  }

  return [
    {
      horaInicio: inicio,
      horaFim: somarMinutosHora(inicio, duracaoMin),
      etapaNome: params.etapaNome || 'Execução em bancada',
      modo: 'bancada',
      equipamento: null,
      observacao: null,
    },
  ]
}

export function calcularRiscoClinicorp(
  bloco: Pick<BlocoAgendaTv, 'data' | 'horaFim' | 'status'>,
  proximaConsulta?: { data: string; hora?: string | null } | null,
): boolean {
  if (!proximaConsulta?.data || bloco.status === 'concluido') return false
  if (proximaConsulta.data < bloco.data) return true
  if (proximaConsulta.data > bloco.data) return false
  if (!proximaConsulta.hora) return true
  const fimBlocoMin = paraMinutos(bloco.horaFim)
  const consultaMin = paraMinutos(proximaConsulta.hora)
  return fimBlocoMin > consultaMin - 45
}

export function formatarConsultaClinicorpCurta(
  proximaConsulta?: { data: string; hora?: string | null; categoria?: string | null } | null,
  dataHoje?: string,
): string | null {
  if (!proximaConsulta?.data) return null
  const [, mes, dia] = proximaConsulta.data.split('-')
  const diaLabel = dataHoje && proximaConsulta.data === dataHoje ? 'Hoje' : `${dia}/${mes}`
  const horaLabel = proximaConsulta.hora ? ` ${proximaConsulta.hora}` : ''
  return `${diaLabel}${horaLabel}`
}

export function parseBlocoNotificacao(row: {
  id: number
  mensagem: string
}): BlocoAgendaTv | null {
  try {
    const parsed = JSON.parse(row.mensagem) as Partial<PayloadBlocoAgendaTv>
    const protetico = normalizarProteticoId(parsed.protetico)
    if (!protetico || !parsed.data || !parsed.horaInicio || !parsed.horaFim) return null

    const modo: ModoBlocoTv = parsed.modo === 'maquina' ? 'maquina' : 'bancada'
    const status: StatusBlocoTv =
      parsed.status === 'em_andamento' || parsed.status === 'concluido' ? parsed.status : 'agendado'

    return {
      id: row.id,
      ordemId: typeof parsed.ordemId === 'number' ? parsed.ordemId : null,
      protetico,
      data: String(parsed.data).slice(0, 10),
      horaInicio: String(parsed.horaInicio).slice(0, 5),
      horaFim: String(parsed.horaFim).slice(0, 5),
      etapaNome: String(parsed.etapaNome || 'Etapa de bancada'),
      modo,
      status,
      paciente: String(parsed.paciente || 'Trabalho avulso'),
      servico: String(parsed.servico || 'Serviço laboratorial'),
      arcada: typeof parsed.arcada === 'string' ? parsed.arcada : null,
      arcadasQtd: typeof parsed.arcadasQtd === 'number' && parsed.arcadasQtd > 0 ? parsed.arcadasQtd : null,
      corDentes: typeof parsed.corDentes === 'string' ? parsed.corDentes : null,
      dentista: typeof parsed.dentista === 'string' ? parsed.dentista : null,
      observacao: typeof parsed.observacao === 'string' ? parsed.observacao : null,
      equipamento: typeof parsed.equipamento === 'string' ? parsed.equipamento : null,
      iniciadoEm: typeof parsed.iniciadoEm === 'string' ? parsed.iniciadoEm : null,
      concluidoEm: typeof parsed.concluidoEm === 'string' ? parsed.concluidoEm : null,
      duracaoPlanejadaMin:
        typeof parsed.duracaoPlanejadaMin === 'number' && Number.isFinite(parsed.duracaoPlanejadaMin)
          ? parsed.duracaoPlanejadaMin
          : null,
      duracaoRealMin:
        typeof parsed.duracaoRealMin === 'number' && Number.isFinite(parsed.duracaoRealMin)
          ? parsed.duracaoRealMin
          : null,
      medicaoTempo:
        parsed.medicaoTempo === 'cronometrada' || parsed.medicaoTempo === 'estimada'
          ? parsed.medicaoTempo
          : null,
      origemAgendamento:
        parsed.origemAgendamento === 'motor_ia' || parsed.origemAgendamento === 'manual'
          ? parsed.origemAgendamento
          : null,
      motivoIa: typeof parsed.motivoIa === 'string' ? parsed.motivoIa : null,
      ajusteTempoNota: typeof parsed.ajusteTempoNota === 'string' ? parsed.ajusteTempoNota : null,
      grupoSequenciaId: typeof parsed.grupoSequenciaId === 'string' ? parsed.grupoSequenciaId : null,
      atualizadoEm: typeof parsed.atualizadoEm === 'string' ? parsed.atualizadoEm : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function resumirBancadaProtetico(params: {
  protetico: ProteticoId
  blocos: BlocoTvEnriquecido[]
  ordensNoLab: OrdemProducao[]
  dataReferencia: string
  dataHoje: string
  horaMinAtual: number
}): ResumoBancadaProtetico {
  const info = getInfoProtetico(params.protetico)
  const ehHoje = params.dataReferencia === params.dataHoje
  const ehPassado = params.dataReferencia < params.dataHoje

  const doDia = params.blocos
    .filter((b) => b.protetico === params.protetico && b.data === params.dataReferencia)
    .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio) || a.id - b.id)

  const bancadaRaw = doDia.filter((b) => b.modo === 'bancada')
  const maquinaRaw = doDia.filter((b) => b.modo === 'maquina' && b.status !== 'concluido')

  // Identifica qual bloco é o foco "AGORA"
  let focoId: number | null =
    bancadaRaw.find((b) => b.status === 'em_andamento')?.id ?? null

  if (focoId === null && ehHoje) {
    const porHorario = bancadaRaw.find(
      (b) =>
        b.status !== 'concluido' &&
        paraMinutos(b.horaInicio) <= params.horaMinAtual &&
        params.horaMinAtual <= paraMinutos(b.horaFim),
    )
    focoId = porHorario?.id ?? bancadaRaw.find((b) => b.status !== 'concluido')?.id ?? null
  } else if (focoId === null) {
    focoId = bancadaRaw.find((b) => b.status !== 'concluido')?.id ?? null
  }

  let primeiroFuturoMarcado = false
  const timeline: BlocoTimelineTv[] = bancadaRaw.map((b) => {
    const inicioMin = paraMinutos(b.horaInicio)
    const fimMin = Math.max(inicioMin + 15, paraMinutos(b.horaFim))
    const duracaoMin = fimMin - inicioMin

    let estadoTemporal: EstadoTemporalBloco = 'futuro'
    let progressoPct = 0
    let excedidoMin = 0

    if (b.status === 'concluido') {
      estadoTemporal = 'concluido'
      progressoPct = 100
    } else if (b.id === focoId) {
      if (ehHoje) {
        const decorrido = Math.max(0, params.horaMinAtual - inicioMin)
        progressoPct = Math.min(100, Math.round((decorrido / duracaoMin) * 100))
        if (params.horaMinAtual > fimMin) {
          estadoTemporal = 'excedido'
          excedidoMin = params.horaMinAtual - fimMin
        } else {
          estadoTemporal = 'agora'
        }
      } else if (ehPassado) {
        estadoTemporal = 'excedido'
        progressoPct = 100
      } else {
        estadoTemporal = 'proximo'
      }
    } else if (ehHoje && params.horaMinAtual > fimMin) {
      estadoTemporal = 'passado_pendente'
      excedidoMin = params.horaMinAtual - fimMin
    } else if (!primeiroFuturoMarcado) {
      estadoTemporal = 'proximo'
      primeiroFuturoMarcado = true
    }

    return {
      ...b,
      inicioMin,
      fimMin,
      duracaoMin,
      estadoTemporal,
      progressoPct,
      excedidoMin,
    }
  })

  const emMaquina: MaquinaEmCicloTv[] = maquinaRaw.map((b) => {
    const inicioMin = paraMinutos(b.horaInicio)
    const fimMin = Math.max(inicioMin + 15, paraMinutos(b.horaFim))
    const restanteMin = ehHoje ? Math.max(0, fimMin - params.horaMinAtual) : fimMin - inicioMin
    const prontoParaRetirar =
      ehHoje && b.status === 'em_andamento'
        ? params.horaMinAtual >= fimMin
        : ehHoje && params.horaMinAtual >= fimMin

    return {
      ...b,
      inicioMin,
      fimMin,
      restanteMin,
      prontoParaRetirar,
    }
  })

  const ordensAgendadasHoje = new Set(
    params.blocos
      .filter((b) => b.data === params.dataReferencia && b.ordemId !== null && b.status !== 'concluido')
      .map((b) => b.ordemId as number),
  )

  const backlog = ordenarOrdensOperacionais(
    params.ordensNoLab.filter((o) => !ordensAgendadasHoje.has(o.id)),
  ).slice(0, 4)

  const blocoAtual = timeline.find((b) => b.id === focoId) ?? null
  const concluidos = timeline.filter((b) => b.status === 'concluido').length
  const minutosPlanejados = timeline.reduce((s, b) => s + b.duracaoMin, 0)
  const minutosConcluidos = timeline
    .filter((b) => b.status === 'concluido')
    .reduce((s, b) => s + b.duracaoMin, 0)
  const atrasadosNoDia = timeline.filter(
    (b) => b.estadoTemporal === 'excedido' || b.estadoTemporal === 'passado_pendente',
  ).length

  return {
    protetico: info,
    blocoAtual,
    sugeridoDaFila: blocoAtual ? null : (backlog[0] ?? null),
    timeline,
    emMaquina,
    backlog,
    indicadores: {
      concluidos,
      totalBancada: timeline.length,
      minutosPlanejados,
      minutosConcluidos,
      atrasadosNoDia,
    },
  }
}
