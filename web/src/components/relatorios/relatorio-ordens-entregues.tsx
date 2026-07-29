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
  situacaoFinanceira: 'Recebida' | 'Pendente' | 'Vencida'
  dataVencimento: string | null
  valorRecebido: number
}

export interface RelatorioOrdensEntreguesData {
  mes: string
  mesLabel: string
  itens: OrdemEntregueRelatorio[]
  totalOrdens: number
  valorTotal: number
  comCobranca: number
  semCobranca: number
  resumoFinanceiro: {
    recebidas: ResumoSituacao
    pendentes: ResumoSituacao
    vencidas: ResumoSituacao
  }
}

interface ResumoSituacao {
  quantidade: number
  valor: number
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
          <h1 className="mt-1 text-2xl font-bold">Ordens finalizadas ou entregues</h1>
          <p className="mt-1 text-sm capitalize text-slate-600">Competência: {dados.mesLabel}</p>
        </div>
        <p className="text-right text-xs text-slate-500">
          Emitido em<br />
          {new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' })}
        </p>
      </header>

      <section className="my-5 grid grid-cols-3 gap-3">
        <Resumo label="Recebidas" dados={dados.resumoFinanceiro.recebidas} tom="recebida" />
        <Resumo label="Pendentes" dados={dados.resumoFinanceiro.pendentes} tom="pendente" />
        <Resumo label="Vencidas" dados={dados.resumoFinanceiro.vencidas} tom="vencida" />
      </section>

      {dados.itens.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">Nenhuma ordem entregue neste mês.</p>
      ) : (
        <div className="space-y-6">
          <GrupoOrdens titulo="Recebidas" situacao="Recebida" itens={dados.itens} />
          <GrupoOrdens titulo="Pendentes" situacao="Pendente" itens={dados.itens} />
          <GrupoOrdens titulo="Vencidas" situacao="Vencida" itens={dados.itens} />
        </div>
      )}

      <footer className="mt-6 border-t border-slate-300 pt-3 text-[9px] leading-relaxed text-slate-500">
        <p>* Quando não existe data operacional histórica, é utilizada a competência financeira confirmada; a previsão de entrega nunca é tratada como entrega realizada.</p>
        <p className="mt-1">Ordens sem lançamento financeiro são exibidas em Pendentes. Cobranças parciais são pendentes ou vencidas conforme a data de vencimento.</p>
      </footer>
    </div>
  )
)

RelatorioOrdensEntregues.displayName = 'RelatorioOrdensEntregues'

function Resumo({ label, dados, tom }: { label: string; dados: ResumoSituacao; tom: 'recebida' | 'pendente' | 'vencida' }) {
  const estilos = {
    recebida: 'border-emerald-300 bg-emerald-50',
    pendente: 'border-amber-300 bg-amber-50',
    vencida: 'border-red-300 bg-red-50',
  }
  return (
    <div className={`rounded border p-3 ${estilos[tom]}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{dados.quantidade}</p>
      <p className="text-[10px] font-semibold text-slate-600">{moeda(dados.valor)}</p>
    </div>
  )
}

function GrupoOrdens({ titulo, situacao, itens }: { titulo: string; situacao: OrdemEntregueRelatorio['situacaoFinanceira']; itens: OrdemEntregueRelatorio[] }) {
  const ordens = itens.filter(item => item.situacaoFinanceira === situacao)
  if (ordens.length === 0) return null

  return (
    <section className="break-inside-avoid">
      <div className="mb-2 flex items-center justify-between border-b border-slate-400 pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide">{titulo}</h2>
        <p className="text-[10px] font-semibold">{ordens.length} ordem(ns) · {moeda(ordens.reduce((total, item) => total + item.valor, 0))}</p>
      </div>
      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="bg-slate-900 text-left text-white">
            <th className="p-1.5">OS</th><th className="p-1.5">Entrega</th><th className="p-1.5">Paciente</th>
            <th className="p-1.5">Dentista / clínica</th><th className="p-1.5">Serviço</th>
            <th className="p-1.5">Vencimento</th><th className="p-1.5 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {ordens.map(item => (
            <tr key={item.id} className="border-b border-slate-200 align-top">
              <td className="p-1.5 font-bold">#{item.id}</td>
              <td className="p-1.5">{dataRelatorio(item.dataEntrega, item.origemData)}{item.origemData !== 'Entrega confirmada' && '*'}</td>
              <td className="p-1.5 font-semibold">{item.paciente}</td>
              <td className="p-1.5">{item.cliente}</td>
              <td className="p-1.5">{item.servico}</td>
              <td className="p-1.5">{item.dataVencimento ? new Date(item.dataVencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem lançamento'}</td>
              <td className="p-1.5 text-right font-semibold">{moeda(item.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
