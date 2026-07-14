import { getProducao } from '@/actions/producao'
import { ProducaoView } from './producao-view'

export const dynamic = 'force-dynamic'

export default async function ProducaoPage() {
  const ordens = await getProducao()
  const versaoOrdens = ordens
    .map((ordem) => `${ordem.id}:${ordem.etapa}:${ordem.cicloStatus}:${ordem.cicloDentistaDeci}`)
    .join('|')

  return <ProducaoView key={versaoOrdens} initialOrdens={ordens} />
}
