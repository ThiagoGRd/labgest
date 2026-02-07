import { getRelatorioFinanceiro } from '@/actions/relatorios'
import { RelatoriosView } from '@/components/relatorios/relatorios-view'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage() {
  const financeiro = await getRelatorioFinanceiro()
  
  return <RelatoriosView financeiro={financeiro} />
}
