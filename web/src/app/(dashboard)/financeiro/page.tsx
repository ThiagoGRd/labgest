import { getContas } from '@/actions/financeiro'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const contas = await getContas()
  
  return <FinanceiroView initialData={contas} />
}
