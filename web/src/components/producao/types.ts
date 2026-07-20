export interface OrdemProducao {
  id: number
  paciente: string
  dentista: string
  servico: string
  status: string
  updatedAt: string
  etapa: string
  subetapa?: string | null
  prioridade: string
  entrega: string
  cor?: string | null
  elementos?: string | null
  foto?: string | null
  tipoWorkflow?: string | null
  passoFluxoAtual?: string | null
  arcadas?: number
  prazoEtapaAtual?: string | null
  fornecedorEstrutura?: string | null
  dataEnvioFornecedor?: string | null
  prazoFornecedor?: string | null
  dataRecebimentoFornecedor?: string | null
  justificativaAtrasoFornecedor?: string | null
  cicloAtivoId?: number | null
  cicloStatus?: string | null
  cicloNumero?: number | null
  cicloComprometido?: string | null
  cicloDentistaDeci?: string | null
  cicloRespostaEm?: string | null
  cicloObs?: string | null
  cicloFotos?: string[]
}

export type FilaProducao = 'laboratorio' | 'clinica' | 'fornecedor' | 'sem_etapa'
export type VisualizacaoProducao = 'kanban' | 'lista'
