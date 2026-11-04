import { requireClienteIdentity } from '@/lib/cliente-identity'
import { getContasCliente } from '@/actions/financeiro'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const cliente = await requireClienteIdentity()
  
  const contas = await getContasCliente()

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }

  return <FinanceiroView user={userData} pendentes={contas.pendentes} pagas={contas.pagas} />
}
