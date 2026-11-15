// Cliente somente-leitura da agenda do Clinicorp.
// Mesmo endpoint e mesmos códigos de status já usados no CRM ClinPrime
// (supabase/functions/clinicorp-agenda). O LabGest nunca cria nem altera
// nada no Clinicorp: apenas lê a agenda.

import type { StatusConsulta } from '@labgest/shared'

export interface ConsultaClinicorp {
  clinicorpId: string
  pacienteNome: string
  data: string
  horaInicio: string | null
  horaFim: string | null
  status: StatusConsulta
  dentistaId: string | null
  dentistaNome: string | null
  categoria: string | null
  observacoes: string | null
}

const ST_COMPARECEU = new Set(['5042370073067520', '5859874752167936', '5989519816392704', '4998570332127232'])
const ST_FALTOU = new Set(['6239752731230208'])

export function mapearStatus(statusId: unknown): StatusConsulta {
  const id = String(statusId ?? '')
  if (ST_COMPARECEU.has(id)) return 'compareceu'
  if (ST_FALTOU.has(id)) return 'faltou'
  return 'agendado'
}

function configuracao() {
  const url = process.env.CLINICORP_URL?.replace(/\/+$/, '')
  const assinante = process.env.CLINICORP_SUBSCRIBER
  const autorizacao = process.env.CLINICORP_AUTH
  return url && assinante && autorizacao ? { url, assinante, autorizacao } : null
}

export function clinicorpConfigurado() {
  return configuracao() !== null
}

const texto = (valor: unknown) => {
  const limpo = typeof valor === 'string' ? valor.trim() : typeof valor === 'number' ? String(valor) : ''
  return limpo || null
}
const hora = (valor: unknown) => (typeof valor === 'string' && /^\d{1,2}:\d{2}/.test(valor) ? valor.slice(0, 5).padStart(5, '0') : null)

/** Converte um item cru de /appointment/list. Retorna null para itens excluídos ou sem data/paciente. */
export function converterConsulta(item: Record<string, unknown>): ConsultaClinicorp | null {
  if (!item || item.Deleted) return null
  const id = texto(item.id)
  const data = typeof item.date === 'string' ? item.date.slice(0, 10) : ''
  const pacienteNome = texto(item.PatientName) ?? texto(item.Name)
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !pacienteNome) return null
  return {
    clinicorpId: id,
    pacienteNome: pacienteNome.slice(0, 255),
    data,
    horaInicio: hora(item.fromTime),
    horaFim: hora(item.toTime),
    status: mapearStatus(item.StatusId),
    dentistaId: texto(item.Dentist_PersonId),
    // O nome do profissional não aparece no código do CRM; tentamos os campos usuais.
    dentistaNome: (texto(item.DentistName) ?? texto(item.Dentist_PersonName) ?? texto(item.ProfessionalName))?.slice(0, 255) ?? null,
    categoria: texto(item.CategoryDescription)?.slice(0, 255) ?? null,
    observacoes: texto(item.Notes),
  }
}

/** Divide o período em janelas de até 31 dias (o Clinicorp é consultado mês a mês). */
export function janelasMensais(de: string, ate: string) {
  const janelas: Array<{ de: string; ate: string }> = []
  const fim = Date.parse(`${ate}T00:00:00Z`)
  let cursor = Date.parse(`${de}T00:00:00Z`)
  while (cursor <= fim) {
    const limite = Math.min(fim, cursor + 30 * 86_400_000)
    janelas.push({ de: new Date(cursor).toISOString().slice(0, 10), ate: new Date(limite).toISOString().slice(0, 10) })
    cursor = limite + 86_400_000
  }
  return janelas
}

/** Lê a agenda da clínica inteira no período. Lança erro se qualquer janela falhar. */
export async function listarConsultas(de: string, ate: string): Promise<ConsultaClinicorp[]> {
  const cfg = configuracao()
  if (!cfg) throw new Error('Clinicorp não configurado')

  const porId = new Map<string, ConsultaClinicorp>()
  for (const janela of janelasMensais(de, ate)) {
    const parametros = new URLSearchParams({ subscriber_id: cfg.assinante, from: janela.de, to: janela.ate })
    const resposta = await fetch(`${cfg.url}/appointment/list?${parametros}`, {
      headers: { Authorization: cfg.autorizacao, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    })
    if (!resposta.ok) throw new Error(`Clinicorp respondeu ${resposta.status} para ${janela.de}..${janela.ate}`)
    const corpo: unknown = await resposta.json()
    const itens = Array.isArray(corpo) ? corpo : (corpo as { appointments?: unknown[] })?.appointments ?? []
    for (const item of itens) {
      const consulta = converterConsulta(item as Record<string, unknown>)
      if (consulta) porId.set(consulta.clinicorpId, consulta)
    }
  }
  return [...porId.values()]
}
