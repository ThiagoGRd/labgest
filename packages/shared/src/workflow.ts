export type TipoWorkflow = 'protocolo' | 'protese_total' | 'parcial_removivel' | null

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

export type EtapaId = (typeof ETAPA_IDS)[number]
export type ContextoEtapa = 'lab' | 'portal'

export const ETAPA_LABELS: Record<EtapaId, Record<ContextoEtapa, string>> = {
  recebimento: { lab: 'Recebimento', portal: 'Recebido pelo laboratório' },
  modelagem: { lab: 'Modelagem/Planejamento', portal: 'Em Planejamento' },
  confeccao: { lab: 'Confecção/Impressão', portal: 'Em Produção' },
  em_prova: { lab: 'Em Prova (Clínica)', portal: 'Aguardando sua avaliação 🧪' },
  ajuste: { lab: 'Ajustes', portal: 'Em Ajuste' },
  acabamento: { lab: 'Acabamento/Polimento', portal: 'Finalizando' },
  conferencia: { lab: 'Conferência Final', portal: 'Controle de Qualidade' },
  pronto: { lab: 'Pronto p/ Entrega', portal: 'Pronto! Aguardando retirada ✅' },
  entregue: { lab: 'Entregue', portal: 'Entregue ✓' },
}

export const KANBAN_ETAPAS = [
  { id: 'recebimento', nome: ETAPA_LABELS.recebimento.lab, cor: '#6366f1' },
  { id: 'modelagem', nome: ETAPA_LABELS.modelagem.lab, cor: '#8b5cf6' },
  { id: 'confeccao', nome: ETAPA_LABELS.confeccao.lab, cor: '#a855f7' },
  { id: 'em_prova', nome: ETAPA_LABELS.em_prova.lab, cor: '#f59e0b' },
  { id: 'ajuste', nome: ETAPA_LABELS.ajuste.lab, cor: '#f97316' },
  { id: 'acabamento', nome: ETAPA_LABELS.acabamento.lab, cor: '#d946ef' },
  { id: 'conferencia', nome: ETAPA_LABELS.conferencia.lab, cor: '#ec4899' },
  { id: 'pronto', nome: ETAPA_LABELS.pronto.lab, cor: '#22c55e' },
] as const satisfies ReadonlyArray<{ id: Exclude<EtapaId, 'entregue'>; nome: string; cor: string }>

export const SEQUENCIA_ETAPAS: EtapaId[] = KANBAN_ETAPAS.map(etapa => etapa.id)
export const ETAPA_FINAL: EtapaId = 'pronto'

export function isEtapaId(valor: string): valor is EtapaId {
  return (ETAPA_IDS as readonly string[]).includes(valor)
}

export function etapaLabel(id: string, contexto: ContextoEtapa = 'lab'): string {
  const normalizada = normalizarEtapa(id)
  return ETAPA_LABELS[normalizada][contexto]
}

export function normalizarEtapa(valor: string): EtapaId {
  const v = valor.toLowerCase().trim()
  if (isEtapaId(v)) return v
  if (v.startsWith('recebimento') || v === 'recebido') return 'recebimento'
  if (v.includes('planejamento') || v.includes('modelagem') || v.includes('delineamento')) return 'modelagem'
  if (
    v === 'produção' || v === 'producao' || v.includes('impress') || v.includes('confec') ||
    v.includes('fresagem') || v.includes('acriliza') || v.includes('estrutura') || v.includes('rodete')
  ) return 'confeccao'
  if (v === 'emprova' || v.includes('prova')) return 'em_prova'
  if (v.includes('ajuste') || v.includes('remontagem')) return 'ajuste'
  if (v.includes('acabamento') || v.includes('polimento') || v.includes('montagem') || v.includes('finaliza')) return 'acabamento'
  if (v.includes('confer') || v.includes('controle de qualidade')) return 'conferencia'
  if (v.includes('pronto') || v === 'finalizado') return 'pronto'
  if (v === 'entregue') return 'entregue'
  return 'recebimento'
}

export function statusParaEtapa(etapa: string): string {
  switch (normalizarEtapa(etapa)) {
    case 'recebimento': return 'Aguardando'
    case 'em_prova': return 'Em Prova'
    case 'pronto': return 'Finalizado'
    case 'entregue': return 'Entregue'
    default: return 'Em Produção'
  }
}

export interface SubetapaConfig {
  nome: string
  etapa: EtapaId
  isProva?: boolean
}

export const SUBETAPAS_POR_WORKFLOW: Record<Exclude<TipoWorkflow, null>, SubetapaConfig[]> = {
  protocolo: [
    { nome: 'Scanner + fotos recebidos', etapa: 'recebimento' },
    { nome: 'Planejamento digital', etapa: 'modelagem' },
    { nome: 'Confecção da estrutura/barra', etapa: 'confeccao' },
    { nome: 'Prova da estrutura', etapa: 'em_prova', isProva: true },
    { nome: 'Montagem dos dentes', etapa: 'confeccao' },
    { nome: 'Prova estética', etapa: 'em_prova', isProva: true },
    { nome: 'Acrilização/fresagem final', etapa: 'confeccao' },
    { nome: 'Acabamento e polimento', etapa: 'acabamento' },
    { nome: 'Conferência final', etapa: 'conferencia' },
  ],
  protese_total: [
    { nome: 'Moldagem/scanner + fotos recebidos', etapa: 'recebimento' },
    { nome: 'Confecção de rodete/base de prova', etapa: 'confeccao' },
    { nome: 'Registro de oclusão', etapa: 'em_prova', isProva: true },
    { nome: 'Montagem dos dentes', etapa: 'confeccao' },
    { nome: 'Prova em cera', etapa: 'em_prova', isProva: true },
    { nome: 'Acrilização', etapa: 'confeccao' },
    { nome: 'Acabamento/remontagem', etapa: 'acabamento' },
    { nome: 'Conferência final', etapa: 'conferencia' },
  ],
  parcial_removivel: [
    { nome: 'Modelo/scanner recebido', etapa: 'recebimento' },
    { nome: 'Delineamento', etapa: 'modelagem' },
    { nome: 'Confecção da estrutura metálica', etapa: 'confeccao' },
    { nome: 'Prova da estrutura', etapa: 'em_prova', isProva: true },
    { nome: 'Montagem dos dentes', etapa: 'confeccao' },
    { nome: 'Prova estética', etapa: 'em_prova', isProva: true },
    { nome: 'Acrilização', etapa: 'confeccao' },
    { nome: 'Acabamento e polimento', etapa: 'acabamento' },
    { nome: 'Conferência final', etapa: 'conferencia' },
  ],
}

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

export function getWorkflowForServico(servicoNome: string): TipoWorkflow {
  const nome = servicoNome.toLowerCase()
  if (nome.includes('protocolo')) return 'protocolo'
  if (nome.includes('total') && (nome.includes('prótese') || nome.includes('protese'))) return 'protese_total'
  if (nome.includes('parcial') || nome.includes('removível') || nome.includes('removivel') || nome.includes('ppr')) return 'parcial_removivel'
  return null
}

export function isEtapaProva(tipoWorkflow: TipoWorkflow, etapaId: string): boolean {
  return Boolean(tipoWorkflow && normalizarEtapa(etapaId) === 'em_prova')
}

export function getNextEtapa(_tipoWorkflow: TipoWorkflow, etapaAtual: string): EtapaId | null {
  const idx = SEQUENCIA_ETAPAS.indexOf(normalizarEtapa(etapaAtual))
  return idx < 0 || idx >= SEQUENCIA_ETAPAS.length - 1 ? null : SEQUENCIA_ETAPAS[idx + 1]
}

export function getRetornoEtapa(_tipoWorkflow: TipoWorkflow, etapaAtual: string): EtapaId | null {
  const etapa = normalizarEtapa(etapaAtual)
  const idx = SEQUENCIA_ETAPAS.indexOf(etapa)
  if (idx <= 0) return null
  return etapa === 'em_prova' ? 'confeccao' : SEQUENCIA_ETAPAS[idx - 1]
}

export function getEtapas(_tipoWorkflow: TipoWorkflow): EtapaId[] {
  return [...SEQUENCIA_ETAPAS]
}

export function getEtapaNome(etapa: string): string {
  return etapaLabel(etapa)
}

export function getEtapaIndex(_tipoWorkflow: TipoWorkflow, etapa: string): number {
  return SEQUENCIA_ETAPAS.indexOf(normalizarEtapa(etapa))
}

export function isChecklistCompleto(checklist?: Partial<ChecklistEstetico> | null): boolean {
  return Boolean(checklist && Object.keys(CHECKLIST_LABELS).every(key => checklist[key as keyof ChecklistEstetico] === true))
}

export function canAdvance(tipoWorkflow: TipoWorkflow, etapaAtual: string, checklist?: Partial<ChecklistEstetico>): boolean {
  return !isEtapaProva(tipoWorkflow, etapaAtual) || isChecklistCompleto(checklist)
}

export function canReturn(tipoWorkflow: TipoWorkflow, etapaAtual: string): boolean {
  return getRetornoEtapa(tipoWorkflow, etapaAtual) !== null
}

export function getWorkflowLabel(tipoWorkflow: TipoWorkflow): string {
  if (tipoWorkflow === 'protocolo') return 'Protocolo sobre Implante'
  if (tipoWorkflow === 'protese_total') return 'Prótese Total'
  if (tipoWorkflow === 'parcial_removivel') return 'Parcial Removível (PPR)'
  return 'Fluxo Padrão'
}

export function getProgresso(_tipoWorkflow: TipoWorkflow, etapaAtual: string): number {
  const idx = SEQUENCIA_ETAPAS.indexOf(normalizarEtapa(etapaAtual))
  return idx < 0 ? 0 : Math.round((idx / (SEQUENCIA_ETAPAS.length - 1)) * 100)
}

export interface EtapaConfig {
  nome: string
  isProva: boolean
  retornoIndex?: number
}
