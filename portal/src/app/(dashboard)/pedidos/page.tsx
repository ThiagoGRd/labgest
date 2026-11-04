import { getMeusPedidos } from '@/actions/pedidos'
import { PedidosView } from './pedidos-view'
import { requireClienteIdentity } from '@/lib/cliente-identity'

export const dynamic = 'force-dynamic'

export default async function PedidosPage() {
  const pedidos = await getMeusPedidos()
  const cliente = await requireClienteIdentity()

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }
  
  return <PedidosView user={userData} pedidos={pedidos} />
}
