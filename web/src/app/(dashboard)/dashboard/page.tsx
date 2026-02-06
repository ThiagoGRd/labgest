import { getDashboardData } from '@/actions/dashboard'
import { DashboardView } from './dashboard-view'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await getDashboardData()
  
  return <DashboardView initialData={data} />
}
