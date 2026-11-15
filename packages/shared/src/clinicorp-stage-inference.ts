import { FLUXOS_PROTESE, getFluxoProtese, type PassoProtese, type TipoProteseId } from './prosthesis-workflows'
import { normalizarNome, somarDias, MARGEM_INICIO_DIAS, type ConsultaClinica, type StatusConsulta } from './treatment-control'
import type { EtapaId } from './workflow'

export interface ConsultaResumoInferencia {
  id: string
  data: string
  hora: string | null
  status: StatusConsulta
  categoria: string | null
  observacoes: string | null
  dentista: string | null
}

export interface ResultadoInferenciaClinicorp {
  passoSugeridoId: string | null
  passoSugeridoNome: string | null
  macroetapaSugerida: EtapaId | null
  confianca: 'alta' | 'media' | 'baixa'
  motivo: string
  divergente: boolean
  ultimaConsulta: ConsultaResumoInferencia | null
  proximaConsulta: ConsultaResumoInferencia | null
  consultasRealizadas: number
}

interface RegraKeyword {
  regex: RegExp
  passosAlvo: readonly string[]
  descricao: string
}

const REGRAS_CLINICAS: readonly RegraKeyword[] = [
  {
    regex: /\b(entrega|instala(?:cao|r|do)?|cimenta(?:cao|r|do)?|alta\s+protese|finaliz)\b/,
    passosAlvo: ['entrega_clinica'],
    descricao: 'Entrega / Instalação',
  },
  {
    regex: /\b(prova\s*(?:dos?|de)?\s*dente|prova\s*estet|prova\s*em\s*cera|prova\s*funcional|prova\s*barra|prova\s*estrutura|prova\s*coping)\b/,
    passosAlvo: ['prova_dentes'],
    descricao: 'Prova dos dentes / estrutura',
  },
  {
    regex: /\b(prova\s*(?:do|de)?\s*plano|plano\s*de\s*orienta|plano\s*de\s*cera|rolete|dvo|registro\s*(?:de)?\s*mordida|relacao\s*maxilo)\b/,
    passosAlvo: ['prova_plano_orientacao'],
    descricao: 'Prova do plano / registro',
  },
  {
    regex: /\b(acriliz|prensag|polimeriz)\b/,
    passosAlvo: ['acrilizacao'],
    descricao: 'Acrilização',
  },
  {
    regex: /\b(montag(?:em)?\s*(?:dos?)?\s*dente)\b/,
    passosAlvo: ['montagem_dentes'],
    descricao: 'Montagem dos dentes',
  },
  {
    regex: /\b(escan(?:eamento)?\s*pos|pos\s*cirurg|cirurg(?:ia)?\s*(?:de)?\s*protocolo|carga\s*imediata)\b/,
    passosAlvo: ['escaneamento_pos_cirurgia'],
    descricao: 'Escaneamento pós-cirurgia',
  },
  {
    regex: /\b(escan(?:eamento)?\s*pre|pre\s*cirurg)\b/,
    passosAlvo: ['escaneamento_pre_cirurgia'],
    descricao: 'Escaneamento pré-cirurgia',
  },
  {
    regex: /\b(moldag(?:em)?\s*(?:de)?\s*trabalho|moldag(?:em)?\s*funcional|moldeira\s*individual)\b/,
    passosAlvo: ['moldagem_trabalho'],
    descricao: 'Moldagem de trabalho / funcional',
  },
  {
    regex: /\b(moldag(?:em)?\s*(?:de)?\s*estudo|molde\s*inicial|alginato)\b/,
    passosAlvo: ['moldagem_estudo'],
    descricao: 'Moldagem de estudo',
  },
  {
    regex: /\b(escaneamento|scanner|intraoral|moldagem|molde)\b/,
    passosAlvo: ['escaneamento_digital', 'moldagem_trabalho', 'moldagem_estudo', 'etapa_clinica_inicial'],
    descricao: 'Moldagem / Escaneamento',
  },
  {
    regex: /\b(prova|experimentar|provar)\b/,
    passosAlvo: ['prova_dentes', 'prova_plano_orientacao'],
    descricao: 'Prova clínica',
  },
]

function normalizarTexto(valor: string | null | undefined) {
  return normalizarNome(valor)
}

function resumirConsulta(c: ConsultaClinica): ConsultaResumoInferencia {
  return {
    id: c.id,
    data: c.data,
    hora: c.hora ?? null,
    status: c.status,
    categoria: c.categoria ?? null,
    observacoes: c.observacoes ?? null,
    dentista: c.dentista ?? null,
  }
}

function buscarIndicePassoPorTexto(
  textoCombinado: string,
  passos: readonly PassoProtese[],
): { indice: number; descricao: string } | null {
  const limpo = normalizarTexto(textoCombinado)
  if (!limpo) return null
  for (const regra of REGRAS_CLINICAS) {
    if (!regra.regex.test(limpo)) continue
    for (const alvo of regra.passosAlvo) {
      const idx = passos.findIndex((p) => p.id === alvo)
      if (idx >= 0) return { indice: idx, descricao: regra.descricao }
    }
  }
  return null
}

function formatarDataBr(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return dia && mes && ano ? `${dia}/${mes}` : iso
}

/**
 * Infere a etapa atual do fluxo da prótese cruzando a agenda do Clinicorp
 * (categoria, observações/notas, comparecimentos e agendamentos futuros)
 * com a sequência de passos clínicos e laboratoriais do tipo da prótese.
 */
export function inferirEtapaClinicorp(entrada: {
  tipoWorkflow: TipoProteseId
  passoFluxoAtual: string | null | undefined
  dataPedido: string
  hoje: string
  consultas: ConsultaClinica[]
  localizacaoAtual?: string | null
}): ResultadoInferenciaClinicorp {
  const fluxo = getFluxoProtese(entrada.tipoWorkflow)
  const passos = fluxo.passos
  const de = somarDias(entrada.dataPedido.slice(0, 10), -MARGEM_INICIO_DIAS)

  const ordenadas = [...entrada.consultas]
    .filter((c) => c.data >= de)
    .sort((a, b) => (a.data + (a.hora ?? '99:99')).localeCompare(b.data + (b.hora ?? '99:99')))

  const naoFora = ordenadas.filter((c) => {
    const cat = normalizarTexto(c.categoria)
    return !/botox|clareamento|ortodon|profilaxia|limpeza|harmoniza/.test(cat)
  })

  const realizadas = naoFora.filter(
    (c) => c.status === 'compareceu' || (c.status === 'agendado' && c.data < entrada.hoje),
  )
  const futuras = naoFora.filter((c) => c.status !== 'faltou' && c.data >= entrada.hoje)
  const ultimaRealizada = realizadas.length > 0 ? realizadas[realizadas.length - 1] : null
  const proxima = futuras.length > 0 ? futuras[0] : null

  const idxAtual = entrada.passoFluxoAtual
    ? passos.findIndex((p) => p.id === entrada.passoFluxoAtual)
    : -1

  // 1. Tenta casar palavras-chave na última consulta realizada (categoria + observações)
  if (ultimaRealizada) {
    const texto = `${ultimaRealizada.categoria ?? ''} ${ultimaRealizada.observacoes ?? ''}`
    const match = buscarIndicePassoPorTexto(texto, passos)
    if (match) {
      const passoRealizado = passos[match.indice]
      // Se o paciente já compareceu a uma etapa clínica que NÃO é entrega final,
      // a peça deve avançar para o próximo passo do laboratório (ex: pós-prova de dentes -> acrilização)
      const alvoIndice = passoRealizado.entregaFinal
        ? match.indice
        : passoRealizado.responsavel === 'clinica' && match.indice + 1 < passos.length
          ? match.indice + 1
          : match.indice
      const passoSugerido = passos[alvoIndice]
      const divergente = idxAtual < 0 || alvoIndice > idxAtual
      return {
        passoSugeridoId: passoSugerido.id,
        passoSugeridoNome: passoSugerido.nome,
        macroetapaSugerida: passoSugerido.macroetapa,
        confianca: 'alta',
        motivo: `Consulta ${formatarDataBr(ultimaRealizada.data)} (${ultimaRealizada.status === 'compareceu' ? 'Compareceu' : 'Realizada'}) · ${match.descricao} → ${passoSugerido.nome}`,
        divergente,
        ultimaConsulta: resumirConsulta(ultimaRealizada),
        proximaConsulta: proxima ? resumirConsulta(proxima) : null,
        consultasRealizadas: realizadas.length,
      }
    }
  }

  // 2. Tenta casar palavras-chave na próxima consulta futura agendada
  if (proxima) {
    const textoFuturo = `${proxima.categoria ?? ''} ${proxima.observacoes ?? ''}`
    const matchFuturo = buscarIndicePassoPorTexto(textoFuturo, passos)
    if (matchFuturo) {
      // Se há consulta futura de "Prova dos dentes", o lab deve estar preparando o passo imediatamente anterior (ou o próprio se for clínico inicial)
      const alvoIndice = matchFuturo.indice > 0 && passos[matchFuturo.indice].responsavel === 'clinica'
        ? matchFuturo.indice - 1
        : matchFuturo.indice
      const passoSugerido = passos[alvoIndice]
      const divergente = idxAtual < 0 || alvoIndice > idxAtual
      return {
        passoSugeridoId: passoSugerido.id,
        passoSugeridoNome: passoSugerido.nome,
        macroetapaSugerida: passoSugerido.macroetapa,
        confianca: 'alta',
        motivo: `Agendado ${formatarDataBr(proxima.data)} (${matchFuturo.descricao}) → Preparar: ${passoSugerido.nome}`,
        divergente,
        ultimaConsulta: ultimaRealizada ? resumirConsulta(ultimaRealizada) : null,
        proximaConsulta: resumirConsulta(proxima),
        consultasRealizadas: realizadas.length,
      }
    }
  }

  // 3. Fallback por contagem de consultas realizadas vs. passos clínicos do fluxo
  if (realizadas.length > 0) {
    const indicesClinicos = passos
      .map((p, idx) => (p.responsavel === 'clinica' && !p.entregaFinal ? idx : -1))
      .filter((idx) => idx >= 0)

    const n = Math.min(realizadas.length, Math.max(1, indicesClinicos.length))
    const ultimoClinicoIdx = indicesClinicos[n - 1] ?? 0
    const alvoIndice = Math.min(passos.length - 1, ultimoClinicoIdx + 1)
    const passoSugerido = passos[alvoIndice]
    const divergente = idxAtual < 0 || alvoIndice > idxAtual

    return {
      passoSugeridoId: passoSugerido.id,
      passoSugeridoNome: passoSugerido.nome,
      macroetapaSugerida: passoSugerido.macroetapa,
      confianca: 'media',
      motivo: `${realizadas.length} consulta(s) realizada(s) no Clinicorp (última em ${formatarDataBr(ultimaRealizada!.data)}) → Estimado: ${passoSugerido.nome}`,
      divergente,
      ultimaConsulta: resumirConsulta(ultimaRealizada!),
      proximaConsulta: proxima ? resumirConsulta(proxima) : null,
      consultasRealizadas: realizadas.length,
    }
  }

  return {
    passoSugeridoId: null,
    passoSugeridoNome: null,
    macroetapaSugerida: null,
    confianca: 'baixa',
    motivo: proxima
      ? `Próxima consulta em ${formatarDataBr(proxima.data)}${proxima.categoria ? ` (${proxima.categoria})` : ''}`
      : 'Sem consultas registradas no Clinicorp neste período',
    divergente: false,
    ultimaConsulta: null,
    proximaConsulta: proxima ? resumirConsulta(proxima) : null,
    consultasRealizadas: 0,
  }
}

export interface OrdemCandidataDuplicata {
  id: number
  nomePaciente: string
  cpfPaciente?: string | null
  clienteId?: number | null
  clienteNome: string
  servicoNome: string
  status: string | null
  valor: number
  arcadas?: number
  elementos?: string | null
  corDentes?: string | null
  dataEntrega: string
  tipoWorkflow?: string | null
  passoFluxoAtual?: string | null
  etapaAtual?: string | null
}

export interface GrupoDuplicataOrdem {
  chave: string
  paciente: string
  clienteNome: string
  ordens: OrdemCandidataDuplicata[]
  ordemPrincipalId: number
  ordensSecundariasIds: number[]
  servicoCombinado: string
  valorTotal: number
}

const STATUS_ENCERRADOS_DUPLICATA = new Set(['Finalizado', 'Entregue', 'Cancelado'])

/**
 * Agrupa ordens ativas duplicadas do mesmo paciente/clínica
 * (ex: Superior + Inferior em OS separadas, ou Prótese Total Sup + Protocolo Inf).
 */
export function agruparOrdensDuplicadas(ordens: OrdemCandidataDuplicata[]): GrupoDuplicataOrdem[] {
  const mapa = new Map<string, OrdemCandidataDuplicata[]>()

  for (const ordem of ordens) {
    if (ordem.status && STATUS_ENCERRADOS_DUPLICATA.has(ordem.status)) continue
    const cpfLimpo = (ordem.cpfPaciente ?? '').replace(/\D/g, '')
    const nomeNorm = normalizarNome(ordem.nomePaciente)
    if (!nomeNorm && cpfLimpo.length !== 11) continue
    const clienteChave = ordem.clienteId ? `cli:${ordem.clienteId}` : `clinome:${normalizarNome(ordem.clienteNome)}`
    const chave = cpfLimpo.length === 11
      ? `cpf:${cpfLimpo}::${clienteChave}`
      : `nome:${nomeNorm}::${clienteChave}`
    const lista = mapa.get(chave) ?? []
    lista.push(ordem)
    mapa.set(chave, lista)
  }

  const grupos: GrupoDuplicataOrdem[] = []
  for (const [chave, lista] of mapa.entries()) {
    if (lista.length < 2) continue
    // Prioriza manter a OS com etapa mais avançada (ou a menor id = mais antiga)
    const ordenadas = [...lista].sort((a, b) => {
      const temFluxoA = a.passoFluxoAtual ? 1 : 0
      const temFluxoB = b.passoFluxoAtual ? 1 : 0
      if (temFluxoA !== temFluxoB) return temFluxoB - temFluxoA
      return a.id - b.id
    })
    const principal = ordenadas[0]
    const secundarias = ordenadas.slice(1)
    const servicosFormatados = ordenadas.map((o) => {
      const elem = o.elementos?.trim()
      return elem ? `${o.servicoNome} (${elem})` : o.servicoNome
    })
    grupos.push({
      chave,
      paciente: principal.nomePaciente,
      clienteNome: principal.clienteNome,
      ordens: ordenadas,
      ordemPrincipalId: principal.id,
      ordensSecundariasIds: secundarias.map((s) => s.id),
      servicoCombinado: [...new Set(servicosFormatados)].join(' + ').slice(0, 250),
      valorTotal: ordenadas.reduce((acc, o) => acc + Number(o.valor || 0), 0),
    })
  }

  return grupos.sort((a, b) => b.ordens.length - a.ordens.length || a.ordemPrincipalId - b.ordemPrincipalId)
}

const PESO_COMPLEXIDADE_PROTESE: Record<TipoProteseId, number> = {
  protocolo_definitivo: 100,
  protocolo_carga_imediata: 90,
  ppr_com_estrutura: 80,
  protese_total_removivel: 70,
  ppr_sem_estrutura: 60,
  provisorio_digital: 50,
  placa_bruxismo: 40,
  placa_contencao: 30,
  placa_clareamento: 20,
  conserto_geral: 10,
}

export function escolherFluxoPrincipal(tipos: Array<TipoProteseId | null | undefined>): TipoProteseId | null {
  const validos = tipos.filter((t): t is TipoProteseId => Boolean(t && t in FLUXOS_PROTESE))
  if (validos.length === 0) return null
  return [...validos].sort((a, b) => (PESO_COMPLEXIDADE_PROTESE[b] ?? 0) - (PESO_COMPLEXIDADE_PROTESE[a] ?? 0))[0]
}
