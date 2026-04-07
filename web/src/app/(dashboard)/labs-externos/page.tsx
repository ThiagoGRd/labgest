import { getPedidosLabExterno, getAtrasados, getRetrabalhos, getDashboardLabsExternos, getLabsExternos } from '@/actions/labs-externos'
import { LabsExternosView } from './labs-externos-view'

export const dynamic = 'force-dynamic'

export default async function LabsExternosPage() {
  const [pedidos, atrasados, retrabalhos, stats, labs] = await Promise.all([
    getPedidosLabExterno(),
    getAtrasados(),
    getRetrabalhos(),
    getDashboardLabsExternos(),
    getLabsExternos(),
  ])

  return (
    <LabsExternosView
      pedidos={pedidos}
      atrasados={atrasados}
      retrabalhos={retrabalhos}
      stats={stats}
      labs={labs}
    />
  )
}
