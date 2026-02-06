import { createClient } from '@/lib/supabase/server'
import { getDashboardStats, getMeusPedidos } from '@/actions/pedidos'
import { DashboardView } from './dashboard-view'

export const dynamic = 'force-dynamic'

export default async function PortalDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Buscar dados reais
  const stats = await getDashboardStats()
  const pedidos = await getMeusPedidos()

  // Pegar apenas os 3 últimos pedidos para o dashboard
  const pedidosRecentes = pedidos.slice(0, 3)

  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }

  return (
    <DashboardView 
      user={userData} 
      stats={stats} 
      pedidosRecentes={pedidosRecentes} 
    />
  )
}
