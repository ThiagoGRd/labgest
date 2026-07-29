export interface ItemEstoque {
  id: number
  nome: string
  marca: string
  categoria: string
  quantidade: number
  quantidadeMinima: number
  unidade: string
  precoUnitario: number
  fornecedor: string
  localizacao: string
  dataValidade: string | null
  codigoBarras: string
  ativo: boolean
  updatedAt: string | null
}

export interface MovimentacaoEstoque {
  id: number
  estoqueId: number
  itemNome: string
  unidade: string
  tipo: string
  quantidade: number
  saldoAnterior: number
  saldoPosterior: number
  valorUnitario: number | null
  motivo: string
  documento: string
  ordemId: number | null
  usuarioNome: string
  createdAt: string
}

export interface GestaoEstoqueData {
  itens: ItemEstoque[]
  movimentacoes: MovimentacaoEstoque[]
  emitidoEm: string
}
