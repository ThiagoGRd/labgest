import { getPainelRecepcao } from '@/actions/recepcao'
import { RecepcaoView } from './recepcao-view'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export default async function RecepcaoPage() {
  const dados = await getPainelRecepcao()
  return <RecepcaoView {...dados} />
}
