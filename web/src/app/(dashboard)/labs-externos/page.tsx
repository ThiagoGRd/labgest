import { getPedidosLabExterno, getLabsExternos, getArquivamentoDisponivel } from '@/actions/labs-externos'
import { LabsExternosView } from './labs-externos-view'

export const dynamic = 'force-dynamic'

export default async function LabsExternosPage() {
  const [pedidos, labs, arquivados, arquivamentoDisponivel] = await Promise.all([
    getPedidosLabExterno(),
    getLabsExternos(),
    getPedidosLabExterno(undefined, true),
    getArquivamentoDisponivel(),
  ])
  // Derive every panel from the same filtered active result.
  const atrasados = pedidos.filter(p => (p.diasAtraso ?? 0) > 0)
    .sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0))
  const retrabalhos = pedidos.filter(p => p.isRetrabalho && p.situacao !== 'Entregue')
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
  const stats = {
    total_enviados: pedidos.filter(p => p.situacao === 'Enviado').length,
    total_provando: pedidos.filter(p => p.situacao === 'Provando').length,
    total_prontos: pedidos.filter(p => p.situacao === 'Pronto').length,
    total_entregues: pedidos.filter(p => p.situacao === 'Entregue').length,
    total_atrasados: atrasados.length,
    total_retrabalhos: retrabalhos.length,
  }

  return (
    <LabsExternosView
      pedidos={pedidos}
      atrasados={atrasados}
      retrabalhos={retrabalhos}
      stats={stats}
      labs={labs}
      arquivados={arquivados}
      arquivamentoDisponivel={arquivamentoDisponivel}
    />
  )
}
