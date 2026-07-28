import { getRelatorioFinanceiro, getRelatorioOrdensEntregues } from '@/actions/relatorios'
import { RelatoriosView } from '@/components/relatorios/relatorios-view'

export const dynamic = 'force-dynamic'

interface RelatoriosPageProps {
  searchParams: Promise<{ mes?: string }>
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const { mes } = await searchParams
  const [financeiro, ordensEntregues] = await Promise.all([
    getRelatorioFinanceiro(),
    getRelatorioOrdensEntregues(mes),
  ])
  
  return <RelatoriosView financeiro={financeiro} ordensEntregues={ordensEntregues} />
}
