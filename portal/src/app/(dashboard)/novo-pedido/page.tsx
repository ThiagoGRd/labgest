import { getServicosDisponiveis } from '@/actions/pedidos'
import { NovoPedidoView } from './novo-pedido-view'
import { requireClienteIdentity } from '@/lib/cliente-identity'

export const dynamic = 'force-dynamic'

export default async function NovoPedidoPage() {
  const servicos = await getServicosDisponiveis()
  const cliente = await requireClienteIdentity()

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }
  
  return <NovoPedidoView user={userData} servicos={servicos} />
}
