import { getFinanceiroPageData } from '@/actions/financeiro'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const params = await searchParams
  const dados = await getFinanceiroPageData(params.mes)
  return <FinanceiroView dados={dados} />
}
