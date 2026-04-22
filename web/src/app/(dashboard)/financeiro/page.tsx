import { getContas, getMesesDisponiveis } from '@/actions/financeiro'
import { FinanceiroView } from './financeiro-view'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const params = await searchParams
  const filtroMes = params.mes

  const [contas, meses] = await Promise.all([
    getContas(filtroMes),
    getMesesDisponiveis(),
  ])

  return (
    <FinanceiroView
      receber={contas.receber}
      pagar={contas.pagar}
      totalReceberMes={contas.totalReceberMes}
      qtdReceberMes={contas.qtdReceberMes}
      mesesDisponiveis={meses}
      mesSelecionado={filtroMes}
    />
  )
}
