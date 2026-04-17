import { createClient } from '@/lib/supabase/server'
import { getContasCliente } from '@/actions/financeiro'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const contas = await getContasCliente()

  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }

  return <FinanceiroView user={userData} pendentes={contas.pendentes} pagas={contas.pagas} />
}
