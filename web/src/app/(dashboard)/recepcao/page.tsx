import { getPainelRecepcao } from '@/actions/recepcao'
import { RecepcaoView } from './recepcao-view'

export const dynamic = 'force-dynamic'

export default async function RecepcaoPage() {
  const dados = await getPainelRecepcao()
  return <RecepcaoView {...dados} />
}
