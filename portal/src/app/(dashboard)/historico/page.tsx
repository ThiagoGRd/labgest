import { createClient } from '@/lib/supabase/server'
import { getHistoricoPedidos } from '@/actions/pedidos'
import { HistoricoView } from './historico-view'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const pedidos = await getHistoricoPedidos()

  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }

  return <HistoricoView user={userData} pedidos={pedidos} />
}
