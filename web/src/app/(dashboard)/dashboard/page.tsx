import { getDashboardData } from '@/actions/dashboard'
import { DashboardView } from './dashboard-view'
import { requireUser } from '@/lib/auth-utils'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const usuario = await requireUser({ permitirRecepcao: true })
  if (usuario.tipo === 'recepcao') redirect('/recepcao')
  const data = await getDashboardData()
  
  return <DashboardView initialData={data} />
}
