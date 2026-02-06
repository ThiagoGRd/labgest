import { getServicosDisponiveis } from '@/actions/pedidos'
import { NovoPedidoView } from './novo-pedido-view'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NovoPedidoPage() {
  const servicos = await getServicosDisponiveis()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Buscar dados adicionais do usuário (nome, cro) se necessário
  // Por enquanto, passando user básico para o layout
  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }
  
  return <NovoPedidoView user={userData} servicos={servicos} />
}
