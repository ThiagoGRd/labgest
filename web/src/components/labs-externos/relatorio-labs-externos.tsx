import { forwardRef } from 'react'
import type { LabExternoPedido } from '@/actions/labs-externos'

interface RelatorioLabsExternosProps {
  pedidos: LabExternoPedido[]
  filtro: string
}

function formatarData(data: Date | null | undefined) {
  if (!data) return '—'
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function estaAtrasado(pedido: LabExternoPedido) {
  return pedido.situacao !== 'Entregue' && (pedido.diasAtraso || 0) > 0
}

export const RelatorioLabsExternos = forwardRef<HTMLDivElement, RelatorioLabsExternosProps>(
  ({ pedidos, filtro }, ref) => {
    const atrasados = pedidos.filter(estaAtrasado).length
    const retrabalhos = pedidos.filter((pedido) => pedido.isRetrabalho).length
    const entregues = pedidos.filter((pedido) => pedido.situacao === 'Entregue').length
    const laboratorios = new Set(pedidos.map((pedido) => pedido.labNome).filter(Boolean)).size

    return (
      <div ref={ref} className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[12mm] text-slate-950">
        <header className="flex items-end justify-between border-b-2 border-slate-900 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-700">LabGest</p>
            <h1 className="mt-1 text-2xl font-bold">Laboratórios externos</h1>
            <p className="mt-1 text-sm text-slate-600">Filtro aplicado: {filtro}</p>
          </div>
          <p className="text-right text-xs text-slate-500">
            Emitido em<br />
            {new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' })}
          </p>
        </header>

        <section className="my-5 grid grid-cols-4 gap-2">
          <Resumo label="Pedidos" valor={pedidos.length} />
          <Resumo label="Laboratórios" valor={laboratorios} />
          <Resumo label="Atrasados" valor={atrasados} destaque={atrasados > 0 ? 'atraso' : undefined} />
          <Resumo label="Retrabalhos" valor={retrabalhos} destaque={retrabalhos > 0 ? 'retrabalho' : undefined} />
        </section>

        {pedidos.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Nenhum pedido encontrado com os filtros selecionados.</p>
        ) : (
          <table className="w-full table-fixed border-collapse text-[8px]">
            <thead>
              <tr className="bg-slate-900 text-left text-white">
                <th className="w-[15%] p-1.5">Laboratório</th>
                <th className="w-[17%] p-1.5">Paciente</th>
                <th className="w-[14%] p-1.5">Dentista</th>
                <th className="w-[20%] p-1.5">Serviço</th>
                <th className="w-[9%] p-1.5">Envio</th>
                <th className="w-[9%] p-1.5">Prazo</th>
                <th className="w-[16%] p-1.5">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => {
                const atrasado = estaAtrasado(pedido)
                return (
                  <tr key={pedido.id} className="break-inside-avoid border-b border-slate-200 align-top">
                    <td className="p-1.5 font-semibold">{pedido.labNome || 'Não informado'}</td>
                    <td className="p-1.5 font-semibold">{pedido.paciente}</td>
                    <td className="p-1.5">{pedido.dentista || '—'}</td>
                    <td className="p-1.5">
                      {pedido.servico || '—'}
                      {pedido.isRetrabalho ? <span className="mt-0.5 block font-semibold text-orange-700">Retrabalho: {pedido.motivoRetrabalho || 'sem motivo informado'}</span> : null}
                    </td>
                    <td className="p-1.5">{formatarData(pedido.dataEnvio)}</td>
                    <td className={`p-1.5 ${atrasado ? 'font-bold text-red-700' : ''}`}>
                      {formatarData(pedido.prazo)}
                      {atrasado ? <span className="block">{pedido.diasAtraso || 1} dia(s) de atraso</span> : null}
                    </td>
                    <td className="p-1.5">
                      <span className="font-semibold">{pedido.situacao}</span>
                      {pedido.situacao === 'Entregue' && pedido.dataRetorno ? <span className="block text-slate-500">Retorno: {formatarData(pedido.dataRetorno)}</span> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        <footer className="mt-6 flex justify-between border-t border-slate-300 pt-3 text-[9px] text-slate-500">
          <span>Relatório operacional de serviços enviados a laboratórios terceirizados.</span>
          <span>{entregues} entregue(s)</span>
        </footer>
      </div>
    )
  },
)

RelatorioLabsExternos.displayName = 'RelatorioLabsExternos'

function Resumo({ label, valor, destaque }: { label: string; valor: number; destaque?: 'atraso' | 'retrabalho' }) {
  const estilo = destaque === 'atraso'
    ? 'border-red-300 bg-red-50'
    : destaque === 'retrabalho'
      ? 'border-orange-300 bg-orange-50'
      : 'border-slate-200 bg-slate-50'

  return (
    <div className={`rounded border p-3 ${estilo}`}>
      <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  )
}
