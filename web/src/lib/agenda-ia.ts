import type { OrdemProducao } from '@/components/producao/types'
import {
  formatarMinutos,
  paraMinutos,
  type BlocoAgendaTv,
  type MedicaoTempoTv,
  type ModoBlocoTv,
  type ProteticoId,
} from '@/lib/agenda-tv'
import { diasEntre, hojeIso, paraIso } from '@/lib/labs-externos-utils'
import { calcularRelogiosOrdem } from '@/lib/producao-utils'

export type CategoriaProcedimento =
  | 'montagem'
  | 'acrilizacao_inclusao'
  | 'acrilizacao_polimerizacao'
  | 'acrilizacao_acabamento'
  | 'acrilizacao_completa'
  | 'plano_orientacao'
  | 'moldeira'
  | 'placa'
  | 'conserto'
  | 'protocolo'
  | 'ppr'
  | 'acabamento'
  | 'planejamento'
  | 'geral'

export type TendenciaTempo = 'diminuiu' | 'estavel' | 'estendeu'

export const EXPEDIENTE_INICIO_MIN = 8 * 60 // 08:00
export const ALMOCO_INICIO_MIN = 12 * 60 // 12:00
export const ALMOCO_FIM_MIN = 13 * 60 + 30 // 13:30
export const EXPEDIENTE_FIM_MIN = 18 * 60 // 18:00
export const INTERVALO_TRANSICAO_MIN = 5

const LABELS_CATEGORIA: Record<CategoriaProcedimento, string> = {
  montagem: 'Montagem de dentes',
  acrilizacao_inclusao: 'Acrilização · Inclusão/Prensagem',
  acrilizacao_polimerizacao: 'Acrilização · Polimerização (Panela)',
  acrilizacao_acabamento: 'Acrilização · Desinclusão/Polimento',
  acrilizacao_completa: 'Acrilização completa',
  plano_orientacao: 'Plano de orientação',
  moldeira: 'Moldeira individual',
  placa: 'Placa oclusal / Bruxismo',
  conserto: 'Conserto / Reparo',
  protocolo: 'Protocolo / Barra',
  ppr: 'PPR / Estrutura',
  acabamento: 'Acabamento e Polimento',
  planejamento: 'Planejamento / CAD',
  geral: 'Bancada geral',
}

export const TEMPO_BASE_POR_CATEGORIA: Record<CategoriaProcedimento, number> = {
  montagem: 60, // por arcada
  acrilizacao_inclusao: 35,
  acrilizacao_polimerizacao: 75, // máquina passiva
  acrilizacao_acabamento: 35,
  acrilizacao_completa: 120,
  plano_orientacao: 45, // por arcada
  moldeira: 45, // por arcada
  placa: 60,
  conserto: 55,
  protocolo: 90,
  ppr: 75,
  acabamento: 45,
  planejamento: 40,
  geral: 60,
}

const CATEGORIAS_ESCALAM_POR_ARCADA = new Set<CategoriaProcedimento>([
  'montagem',
  'plano_orientacao',
  'moldeira',
])

function limparTexto(valor?: string | null): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function normalizarCategoriaProcedimento(
  etapaNome?: string | null,
  servicoNome?: string | null,
  modo?: ModoBlocoTv | null,
): CategoriaProcedimento {
  const etapa = limparTexto(etapaNome)
  const servico = limparTexto(servicoNome)
  const combinado = `${etapa} ${servico}`

  if (modo === 'maquina' || etapa.includes('polimeriz') || etapa.includes('panela')) {
    return 'acrilizacao_polimerizacao'
  }
  if (etapa.includes('inclus') || etapa.includes('prensag')) {
    return 'acrilizacao_inclusao'
  }
  if (etapa.includes('desinclus') || (etapa.includes('acriliz') && etapa.includes('poliment'))) {
    return 'acrilizacao_acabamento'
  }
  if (etapa.includes('acriliz')) {
    return 'acrilizacao_completa'
  }
  if (etapa.includes('montagem')) {
    return 'montagem'
  }
  if (etapa.includes('plano') || etapa.includes('rolete') || etapa.includes('mordida')) {
    return 'plano_orientacao'
  }
  if (etapa.includes('moldeira')) {
    return 'moldeira'
  }
  if (etapa.includes('placa') || servico.includes('placa') || servico.includes('bruxism')) {
    return 'placa'
  }
  if (etapa.includes('consert') || etapa.includes('reparo') || etapa.includes('reembas') || servico.includes('consert')) {
    return 'conserto'
  }
  if (etapa.includes('acabament') || etapa.includes('poliment') || etapa.includes('caracteriz')) {
    return 'acabamento'
  }
  if (etapa.includes('planejamento') || etapa.includes('digital') || etapa.includes('stl') || etapa.includes('receb')) {
    return 'planejamento'
  }
  if (combinado.includes('protocolo') || combinado.includes('barra')) {
    return 'protocolo'
  }
  if (combinado.includes('ppr') || combinado.includes('armacao') || combinado.includes('grampo')) {
    return 'ppr'
  }
  if (combinado.includes('total') || combinado.includes('dentadura')) {
    return 'montagem'
  }
  return 'geral'
}

export function arredondarPara5Min(minutos: number, min = 15, max = 240): number {
  const clamped = Math.max(min, Math.min(max, minutos))
  return Math.round(clamped / 5) * 5
}

function minutosLocaisMaceioDeIso(iso: string): { dataIso: string; horaMin: number } | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const local = new Date(ms - 3 * 3600_000)
  const dataIso = local.toISOString().slice(0, 10)
  const horaMin = local.getUTCHours() * 60 + local.getUTCMinutes()
  return { dataIso, horaMin }
}

export function calcularDuracaoRealExecucao(params: {
  data: string
  horaInicio: string
  horaFim: string
  iniciadoEm?: string | null
  concluidoEm?: string | null
  duracaoRealMin?: number | null
  medicaoTempo?: MedicaoTempoTv | null
}): { duracaoRealMin: number; medicao: MedicaoTempoTv } {
  if (typeof params.duracaoRealMin === 'number' && params.duracaoRealMin >= 5 && params.duracaoRealMin <= 420) {
    return {
      duracaoRealMin: Math.round(params.duracaoRealMin),
      medicao: params.medicaoTempo ?? 'cronometrada',
    }
  }

  if (params.iniciadoEm && params.concluidoEm) {
    const ini = Date.parse(params.iniciadoEm)
    const fim = Date.parse(params.concluidoEm)
    if (Number.isFinite(ini) && Number.isFinite(fim)) {
      const diffMin = Math.round((fim - ini) / 60_000)
      if (diffMin >= 5 && diffMin <= 420) {
        return { duracaoRealMin: diffMin, medicao: 'cronometrada' }
      }
    }
  }

  if (params.concluidoEm) {
    const local = minutosLocaisMaceioDeIso(params.concluidoEm)
    const inicioMin = paraMinutos(params.horaInicio)
    if (local && local.dataIso === params.data) {
      const diffMin = local.horaMin - inicioMin
      if (diffMin >= 5 && diffMin <= 420) {
        return { duracaoRealMin: diffMin, medicao: 'estimada' }
      }
    }
  }

  const planejada = Math.max(15, paraMinutos(params.horaFim) - paraMinutos(params.horaInicio))
  return { duracaoRealMin: planejada, medicao: 'estimada' }
}

export interface ExtracaoDuracaoReal {
  duracaoRealMin: number
  porArcadaMin: number
  medicao: MedicaoTempoTv
  arcadas: number
}

export function extrairDuracaoRealBloco(bloco: BlocoAgendaTv): ExtracaoDuracaoReal | null {
  if (bloco.status !== 'concluido') return null
  if (!bloco.duracaoRealMin && !bloco.iniciadoEm && !bloco.concluidoEm) return null

  const { duracaoRealMin, medicao } = calcularDuracaoRealExecucao({
    data: bloco.data,
    horaInicio: bloco.horaInicio,
    horaFim: bloco.horaFim,
    iniciadoEm: bloco.iniciadoEm,
    concluidoEm: bloco.concluidoEm,
    duracaoRealMin: bloco.duracaoRealMin,
    medicaoTempo: bloco.medicaoTempo,
  })

  const arcadas = Math.max(
    1,
    Math.min(2, bloco.arcadasQtd ?? (bloco.arcada?.toLowerCase().includes('2') || bloco.arcada?.includes('+') ? 2 : 1)),
  )
  const categoria = normalizarCategoriaProcedimento(bloco.etapaNome, bloco.servico, bloco.modo)
  const divisor = CATEGORIAS_ESCALAM_POR_ARCADA.has(categoria) ? arcadas : 1

  return {
    duracaoRealMin,
    porArcadaMin: duracaoRealMin / divisor,
    medicao,
    arcadas,
  }
}

export interface PerfilTempoProtetico {
  protetico: ProteticoId
  categoria: CategoriaProcedimento
  categoriaLabel: string
  amostras: number
  amostrasCronometradas: number
  tempoBaseMin: number
  mediaRealMin: number
  duracaoSugeridaMin: number
  desvioMin: number
  tendencia: TendenciaTempo
  ultimaExecucaoMin: number | null
  atualizadoEm: string | null
}

/**
 * Aprende continuamente com blocos concluídos usando Média Móvel Exponencial (EMA).
 * Quando o protético termina mais rápido ou mais devagar de forma consistente,
 * a duração sugerida diminui ou estende gradualmente em múltiplos de 5 minutos.
 */
export function aprenderTemposProteticos(historicoConcluidos: BlocoAgendaTv[]): PerfilTempoProtetico[] {
  const grupos = new Map<string, {
    protetico: ProteticoId
    categoria: CategoriaProcedimento
    itens: Array<{ ordemTs: number; porArcadaMin: number; duracaoBrutaMin: number; medicao: MedicaoTempoTv; tsStr: string }>
  }>()

  for (const bloco of historicoConcluidos) {
    if (bloco.status !== 'concluido') continue
    const extraido = extrairDuracaoRealBloco(bloco)
    if (!extraido) continue

    const categoria = normalizarCategoriaProcedimento(bloco.etapaNome, bloco.servico, bloco.modo)
    if (categoria === 'acrilizacao_polimerizacao') {
      // Panela térmica tem ciclo físico padrão (mas ainda permite aprender se realmente variar)
    }
    const chave = `${bloco.protetico}:${categoria}`
    const tsStr = bloco.concluidoEm || bloco.atualizadoEm || `${bloco.data}T18:00:00Z`
    const ordemTs = Date.parse(tsStr) || 0

    const lista = grupos.get(chave) ?? {
      protetico: bloco.protetico,
      categoria,
      itens: [],
    }
    lista.itens.push({
      ordemTs,
      porArcadaMin: extraido.porArcadaMin,
      duracaoBrutaMin: extraido.duracaoRealMin,
      medicao: extraido.medicao,
      tsStr,
    })
    grupos.set(chave, lista)
  }

  const perfis: PerfilTempoProtetico[] = []

  for (const grupo of grupos.values()) {
    grupo.itens.sort((a, b) => a.ordemTs - b.ordemTs)
    const tempoBase = TEMPO_BASE_POR_CATEGORIA[grupo.categoria]
    let ema = tempoBase
    let pesoTotal = 0
    let cronometradas = 0

    for (const item of grupo.itens) {
      const alpha = item.medicao === 'cronometrada' ? 0.38 : 0.2
      const peso = item.medicao === 'cronometrada' ? 1 : 0.5
      if (item.medicao === 'cronometrada') cronometradas += 1

      if (pesoTotal === 0) {
        // Primeira amostra ainda pondera bastante com a base para evitar ruído extremo
        ema = tempoBase * 0.55 + item.porArcadaMin * 0.45
      } else {
        ema = ema * (1 - alpha) + item.porArcadaMin * alpha
      }
      pesoTotal += peso
    }

    const confianca = Math.min(1, pesoTotal / 2.5)
    const blended = tempoBase * (1 - confianca) + ema * confianca
    const duracaoSugeridaMin = arredondarPara5Min(blended, 15, 210)
    const desvioMin = duracaoSugeridaMin - tempoBase
    const tendencia: TendenciaTempo =
      desvioMin <= -5 ? 'diminuiu' : desvioMin >= 5 ? 'estendeu' : 'estavel'
    const ultimo = grupo.itens[grupo.itens.length - 1] ?? null

    perfis.push({
      protetico: grupo.protetico,
      categoria: grupo.categoria,
      categoriaLabel: LABELS_CATEGORIA[grupo.categoria],
      amostras: grupo.itens.length,
      amostrasCronometradas: cronometradas,
      tempoBaseMin: tempoBase,
      mediaRealMin: Math.round(ema),
      duracaoSugeridaMin,
      desvioMin,
      tendencia,
      ultimaExecucaoMin: ultimo ? Math.round(ultimo.porArcadaMin) : null,
      atualizadoEm: ultimo?.tsStr ?? null,
    })
  }

  return perfis.sort((a, b) => b.amostras - a.amostras || a.protetico.localeCompare(b.protetico))
}

export function obterDuracaoAdaptada(params: {
  protetico: ProteticoId
  etapaNome?: string | null
  servicoNome?: string | null
  arcadas?: number
  modo?: ModoBlocoTv
  perfis: PerfilTempoProtetico[]
}): {
  categoria: CategoriaProcedimento
  duracaoMin: number
  tempoBaseMin: number
  amostras: number
  tendencia: TendenciaTempo
  desvioMin: number
  motivoDuracao: string
} {
  const categoria = normalizarCategoriaProcedimento(params.etapaNome, params.servicoNome, params.modo)
  const arcadas = Math.max(1, Math.min(2, params.arcadas || 1))
  const fatorArcada = CATEGORIAS_ESCALAM_POR_ARCADA.has(categoria) ? arcadas : 1
  const tempoBaseUnit = TEMPO_BASE_POR_CATEGORIA[categoria]
  const tempoBaseMin = arredondarPara5Min(tempoBaseUnit * fatorArcada, 15, 240)

  const perfil = params.perfis.find(
    (p) => p.protetico === params.protetico && p.categoria === categoria,
  )

  if (!perfil || perfil.amostras === 0) {
    return {
      categoria,
      duracaoMin: tempoBaseMin,
      tempoBaseMin,
      amostras: 0,
      tendencia: 'estavel',
      desvioMin: 0,
      motivoDuracao: `Tempo padrão ${tempoBaseMin}m`,
    }
  }

  const duracaoMin = arredondarPara5Min(perfil.duracaoSugeridaMin * fatorArcada, 15, 240)
  const desvioMin = duracaoMin - tempoBaseMin
  const tendencia: TendenciaTempo =
    desvioMin <= -5 ? 'diminuiu' : desvioMin >= 5 ? 'estendeu' : 'estavel'

  const nomeProt = params.protetico === 'otavio' ? 'Tavá' : 'Napoleão'
  const motivoDuracao =
    tendencia === 'diminuiu'
      ? `Ajustado p/ ${duracaoMin}m (${nomeProt} reduziu ${Math.abs(desvioMin)}m em ${perfil.amostras}x)`
      : tendencia === 'estendeu'
        ? `Ajustado p/ ${duracaoMin}m (${nomeProt} estendeu +${desvioMin}m em ${perfil.amostras}x)`
        : `Mantido em ${duracaoMin}m (média real de ${perfil.amostras}x)`

  return {
    categoria,
    duracaoMin,
    tempoBaseMin,
    amostras: perfil.amostras,
    tendencia,
    desvioMin,
    motivoDuracao,
  }
}

export type FaixaUrgencia = 'critica' | 'urgente' | 'normal_envelhecida' | 'normal_recente'

export interface OrdemPriorizadaIa {
  ordem: OrdemProducao
  scoreTotal: number
  faixa: FaixaUrgencia
  diasNaFila: number
  diasVencidosTotal: number
  diasParaClinicorp: number | null
  motivoPrioridade: string
}

export function avaliarPrioridadesComAntiInanicao(
  ordens: OrdemProducao[],
  hoje = hojeIso(),
): OrdemPriorizadaIa[] {
  const avaliadas: OrdemPriorizadaIa[] = ordens.map((ordem) => {
    const rel = calcularRelogiosOrdem(ordem, hoje)
    const consultaData = ordem.clinicorpEtapa?.proximaConsulta?.data ?? null
    const diasParaClinicorp = consultaData ? diasEntre(hoje, consultaData) : null

    const dataEntradaFila =
      rel.retornouAoLabEmIso ||
      paraIso(ordem.movimentacaoLogisticaEm) ||
      paraIso(ordem.dataEntradaCiclo) ||
      paraIso(ordem.updatedAt)
    const diasNaFila = dataEntradaFila ? Math.max(0, diasEntre(dataEntradaFila, hoje) ?? 0) : 0

    let score = 0
    const motivos: string[] = []

    if (diasParaClinicorp !== null) {
      if (diasParaClinicorp < 0) {
        score += 48
        motivos.push('Consulta Clinicorp vencida')
      } else if (diasParaClinicorp === 0) {
        score += 55
        motivos.push('Clinicorp HOJE')
      } else if (diasParaClinicorp === 1) {
        score += 38
        motivos.push('Clinicorp amanhã')
      } else if (diasParaClinicorp <= 3) {
        score += 20
        motivos.push(`Clinicorp em ${diasParaClinicorp}d`)
      }
    }

    if (ordem.cicloDentistaDeci) {
      score += 42
      motivos.push(`Retorno clínica (${ordem.cicloDentistaDeci})`)
    }

    if (rel.diasRestantesCiclo !== null && rel.diasRestantesCiclo < 0) {
      score += 32 + Math.min(20, Math.abs(rel.diasRestantesCiclo) * 3)
      motivos.push(`Ciclo 10d vencido (${Math.abs(rel.diasRestantesCiclo)}d)`)
    }

    if (rel.diasVencidosTotal > 0) {
      score += Math.min(48, rel.diasVencidosTotal * 4)
      motivos.push(`Atrasada ${rel.diasVencidosTotal}d`)
    }

    if (ordem.prioridade === 'Urgente') {
      score += 38
      motivos.push('Urgente')
    } else if (ordem.prioridade === 'Alta') {
      score += 20
      motivos.push('Alta prioridade')
    } else if (ordem.prioridade === 'Normal') {
      score += 6
    }

    // Fator anti-inanição: cada dia parada no laboratório ganha pontos progressivos
    // para impedir que ordens normais fiquem eternamente presas atrás de novas urgências.
    const bonusAging = Math.min(42, diasNaFila * 4)
    score += bonusAging
    if (diasNaFila >= 4 && motivos.length === 0) {
      motivos.push(`Anti-fila (${diasNaFila}d esperando no lab)`)
    } else if (diasNaFila >= 5) {
      motivos.push(`${diasNaFila}d em espera`)
    }

    let faixa: FaixaUrgencia = 'normal_recente'
    if (
      (diasParaClinicorp !== null && diasParaClinicorp <= 1) ||
      (rel.diasRestantesCiclo !== null && rel.diasRestantesCiclo < 0) ||
      rel.diasVencidosTotal >= 5 ||
      (ordem.prioridade === 'Urgente' && (rel.diasVencidosTotal > 0 || Boolean(ordem.cicloDentistaDeci)))
    ) {
      faixa = 'critica'
    } else if (
      ordem.prioridade === 'Urgente' ||
      ordem.prioridade === 'Alta' ||
      Boolean(ordem.cicloDentistaDeci) ||
      rel.diasVencidosTotal > 0 ||
      (diasParaClinicorp !== null && diasParaClinicorp <= 3)
    ) {
      faixa = 'urgente'
    } else if (diasNaFila >= 3) {
      faixa = 'normal_envelhecida'
    }

    return {
      ordem,
      scoreTotal: score,
      faixa,
      diasNaFila,
      diasVencidosTotal: rel.diasVencidosTotal,
      diasParaClinicorp,
      motivoPrioridade: motivos.join(' · ') || 'Fluxo regular de entrada',
    }
  })

  // Ordena todas por score descendente e aplica intercalação justa 3:1
  // (a cada 3 itens críticos/urgentes, puxa 1 ordem normal antiga/recém-chegada para não travar a fila)
  const urgentes = avaliadas
    .filter((a) => a.faixa === 'critica' || a.faixa === 'urgente')
    .sort((a, b) => b.scoreTotal - a.scoreTotal || a.ordem.id - b.ordem.id)

  const normais = avaliadas
    .filter((a) => a.faixa === 'normal_envelhecida' || a.faixa === 'normal_recente')
    .sort((a, b) => b.scoreTotal - a.scoreTotal || a.ordem.id - b.ordem.id)

  const resultado: OrdemPriorizadaIa[] = []
  let idxUrg = 0
  let idxNorm = 0
  let seguidasUrgentes = 0

  while (idxUrg < urgentes.length || idxNorm < normais.length) {
    if (idxUrg < urgentes.length && (seguidasUrgentes < 3 || idxNorm >= normais.length)) {
      resultado.push(urgentes[idxUrg++])
      seguidasUrgentes += 1
    } else if (idxNorm < normais.length) {
      const normalItem = normais[idxNorm++]
      const anotada: OrdemPriorizadaIa =
        seguidasUrgentes >= 3
          ? {
              ...normalItem,
              motivoPrioridade: `${normalItem.motivoPrioridade} · Rodízio anti-pendência`,
            }
          : normalItem
      resultado.push(anotada)
      seguidasUrgentes = 0
    }
  }

  return resultado
}

export function escolherProteticoParaOrdem(
  ordem: OrdemProducao,
  cargaMin: Record<ProteticoId, number>,
): { protetico: ProteticoId; motivoAlocacao: string } {
  const texto = limparTexto(`${ordem.subetapa || ''} ${ordem.etapa || ''} ${ordem.servico || ''}`)

  let preferido: ProteticoId | null = null
  let motivoEspecialidade = ''

  if (
    texto.includes('montagem') ||
    texto.includes('protocolo') ||
    texto.includes('caracteriz') ||
    texto.includes('total') ||
    texto.includes('dentadura') ||
    texto.includes('coroa')
  ) {
    preferido = 'otavio'
    motivoEspecialidade = 'Especialidade Tavá (Estética/Protocolo/Montagem)'
  } else if (
    texto.includes('ppr') ||
    texto.includes('plano') ||
    texto.includes('moldeira') ||
    texto.includes('placa') ||
    texto.includes('consert') ||
    texto.includes('reparo') ||
    texto.includes('acabament') ||
    texto.includes('acriliz')
  ) {
    preferido = 'napoleao'
    motivoEspecialidade = 'Especialidade Napoleão (PPR/Planos/Placas/Acrilização)'
  }

  if (!preferido) {
    const escolhido: ProteticoId = cargaMin.otavio <= cargaMin.napoleao ? 'otavio' : 'napoleao'
    return {
      protetico: escolhido,
      motivoAlocacao: `Equilíbrio de carga (${escolhido === 'otavio' ? 'Tavá' : 'Napoleão'} com janela livre)`,
    }
  }

  const outro: ProteticoId = preferido === 'otavio' ? 'napoleao' : 'otavio'
  const sobrecarregado = cargaMin[preferido] >= 330 && cargaMin[preferido] - cargaMin[outro] >= 90
  const transferivel = !texto.includes('protocolo')

  if (sobrecarregado && transferivel) {
    return {
      protetico: outro,
      motivoAlocacao: `Redistribuído p/ ${outro === 'otavio' ? 'Tavá' : 'Napoleão'} (alívio de sobrecarga)`,
    }
  }

  return {
    protetico: preferido,
    motivoAlocacao: motivoEspecialidade,
  }
}

interface IntervaloMin {
  inicio: number
  fim: number
}

function colideIntervalo(a: IntervaloMin, b: IntervaloMin): boolean {
  return a.inicio < b.fim && b.inicio < a.fim
}

export function encontrarProximaJanelaLivre(
  ocupados: IntervaloMin[],
  duracaoMin: number,
  inicioMinimo = EXPEDIENTE_INICIO_MIN,
  fimLimite = EXPEDIENTE_FIM_MIN,
): IntervaloMin | null {
  const ordenado = [...ocupados].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim)
  let cursor = Math.max(EXPEDIENTE_INICIO_MIN, inicioMinimo)

  while (cursor + duracaoMin <= fimLimite) {
    // Pula intervalo do almoço (12:00–13:30)
    if (cursor < ALMOCO_FIM_MIN && cursor + duracaoMin > ALMOCO_INICIO_MIN) {
      cursor = ALMOCO_FIM_MIN
      continue
    }

    const candidato = { inicio: cursor, fim: cursor + duracaoMin }
    const conflito = ordenado.find((slot) => colideIntervalo(candidato, slot))
    if (!conflito) {
      return candidato
    }
    cursor = Math.max(cursor + 5, conflito.fim + INTERVALO_TRANSICAO_MIN)
  }

  return null
}

export interface BlocoPlanejadoIa {
  ordemId: number
  protetico: ProteticoId
  data: string
  horaInicio: string
  horaFim: string
  etapaNome: string
  modo: ModoBlocoTv
  equipamento: string | null
  duracaoPlanejadaMin: number
  arcadasQtd: number
  motivoIa: string
  ajusteTempoNota: string | null
  grupoSequenciaId: string | null
  faixaUrgencia: FaixaUrgencia
  scorePrioridade: number
}

export interface PlanoAgendaAutomaticoResultado {
  dataAlvo: string
  blocos: BlocoPlanejadoIa[]
  ordensAvaliadas: OrdemPriorizadaIa[]
  ordensNaoAlocadas: Array<{ ordemId: number; paciente: string; motivo: string }>
  perfisUsados: PerfilTempoProtetico[]
  resumo: {
    totalBlocos: number
    blocosOtavio: number
    blocosNapoleao: number
    urgentesAtendidas: number
    normaisPuxadas: number
    procedimentosAjustadosParaMenos: number
    procedimentosAjustadosParaMais: number
  }
}

export interface OverrideIaSugestao {
  ordemId: number
  protetico?: ProteticoId
  ordemLista?: number
  motivoExtra?: string
}

export function gerarPlanoAgendaAutomatico(params: {
  dataAlvo: string
  dataHoje: string
  horaMinAtual: number
  ordensNoLab: OrdemProducao[]
  blocosExistentesNoDia: BlocoAgendaTv[]
  historicoConcluidos: BlocoAgendaTv[]
  dividirAcrilizacao?: boolean
  overridesGemini?: OverrideIaSugestao[]
  ignorarBlocosAgendadosIa?: boolean
}): PlanoAgendaAutomaticoResultado {
  const perfisUsados = aprenderTemposProteticos(params.historicoConcluidos)
  const dividirAcrilizacao = params.dividirAcrilizacao ?? true

  // Determina blocos fixos já presentes no dia (sempre preserva em_andamento, concluido e manuais)
  const blocosPreservados = params.blocosExistentesNoDia.filter((b) => {
    if (b.status === 'em_andamento' || b.status === 'concluido') return true
    if (params.ignorarBlocosAgendadosIa && b.origemAgendamento === 'motor_ia') return false
    return true
  })

  const ordensJaNaAgenda = new Set(
    blocosPreservados
      .filter((b) => b.ordemId !== null && b.status !== 'concluido')
      .map((b) => b.ordemId as number),
  )

  const candidatas = params.ordensNoLab.filter(
    (o) => o.status !== 'Pausado' && !ordensJaNaAgenda.has(o.id),
  )

  let ordensAvaliadas = avaliarPrioridadesComAntiInanicao(candidatas, params.dataHoje)

  // Aplica ordenação refinada pela IA (se houver overrides válidos)
  const overrideMap = new Map<number, OverrideIaSugestao>()
  if (params.overridesGemini && params.overridesGemini.length > 0) {
    for (const ov of params.overridesGemini) {
      overrideMap.set(ov.ordemId, ov)
    }
    ordensAvaliadas = [...ordensAvaliadas].sort((a, b) => {
      const ovA = overrideMap.get(a.ordem.id)?.ordemLista ?? Number.MAX_SAFE_INTEGER
      const ovB = overrideMap.get(b.ordem.id)?.ordemLista ?? Number.MAX_SAFE_INTEGER
      if (ovA !== ovB) return ovA - ovB
      return 0
    })
  }

  const ocupadosBancada: Record<ProteticoId, IntervaloMin[]> = {
    otavio: [],
    napoleao: [],
  }
  const ocupadosMaquina: IntervaloMin[] = []

  for (const b of blocosPreservados) {
    if (b.status === 'concluido') continue
    const slot = { inicio: paraMinutos(b.horaInicio), fim: paraMinutos(b.horaFim) }
    if (b.modo === 'maquina') {
      ocupadosMaquina.push(slot)
    } else if (b.protetico in ocupadosBancada) {
      ocupadosBancada[b.protetico].push(slot)
    }
  }

  const cargaMin: Record<ProteticoId, number> = {
    otavio: ocupadosBancada.otavio.reduce((acc, s) => acc + (s.fim - s.inicio), 0),
    napoleao: ocupadosBancada.napoleao.reduce((acc, s) => acc + (s.fim - s.inicio), 0),
  }

  const ehHoje = params.dataAlvo === params.dataHoje
  const horaMinSegura = Number.isFinite(params.horaMinAtual) ? params.horaMinAtual : EXPEDIENTE_INICIO_MIN
  const inicioMinimoHoje = ehHoje
    ? Math.max(EXPEDIENTE_INICIO_MIN, Math.ceil(horaMinSegura / 5) * 5 + 5)
    : EXPEDIENTE_INICIO_MIN

  const blocosGerados: BlocoPlanejadoIa[] = []
  const ordensNaoAlocadas: Array<{ ordemId: number; paciente: string; motivo: string }> = []
  let urgentesAtendidas = 0
  let normaisPuxadas = 0
  const categoriasAjusteMenos = new Set<string>()
  const categoriasAjusteMais = new Set<string>()

  for (const item of ordensAvaliadas) {
    const { ordem } = item
    const ov = overrideMap.get(ordem.id)
    const escolha = ov?.protetico
      ? { protetico: ov.protetico, motivoAlocacao: ov.motivoExtra || 'Direcionado pela IA' }
      : escolherProteticoParaOrdem(ordem, cargaMin)

    const prot = escolha.protetico
    const etapaAtualTexto = (ordem.subetapa || ordem.etapa || ordem.servico || 'Execução em bancada').trim()
    const arcadas = Math.max(1, Math.min(2, Number(ordem.arcadas) || 1))
    const ehAcrilizacao = normalizarCategoriaProcedimento(etapaAtualTexto, ordem.servico, 'bancada') === 'acrilizacao_completa'

    if (ehAcrilizacao && dividirAcrilizacao) {
      const incInfo = obterDuracaoAdaptada({
        protetico: prot,
        etapaNome: 'Acrilização · Inclusão e Prensagem',
        servicoNome: ordem.servico,
        arcadas,
        modo: 'bancada',
        perfis: perfisUsados,
      })
      const polInfo = obterDuracaoAdaptada({
        protetico: prot,
        etapaNome: 'Acrilização · Polimerização',
        servicoNome: ordem.servico,
        arcadas,
        modo: 'maquina',
        perfis: perfisUsados,
      })
      const acabInfo = obterDuracaoAdaptada({
        protetico: prot,
        etapaNome: 'Acrilização · Desinclusão e Polimento',
        servicoNome: ordem.servico,
        arcadas,
        modo: 'bancada',
        perfis: perfisUsados,
      })

      const slotInclusao = encontrarProximaJanelaLivre(
        ocupadosBancada[prot],
        incInfo.duracaoMin,
        inicioMinimoHoje,
      )
      if (!slotInclusao) {
        ordensNaoAlocadas.push({
          ordemId: ordem.id,
          paciente: ordem.paciente,
          motivo: 'Sem janela livre hoje para Inclusão na bancada',
        })
        continue
      }

      // Panela começa logo após Inclusão sem ocupar a bancada
      const slotPanela = encontrarProximaJanelaLivre(
        ocupadosMaquina,
        polInfo.duracaoMin,
        slotInclusao.fim,
        EXPEDIENTE_FIM_MIN + 60,
      )
      if (!slotPanela) {
        ordensNaoAlocadas.push({
          ordemId: ordem.id,
          paciente: ordem.paciente,
          motivo: 'Panela Térmica ocupada até o fim do expediente',
        })
        continue
      }

      const slotAcab = encontrarProximaJanelaLivre(
        [...ocupadosBancada[prot], slotInclusao],
        acabInfo.duracaoMin,
        slotPanela.fim,
      )
      if (!slotAcab) {
        ordensNaoAlocadas.push({
          ordemId: ordem.id,
          paciente: ordem.paciente,
          motivo: 'Acabamento pós-panela ultrapassa 18:00',
        })
        continue
      }

      const seqId = `ia-seq-${params.dataAlvo}-${ordem.id}`
      ocupadosBancada[prot].push(slotInclusao, slotAcab)
      ocupadosMaquina.push(slotPanela)
      cargaMin[prot] += incInfo.duracaoMin + acabInfo.duracaoMin

      if (incInfo.tendencia === 'diminuiu') categoriasAjusteMenos.add(`${prot}:${incInfo.categoria}`)
      if (incInfo.tendencia === 'estendeu') categoriasAjusteMais.add(`${prot}:${incInfo.categoria}`)
      if (acabInfo.tendencia === 'diminuiu') categoriasAjusteMenos.add(`${prot}:${acabInfo.categoria}`)
      if (acabInfo.tendencia === 'estendeu') categoriasAjusteMais.add(`${prot}:${acabInfo.categoria}`)

      const motivoBase = `${item.motivoPrioridade} · ${escolha.motivoAlocacao}`

      blocosGerados.push(
        {
          ordemId: ordem.id,
          protetico: prot,
          data: params.dataAlvo,
          horaInicio: formatarMinutos(slotInclusao.inicio),
          horaFim: formatarMinutos(slotInclusao.fim),
          etapaNome: 'Acrilização · Inclusão e Prensagem',
          modo: 'bancada',
          equipamento: null,
          duracaoPlanejadaMin: incInfo.duracaoMin,
          arcadasQtd: arcadas,
          motivoIa: `${motivoBase} · ${incInfo.motivoDuracao}`,
          ajusteTempoNota: incInfo.tendencia !== 'estavel' ? incInfo.motivoDuracao : null,
          grupoSequenciaId: seqId,
          faixaUrgencia: item.faixa,
          scorePrioridade: item.scoreTotal,
        },
        {
          ordemId: ordem.id,
          protetico: prot,
          data: params.dataAlvo,
          horaInicio: formatarMinutos(slotPanela.inicio),
          horaFim: formatarMinutos(slotPanela.fim),
          etapaNome: 'Acrilização · Polimerização',
          modo: 'maquina',
          equipamento: 'Panela Térmica 1',
          duracaoPlanejadaMin: polInfo.duracaoMin,
          arcadasQtd: arcadas,
          motivoIa: 'Ciclo passivo na Panela (bancada liberada para outro paciente)',
          ajusteTempoNota: null,
          grupoSequenciaId: seqId,
          faixaUrgencia: item.faixa,
          scorePrioridade: item.scoreTotal,
        },
        {
          ordemId: ordem.id,
          protetico: prot,
          data: params.dataAlvo,
          horaInicio: formatarMinutos(slotAcab.inicio),
          horaFim: formatarMinutos(slotAcab.fim),
          etapaNome: 'Acrilização · Desinclusão e Polimento',
          modo: 'bancada',
          equipamento: null,
          duracaoPlanejadaMin: acabInfo.duracaoMin,
          arcadasQtd: arcadas,
          motivoIa: `${motivoBase} · ${acabInfo.motivoDuracao}`,
          ajusteTempoNota: acabInfo.tendencia !== 'estavel' ? acabInfo.motivoDuracao : null,
          grupoSequenciaId: seqId,
          faixaUrgencia: item.faixa,
          scorePrioridade: item.scoreTotal,
        },
      )

      if (item.faixa === 'critica' || item.faixa === 'urgente') urgentesAtendidas += 1
      else normaisPuxadas += 1
      continue
    }

    const durInfo = obterDuracaoAdaptada({
      protetico: prot,
      etapaNome: etapaAtualTexto,
      servicoNome: ordem.servico,
      arcadas,
      modo: 'bancada',
      perfis: perfisUsados,
    })

    const slot = encontrarProximaJanelaLivre(
      ocupadosBancada[prot],
      durInfo.duracaoMin,
      inicioMinimoHoje,
    )

    if (!slot) {
      // Tenta alocar no outro protético se ele ainda tiver janela livre e não for tarefa bloqueada
      const outro: ProteticoId = prot === 'otavio' ? 'napoleao' : 'otavio'
      const durOutro = obterDuracaoAdaptada({
        protetico: outro,
        etapaNome: etapaAtualTexto,
        servicoNome: ordem.servico,
        arcadas,
        modo: 'bancada',
        perfis: perfisUsados,
      })
      const slotOutro = encontrarProximaJanelaLivre(
        ocupadosBancada[outro],
        durOutro.duracaoMin,
        inicioMinimoHoje,
      )
      if (!slotOutro) {
        ordensNaoAlocadas.push({
          ordemId: ordem.id,
          paciente: ordem.paciente,
          motivo: 'Expediente completo nas duas bancadas hoje',
        })
        continue
      }

      ocupadosBancada[outro].push(slotOutro)
      cargaMin[outro] += durOutro.duracaoMin
      if (durOutro.tendencia === 'diminuiu') categoriasAjusteMenos.add(`${outro}:${durOutro.categoria}`)
      if (durOutro.tendencia === 'estendeu') categoriasAjusteMais.add(`${outro}:${durOutro.categoria}`)

      blocosGerados.push({
        ordemId: ordem.id,
        protetico: outro,
        data: params.dataAlvo,
        horaInicio: formatarMinutos(slotOutro.inicio),
        horaFim: formatarMinutos(slotOutro.fim),
        etapaNome: (ordem.subetapa || ordem.servico || 'Execução em bancada').trim() || 'Execução em bancada',
        modo: 'bancada',
        equipamento: null,
        duracaoPlanejadaMin: durOutro.duracaoMin,
        arcadasQtd: arcadas,
        motivoIa: `${item.motivoPrioridade} · Encaixe cruzado por agenda cheia · ${durOutro.motivoDuracao}`,
        ajusteTempoNota: durOutro.tendencia !== 'estavel' ? durOutro.motivoDuracao : null,
        grupoSequenciaId: null,
        faixaUrgencia: item.faixa,
        scorePrioridade: item.scoreTotal,
      })
      if (item.faixa === 'critica' || item.faixa === 'urgente') urgentesAtendidas += 1
      else normaisPuxadas += 1
      continue
    }

    ocupadosBancada[prot].push(slot)
    cargaMin[prot] += durInfo.duracaoMin
    if (durInfo.tendencia === 'diminuiu') categoriasAjusteMenos.add(`${prot}:${durInfo.categoria}`)
    if (durInfo.tendencia === 'estendeu') categoriasAjusteMais.add(`${prot}:${durInfo.categoria}`)

    blocosGerados.push({
      ordemId: ordem.id,
      protetico: prot,
      data: params.dataAlvo,
      horaInicio: formatarMinutos(slot.inicio),
      horaFim: formatarMinutos(slot.fim),
      etapaNome: (ordem.subetapa || ordem.servico || 'Execução em bancada').trim() || 'Execução em bancada',
      modo: 'bancada',
      equipamento: null,
      duracaoPlanejadaMin: durInfo.duracaoMin,
      arcadasQtd: arcadas,
      motivoIa: `${item.motivoPrioridade} · ${escolha.motivoAlocacao} · ${durInfo.motivoDuracao}`,
      ajusteTempoNota: durInfo.tendencia !== 'estavel' ? durInfo.motivoDuracao : null,
      grupoSequenciaId: null,
      faixaUrgencia: item.faixa,
      scorePrioridade: item.scoreTotal,
    })

    if (item.faixa === 'critica' || item.faixa === 'urgente') urgentesAtendidas += 1
    else normaisPuxadas += 1
  }

  return {
    dataAlvo: params.dataAlvo,
    blocos: blocosGerados,
    ordensAvaliadas,
    ordensNaoAlocadas,
    perfisUsados,
    resumo: {
      totalBlocos: blocosGerados.length,
      blocosOtavio: blocosGerados.filter((b) => b.protetico === 'otavio').length,
      blocosNapoleao: blocosGerados.filter((b) => b.protetico === 'napoleao').length,
      urgentesAtendidas,
      normaisPuxadas,
      procedimentosAjustadosParaMenos: categoriasAjusteMenos.size,
      procedimentosAjustadosParaMais: categoriasAjusteMais.size,
    },
  }
}

export interface BlocoRecalibradoPatch {
  id: number
  horaInicio: string
  horaFim: string
  ajusteTempoNota: string
}

export interface RecalibracaoResultado {
  deltaMin: number
  direcao: 'diminuiu' | 'estendeu' | 'no_prazo'
  blocosAtualizados: BlocoRecalibradoPatch[]
}

/**
 * Recalibra em cascata os próximos blocos pendentes de um protético no mesmo dia
 * quando um bloco termina mais rápido (diminuiu) ou passa do prazo (estendeu).
 * Respeita o almoço (12:00–13:30) e sequências ligadas (Inclusão -> Panela -> Polimento).
 */
export function recalibrarAgendaPorExecucao(params: {
  blocosDoDia: BlocoAgendaTv[]
  blocoAlteradoId: number
  novoFimMin: number
  inicioRealMin?: number
}): RecalibracaoResultado {
  const alvo = params.blocosDoDia.find((b) => b.id === params.blocoAlteradoId)
  if (!alvo) {
    return { deltaMin: 0, direcao: 'no_prazo', blocosAtualizados: [] }
  }

  const fimPlanejadoMin = paraMinutos(alvo.horaFim)
  const deltaMin = params.novoFimMin - fimPlanejadoMin
  const direcao: 'diminuiu' | 'estendeu' | 'no_prazo' =
    deltaMin >= 5 ? 'estendeu' : deltaMin <= -5 ? 'diminuiu' : 'no_prazo'

  if (direcao === 'no_prazo') {
    return { deltaMin, direcao, blocosAtualizados: [] }
  }

  const atualizados: BlocoRecalibradoPatch[] = []
  const horarioAlvoInicio = params.inicioRealMin ?? paraMinutos(alvo.horaInicio)

  // Ordena blocos pendentes do mesmo protético (bancada + sequência máquina vinculada)
  const ordenados = params.blocosDoDia
    .filter((b) => b.protetico === alvo.protetico && b.id !== alvo.id)
    .sort((a, b) => paraMinutos(a.horaInicio) - paraMinutos(b.horaInicio) || a.id - b.id)

  let cursorBancada = Math.max(horarioAlvoInicio + 5, params.novoFimMin + INTERVALO_TRANSICAO_MIN)

  // Se o alvo faz parte de uma sequência (ex: Inclusão -> Panela -> Polimento), ajusta a Panela vinculada
  let fimMaquinaVinculada: number | null = null
  if (alvo.grupoSequenciaId) {
    const maqVinculada = ordenados.find(
      (b) => b.grupoSequenciaId === alvo.grupoSequenciaId && b.modo === 'maquina' && b.status !== 'concluido',
    )
    if (maqVinculada) {
      const durMaq = Math.max(15, paraMinutos(maqVinculada.horaFim) - paraMinutos(maqVinculada.horaInicio))
      const novoIniMaq = params.novoFimMin
      const novoFimMaq = novoIniMaq + durMaq
      fimMaquinaVinculada = novoFimMaq
      if (novoIniMaq !== paraMinutos(maqVinculada.horaInicio)) {
        atualizados.push({
          id: maqVinculada.id,
          horaInicio: formatarMinutos(novoIniMaq),
          horaFim: formatarMinutos(novoFimMaq),
          ajusteTempoNota:
            direcao === 'estendeu'
              ? `Panela ajustada +${deltaMin}m (após inclusão)`
              : `Panela antecipada ${deltaMin}m (inclusão rápida)`,
        })
      }
    }
  }

  for (const bloco of ordenados) {
    if (bloco.modo === 'maquina') continue
    if (bloco.status !== 'agendado') {
      // Bloco em_andamento ou concluído vira âncora fixa para o cursor
      const ini = paraMinutos(bloco.horaInicio)
      const fim = paraMinutos(bloco.horaFim)
      if (fim > horarioAlvoInicio) {
        cursorBancada = Math.max(cursorBancada, fim + INTERVALO_TRANSICAO_MIN)
      }
      void ini
      continue
    }

    const iniAtual = paraMinutos(bloco.horaInicio)
    const fimAtual = paraMinutos(bloco.horaFim)
    const duracao = Math.max(15, fimAtual - iniAtual)

    // Ignora blocos que claramente pertenciam a antes do bloco alterado
    if (fimAtual <= horarioAlvoInicio) continue

    let pisoInicio = cursorBancada
    if (alvo.grupoSequenciaId && bloco.grupoSequenciaId === alvo.grupoSequenciaId && fimMaquinaVinculada !== null) {
      pisoInicio = Math.max(pisoInicio, fimMaquinaVinculada)
    }

    // Não empurrar para o horário do almoço (12:00–13:30)
    if (pisoInicio < ALMOCO_FIM_MIN && pisoInicio + duracao > ALMOCO_INICIO_MIN) {
      pisoInicio = ALMOCO_FIM_MIN
    }

    if (direcao === 'estendeu') {
      if (iniAtual < pisoInicio) {
        const novoFim = Math.min(EXPEDIENTE_FIM_MIN + 60, pisoInicio + duracao)
        atualizados.push({
          id: bloco.id,
          horaInicio: formatarMinutos(pisoInicio),
          horaFim: formatarMinutos(novoFim),
          ajusteTempoNota: `Empurrado +${deltaMin}m (prazo anterior estendeu)`,
        })
        cursorBancada = novoFim + INTERVALO_TRANSICAO_MIN
      } else {
        cursorBancada = Math.max(cursorBancada, fimAtual + INTERVALO_TRANSICAO_MIN)
      }
    } else {
      // Terminou mais rápido (diminuiu): puxa se houver folga significativa (>= 10 min)
      const economia = iniAtual - pisoInicio
      // Mantém almoço respeitado: só puxa através do almoço se realmente couber inteiro antes de 12:00
      const estavaDepoisAlmoco = iniAtual >= ALMOCO_FIM_MIN
      const cabeAntesAlmoco = pisoInicio + duracao <= ALMOCO_INICIO_MIN
      const podePuxar =
        economia >= 10 && (!estavaDepoisAlmoco || cabeAntesAlmoco || pisoInicio >= ALMOCO_FIM_MIN)

      if (podePuxar) {
        const novoFim = pisoInicio + duracao
        atualizados.push({
          id: bloco.id,
          horaInicio: formatarMinutos(pisoInicio),
          horaFim: formatarMinutos(novoFim),
          ajusteTempoNota: `Antecipado -${Math.abs(deltaMin)}m (bloco anterior terminou antes)`,
        })
        cursorBancada = novoFim + INTERVALO_TRANSICAO_MIN
      } else {
        cursorBancada = Math.max(cursorBancada, fimAtual + INTERVALO_TRANSICAO_MIN)
      }
    }
  }

  return {
    deltaMin,
    direcao,
    blocosAtualizados: atualizados,
  }
}
