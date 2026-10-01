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
  clienteSelecionado: {
    id: number
    nome: string
    telefone: string
    email: string | null
    endereco: string | null
    cro: string
  } | null
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
          <h1 className="mt-1 text-2xl font-bold">Demonstrativo de serviços</h1>
          <p className="mt-1 text-sm capitalize text-slate-600">Competência: {dados.mesLabel}</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {dados.clienteSelecionado?.nome || 'Todas as clínicas'}
          </p>
        </div>
        <p className="text-right text-xs text-slate-500">
          Emitido em<br />
          {new Date().toLocaleString('pt-BR', { timeZone: 'America/Maceio' })}
        </p>
      </header>

      <section className="my-5 grid grid-cols-3 gap-3">
        <ResumoSimples label="Ordens entregues" valor={String(dados.totalOrdens)} />
        <ResumoSimples label="Valor dos serviços" valor={moeda(dados.valorTotal)} />
        <ResumoSimples
          label="Saldo para pagamento"
          valor={moeda(dados.itens.reduce((total, item) => total + Math.max(0, item.valor - item.valorRecebido), 0))}
        />
      </section>

      {dados.itens.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-500">Nenhuma ordem entregue neste mês.</p>
      ) : (
        <div className="space-y-6">
          <GrupoClinicas itens={dados.itens} separarPorClinica={!dados.clienteSelecionado} />
        </div>
      )}

      <footer className="mt-6 border-t border-slate-300 pt-3 text-[9px] leading-relaxed text-slate-500">
        <p>Documento para conferência dos serviços executados. Em caso de divergência, informe o número da OS ao laboratório.</p>
        <p className="mt-1">* Em registros históricos sem confirmação de entrega, foi utilizada a data de finalização ou a previsão disponível.</p>
      </footer>
    </div>
  )
)

RelatorioOrdensEntregues.displayName = 'RelatorioOrdensEntregues'

function ResumoSimples({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded border border-indigo-200 bg-indigo-50 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{valor}</p>
    </div>
  )
}

function GrupoClinicas({ itens, separarPorClinica }: { itens: OrdemEntregueRelatorio[]; separarPorClinica: boolean }) {
  const grupos = separarPorClinica
    ? Array.from(itens.reduce((mapa, item) => {
        const grupo = mapa.get(item.cliente) || []
        grupo.push(item)
        mapa.set(item.cliente, grupo)
        return mapa
      }, new Map<string, OrdemEntregueRelatorio[]>()).entries())
    : [['Serviços', itens] as [string, OrdemEntregueRelatorio[]]]

  return grupos.map(([titulo, ordens]) => (
    <section key={titulo} className="break-inside-avoid">
      <div className="mb-2 flex items-center justify-between border-b border-slate-400 pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wide">{titulo}</h2>
        <p className="text-[10px] font-semibold">{ordens.length} ordem(ns) · {moeda(ordens.reduce((total, item) => total + item.valor, 0))}</p>
      </div>
      <TabelaOrdens ordens={ordens} />
    </section>
  ))
}

function TabelaOrdens({ ordens }: { ordens: OrdemEntregueRelatorio[] }) {
  return (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr className="bg-slate-900 text-left text-white">
          <th className="p-1.5">OS</th><th className="p-1.5">Entrega</th><th className="p-1.5">Paciente</th>
          <th className="p-1.5">Serviço</th><th className="p-1.5">Situação</th>
          <th className="p-1.5 text-right">Valor</th><th className="p-1.5 text-right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        {ordens.map(item => (
          <tr key={item.id} className="border-b border-slate-200 align-top">
            <td className="p-1.5 font-bold">#{item.id}</td>
            <td className="p-1.5">{dataRelatorio(item.dataEntrega, item.origemData)}{item.origemData !== 'Entrega confirmada' && '*'}</td>
            <td className="p-1.5 font-semibold">{item.paciente}</td>
            <td className="p-1.5">{item.servico}</td>
            <td className="p-1.5">{item.situacaoFinanceira === 'Recebida' ? 'Pago' : item.situacaoFinanceira}</td>
            <td className="p-1.5 text-right font-semibold">{moeda(item.valor)}</td>
            <td className="p-1.5 text-right font-bold">{moeda(Math.max(0, item.valor - item.valorRecebido))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
