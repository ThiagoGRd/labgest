import { inferirTipoProtese, type TipoProteseId } from '@labgest/shared'

export interface CandidatoClinicorp {
  nome: string
  cpf?: string | null
  dentista?: string | null
  dataConsultaIso?: string | null
  origem: 'clinicorp' | 'ordem_existente'
}

export interface CandidatoConciliado extends CandidatoClinicorp {
  score: number
  nomeFonetico: string
  motivoMatch: string
}

export interface DadosExtraidosGrupoOs {
  pacienteExtraido: string
  dentistaExtraido: string
  servicoExtraido: string
  corExtraida: string
  elementosExtraidos: string
  tipoProteseInferido: TipoProteseId | 'geral'
  observacoes: string
}

export interface ItemTriagemWhatsappOs {
  id: number
  criadoEm: string
  remetenteNome: string
  remetenteTelefone: string
  grupoJid: string
  textoOriginal: string
  arquivosStl: string[]
  pacienteExtraido: string
  pacienteSugerido: string
  cpfSugerido: string
  scoreConciliacao: number
  origemConciliacao: 'clinicorp' | 'ordem_existente' | 'manual'
  motivoConciliacao: string
  dentistaSugerido: string
  servicoSugerido: string
  corSugerida: string
  elementosSugeridos: string
  tipoProtese: TipoProteseId | 'geral'
  status: 'pendente' | 'aprovada' | 'descartada'
  ordemGeradaId?: number | null
}

const STOPWORDS_NOME = new Set(['da', 'de', 'do', 'dos', 'das', 'e', 'pac', 'paciente', 'sr', 'sra', 'dr', 'dra'])

export function limparNomeBase(valor: string): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizarTokenFoneticoPtBr(token: string): string {
  return token
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/ch|sh/g, 'x')
    .replace(/y/g, 'i')
    .replace(/w/g, 'v')
    .replace(/k/g, 'c')
    .replace(/qu([ei])/g, 'c$1')
    .replace(/ge|gi/g, (m) => `j${m[1]}`)
    .replace(/ce|ci/g, (m) => `s${m[1]}`)
    .replace(/ss/g, 's')
    .replace(/z$/g, 's')
    .replace(/([a-z])\1+/g, '$1')
}

export function normalizarFoneticoPtBr(nome: string): string {
  const limpo = limparNomeBase(nome)
  if (!limpo) return ''
  const tokens = limpo
    .split(' ')
    .filter((t) => t.length > 0 && !STOPWORDS_NOME.has(t))
    .map(normalizarTokenFoneticoPtBr)
  return tokens.join(' ')
}

export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  const curr = new Array<number>(b.length + 1).fill(0)

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + custo,
      )
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j]
  }
  return prev[b.length]
}

export function similaridadeNomes(nomeA: string, nomeB: string): number {
  const fonA = normalizarFoneticoPtBr(nomeA)
  const fonB = normalizarFoneticoPtBr(nomeB)
  if (!fonA || !fonB) return 0
  if (fonA === fonB) return 100

  const maxLen = Math.max(fonA.length, fonB.length)
  const distGlobal = distanciaLevenshtein(fonA, fonB)
  const simGlobal = Math.max(0, 1 - distGlobal / maxLen) * 100

  const tokensA = fonA.split(' ').filter(Boolean)
  const tokensB = fonB.split(' ').filter(Boolean)
  if (tokensA.length === 0 || tokensB.length === 0) return Math.round(simGlobal)

  // Primeiro nome tem peso alto na identificação clínica
  const distPrimeiro = distanciaLevenshtein(tokensA[0], tokensB[0])
  const simPrimeiro = Math.max(0, 1 - distPrimeiro / Math.max(tokensA[0].length, tokensB[0].length))

  let somaTokens = 0
  for (const tA of tokensA) {
    let melhorToken = 0
    for (const tB of tokensB) {
      if (tA === tB) {
        melhorToken = 1
        break
      }
      // Abreviação tipo "M" ou "S" batendo com inicial
      if (tA.length === 1 && tB.startsWith(tA)) {
        melhorToken = Math.max(melhorToken, 0.85)
        continue
      }
      if (tB.length === 1 && tA.startsWith(tB)) {
        melhorToken = Math.max(melhorToken, 0.85)
        continue
      }
      const d = distanciaLevenshtein(tA, tB)
      const s = Math.max(0, 1 - d / Math.max(tA.length, tB.length))
      if (s > melhorToken) melhorToken = s
    }
    somaTokens += melhorToken
  }

  const coberturaA = somaTokens / tokensA.length
  const combinado = simPrimeiro * 40 + coberturaA * 45 + (simGlobal / 100) * 15
  return Math.min(100, Math.round(combinado))
}

export function conciliarPacienteClinicorp(
  nomeInformado: string,
  candidatos: CandidatoClinicorp[],
  dentistaInformado?: string,
): {
  melhorMatch: CandidatoConciliado | null
  alternativas: CandidatoConciliado[]
  corrigidoAutomaticamente: boolean
} {
  if (!nomeInformado.trim() || candidatos.length === 0) {
    return { melhorMatch: null, alternativas: [], corrigidoAutomaticamente: false }
  }

  const dentistaFon = dentistaInformado ? normalizarFoneticoPtBr(dentistaInformado) : ''
  const avaliados = new Map<string, CandidatoConciliado>()

  for (const cand of candidatos) {
    if (!cand.nome?.trim()) continue
    const baseScore = similaridadeNomes(nomeInformado, cand.nome)
    if (baseScore < 55) continue

    let bonus = 0
    const motivos: string[] = []

    if (baseScore === 100 && limparNomeBase(nomeInformado) !== limparNomeBase(cand.nome)) {
      motivos.push('Grafia fonética equivalente')
    } else if (baseScore >= 85) {
      motivos.push(`Similaridade ${baseScore}%`)
    }

    if (cand.origem === 'clinicorp' && cand.dataConsultaIso) {
      bonus += 6
      motivos.push(`Agenda Clinicorp (${cand.dataConsultaIso.slice(8, 10)}/${cand.dataConsultaIso.slice(5, 7)})`)
    }

    if (dentistaFon && cand.dentista) {
      const simDentista = similaridadeNomes(dentistaInformado!, cand.dentista)
      if (simDentista >= 75) {
        bonus += 5
        motivos.push(`Mesmo dentista (${cand.dentista})`)
      }
    }

    const scoreFinal = Math.min(100, baseScore + bonus)
    const chave = limparNomeBase(cand.nome)
    const existente = avaliados.get(chave)
    if (!existente || scoreFinal > existente.score) {
      avaliados.set(chave, {
        ...cand,
        score: scoreFinal,
        nomeFonetico: normalizarFoneticoPtBr(cand.nome),
        motivoMatch: motivos.join(' · ') || `Similaridade ${scoreFinal}%`,
      })
    }
  }

  const ordenados = [...avaliados.values()].sort((a, b) => b.score - a.score)
  const melhorMatch = ordenados[0] ?? null
  const corrigidoAutomaticamente = Boolean(
    melhorMatch &&
    melhorMatch.score >= 76 &&
    limparNomeBase(melhorMatch.nome) !== limparNomeBase(nomeInformado),
  )

  return {
    melhorMatch: melhorMatch && melhorMatch.score >= 70 ? melhorMatch : null,
    alternativas: ordenados.slice(0, 4),
    corrigidoAutomaticamente,
  }
}

const CORES_VITA = /\b(A1|A2|A3\.5|A3|A4|B1|B2|B3|B4|C1|C2|C3|C4|D2|D3|D4|BL1|BL2|BL3|BL4|OM1|OM2|OM3)\b/i

export function extrairDadosMensagemGrupoOs(
  textoMensagem: string,
  nomeArquivoStl?: string,
): DadosExtraidosGrupoOs {
  const texto = (textoMensagem || '').trim()
  const arquivoBase = (nomeArquivoStl || '')
    .split('/')
    .pop()
    ?.replace(/\.stl$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim() || ''

  let paciente = ''
  let dentista = ''
  let servico = ''
  let cor = ''
  let elementos = ''

  // 1. Tenta extrair por rótulos explícitos ("Paciente: ...", "Dentista: ...", "Serviço: ...")
  const matchPac = texto.match(/(?:pac(?:iente)?|nome)\s*[:\-]\s*([^\n,;•|]+)/i)
  if (matchPac) paciente = matchPac[1].trim()

  const matchDent = texto.match(/(?:dentista|dr\(a\)?\.?|doutor(?:a)?|profissional|clinica|clínica)\s*[:\-]\s*([^\n,;•|]+)/i)
  if (matchDent) dentista = matchDent[1].trim()

  const matchServ = texto.match(/(?:servi[cç]o|trabalho|pr[oó]tese|pe[cç]a|pedido)\s*[:\-]\s*([^\n,;•|]+)/i)
  if (matchServ) servico = matchServ[1].trim()

  const matchCor = texto.match(/(?:cor|escala)\s*[:\-]?\s*(A1|A2|A3\.5|A3|A4|B1|B2|B3|B4|C1|C2|C3|C4|D2|D3|D4|BL[1-4]|OM[1-3])/i)
    || texto.match(CORES_VITA)
    || arquivoBase.match(CORES_VITA)
  if (matchCor) cor = matchCor[1].toUpperCase()

  const matchElem = texto.match(/(?:dentes?|elem(?:entos?)?|regi[aã]o)\s*[:\-]?\s*([0-9,\s/eEaoAO\-]+|sup(?:erior)?|inf(?:erior)?|total)/i)
  if (matchElem) elementos = matchElem[1].trim()

  // 2. Se não tinha rótulo "Paciente:", tenta formato separado por traço/linha ("Maria Silva - Dr João - Protocolo")
  if (!paciente && texto) {
    const linhas = texto
      .split(/\n|\s+[-–—|]\s+/)
      .map((l) => l.trim())
      .filter(Boolean)

    for (const parte of linhas) {
      if (!dentista && /^(dr\.?|dra\.?|doutor|doutora)\s+/i.test(parte)) {
        dentista = parte
        continue
      }
      if (!servico && /(protocolo|pr[oó]tese|total|ppr|coroa|zirc[oô]nia|placa|faceta|lente|onlay|inlay|provis[oó]rio|barra)/i.test(parte)) {
        servico = parte
        continue
      }
      if (!paciente && /^[a-záàâãéêíóôõúç\s]{4,50}$/i.test(parte) && !/^(bom dia|boa tarde|boa noite|segue|arquivo|stl)/i.test(parte)) {
        paciente = parte.replace(/^(os|pedido)\s+/i, '').trim()
      }
    }
  }

  // 3. Fallback pelo nome do arquivo .STL ("Maria_Silva_Protocolo_Superior.stl")
  if (!paciente && arquivoBase) {
    const limpoArquivo = arquivoBase
      .replace(/\b(superior|inferior|sup|inf|stl|scan|escaneamento|arcada|mordida|antagonista|preparo)\b/gi, '')
      .replace(CORES_VITA, '')
      .replace(/\b\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (limpoArquivo.length >= 3) {
      paciente = limpoArquivo
    }
  }

  if (!servico) {
    const fonteServico = `${texto} ${arquivoBase}`
    if (/protocolo/i.test(fonteServico)) servico = 'Prótese Tipo Protocolo'
    else if (/ppr|parcial remov/i.test(fonteServico)) servico = 'PPR (Parcial Removível)'
    else if (/total|dentadura/i.test(fonteServico)) servico = 'Prótese Total'
    else if (/zirc[oô]nia|coroa|faceta|lente|onlay|inlay/i.test(fonteServico)) servico = 'Coroa em Zircônia / CAD-CAM'
    else if (/placa|bruxismo|miorrelaxante/i.test(fonteServico)) servico = 'Placa Miorrelaxante'
    else if (nomeArquivoStl) servico = 'Trabalho Digital (.STL)'
  }

  const tipoInferido = inferirTipoProtese(`${servico} ${texto} ${arquivoBase}`)

  return {
    pacienteExtraido: paciente || 'Paciente não identificado',
    dentistaExtraido: dentista,
    servicoExtraido: servico || 'Serviço Digital / Prótese',
    corExtraida: cor,
    elementosExtraidos: elementos,
    tipoProteseInferido: tipoInferido || 'geral',
    observacoes: texto || (nomeArquivoStl ? `Arquivo recebido no grupo: ${nomeArquivoStl}` : ''),
  }
}
