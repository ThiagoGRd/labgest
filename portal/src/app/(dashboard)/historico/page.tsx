import { requireClienteIdentity } from '@/lib/cliente-identity'
import { getHistoricoPedidos } from '@/actions/pedidos'
import { HistoricoView } from './historico-view'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  const cliente = await requireClienteIdentity()
  
  const pedidos = await getHistoricoPedidos()

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }

  return <HistoricoView user={userData} pedidos={pedidos} />
}
