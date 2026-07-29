import { forwardRef } from 'react'
import type { ItemEstoque, MovimentacaoEstoque } from '@/components/estoque/types'

export type TipoRelatorioEstoque = 'posicao' | 'alertas' | 'movimentacoes'

interface RelatorioEstoqueProps {
  tipo: TipoRelatorioEstoque
  itens: ItemEstoque[]
  movimentacoes: MovimentacaoEstoque[]
  periodo: string
  emitidoEm: string
}

const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const data = (valor: string) => new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const dataHora = (valor: string) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Maceio' })

function diaMaceio(valor: string) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(valor))
  return `${partes.find(parte => parte.type === 'year')?.value}-${partes.find(parte => parte.type === 'month')?.value}-${partes.find(parte => parte.type === 'day')?.value}`
}

function emAlerta(item: ItemEstoque, emitidoEm: string) {
  if (item.quantidade <= item.quantidadeMinima) return true
  if (!item.dataValidade) return false
  const limite = new Date(`${diaMaceio(emitidoEm)}T00:00:00Z`)
  limite.setUTCDate(limite.getUTCDate() + 30)
  return new Date(`${item.dataValidade.slice(0, 10)}T00:00:00Z`) <= limite
}

export const RelatorioEstoque = forwardRef<HTMLDivElement, RelatorioEstoqueProps>(({ tipo, itens, movimentacoes, periodo, emitidoEm }, ref) => {
  const itensRelatorio = tipo === 'alertas' ? itens.filter(item => emAlerta(item, emitidoEm)) : itens
  const titulo = tipo === 'posicao' ? 'Posição atual do estoque' : tipo === 'alertas' ? 'Alertas de estoque e validade' : 'Movimentações de estoque'
  const valorTotal = itensRelatorio.reduce((total, item) => total + item.quantidade * item.precoUnitario, 0)

  return (
    <div ref={ref} className="mx-auto min-h-[297mm] w-[210mm] bg-white p-[14mm] text-slate-950">
      <header className="flex items-end justify-between border-b-2 border-slate-900 pb-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-indigo-700">LabGest</p><h1 className="mt-1 text-2xl font-bold">{titulo}</h1>{tipo === 'movimentacoes' ? <p className="mt-1 text-sm text-slate-600">Período: {periodo}</p> : null}</div>
        <p className="text-right text-xs text-slate-500">Emitido em<br />{dataHora(emitidoEm)}</p>
      </header>

      {tipo === 'movimentacoes' ? (
        <Movimentacoes movimentacoes={movimentacoes} />
      ) : (
        <>
          <section className="my-5 grid grid-cols-3 gap-3"><Resumo label="Itens" valor={String(itensRelatorio.length)} /><Resumo label="Valor em estoque" valor={moeda(valorTotal)} /><Resumo label="Unidades críticas" valor={String(itensRelatorio.filter(item => item.quantidade <= item.quantidadeMinima).length)} /></section>
          <table className="w-full border-collapse text-[9px]">
            <thead><tr className="bg-slate-900 text-left text-white"><th className="p-2">Item</th><th className="p-2">Categoria</th><th className="p-2">Saldo</th><th className="p-2">Mínimo</th><th className="p-2">Validade</th><th className="p-2">Localização</th><th className="p-2 text-right">Valor</th></tr></thead>
            <tbody>{itensRelatorio.map(item => <tr key={item.id} className="border-b border-slate-200"><td className="p-2 font-semibold">{item.nome}{item.marca ? <span className="block text-[8px] font-normal text-slate-500">{item.marca}</span> : null}</td><td className="p-2">{item.categoria}</td><td className="p-2">{numero(item.quantidade)} {item.unidade}</td><td className="p-2">{numero(item.quantidadeMinima)}</td><td className="p-2">{item.dataValidade ? data(item.dataValidade) : '—'}</td><td className="p-2">{item.localizacao || '—'}</td><td className="p-2 text-right">{moeda(item.quantidade * item.precoUnitario)}</td></tr>)}</tbody>
          </table>
          {itensRelatorio.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Nenhum item neste relatório.</p> : null}
        </>
      )}
      <footer className="mt-6 border-t border-slate-300 pt-3 text-[9px] text-slate-500">Relatório gerencial do LabGest. Os valores representam custo estimado pelo preço unitário cadastrado.</footer>
    </div>
  )
})

RelatorioEstoque.displayName = 'RelatorioEstoque'

function Movimentacoes({ movimentacoes }: { movimentacoes: MovimentacaoEstoque[] }) {
  const entradas = movimentacoes.filter(item => item.tipo === 'Entrada').reduce((total, item) => total + item.quantidade, 0)
  const saidas = movimentacoes.filter(item => item.tipo === 'Saída').reduce((total, item) => total + item.quantidade, 0)
  return <><section className="my-5 grid grid-cols-3 gap-3"><Resumo label="Movimentações" valor={String(movimentacoes.length)} /><Resumo label="Entradas" valor={numero(entradas)} /><Resumo label="Saídas" valor={numero(saidas)} /></section><table className="w-full border-collapse text-[9px]"><thead><tr className="bg-slate-900 text-left text-white"><th className="p-2">Data</th><th className="p-2">Item</th><th className="p-2">Tipo</th><th className="p-2">Quantidade</th><th className="p-2">Saldo</th><th className="p-2">Motivo</th><th className="p-2">Responsável</th></tr></thead><tbody>{movimentacoes.map(item => <tr key={item.id} className="border-b border-slate-200"><td className="p-2">{dataHora(item.createdAt)}</td><td className="p-2 font-semibold">{item.itemNome}</td><td className="p-2">{item.tipo}</td><td className="p-2">{numero(item.quantidade)} {item.unidade}</td><td className="p-2">{numero(item.saldoAnterior)} → {numero(item.saldoPosterior)}</td><td className="p-2">{item.motivo}{item.ordemId ? ` · OS #${item.ordemId}` : ''}</td><td className="p-2">{item.usuarioNome}</td></tr>)}</tbody></table>{movimentacoes.length === 0 ? <p className="p-10 text-center text-sm text-slate-500">Nenhuma movimentação no período.</p> : null}</>
}

function Resumo({ label, valor }: { label: string; valor: string }) {
  return <div className="rounded border border-slate-200 bg-slate-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-bold">{valor}</p></div>
}
