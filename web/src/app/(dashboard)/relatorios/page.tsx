import { getClientesRelatorio, getRelatorioFinanceiro, getRelatorioOrdensEntregues } from '@/actions/relatorios'
import { RelatoriosView } from '@/components/relatorios/relatorios-view'

export const dynamic = 'force-dynamic'

interface RelatoriosPageProps {
  searchParams: Promise<{ mes?: string; cliente?: string }>
}

export default async function RelatoriosPage({ searchParams }: RelatoriosPageProps) {
  const { mes, cliente } = await searchParams
  const clienteId = Number(cliente)
  const [financeiro, ordensEntregues, clientes] = await Promise.all([
    getRelatorioFinanceiro(),
    getRelatorioOrdensEntregues(mes, Number.isInteger(clienteId) && clienteId > 0 ? clienteId : undefined),
    getClientesRelatorio(),
  ])
  
  return <RelatoriosView financeiro={financeiro} ordensEntregues={ordensEntregues} clientes={clientes} />
}
