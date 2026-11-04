import { requireClienteIdentity } from '@/lib/cliente-identity'
import { getDashboardStats, getMeusPedidos } from '@/actions/pedidos'
import { DashboardView } from './dashboard-view'

export const dynamic = 'force-dynamic'

export default async function PortalDashboard() {
  const cliente = await requireClienteIdentity()
  
  // Buscar dados reais
  const stats = await getDashboardStats()
  const pedidos = await getMeusPedidos()

  // Pegar apenas os 3 últimos pedidos para o dashboard
  const pedidosRecentes = pedidos.slice(0, 3)

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }

  return (
    <DashboardView 
      user={userData} 
      stats={stats} 
      pedidosRecentes={pedidosRecentes} 
    />
  )
}
