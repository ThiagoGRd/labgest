import { getEstoque } from '@/actions/estoque'
import { EstoqueView } from './estoque-view'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
  const estoque = await getEstoque()
  
  return <EstoqueView initialData={estoque} />
}
