import { getMeusPedidos } from '@/actions/pedidos'
import { PedidosView } from './pedidos-view'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PedidosPage() {
  const pedidos = await getMeusPedidos()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }
  
  return <PedidosView user={userData} pedidos={pedidos} />
}
