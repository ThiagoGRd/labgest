// Controle de tratamentos: quantas consultas e quanto tempo cada prótese consome
// e com quem o trabalho ficou parado. Regras puras, sem banco nem tela, para que
// o mesmo cálculo valha no painel, nos alertas e nos testes.

import { FLUXOS_PROTESE, type TipoProteseId } from './prosthesis-workflows'

export type NivelAlerta = 'ok' | 'atencao' | 'critico'
export type Responsavel = 'laboratorio' | 'clinica' | 'fornecedor'
export type StatusConsulta = 'agendado' | 'compareceu' | 'faltou'

export interface LimiteTratamento {
  consultasAtencao: number
  consultasMax: number
  diasAtencao: number
  diasMax: number
}

/** Próteses com várias idas e vindas, que entram no controle do gestor. */
export const TIPOS_CONTROLADOS: readonly TipoProteseId[] = [
  'protocolo_definitivo',
  'protocolo_carga_imediata',
  'protese_total_removivel',
  'ppr_com_estrutura',
  'ppr_sem_estrutura',
]

const DIAS_PADRAO: Record<string, [number, number]> = {
  protocolo_definitivo: [60, 90],
  protocolo_carga_imediata: [10, 20],
  protese_total_removivel: [45, 60],
  ppr_com_estrutura: [60, 90],
  ppr_sem_estrutura: [45, 60],
}

/** Consultas previstas no fluxo ideal: uma por etapa clínica. */
export function consultasPrevistas(tipo: TipoProteseId) {
  return FLUXOS_PROTESE[tipo].passos.filter((passo) => passo.responsavel === 'clinica').length
}

/**
 * Limite padrão: uma consulta além do previsto já pede atenção e duas é o teto.
 * No protocolo definitivo (3 previstas) isso dá atenção na 4ª e máximo na 5ª.
 */
export function limitePadrao(tipo: TipoProteseId): LimiteTratamento {
  const previstas = consultasPrevistas(tipo)
  const [diasAtencao, diasMax] = DIAS_PADRAO[tipo] ?? [30, 45]
  return { consultasAtencao: previstas + 1, consultasMax: previstas + 2, diasAtencao, diasMax }
}

export function limiteValido(limite: LimiteTratamento) {
  const valores = [limite.consultasAtencao, limite.consultasMax, limite.diasAtencao, limite.diasMax]
  return valores.every((valor) => Number.isInteger(valor) && valor > 0 && valor <= 3650)
    && limite.consultasAtencao <= limite.consultasMax
    && limite.diasAtencao <= limite.diasMax
}

/** Chave de comparação de nomes: sem acento, sem caixa e sem espaços sobrando. */
export function normalizarNome(nome: string | null | undefined) {
  return (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/**
 * Nomes diferentes que provavelmente são a mesma pessoa (abreviação ou sobrenome
 * do meio faltando). Serve só para SUGERIR um vínculo; nunca vincula sozinho.
 */
export function nomesParecidos(a: string, b: string) {
  const ta = normalizarNome(a).split(' ').filter((t) => t && !PARTICULAS.has(t))
  const tb = normalizarNome(b).split(' ').filter((t) => t && !PARTICULAS.has(t))
  if (ta.length < 2 || tb.length < 2) return false
  if (ta.join(' ') === tb.join(' ')) return false
  if (ta[0] !== tb[0]) return false
  const [menor, maior] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  return menor.every((token) => maior.includes(token))
}

// Categorias da agenda que não fazem parte da confecção de uma prótese.
const CATEGORIAS_FORA = /avalia|botox|clareamento|ortodon|follow|conversar|retorno de 6|limpeza|profilaxia|harmoniza/

export function categoriaContaParaProtese(categoria: string | null | undefined) {
  return !CATEGORIAS_FORA.test(normalizarNome(categoria))
}

export interface ConsultaClinica {
  id: string
  /** AAAA-MM-DD */
  data: string
  hora?: string | null
  status: StatusConsulta
  dentista?: string | null
  categoria?: string | null
  observacoes?: string | null
  /** Decisão manual do gestor: true conta, false não conta, null segue a categoria. */
  contaManual?: boolean | null
}

export type SituacaoConsulta = 'realizada' | 'sem_confirmacao' | 'falta' | 'futura' | 'fora'

export interface ConsultaAnalisada extends ConsultaClinica {
  situacao: SituacaoConsulta
}

export interface ResumoConsultas {
  /** Consultas que consumiram agenda: compareceu + passadas sem marcação de falta. */
  realizadas: number
  semConfirmacao: number
  faltas: number
  futuras: number
  lista: ConsultaAnalisada[]
}

const MS_DIA = 86_400_000
const diaUtc = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)

export function diasEntre(inicio: string, fim: string) {
  return Math.max(0, Math.round((diaUtc(fim) - diaUtc(inicio)) / MS_DIA))
}

export function somarDias(iso: string, dias: number) {
  return new Date(diaUtc(iso) + dias * MS_DIA).toISOString().slice(0, 10)
}

/** A primeira consulta (moldagem/escaneamento) costuma ocorrer pouco antes de a ordem ser aberta. */
export const MARGEM_INICIO_DIAS = 7

/**
 * Separa as consultas do paciente que pertencem a este tratamento.
 * `inicio` é a data do pedido e `fim` a data de entrega (ou null se ainda aberto).
 */
export function analisarConsultas(
  consultas: ConsultaClinica[],
  janela: { inicio: string; fim: string | null; hoje: string },
): ResumoConsultas {
  const de = somarDias(janela.inicio, -MARGEM_INICIO_DIAS)
  const lista: ConsultaAnalisada[] = []
  const resumo = { realizadas: 0, semConfirmacao: 0, faltas: 0, futuras: 0 }

  for (const consulta of [...consultas].sort((a, b) => (a.data + (a.hora ?? '')).localeCompare(b.data + (b.hora ?? '')))) {
    if (consulta.data < de || (janela.fim && consulta.data > janela.fim)) continue
    const conta = consulta.contaManual ?? categoriaContaParaProtese(consulta.categoria)
    let situacao: SituacaoConsulta
    if (!conta) situacao = 'fora'
    else if (consulta.status === 'faltou') situacao = 'falta'
    else if (consulta.status === 'compareceu') situacao = 'realizada'
    else if (consulta.data >= janela.hoje) situacao = 'futura'
    else situacao = 'sem_confirmacao'

    if (situacao === 'realizada') resumo.realizadas += 1
    if (situacao === 'sem_confirmacao') { resumo.realizadas += 1; resumo.semConfirmacao += 1 }
    if (situacao === 'falta') resumo.faltas += 1
    if (situacao === 'futura') resumo.futuras += 1
    lista.push({ ...consulta, situacao })
  }

  return { ...resumo, lista }
}

export interface EventoHistorico {
  acao?: string
  data?: string
}

const TROCA_DE_MAOS: Record<string, Responsavel> = {
  enviou_recepcao: 'clinica',
  recebeu_laboratorio: 'laboratorio',
  registrou_no_laboratorio: 'laboratorio',
  retorno_ciclo: 'laboratorio',
  enviado_fornecedor: 'fornecedor',
  recebeu_fornecedor: 'laboratorio',
}

export interface DivisaoTempo {
  laboratorio: number
  clinica: number
  fornecedor: number
  /** false quando a ordem não tem movimentações registradas: a divisão não é confiável. */
  temRegistro: boolean
  /** Com quem o trabalho está agora e desde quando (AAAA-MM-DD). */
  comQuem: Responsavel
  desde: string
}

/**
 * Quantos dias o trabalho ficou com cada parte, a partir das movimentações que o
 * próprio LabGest registra (envio à recepção, retorno ao laboratório, fornecedor).
 * É a resposta objetiva para "o atraso foi do laboratório ou da clínica?".
 */
export function dividirTempo(historico: EventoHistorico[], inicioIso: string, fimIso: string): DivisaoTempo {
  const inicio = Date.parse(inicioIso)
  const fim = Math.max(inicio, Date.parse(fimIso))
  const eventos = historico
    .filter((e): e is { acao: string; data: string } => Boolean(e?.acao && e.data && TROCA_DE_MAOS[e.acao] && !Number.isNaN(Date.parse(e.data))))
    .map((e) => ({ para: TROCA_DE_MAOS[e.acao], em: Math.min(fim, Math.max(inicio, Date.parse(e.data))) }))
    .sort((a, b) => a.em - b.em)

  const ms: Record<Responsavel, number> = { laboratorio: 0, clinica: 0, fornecedor: 0 }
  let atual: Responsavel = 'laboratorio'
  let cursor = inicio
  for (const evento of eventos) {
    ms[atual] += evento.em - cursor
    cursor = evento.em
    atual = evento.para
  }
  ms[atual] += fim - cursor

  const dias = (valor: number) => Math.round((valor / MS_DIA) * 10) / 10
  return {
    laboratorio: dias(ms.laboratorio),
    clinica: dias(ms.clinica),
    fornecedor: dias(ms.fornecedor),
    temRegistro: eventos.length > 0,
    comQuem: atual,
    desde: new Date(cursor).toISOString().slice(0, 10),
  }
}

function nivelPara(valor: number, atencao: number, maximo: number): NivelAlerta {
  if (valor >= maximo) return 'critico'
  if (valor >= atencao) return 'atencao'
  return 'ok'
}

const PESO: Record<NivelAlerta, number> = { ok: 0, atencao: 1, critico: 2 }

export function piorNivel(...niveis: NivelAlerta[]): NivelAlerta {
  return niveis.reduce((pior, nivel) => (PESO[nivel] > PESO[pior] ? nivel : pior), 'ok' as NivelAlerta)
}

export interface AvaliacaoTratamento {
  consultas: NivelAlerta
  tempo: NivelAlerta
  geral: NivelAlerta
}

export function avaliarTratamento(consultasRealizadas: number, diasAberto: number, limite: LimiteTratamento): AvaliacaoTratamento {
  const consultas = nivelPara(consultasRealizadas, limite.consultasAtencao, limite.consultasMax)
  const tempo = nivelPara(diasAberto, limite.diasAtencao, limite.diasMax)
  return { consultas, tempo, geral: piorNivel(consultas, tempo) }
}

export type TipoAlertaTratamento = 'consultas_atencao' | 'consultas_critico' | 'tempo_atencao' | 'tempo_critico'

/** Alertas que devem existir para a situação atual (o de atenção permanece quando vira crítico). */
export function alertasDevidos(avaliacao: AvaliacaoTratamento): TipoAlertaTratamento[] {
  const tipos: TipoAlertaTratamento[] = []
  if (avaliacao.consultas !== 'ok') tipos.push('consultas_atencao')
  if (avaliacao.consultas === 'critico') tipos.push('consultas_critico')
  if (avaliacao.tempo !== 'ok') tipos.push('tempo_atencao')
  if (avaliacao.tempo === 'critico') tipos.push('tempo_critico')
  return tipos
}

export type TipoRiscoOperacional = 'consulta_sem_peca' | 'peca_sem_agenda' | 'faltas_recorrentes'

export interface RiscoOperacional {
  tipo: TipoRiscoOperacional
  nivel: 'critico' | 'atencao'
  titulo: string
  detalhe: string
}

const ROTULO_LOCAL_RISCO: Record<Responsavel, string> = {
  laboratorio: 'no laboratório',
  clinica: 'na clínica',
  fornecedor: 'no fornecedor',
}

/**
 * Sinais operacionais do dia a dia que escapam dos contadores puros de teto:
 * - consulta próxima com a peça ainda fora da clínica;
 * - peça parada na clínica há 7+ dias sem retorno agendado;
 * - paciente faltando repetidamente (problema de confirmação/recepção).
 */
export function detectarRiscosOperacionais(entrada: {
  encerrado: boolean
  pausado: boolean
  hoje: string
  tempo: Pick<DivisaoTempo, 'comQuem' | 'desde'>
  consultas: Pick<ResumoConsultas, 'futuras' | 'faltas' | 'lista'>
}): RiscoOperacional[] {
  if (entrada.encerrado || entrada.pausado) return []
  const riscos: RiscoOperacional[] = []

  const proxima = entrada.consultas.lista.find((c) => c.situacao === 'futura')
  if (entrada.tempo.comQuem !== 'clinica' && proxima && proxima.data >= entrada.hoje) {
    const emDias = diasEntre(entrada.hoje, proxima.data)
    if (emDias <= 2) {
      const quando = emDias === 0 ? 'hoje' : emDias === 1 ? 'amanhã' : 'em 2 dias'
      riscos.push({
        tipo: 'consulta_sem_peca',
        nivel: 'critico',
        titulo: 'Consulta próxima sem peça na clínica',
        detalhe: `Paciente agendado ${quando}${proxima.hora ? ` às ${proxima.hora}` : ''}, mas a peça consta ${ROTULO_LOCAL_RISCO[entrada.tempo.comQuem]}.`,
      })
    }
  }

  const diasParado = diasEntre(entrada.tempo.desde, entrada.hoje)
  if (entrada.tempo.comQuem === 'clinica' && entrada.consultas.futuras === 0 && diasParado >= 7) {
    riscos.push({
      tipo: 'peca_sem_agenda',
      nivel: 'atencao',
      titulo: 'Na clínica sem consulta futura',
      detalhe: `Está com a clínica há ${diasParado} dias e não há retorno agendado no Clinicorp.`,
    })
  }

  if (entrada.consultas.faltas >= 2) {
    riscos.push({
      tipo: 'faltas_recorrentes',
      nivel: 'atencao',
      titulo: `${entrada.consultas.faltas} faltas do paciente`,
      detalhe: 'Excesso de faltas elevando o prazo sem avanço clínico — alinhar confirmação com a recepção.',
    })
  }

  return riscos
}
