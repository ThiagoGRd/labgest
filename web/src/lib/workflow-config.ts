// ============================================================
// workflow-config.ts — Configuração do Workflow de Etapas
// Controla o fluxo de ida e volta para Protocolo, Prótese Total
// e Parcial Removível.
// ============================================================

export type TipoWorkflow = 'protocolo' | 'protese_total' | 'parcial_removivel' | null

export interface EtapaConfig {
  nome: string
  /** Essa etapa é uma "prova" que exige checklist estético? */
  isProva: boolean
  /** Se reprovada, volta para qual índice? (null = etapa anterior) */
  retornoIndex?: number
}

// ---- Etapas por tipo de workflow ----

export const WORKFLOW_ETAPAS: Record<string, EtapaConfig[]> = {
  protocolo: [
    { nome: 'Recebimento (Scanner + Fotos)', isProva: false },
    { nome: 'Planejamento Digital', isProva: false },
    { nome: 'Confecção da Estrutura/Barra', isProva: false },
    { nome: 'Prova da Estrutura', isProva: true, retornoIndex: 2 },
    { nome: 'Montagem dos Dentes', isProva: false },
    { nome: 'Prova Estética', isProva: true, retornoIndex: 4 },
    { nome: 'Acrilização / Fresagem Final', isProva: false },
    { nome: 'Acabamento / Polimento', isProva: false },
    { nome: 'Conferência Final', isProva: false },
    { nome: 'Pronto para Entrega', isProva: false },
  ],
  protese_total: [
    { nome: 'Recebimento (Moldagem/Scanner + Fotos)', isProva: false },
    { nome: 'Confecção de Rodete / Base de Prova', isProva: false },
    { nome: 'Registro de Oclusão (DVO + Linha Média)', isProva: true },
    { nome: 'Montagem dos Dentes', isProva: false },
    { nome: 'Prova em Cera', isProva: true, retornoIndex: 3 },
    { nome: 'Acrilização', isProva: false },
    { nome: 'Acabamento / Remontagem', isProva: false },
    { nome: 'Conferência Final', isProva: false },
    { nome: 'Pronto para Entrega', isProva: false },
  ],
  parcial_removivel: [
    { nome: 'Recebimento (Modelo/Scanner)', isProva: false },
    { nome: 'Delineamento', isProva: false },
    { nome: 'Confecção da Estrutura Metálica', isProva: false },
    { nome: 'Prova da Estrutura', isProva: true, retornoIndex: 2 },
    { nome: 'Montagem dos Dentes', isProva: false },
    { nome: 'Prova Estética', isProva: true, retornoIndex: 4 },
    { nome: 'Acrilização', isProva: false },
    { nome: 'Acabamento / Polimento', isProva: false },
    { nome: 'Conferência Final', isProva: false },
    { nome: 'Pronto para Entrega', isProva: false },
  ],
}

/** Etapas do fluxo simples (outros serviços) */
export const ETAPAS_SIMPLES = [
  'Recebimento',
  'Modelagem',
  'Impressão',
  'Acabamento',
  'Conferência',
  'Pronto para Entrega',
]

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
  if (nome.includes('total')) return 'protese_total'
  if (nome.includes('parcial') || nome.includes('removível') || nome.includes('removivel') || nome.includes('ppr'))
    return 'parcial_removivel'
  return null
}

export function getEtapas(tipoWorkflow: TipoWorkflow): EtapaConfig[] | string[] {
  if (!tipoWorkflow) return ETAPAS_SIMPLES
  return WORKFLOW_ETAPAS[tipoWorkflow] || ETAPAS_SIMPLES
}

export function getEtapaNome(etapa: EtapaConfig | string): string {
  return typeof etapa === 'string' ? etapa : etapa.nome
}

export function getEtapaIndex(tipoWorkflow: TipoWorkflow, etapaNome: string): number {
  const etapas = getEtapas(tipoWorkflow)
  return etapas.findIndex(e => getEtapaNome(e) === etapaNome)
}

export function getNextEtapa(tipoWorkflow: TipoWorkflow, etapaAtual: string): string | null {
  const etapas = getEtapas(tipoWorkflow)
  const idx = etapas.findIndex(e => getEtapaNome(e) === etapaAtual)
  if (idx < 0 || idx >= etapas.length - 1) return null
  return getEtapaNome(etapas[idx + 1])
}

export function getRetornoEtapa(tipoWorkflow: TipoWorkflow, etapaAtual: string): string | null {
  if (!tipoWorkflow) return null
  const etapas = WORKFLOW_ETAPAS[tipoWorkflow]
  if (!etapas) return null
  const idx = etapas.findIndex(e => e.nome === etapaAtual)
  if (idx < 0) return null
  const config = etapas[idx]
  if (config.retornoIndex !== undefined) {
    return etapas[config.retornoIndex].nome
  }
  // Se não tem retornoIndex definido mas é uma prova, volta uma etapa
  if (config.isProva && idx > 0) {
    return etapas[idx - 1].nome
  }
  return idx > 0 ? etapas[idx - 1].nome : null
}

export function isEtapaProva(tipoWorkflow: TipoWorkflow, etapaNome: string): boolean {
  if (!tipoWorkflow) return false
  const etapas = WORKFLOW_ETAPAS[tipoWorkflow]
  if (!etapas) return false
  const etapa = etapas.find(e => e.nome === etapaNome)
  return etapa?.isProva ?? false
}

export function isChecklistCompleto(checklist: Partial<ChecklistEstetico>): boolean {
  return Object.values(CHECKLIST_LABELS).every((_, i) => {
    const key = Object.keys(CHECKLIST_LABELS)[i] as keyof ChecklistEstetico
    return checklist[key] === true
  })
}

export function canAdvance(
  tipoWorkflow: TipoWorkflow,
  etapaAtual: string,
  checklistEstetico?: Partial<ChecklistEstetico>
): boolean {
  // Se é etapa de prova, exige checklist completo
  if (isEtapaProva(tipoWorkflow, etapaAtual)) {
    if (!checklistEstetico) return false
    return isChecklistCompleto(checklistEstetico)
  }
  return true
}

export function canReturn(tipoWorkflow: TipoWorkflow, etapaAtual: string): boolean {
  if (!tipoWorkflow) return false
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
  const etapas = getEtapas(tipoWorkflow)
  const idx = etapas.findIndex(e => getEtapaNome(e) === etapaAtual)
  if (idx < 0) return 0
  return Math.round((idx / (etapas.length - 1)) * 100)
}
