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

const CAMPOS_LISTA = ['professionals', 'users', 'data', 'items', 'result'] as const
const CAMPOS_ID_PROF = ['PersonId', 'personId', 'ProfessionalId', 'professionalId', 'Dentist_PersonId', 'UserId', 'userId', 'id', 'Id'] as const
const CAMPOS_NOME_PROF = ['Name', 'name', 'FullName', 'fullName', 'ProfessionalName', 'professionalName', 'PersonName', 'personName', 'UserName', 'userName', 'DisplayName', 'displayName', 'Apelido', 'apelido'] as const

function extrairLista(corpo: unknown, fallbackKey?: string): Record<string, unknown>[] {
  if (Array.isArray(corpo)) return corpo as Record<string, unknown>[]
  if (!corpo || typeof corpo !== 'object') return []
  const obj = corpo as Record<string, unknown>
  if (fallbackKey && Array.isArray(obj[fallbackKey])) return obj[fallbackKey] as Record<string, unknown>[]
  for (const chave of CAMPOS_LISTA) {
    if (Array.isArray(obj[chave])) return obj[chave] as Record<string, unknown>[]
  }
  return []
}

/** Extrai mapa de ID -> nome a partir de respostas de /professional/list_all_professionals ou /security/list_users. */
export function extrairMapaProfissionais(corpo: unknown, mapa = new Map<string, string>()): Map<string, string> {
  for (const item of extrairLista(corpo)) {
    if (!item || typeof item !== 'object') continue
    let nome: string | null = null
    for (const campo of CAMPOS_NOME_PROF) {
      nome = texto(item[campo])
      if (nome) break
    }
    if (!nome) continue
    const limpo = nome.slice(0, 255)
    for (const campo of CAMPOS_ID_PROF) {
      const id = texto(item[campo])
      if (id && !mapa.has(id)) mapa.set(id, limpo)
    }
  }
  return mapa
}

/** Converte um item cru de /appointment/list. Retorna null para itens excluídos ou sem data/paciente. */
export function converterConsulta(
  item: Record<string, unknown>,
  profissionais?: ReadonlyMap<string, string>,
): ConsultaClinicorp | null {
  if (!item || item.Deleted) return null
  const id = texto(item.id)
  const data = typeof item.date === 'string' ? item.date.slice(0, 10) : ''
  const pacienteNome = texto(item.PatientName) ?? texto(item.Name)
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !pacienteNome) return null

  const dentistaId = texto(item.Dentist_PersonId) ?? texto(item.ProfessionalId) ?? texto(item.DentistId)
  const dentistaObj = (item.Dentist ?? item.Professional) as Record<string, unknown> | undefined
  const nomeInline = texto(item.DentistName)
    ?? texto(item.Dentist_PersonName)
    ?? texto(item.ProfessionalName)
    ?? texto(item.DoctorName)
    ?? (dentistaObj ? texto(dentistaObj.Name) ?? texto(dentistaObj.name) : null)
  const dentistaNome = (nomeInline ?? (dentistaId ? profissionais?.get(dentistaId) ?? null : null))?.slice(0, 255) ?? null

  return {
    clinicorpId: id,
    pacienteNome: pacienteNome.slice(0, 255),
    data,
    horaInicio: hora(item.fromTime),
    horaFim: hora(item.toTime),
    status: mapearStatus(item.StatusId),
    dentistaId,
    dentistaNome,
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

/**
 * Busca o cadastro de profissionais e usuários do Clinicorp para traduzir `Dentist_PersonId` em nome.
 * É tolerante a falhas: se um endpoint não responder, segue com o que estiver disponível.
 */
export async function listarProfissionais(): Promise<Map<string, string>> {
  const cfg = configuracao()
  const mapa = new Map<string, string>()
  if (!cfg) return mapa

  const endpoints = ['/professional/list_all_professionals', '/security/list_users']
  const resultados = await Promise.allSettled(
    endpoints.map(async (caminho) => {
      const parametros = new URLSearchParams({ subscriber_id: cfg.assinante })
      const resposta = await fetch(`${cfg.url}${caminho}?${parametros}`, {
        headers: { Authorization: cfg.autorizacao, 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })
      if (!resposta.ok) return null
      return resposta.json()
    }),
  )

  for (const res of resultados) {
    if (res.status === 'fulfilled' && res.value) extrairMapaProfissionais(res.value, mapa)
  }
  return mapa
}

const CONCORRENCIA_JANELAS = 4

/** Lê a agenda da clínica inteira no período junto com o mapa de profissionais. */
export async function buscarAgendaCompleta(
  de: string,
  ate: string,
): Promise<{ consultas: ConsultaClinicorp[]; profissionais: Map<string, string> }> {
  const cfg = configuracao()
  if (!cfg) throw new Error('Clinicorp não configurado')

  const profissionaisPromise = listarProfissionais()
  const janelas = janelasMensais(de, ate)
  const itensBrutos: Record<string, unknown>[] = []

  for (let i = 0; i < janelas.length; i += CONCORRENCIA_JANELAS) {
    const lote = janelas.slice(i, i + CONCORRENCIA_JANELAS)
    const respostas = await Promise.all(
      lote.map(async (janela) => {
        const parametros = new URLSearchParams({ subscriber_id: cfg.assinante, from: janela.de, to: janela.ate })
        const resposta = await fetch(`${cfg.url}/appointment/list?${parametros}`, {
          headers: { Authorization: cfg.autorizacao, 'Content-Type': 'application/json' },
          cache: 'no-store',
          signal: AbortSignal.timeout(25_000),
        })
        if (!resposta.ok) throw new Error(`Clinicorp respondeu ${resposta.status} para ${janela.de}..${janela.ate}`)
        const corpo: unknown = await resposta.json()
        return extrairLista(corpo, 'appointments')
      }),
    )
    for (const itens of respostas) itensBrutos.push(...itens)
  }

  const profissionais = await profissionaisPromise
  const porId = new Map<string, ConsultaClinicorp>()
  for (const item of itensBrutos) {
    const consulta = converterConsulta(item, profissionais)
    if (consulta) porId.set(consulta.clinicorpId, consulta)
  }
  return { consultas: [...porId.values()], profissionais }
}

/** Lê a agenda da clínica inteira no período. Lança erro se qualquer janela falhar. */
export async function listarConsultas(de: string, ate: string): Promise<ConsultaClinicorp[]> {
  const { consultas } = await buscarAgendaCompleta(de, ate)
  return consultas
}
