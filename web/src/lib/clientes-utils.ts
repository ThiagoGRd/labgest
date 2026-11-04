export interface ClienteCampos {
  nome: string
  telefone: string
  email: string
  cro: string
  endereco: string
  observacoes: string
}

export function validarCliente(input: unknown): ClienteCampos {
  if (!input || typeof input !== 'object') throw new Error('Dados do cliente inválidos')
  const data = input as Record<string, unknown>
  const campo = (key: string, label: string, max: number, required = false) => {
    const raw = data[key]
    if (raw !== undefined && typeof raw !== 'string') throw new Error(`${label} inválido`)
    const value = (raw as string | undefined)?.trim() || ''
    if (required && !value) throw new Error(`${label} é obrigatório`)
    if (value.length > max) throw new Error(`${label}: máximo de ${max} caracteres`)
    return value
  }
  const result = {
    nome: campo('nome', 'Nome', 255, true),
    telefone: campo('telefone', 'Telefone', 20, true),
    cro: campo('cro', 'CRO', 50, true),
    email: campo('email', 'Email', 255),
    endereco: campo('endereco', 'Endereço', 5000),
    observacoes: campo('observacoes', 'Observações', 10000),
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Email inválido')
  return result
}

interface ClienteExportavel {
  nome: string; telefone: string; email: string; cro: string; endereco: string
  ativo: boolean | null; totalPedidos: number; valorTotal: number; ultimoPedido: string | null
}

export function clientesCsv(clientes: ClienteExportavel[]) {
  const cell = (value: unknown) => {
    let text = String(value ?? '')
    // Quoting alone does not prevent spreadsheet formula evaluation.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const rows: unknown[][] = [['Nome', 'Telefone', 'Email', 'CRO', 'Endereço', 'Status', 'Pedidos', 'Valor total', 'Último pedido']]
  for (const c of clientes) rows.push([c.nome, c.telefone, c.email, c.cro, c.endereco, c.ativo ? 'Ativo' : 'Inativo', c.totalPedidos, c.valorTotal, c.ultimoPedido])
  return '\ufeff' + rows.map(row => row.map(cell).join(';')).join('\r\n')
}
