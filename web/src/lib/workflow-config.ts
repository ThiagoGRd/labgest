// ============================================================
// workflow-config.ts — Fonte ÚNICA de Verdade para Etapas
// IDs canônicos curtos são gravados no banco.
// Labels são por contexto (lab vs portal).
// ============================================================

export type TipoWorkflow = 'protocolo' | 'protese_total' | 'parcial_removivel' | null

// ---- IDs Canônicos (o que vai no banco) ----
export const ETAPA_IDS = [
  'recebimento',
  'modelagem',
  'confeccao',
  'em_prova',
  'ajuste',
  'acabamento',
  'conferencia',
  'pronto',
  'entregue',
] as const

export type EtapaId = typeof ETAPA_IDS[number]

// ---- Mapeamento ID → Labels por contexto ----
export const ETAPA_LABELS: Record<EtapaId, { lab: string; portal: string }> = {
  recebimento: { lab: 'Recebimento',           portal: 'Recebido pelo laboratório' },
  modelagem:   { lab: 'Modelagem/Planejamento', portal: 'Em Planejamento' },
  confeccao:   { lab: 'Confecção/Impressão',    portal: 'Em Produção' },
  em_prova:    { lab: 'Em Prova (Clínica)',      portal: 'Aguardando sua avaliação 🧪' },
  ajuste:      { lab: 'Ajustes',                 portal: 'Em Ajuste' },
  acabamento:  { lab: 'Acabamento/Polimento',    portal: 'Finalizando' },
  conferencia: { lab: 'Conferência Final',       portal: 'Controle de Qualidade' },
  pronto:      { lab: 'Pronto p/ Entrega',       portal: 'Pronto! Aguardando retirada ✅' },
  entregue:    { lab: 'Entregue',                portal: 'Entregue ✓' },
}

/**
 * Retorna o label da etapa de acordo com o contexto.
 * Se o ID não for canônico (dados legados), retorna o valor original.
 */
export function etapaLabel(id: string, contexto: 'lab' | 'portal' = 'lab'): string {
  const entry = ETAPA_LABELS[id as EtapaId]
  if (entry) return entry[contexto]
  // Legado: retorna o valor bruto que veio do banco
  return id
}

/**
 * Normaliza um valor antigo do banco (string longa, ID do kanban antigo, etc.)
 * para o ID canônico equivalente. Usado na migração e no fallback de leitura.
 */
export function normalizarEtapa(valor: string): EtapaId {
  const v = valor.toLowerCase().trim()
  if (v === 'recebimento' || v.startsWith('recebimento')) return 'recebimento'
  if (v === 'modelagem' || v.includes('planejamento') || v.includes('delineamento')) return 'modelagem'
  if (v === 'impressão' || v === 'impressao' || v.includes('impressão') || v.includes('confecção') || v.includes('confeccao') || v.includes('fresagem') || v.includes('acriliza') || v.includes('estrutura metálica') || v.includes('estrutura/barra') || v.includes('rodete')) return 'confeccao'
  if (v === 'emprova' || v === 'em_prova' || v.includes('prova') ) return 'em_prova'
  if (v === 'ajuste' || v.includes('ajuste') || v.includes('remontagem')) return 'ajuste'
  if (v === 'acabamento' || v.includes('acabamento') || v.includes('polimento') || v.includes('montagem')) return 'acabamento'
  if (v === 'conferência' || v === 'conferencia' || v.includes('conferência') || v.includes('controle')) return 'conferencia'
  if (v === 'pronto' || v.includes('pronto para entrega') || v === 'finalizado') return 'pronto'
  if (v === 'entregue') return 'entregue'
  return 'recebimento' // fallback seguro
}

// ---- Sequência canônica de etapas no lab ----
export const SEQUENCIA_ETAPAS: EtapaId[] = [
  'recebimento',
  'modelagem',
  'confeccao',
  'em_prova',
  'ajuste',
  'acabamento',
  'conferencia',
  'pronto',
]

// Etapa final que aciona faturamento
export const ETAPA_FINAL: EtapaId = 'pronto'

// ---- Checklist de Registro Estético (para etapas de prova) ----

export interface ChecklistEstetico {
  fotoSorrisoFrontal: boolean
  fotoPerfil: boolean
  escaneamentoReferencia: boolean
  dvoVerificada: boolean
  formatoDenteDefinido: boolean
  corredorBucalOk: boolean
  linhaMediaOk: boolean
}

export const CHECKLIST_VAZIO: ChecklistEstetico = {
  fotoSorrisoFrontal: false,
  fotoPerfil: false,
  escaneamentoReferencia: false,
  dvoVerificada: false,
  formatoDenteDefinido: false,
  corredorBucalOk: false,
  linhaMediaOk: false,
}

export const CHECKLIST_LABELS: Record<keyof ChecklistEstetico, string> = {
  fotoSorrisoFrontal: 'Foto de Sorriso Frontal enviada',
  fotoPerfil: 'Foto de Perfil enviada',
  escaneamentoReferencia: 'Escaneamento de Referência (Provisório/Rodete)',
  dvoVerificada: 'DVO verificada',
  formatoDenteDefinido: 'Formato dos dentes definido',
  corredorBucalOk: 'Corredor bucal OK',
  linhaMediaOk: 'Linha média OK',
}

// ---- Funções utilitárias ----

/**
 * Detecta o tipo de workflow baseado no nome do serviço.
 * Retorna null para serviços com fluxo simples.
 */
export function getWorkflowForServico(servicoNome: string): TipoWorkflow {
  const nome = servicoNome.toLowerCase()
  if (nome.includes('protocolo')) return 'protocolo'
  if (nome.includes('total') && (nome.includes('prótese') || nome.includes('protese'))) return 'protese_total'
  if (nome.includes('parcial') || nome.includes('removível') || nome.includes('removivel') || nome.includes('ppr'))
    return 'parcial_removivel'
  return null
}

/** Etapas de prova por tipo de workflow (usadas para identificar se precisa de ciclo) */
export const ETAPAS_PROVA_DO_WORKFLOW: Record<string, EtapaId[]> = {
  protocolo:          ['em_prova'],
  protese_total:      ['em_prova'],
  parcial_removivel:  ['em_prova'],
}

export function isEtapaProva(tipoWorkflow: TipoWorkflow, etapaId: string): boolean {
  if (!tipoWorkflow) return false
  return (ETAPAS_PROVA_DO_WORKFLOW[tipoWorkflow] || []).includes(etapaId as EtapaId)
}

export function getNextEtapa(tipoWorkflow: TipoWorkflow, etapaAtual: string): string | null {
  // Para todos os workflows, usa a sequência canônica
  const etapaId = normalizarEtapa(etapaAtual)
  const idx = SEQUENCIA_ETAPAS.indexOf(etapaId)
  if (idx < 0 || idx >= SEQUENCIA_ETAPAS.length - 1) return null
  return SEQUENCIA_ETAPAS[idx + 1]
}

export function getRetornoEtapa(tipoWorkflow: TipoWorkflow, etapaAtual: string): string | null {
  const etapaId = normalizarEtapa(etapaAtual)
  const idx = SEQUENCIA_ETAPAS.indexOf(etapaId)
  if (idx <= 0) return null
  // Volta da prova para confeccao
  if (etapaId === 'em_prova') return 'confeccao'
  // Volta para etapa anterior
  return SEQUENCIA_ETAPAS[idx - 1]
}

export function getEtapas(tipoWorkflow: TipoWorkflow): string[] {
  // Todos os workflows usam a mesma sequência canônica
  return [...SEQUENCIA_ETAPAS]
}

export function getEtapaNome(etapa: string): string {
  return etapa
}

export function getEtapaIndex(tipoWorkflow: TipoWorkflow, etapa: string): number {
  const id = normalizarEtapa(etapa)
  return SEQUENCIA_ETAPAS.indexOf(id)
}

export function isChecklistCompleto(checklist: Partial<ChecklistEstetico>): boolean {
  return Object.keys(CHECKLIST_LABELS).every(key => checklist[key as keyof ChecklistEstetico] === true)
}

export function canAdvance(
  tipoWorkflow: TipoWorkflow,
  etapaAtual: string,
  checklistEstetico?: Partial<ChecklistEstetico>
): boolean {
  if (isEtapaProva(tipoWorkflow, etapaAtual)) {
    if (!checklistEstetico) return false
    return isChecklistCompleto(checklistEstetico)
  }
  return true
}

export function canReturn(tipoWorkflow: TipoWorkflow, etapaAtual: string): boolean {
  return getRetornoEtapa(tipoWorkflow, etapaAtual) !== null
}

export function getWorkflowLabel(tipoWorkflow: TipoWorkflow): string {
  const labels: Record<string, string> = {
    protocolo: 'Protocolo sobre Implante',
    protese_total: 'Prótese Total',
    parcial_removivel: 'Parcial Removível (PPR)',
  }
  return tipoWorkflow ? labels[tipoWorkflow] || 'Fluxo Padrão' : 'Fluxo Padrão'
}

export function getProgresso(tipoWorkflow: TipoWorkflow, etapaAtual: string): number {
  const id = normalizarEtapa(etapaAtual)
  const idx = SEQUENCIA_ETAPAS.indexOf(id)
  if (idx < 0) return 0
  return Math.round((idx / (SEQUENCIA_ETAPAS.length - 1)) * 100)
}

// Compat: mantém EtapaConfig para código legado
export interface EtapaConfig {
  nome: string
  isProva: boolean
  retornoIndex?: number
}
