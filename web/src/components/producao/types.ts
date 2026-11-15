import type { ResultadoInferenciaClinicorp } from '@labgest/shared'

export interface ItemCasoOrdem {
  servicoId?: number | null
  servicoNome: string
  arcada?: 'Superior' | 'Inferior' | 'Superior + Inferior' | string | null
  elementos?: string | null
  corDentes?: string | null
  material?: string | null
  tipoProtese?: string | null
  valor?: number | null
  origemOrdemId?: number | null
}

export interface OrdemProducao {
  id: number
  paciente: string
  cpfPaciente?: string | null
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
  localizacaoAtual?: string | null
  situacaoLogistica?: string | null
  movimentacaoLogisticaEm?: string | null
  dentistaResponsavel?: string | null
  agendamentoClinico?: string | null
  cicloAtivoId?: number | null
  cicloStatus?: string | null
  cicloNumero?: number | null
  cicloComprometido?: string | null
  dataEntradaCiclo?: string | null
  retornouAoLabEm?: string | null
  cicloDentistaDeci?: string | null
  cicloRespostaEm?: string | null
  cicloObs?: string | null
  cicloFotos?: string[]
  itensCaso?: ItemCasoOrdem[]
  clinicorpEtapa?: ResultadoInferenciaClinicorp | null
}

export type FilaProducao = 'laboratorio' | 'clinica' | 'fornecedor' | 'sem_etapa'
export type VisualizacaoProducao = 'kanban' | 'lista'


