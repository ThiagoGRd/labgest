import type { EtapaId } from './workflow'

export const TIPOS_PROTESE = [
  'protese_total_removivel',
  'ppr_com_estrutura',
  'ppr_sem_estrutura',
  'protocolo_carga_imediata',
  'protocolo_definitivo',
  'placa_bruxismo',
  'provisorio_digital',
  'placa_contencao',
  'placa_clareamento',
  'conserto_geral',
] as const

export type TipoProteseId = (typeof TIPOS_PROTESE)[number]
export type ResponsavelPasso = 'clinica' | 'laboratorio' | 'fornecedor'

export interface RegraPrazoPasso {
  horas?: number
  porArcada?: boolean
  corrido?: boolean
  diasCorridos?: number
}

export interface PassoProtese {
  id: string
  nome: string
  responsavel: ResponsavelPasso
  macroetapa: EtapaId
  prazo?: RegraPrazoPasso
  prova?: boolean
  entregaFinal?: boolean
}

export interface FluxoProtese {
  id: TipoProteseId
  nome: string
  nomeCurto: string
  passos: readonly PassoProtese[]
}

const clinica = (id: string, nome: string, macroetapa: EtapaId = 'em_prova', extra: Partial<PassoProtese> = {}): PassoProtese => ({
  id, nome, responsavel: 'clinica', macroetapa, ...extra,
})
const lab = (id: string, nome: string, horas: number, extra: Partial<PassoProtese> = {}): PassoProtese => ({
  id, nome, responsavel: 'laboratorio', macroetapa: 'confeccao', prazo: { horas }, ...extra,
})
const prova = (id: string, nome: string): PassoProtese => clinica(id, nome, 'em_prova', { prova: true })
const entrega = (): PassoProtese => clinica('entrega_clinica', 'Entrega ao paciente', 'pronto', { entregaFinal: true })

export const FLUXOS_PROTESE: Record<TipoProteseId, FluxoProtese> = {
  protese_total_removivel: {
    id: 'protese_total_removivel', nome: 'Prótese total removível', nomeCurto: 'Total removível', passos: [
      clinica('moldagem_estudo', 'Moldagem de estudo', 'recebimento'),
      { id: 'recebimento_lab', nome: 'Recebimento no laboratório', responsavel: 'laboratorio', macroetapa: 'recebimento' },
      lab('moldeira_individual', 'Confecção da moldeira individual', 1, { prazo: { horas: 1, porArcada: true } }),
      clinica('moldagem_trabalho', 'Moldagem de trabalho'),
      lab('plano_orientacao', 'Confecção do plano de orientação', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_plano_orientacao', 'Prova do plano de orientação'),
      lab('montagem_dentes', 'Montagem dos dentes', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_dentes', 'Prova dos dentes'),
      lab('acrilizacao', 'Acrilização', 24, { macroetapa: 'acabamento', prazo: { horas: 24, corrido: true } }),
      entrega(),
    ],
  },
  ppr_com_estrutura: {
    id: 'ppr_com_estrutura', nome: 'Prótese parcial removível com estrutura', nomeCurto: 'PPR com estrutura', passos: [
      clinica('moldagem_trabalho', 'Moldagem de trabalho', 'recebimento'),
      { id: 'estrutura_externa', nome: 'Estrutura com fornecedor externo', responsavel: 'fornecedor', macroetapa: 'confeccao', prazo: { diasCorridos: 15 } },
      lab('plano_orientacao', 'Confecção do plano de orientação', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_plano_orientacao', 'Prova do plano de orientação'),
      lab('montagem_dentes', 'Montagem dos dentes', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_dentes', 'Prova dos dentes'),
      lab('acrilizacao', 'Acrilização', 24, { macroetapa: 'acabamento', prazo: { horas: 24, corrido: true } }),
      entrega(),
    ],
  },
  ppr_sem_estrutura: {
    id: 'ppr_sem_estrutura', nome: 'Prótese parcial removível sem estrutura', nomeCurto: 'PPR sem estrutura', passos: [
      clinica('moldagem_trabalho', 'Moldagem de trabalho', 'recebimento'),
      lab('plano_orientacao', 'Confecção do plano de orientação', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_plano_orientacao', 'Prova do plano de orientação'),
      lab('montagem_dentes', 'Montagem dos dentes', 1, { prazo: { horas: 1, porArcada: true } }),
      prova('prova_dentes', 'Prova dos dentes'),
      lab('acrilizacao', 'Acrilização', 24, { macroetapa: 'acabamento', prazo: { horas: 24, corrido: true } }),
      entrega(),
    ],
  },
  protocolo_carga_imediata: {
    id: 'protocolo_carga_imediata', nome: 'Protocolo provisório de carga imediata', nomeCurto: 'Carga imediata', passos: [
      clinica('escaneamento_pre_cirurgia', 'Escaneamento pré-cirurgia', 'recebimento'),
      clinica('escaneamento_pos_cirurgia', 'Escaneamento pós-cirurgia', 'recebimento'),
      lab('confeccao_protocolo', 'Confecção do protocolo provisório', 8, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
  protocolo_definitivo: {
    id: 'protocolo_definitivo', nome: 'Protocolo definitivo', nomeCurto: 'Protocolo definitivo', passos: [
      clinica('escaneamento_digital', 'Escaneamento digital', 'recebimento'),
      lab('planejamento_digital', 'Planejamento digital', 5, { macroetapa: 'modelagem' }),
      lab('montagem_dentes', 'Montagem dos dentes', 5),
      prova('prova_dentes', 'Prova dos dentes'),
      lab('acrilizacao', 'Acrilização', 24, { macroetapa: 'acabamento', prazo: { horas: 24, corrido: true } }),
      entrega(),
    ],
  },
  placa_bruxismo: {
    id: 'placa_bruxismo', nome: 'Placa de bruxismo', nomeCurto: 'Bruxismo', passos: [
      clinica('escaneamento_digital', 'Escaneamento digital', 'recebimento'),
      lab('confeccao_placa', 'Confecção da placa de bruxismo', 8, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
  provisorio_digital: {
    id: 'provisorio_digital', nome: 'Unitário provisório digital', nomeCurto: 'Provisório digital', passos: [
      clinica('escaneamento_digital', 'Escaneamento digital', 'recebimento'),
      lab('confeccao_provisorio', 'Confecção do provisório digital', 3, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
  placa_contencao: {
    id: 'placa_contencao', nome: 'Placa de contenção estética', nomeCurto: 'Contenção', passos: [
      clinica('moldagem_trabalho', 'Moldagem de trabalho', 'recebimento'),
      lab('confeccao_placa', 'Confecção da placa de contenção', 3, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
  placa_clareamento: {
    id: 'placa_clareamento', nome: 'Placa de clareamento', nomeCurto: 'Clareamento', passos: [
      clinica('moldagem_trabalho', 'Moldagem de trabalho', 'recebimento'),
      lab('confeccao_placa', 'Confecção da placa de clareamento', 3, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
  conserto_geral: {
    id: 'conserto_geral', nome: 'Consertos gerais', nomeCurto: 'Consertos', passos: [
      clinica('etapa_clinica_inicial', 'Avaliação e envio clínico', 'recebimento'),
      lab('execucao_conserto', 'Execução do conserto', 3, { macroetapa: 'acabamento' }),
      entrega(),
    ],
  },
}

export function isTipoProtese(valor: string | null | undefined): valor is TipoProteseId {
  return Boolean(valor && (TIPOS_PROTESE as readonly string[]).includes(valor))
}

export function getFluxoProtese(tipo: TipoProteseId) {
  return FLUXOS_PROTESE[tipo]
}

export function getPassoProtese(tipo: TipoProteseId, passoId: string | null | undefined) {
  const fluxo = getFluxoProtese(tipo)
  return fluxo.passos.find((passo) => passo.id === passoId) ?? fluxo.passos[0]
}

export function getProximoPassoProtese(tipo: TipoProteseId, passoId: string) {
  const passos = getFluxoProtese(tipo).passos
  const indice = passos.findIndex((passo) => passo.id === passoId)
  return indice >= 0 ? passos[indice + 1] ?? null : passos[0]
}

export function getPassoLaboratorialAnterior(tipo: TipoProteseId, passoId: string) {
  const passos = getFluxoProtese(tipo).passos
  const indice = passos.findIndex((passo) => passo.id === passoId)
  for (let i = indice - 1; i >= 0; i -= 1) {
    if (passos[i].responsavel === 'laboratorio') return passos[i]
  }
  return null
}

export function inferirTipoProtese(servicoNome: string, legado?: string | null): TipoProteseId | null {
  const nome = servicoNome.toLowerCase()
  if (nome.includes('clareamento')) return 'placa_clareamento'
  if (nome.includes('contenção') || nome.includes('contencao')) return 'placa_contencao'
  if (nome.includes('brux') || nome.includes('miorrelax')) return 'placa_bruxismo'
  if (nome.includes('conserto') || nome.includes('reparo')) return 'conserto_geral'
  if (nome.includes('carga imediata') || nome.includes('provis') && nome.includes('protocolo')) return 'protocolo_carga_imediata'
  if (nome.includes('provis') || nome === 'unitário' || nome === 'unitario') return 'provisorio_digital'
  if (nome.includes('protocolo') || legado === 'protocolo') return 'protocolo_definitivo'
  if ((nome.includes('parcial') || nome.includes('ppr')) && nome.includes('sem estrutura')) return 'ppr_sem_estrutura'
  if (nome.includes('parcial') || nome.includes('ppr') || legado === 'parcial_removivel') return 'ppr_com_estrutura'
  if (nome.includes('total') || legado === 'protese_total') return 'protese_total_removivel'
  return null
}

export function calcularPrazoPasso(inicio: Date, passo: PassoProtese, arcadas = 1) {
  const regra = passo.prazo
  if (!regra) return null
  if (regra.diasCorridos) return new Date(inicio.getTime() + regra.diasCorridos * 86400000)
  const horas = (regra.horas ?? 0) * (regra.porArcada ? Math.max(1, Math.min(2, arcadas)) : 1)
  if (regra.corrido) return new Date(inicio.getTime() + horas * 3600000)
  return adicionarHorasExpediente(inicio, horas)
}

// Maceió usa UTC-3 sem horário de verão. O cálculo ocorre na linha do tempo local.
export function adicionarHorasExpediente(inicio: Date, horas: number) {
  const deslocamento = 3 * 3600000
  let local = new Date(inicio.getTime() - deslocamento)
  let restante = horas

  while (restante > 0) {
    const dia = local.getUTCDay()
    const inicioHora = dia === 6 ? 8 : 8
    const fimHora = dia === 6 ? 13 : dia === 0 ? 0 : 18
    const inicioDia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), inicioHora)
    const fimDia = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), fimHora)

    if (dia === 0 || local.getTime() >= fimDia) {
      local = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 8))
      continue
    }
    if (local.getTime() < inicioDia) local = new Date(inicioDia)

    const disponivel = (fimDia - local.getTime()) / 3600000
    const consumir = Math.min(restante, disponivel)
    local = new Date(local.getTime() + consumir * 3600000)
    restante -= consumir
    if (restante > 0) local = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 8))
  }

  return new Date(local.getTime() + deslocamento)
}

export function statusParaPassoProtese(passo: PassoProtese) {
  if (passo.entregaFinal) return 'Finalizado'
  if (passo.responsavel === 'clinica' && passo.macroetapa !== 'recebimento') return 'Em Prova'
  if (passo.macroetapa === 'recebimento') return 'Aguardando'
  return 'Em Produção'
}
