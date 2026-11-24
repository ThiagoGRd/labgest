import { normalizarNome, somarDias, type StatusConsulta } from '@labgest/shared'
import { instanteMaceio } from './recepcao-agenda-view'

export interface ConsultaClinicorpRecepcao {
  clinicorpId: string
  data: string
  horaInicio: string | null
  horaFim: string | null
  status: StatusConsulta
  dentistaNome: string | null
  categoria: string | null
  observacoes: string | null
}

export type RiscoClinicorpRecepcao =
  | 'hoje_sem_peca'
  | 'amanha_sem_peca'
  | 'resposta_pendente_com_consulta'
  | null

export interface ResumoClinicorpRecepcao {
  proximaConsulta: ConsultaClinicorpRecepcao | null
  consultasFuturas: number
  risco: RiscoClinicorpRecepcao
}

export type OrdenacaoRecepcao = 'urgencia' | 'parados' | 'entrega'

const SITUACOES_SEM_PECA_PRONTA = new Set([
  'no_laboratorio',
  'conferir_recebimento',
  'aguardando_recepcao',
  'aguardando_envio_laboratorio',
  'em_transito_laboratorio',
])

export const SITUACOES_GARGALO_24H = new Set([
  'conferir_recebimento',
  'aguardando_recepcao',
  'aguardando_distribuicao',
  'aguardando_resultado_dentista',
  'aguardando_envio_laboratorio',
  'em_transito_laboratorio',
])

export function situacaoVisualItem(situacao: string, decisaoDentista: string | null): string {
  if (situacao === 'aguardando_resultado_dentista' && decisaoDentista) {
    return 'aguardando_envio_laboratorio'
  }
  return situacao
}

function normalizarHoraClinicorp(horaInicio: string | null): string {
  if (!horaInicio) return '08:00'
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(horaInicio.trim())
  if (!match) return '08:00'
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return '08:00'
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function instanteConsultaClinicorp(data: string, horaInicio: string | null): string {
  const hora = normalizarHoraClinicorp(horaInicio)
  return instanteMaceio(`${data.slice(0, 10)}T${hora}`)
}

export function dataHoraInputClinicorp(data: string, horaInicio: string | null): string {
  const hora = normalizarHoraClinicorp(horaInicio)
  return `${data.slice(0, 10)}T${hora}`
}

export function resumirAgendaClinicorpParaOrdem(
  consultas: ConsultaClinicorpRecepcao[],
  situacaoAtual: string,
  hoje: string,
): ResumoClinicorpRecepcao {
  const futuras = consultas
    .filter((c) => c.data >= hoje && c.status !== 'faltou')
    .sort((a, b) => a.data.localeCompare(b.data) || (a.horaInicio ?? '99:99').localeCompare(b.horaInicio ?? '99:99'))

  const proxima = futuras.find((c) => c.status === 'agendado') ?? futuras[0] ?? null
  if (!proxima) {
    return { proximaConsulta: null, consultasFuturas: 0, risco: null }
  }

  const amanha = somarDias(hoje, 1)
  let risco: RiscoClinicorpRecepcao = null

  if (proxima.data === hoje) {
    if (situacaoAtual === 'aguardando_resultado_dentista') risco = 'resposta_pendente_com_consulta'
    else if (SITUACOES_SEM_PECA_PRONTA.has(situacaoAtual)) risco = 'hoje_sem_peca'
  } else if (proxima.data === amanha) {
    if (situacaoAtual === 'aguardando_resultado_dentista') risco = 'resposta_pendente_com_consulta'
    else if (SITUACOES_SEM_PECA_PRONTA.has(situacaoAtual)) risco = 'amanha_sem_peca'
  }

  return {
    proximaConsulta: proxima,
    consultasFuturas: futuras.length,
    risco,
  }
}

export function temCompromissoProximo(
  item: {
    agendamento: string | null
    agendamentoConfirmado: boolean
    clinicorp?: ResumoClinicorpRecepcao | null
  },
  hoje: string,
): boolean {
  const amanha = somarDias(hoje, 1)
  const dataClinicorp = item.clinicorp?.proximaConsulta?.data
  if (dataClinicorp && (dataClinicorp === hoje || dataClinicorp === amanha)) return true
  if (item.agendamentoConfirmado && item.agendamento) {
    const ms = Date.parse(item.agendamento)
    if (!Number.isFinite(ms)) return false
    const dataMaceio = new Date(ms - 3 * 3_600_000).toISOString().slice(0, 10)
    return dataMaceio === hoje || dataMaceio === amanha
  }
  return false
}

export function pesoRiscoClinicorp(risco: RiscoClinicorpRecepcao | undefined): number {
  if (risco === 'hoje_sem_peca' || risco === 'resposta_pendente_com_consulta') return 0
  if (risco === 'amanha_sem_peca') return 1
  return 2
}

export function instanteAgendaReferencia(item: {
  agendamento: string | null
  agendamentoConfirmado: boolean
  clinicorp?: ResumoClinicorpRecepcao | null
}): number {
  const candidatos: number[] = []
  if (item.agendamentoConfirmado && item.agendamento) {
    const ms = Date.parse(item.agendamento)
    if (Number.isFinite(ms)) candidatos.push(ms)
  }
  const prox = item.clinicorp?.proximaConsulta
  if (prox) {
    const ms = Date.parse(instanteConsultaClinicorp(prox.data, prox.horaInicio))
    if (Number.isFinite(ms)) candidatos.push(ms)
  }
  return candidatos.length > 0 ? Math.min(...candidatos) : Number.POSITIVE_INFINITY
}

export function ordenarItensRecepcao<
  T extends {
    id: number
    movimentadoEm: string | null
    entregaPrevista: string
    agendamento: string | null
    agendamentoConfirmado: boolean
    clinicorp?: ResumoClinicorpRecepcao | null
  },
>(itens: T[], modo: OrdenacaoRecepcao): T[] {
  const copia = [...itens]
  copia.sort((a, b) => {
    if (modo === 'parados') {
      const ma = a.movimentadoEm ? Date.parse(a.movimentadoEm) : Number.POSITIVE_INFINITY
      const mb = b.movimentadoEm ? Date.parse(b.movimentadoEm) : Number.POSITIVE_INFINITY
      if (ma !== mb) return ma - mb
    } else if (modo === 'entrega') {
      const ea = a.entregaPrevista ? Date.parse(a.entregaPrevista) : Number.POSITIVE_INFINITY
      const eb = b.entregaPrevista ? Date.parse(b.entregaPrevista) : Number.POSITIVE_INFINITY
      if (ea !== eb) return ea - eb
    } else {
      const ra = pesoRiscoClinicorp(a.clinicorp?.risco)
      const rb = pesoRiscoClinicorp(b.clinicorp?.risco)
      if (ra !== rb) return ra - rb

      const aa = instanteAgendaReferencia(a)
      const ab = instanteAgendaReferencia(b)
      if (aa !== ab) return aa - ab

      const ma = a.movimentadoEm ? Date.parse(a.movimentadoEm) : Number.POSITIVE_INFINITY
      const mb = b.movimentadoEm ? Date.parse(b.movimentadoEm) : Number.POSITIVE_INFINITY
      if (ma !== mb) return ma - mb
    }
    return a.id - b.id
  })
  return copia
}

export function historicoIndicaNoLabAtual(historico: unknown): boolean {
  if (!Array.isArray(historico) || historico.length === 0) return false
  const acoesLogisticas = new Set([
    'enviou_recepcao',
    'recebeu_recepcao',
    'registrou_no_laboratorio',
    'entregou_dentista',
    'corrigiu_distribuicao',
    'recebeu_do_dentista',
    'enviou_retorno_laboratorio',
    'recebeu_laboratorio',
    'retornou_agendado_recepcao',
    'retorno_ciclo',
    'abriu_ciclo',
  ])
  for (let i = historico.length - 1; i >= 0; i--) {
    const evento = historico[i]
    if (!evento || typeof evento !== 'object') continue
    const acao = (evento as { acao?: unknown }).acao
    if (typeof acao === 'string' && acoesLogisticas.has(acao)) {
      return acao === 'registrou_no_laboratorio'
    }
  }
  return false
}

export function chavePacienteRecepcao(
  origem: 'interno' | 'externo',
  id: number,
  paciente: string,
  vinculoPorOrdem?: ReadonlyMap<number, string>,
): string {
  if (origem === 'interno' && vinculoPorOrdem?.has(id)) {
    return vinculoPorOrdem.get(id)!
  }
  return normalizarNome(paciente)
}
