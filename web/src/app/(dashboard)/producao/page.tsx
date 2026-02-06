import { getProducao } from '@/actions/producao'
import { ProducaoView } from './producao-view'

export const dynamic = 'force-dynamic'

export default async function ProducaoPage() {
  const ordens = await getProducao()
  
  return <ProducaoView initialOrdens={ordens} />
}
