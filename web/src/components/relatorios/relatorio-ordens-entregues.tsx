import { forwardRef } from 'react'

export interface OrdemEntregueRelatorio {
  id: number
  paciente: string
  cliente: string
  servico: string
  valor: number
  dataEntrega: string
  origemData: string
  contaId: number | null
  statusFinanceiro: string
}

export interface RelatorioOrdensEntreguesData {
  mes: string
  mesLabel: string
  itens: OrdemEntregueRelatorio[]
  totalOrdens: number
  valorTotal: number
  comCobranca: number
  semCobranca: number
}

function moeda(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataRelatorio(valor: string, origem: string) {
  const data = new Date(valor)
  const timeZone = origem === 'Entrega confirmada' ? 'America/Maceio' : 'UTC'
  return data.toLocaleDateString('pt-BR', { timeZone })
}

export const RelatorioOrdensEntregues = forwardRef<HTMLDivElement, { dados: RelatorioOrdensEntreguesData }>(
  ({ dados }, ref) => (
    <div ref={ref} className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[14mm] text-slate-950">
      <header className="flex items-end justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-700">LabGest</p>
          <h1 className="mt-1 text-2xl font-bold">Ordens entregues</h1>
          <p className="mt-1 text-sm capitalize text-slate-600">Competência: {dados.mesLabel}</p>
        </div>
        <p className="text-right text-xs text-slate-500">
          Emitido em<br />
          {new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' })}
        </p>
      </header>

      <section className="my-5 grid grid-cols-3 gap-3">
        <Resumo label="Ordens entregues" valor={String(dados.totalOrdens)} />
        <Resumo label="Valor total" valor={moeda(dados.valorTotal)} />
        <Resumo label="Sem lançamento financeiro" valor={String(dados.semCobranca)} destaque={dados.semCobranca > 0} />
      </section>

      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="bg-slate-900 text-left text-white">
            <th className="p-2">OS</th>
            <th className="p-2">Entrega</th>
            <th className="p-2">Paciente</th>
            <th className="p-2">Dentista / clínica</th>
            <th className="p-2">Serviço</th>
            <th className="p-2 text-right">Valor</th>
            <th className="p-2">Financeiro</th>
          </tr>
        </thead>
        <tbody>
          {dados.itens.map((item) => (
            <tr key={item.id} className="border-b border-slate-200 align-top">
              <td className="p-2 font-bold">#{item.id}</td>
              <td className="p-2">
                {dataRelatorio(item.dataEntrega, item.origemData)}
                {item.origemData !== 'Entrega confirmada' && <span className="ml-0.5">*</span>}
              </td>
              <td className="p-2 font-semibold">{item.paciente}</td>
              <td className="p-2">{item.cliente}</td>
              <td className="p-2">{item.servico}</td>
              <td className="p-2 text-right font-semibold">{moeda(item.valor)}</td>
              <td className="p-2">{item.contaId ? `#${item.contaId} · ${item.statusFinanceiro}` : 'Sem lançamento'}</td>
            </tr>
          ))}
          {dados.itens.length === 0 && (
            <tr><td colSpan={7} className="p-10 text-center text-sm text-slate-500">Nenhuma ordem entregue neste mês.</td></tr>
          )}
        </tbody>
      </table>

      <footer className="mt-6 border-t border-slate-300 pt-3 text-[9px] leading-relaxed text-slate-500">
        <p>* Registro histórico sem data de entrega confirmada; foi utilizada a data de finalização ou, quando indisponível, a previsão de entrega.</p>
        <p className="mt-1">O total representa o valor final das ordens e não confirma recebimento. A situação de cobrança está indicada na coluna Financeiro.</p>
      </footer>
    </div>
  )
)

RelatorioOrdensEntregues.displayName = 'RelatorioOrdensEntregues'

function Resumo({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded border p-3 ${destaque ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  )
}
