export interface CadastroCliente {
  nome: string
  telefone: string
  cro: string
  endereco: string
}

export function validarCadastroCliente(data: unknown): CadastroCliente | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const campos = ['nome', 'telefone', 'cro', 'endereco']
  if (Object.keys(data).some(campo => !campos.includes(campo))) return null
  const valores = data as Record<string, unknown>
  if (campos.some(campo => typeof valores[campo] !== 'string')) return null
  const nome = (valores.nome as string).trim()
  const telefone = (valores.telefone as string).trim()
  const cro = (valores.cro as string).trim()
  const endereco = (valores.endereco as string).trim()
  if (!nome || nome.length > 255 || !telefone || telefone.length > 20 || !cro || cro.length > 50) return null
  return { nome, telefone, cro, endereco }
}

interface ClienteCsv extends CadastroCliente {
  email: string
  ativo: boolean | null
}

function campoCsv(valor: string) {
  // Spreadsheet formulas can start after whitespace/control characters.
  const texto = /^[\s\u0000-\u001f]*[=+\-@]/u.test(valor) || /^[\t\r\n]/u.test(valor) ? `'${valor}` : valor
  return `"${texto.replaceAll('"', '""')}"`
}

export function clientesCsv(clientes: ClienteCsv[]) {
  const linhas = [
    ['Nome', 'CRO', 'Telefone', 'Email', 'Endereço', 'Situação'],
    ...clientes.map(cliente => [cliente.nome, cliente.cro, cliente.telefone, cliente.email, cliente.endereco, cliente.ativo ? 'Ativo' : 'Inativo']),
  ]
  return `\uFEFF${linhas.map(linha => linha.map(campoCsv).join(';')).join('\r\n')}`
}
