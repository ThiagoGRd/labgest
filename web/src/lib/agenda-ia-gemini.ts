import { GoogleGenerativeAI } from '@google/generative-ai'
import { normalizarProteticoId } from '@/lib/agenda-tv'
import type {
  OrdemPriorizadaIa,
  OverrideIaSugestao,
  PerfilTempoProtetico,
  PlanoAgendaAutomaticoResultado,
} from '@/lib/agenda-ia'

export interface EstrategiaIaResultado {
  motor: 'gemini' | 'algoritmico'
  briefingTurno: string
  alertasIa: string[]
  overrides: OverrideIaSugestao[]
}

export function gerarBriefingDeterministico(plano: PlanoAgendaAutomaticoResultado): EstrategiaIaResultado {
  const { resumo, perfisUsados, ordensNaoAlocadas } = plano

  const diminuiram = perfisUsados.filter((p) => p.tendencia === 'diminuiu')
  const estenderam = perfisUsados.filter((p) => p.tendencia === 'estendeu')

  const partes: string[] = []
  if (resumo.totalBlocos === 0) {
    partes.push('Nenhuma nova ordem pendente coube ou precisou ser adicionada nas janelas livres deste dia.')
  } else {
    partes.push(
      `Motor programou ${resumo.totalBlocos} bloco(s) (${resumo.blocosOtavio} p/ Tavá, ${resumo.blocosNapoleao} p/ Napoleão), atendendo ${resumo.urgentesAtendidas} urgente(s) e puxando ${resumo.normaisPuxadas} ordem(ns) da fila normal para não ficarem paradas.`,
    )
  }

  if (diminuiram.length > 0) {
    const exemplo = diminuiram[0]
    const nome = exemplo.protetico === 'otavio' ? 'Tavá' : 'Napoleão'
    partes.push(
      `Ritmo acelerado detectado: ${nome} reduziu ${Math.abs(exemplo.desvioMin)}m em ${exemplo.categoriaLabel} (ajustado para ${exemplo.duracaoSugeridaMin}m).`,
    )
  }

  if (estenderam.length > 0) {
    const exemplo = estenderam[0]
    const nome = exemplo.protetico === 'otavio' ? 'Tavá' : 'Napoleão'
    partes.push(
      `Margem ampliada: ${nome} estendeu +${exemplo.desvioMin}m em ${exemplo.categoriaLabel} (agenda recalibrada para ${exemplo.duracaoSugeridaMin}m).`,
    )
  }

  const alertas: string[] = []
  if (ordensNaoAlocadas.length > 0) {
    alertas.push(
      `${ordensNaoAlocadas.length} ordem(ns) excederam a capacidade das duas bancadas hoje e seguem no topo para amanhã.`,
    )
  }

  return {
    motor: 'algoritmico',
    briefingTurno: partes.join(' '),
    alertasIa: alertas,
    overrides: [],
  }
}

export async function refinarEstrategiaComGemini(params: {
  dataAlvo: string
  ordensAvaliadas: OrdemPriorizadaIa[]
  perfis: PerfilTempoProtetico[]
  planoBase: PlanoAgendaAutomaticoResultado
  usarGemini?: boolean
}): Promise<EstrategiaIaResultado> {
  const deterministico = gerarBriefingDeterministico(params.planoBase)

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || params.usarGemini === false || params.ordensAvaliadas.length === 0) {
    return deterministico
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const topOrdens = params.ordensAvaliadas.slice(0, 14).map((o, idx) => ({
      ordemId: o.ordem.id,
      posicaoAtual: idx + 1,
      paciente: o.ordem.paciente,
      servico: o.ordem.servico,
      etapa: o.ordem.subetapa || o.ordem.etapa,
      prioridade: o.ordem.prioridade,
      faixa: o.faixa,
      diasNaFila: o.diasNaFila,
      diasVencidosTotal: o.diasVencidosTotal,
      clinicorpConsulta: o.ordem.clinicorpEtapa?.proximaConsulta ?? null,
      motivoBase: o.motivoPrioridade,
    }))

    const perfisResumo = params.perfis.map((p) => ({
      protetico: p.protetico,
      procedimento: p.categoriaLabel,
      tempoBaseMin: p.tempoBaseMin,
      tempoAprendidoMin: p.duracaoSugeridaMin,
      tendencia: p.tendencia,
      amostras: p.amostras,
    }))

    const prompt = `
Você é o Coordenador de Produção de um Laboratório de Prótese Dentária com 2 protéticos:
- "otavio" (Tavá): especialista em Montagem Estética, Protocolo e Caracterização.
- "napoleao" (Napoleão): especialista em PPR, Plano de Orientação, Moldeira, Placas, Consertos e Acabamento/Acrilização.

Data da agenda: ${params.dataAlvo}.
Regras obrigatórias:
1. Priorizar Clinicorp próximo, retornos da clínica e urgentes/vencidas.
2. NÃO deixar ordens normais recém-chegadas ou antigas presas para sempre (manter rodízio justo).
3. Respeitar os tempos reais aprendidos (quem diminuiu tempo ganha janela menor; quem estendeu ganha margem).

ORDENS CANDIDATAS (ordenadas pelo score):
${JSON.stringify(topOrdens)}

TEMPOS REAIS APRENDIDOS:
${JSON.stringify(perfisResumo)}

RESUMO DO PLANO BASE:
${JSON.stringify(params.planoBase.resumo)}

Retorne APENAS JSON válido:
{
  "briefingTurno": "Resumo executivo em 2 frases diretas em pt-BR explicando as prioridades, o equilíbrio da fila e ajustes de tempo reais.",
  "alertasIa": ["Alerta curto opcional se houver gargalo ou risco Clinicorp"],
  "ajustes": [
    { "ordemId": 123, "protetico": "otavio", "ordemLista": 1, "motivoExtra": "Motivo curto em 5 palavras" }
  ]
}
Obs: "ajustes" só deve incluir ordens da lista acima se você recomendar alterar ordem ou protético. Caso o plano base já esteja ótimo, retorne "ajustes": [].
`

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timeout Gemini Agenda')), 2500)
    })
    const result = await Promise.race([model.generateContent(prompt), timeout])
    const raw = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(raw) as {
      briefingTurno?: unknown
      alertasIa?: unknown
      ajustes?: Array<{ ordemId?: unknown; protetico?: unknown; ordemLista?: unknown; motivoExtra?: unknown }>
    }

    const idsValidos = new Set(params.ordensAvaliadas.map((o) => o.ordem.id))
    const overrides: OverrideIaSugestao[] = []

    if (Array.isArray(parsed.ajustes)) {
      for (const aj of parsed.ajustes) {
        const oid = typeof aj.ordemId === 'number' ? aj.ordemId : Number(aj.ordemId)
        if (!Number.isInteger(oid) || !idsValidos.has(oid)) continue
        const prot = typeof aj.protetico === 'string' ? normalizarProteticoId(aj.protetico) : null
        const ordemListaNum = typeof aj.ordemLista === 'number' ? aj.ordemLista : Number(aj.ordemLista)
        overrides.push({
          ordemId: oid,
          protetico: prot ?? undefined,
          ordemLista: Number.isFinite(ordemListaNum) ? ordemListaNum : undefined,
          motivoExtra: typeof aj.motivoExtra === 'string' ? aj.motivoExtra.slice(0, 120) : undefined,
        })
      }
    }

    return {
      motor: 'gemini',
      briefingTurno:
        typeof parsed.briefingTurno === 'string' && parsed.briefingTurno.trim()
          ? parsed.briefingTurno.trim()
          : deterministico.briefingTurno,
      alertasIa: Array.isArray(parsed.alertasIa)
        ? parsed.alertasIa.filter((a): a is string => typeof a === 'string' && a.trim().length > 0).slice(0, 3)
        : deterministico.alertasIa,
      overrides,
    }
  } catch {
    return deterministico
  } finally {
    if (timer) clearTimeout(timer)
  }
}
