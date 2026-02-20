// ============================================================
// workflow-config.ts — Configuração do Workflow de Etapas
// (Cópia para o Portal)
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

export function isEtapaProva(tipoWorkflow: TipoWorkflow, etapaNome: string): boolean {
  if (!tipoWorkflow) return false
  const etapas = WORKFLOW_ETAPAS[tipoWorkflow]
  if (!etapas) return false
  // Match parcial para segurança
  const etapa = etapas.find(e => e.nome.includes(etapaNome) || etapaNome.includes(e.nome))
  return etapa?.isProva ?? false
}

export function isChecklistCompleto(checklist?: Partial<ChecklistEstetico> | null): boolean {
  if (!checklist) return false
  const keys = Object.keys(CHECKLIST_LABELS) as (keyof ChecklistEstetico)[]
  return keys.every(key => checklist[key] === true)
}
