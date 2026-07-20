'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, CalendarDays,
  CheckCircle2, CircleDollarSign, FileBarChart, Landmark, Plus, RefreshCw,
  Pencil, Search, TrendingUp, WalletCards, XCircle,
} from 'lucide-react'
import { cancelarConta, sincronizarFinanceiroRetroativo } from '@/actions/financeiro'
import { BaixaContaModal } from '@/components/financeiro/baixa-conta-modal'
import { EditarContaModal } from '@/components/financeiro/editar-conta-modal'
import { NovaContaModal } from '@/components/financeiro/nova-conta-modal'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ReasonModal } from '@/components/ui/reason-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/date-utils'
import { toast } from 'sonner'

interface Lancamento {
  id: number
  descricao: string
  valor: number
  liquidado: number
  restante: number
  vencimento: string
  status: string
  observacoes: string
  cliente?: string
  clienteId?: number | null
  paciente?: string | null
  servico?: string | null
  ordemId?: number | null
  categoria?: string
  fornecedor?: string
}

interface FinanceiroData {
  periodo: string
  receber: Lancamento[]
  pagar: Lancamento[]
  clientes: Array<{ id: number; nome: string }>
  contasFinanceiras: Array<{ id: number; nome: string; tipo: string }>
  movimentacoes: Array<{ id: number; tipo: string; valor: number; data: string; descricao: string; pessoa: string; conta: string; formaPagamento: string }>
  resumo: {
    saldoAtual: number; entradas: number; saidas: number; resultadoRealizado: number
    previstoReceber: number; previstoPagar: number; saldoProjetado: number
    vencidoReceber: number; quantidadeVencidas: number
  }
  mesesDisponiveis: string[]
}

interface FinanceiroViewProps { dados: FinanceiroData }

const tabItems = [
  { value: 'visao', label: 'Visão geral', short: 'Resumo' },
  { value: 'receber', label: 'A receber', short: 'Receber' },
  { value: 'pagar', label: 'A pagar', short: 'Pagar' },
  { value: 'caixa', label: 'Fluxo de caixa', short: 'Caixa' },
  { value: 'relatorios', label: 'Relatórios', short: 'Relatórios' },
] as const

function mesLabel(periodo: string) {
  const [ano, mes] = periodo.split('-').map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

function badgeVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'Recebido' || status === 'Pago') return 'success'
  if (status.includes('Vencido') || status.includes('atrasado')) return 'destructive'
  if (status === 'Cancelado') return 'secondary'
  return 'warning'
}

function statusAberto(status: string) {
  return !['Recebido', 'Pago', 'Cancelado'].includes(status)
}

export function FinanceiroView({ dados }: FinanceiroViewProps) {
  const router = useRouter()
  const [tab, setTab] = useState('visao')
  const [busca, setBusca] = useState('')
  const [status, setStatus] = useState('todos')
  const [novoTipo, setNovoTipo] = useState<'receber' | 'pagar' | null>(null)
  const [baixa, setBaixa] = useState<{ id: number; tipo: 'receber' | 'pagar'; descricao: string; restante: number } | null>(null)
  const [edicao, setEdicao] = useState<(Lancamento & { tipo: 'receber' | 'pagar' }) | null>(null)
  const [cancelamento, setCancelamento] = useState<{ id: number; tipo: 'receber' | 'pagar' } | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)

  const filtrar = (itens: Lancamento[]) => itens.filter((item) => {
    const texto = `${item.descricao} ${item.cliente || ''} ${item.fornecedor || ''} ${item.paciente || ''} ${item.ordemId || ''}`.toLowerCase()
    return texto.includes(busca.toLowerCase()) && (status === 'todos' || (status === 'abertos' ? statusAberto(item.status) : item.status.toLowerCase().includes(status)))
  })
  const receberFiltrado = filtrar(dados.receber)
  const pagarFiltrado = filtrar(dados.pagar)
  const taxaInadimplencia = dados.resumo.previstoReceber > 0 ? (dados.resumo.vencidoReceber / dados.resumo.previstoReceber) * 100 : 0
  const recebimentoPeriodo = dados.receber.reduce((s, c) => s + c.liquidado, 0)
  const ticketMedio = dados.receber.length ? dados.receber.reduce((s, c) => s + c.valor, 0) / dados.receber.length : 0

  async function confirmarCancelamento(motivo: string) {
    if (!cancelamento) return
    setCancelando(true)
    const resultado = await cancelarConta(cancelamento.id, cancelamento.tipo, motivo)
    setCancelando(false)
    if (!resultado.success) return toast.error(resultado.error)
    toast.success('Lançamento cancelado e preservado no histórico.')
    setCancelamento(null)
  }

  async function sincronizar() {
    setSincronizando(true)
    const resultado = await sincronizarFinanceiroRetroativo()
    setSincronizando(false)
    if (!resultado.success) return toast.error(resultado.error)
    toast.success(resultado.criadas ? `${resultado.criadas} cobranças recuperadas.` : 'Todas as ordens já estão sincronizadas.')
  }

  return (
    <DashboardLayout>
      {novoTipo && <NovaContaModal key={novoTipo} isOpen onClose={() => setNovoTipo(null)} tipoInicial={novoTipo} clientes={dados.clientes} />}
      {baixa && <BaixaContaModal key={`${baixa.tipo}-${baixa.id}`} conta={baixa} contasFinanceiras={dados.contasFinanceiras} onClose={() => setBaixa(null)} />}
      {edicao && <EditarContaModal key={`${edicao.tipo}-${edicao.id}`} conta={edicao} onClose={() => setEdicao(null)} />}
      <ReasonModal isOpen={cancelamento !== null} onClose={() => setCancelamento(null)} onConfirm={confirmarCancelamento} title="Cancelar lançamento" description="O registro será preservado para auditoria." label="Motivo do cancelamento" confirmLabel="Cancelar lançamento" loading={cancelando} />

      <Header title="Financeiro" subtitle="Caixa, cobranças, despesas e resultado do laboratório" action={{ label: 'Novo lançamento', onClick: () => setNovoTipo(tab === 'pagar' ? 'pagar' : 'receber') }} />

      <main className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Período de gestão</p><p className="mt-1 text-lg font-bold capitalize text-slate-900 dark:text-white">{mesLabel(dados.periodo)}</p></div>
          <div className="flex gap-2">
            <Select value={dados.periodo} onValueChange={(mes) => router.push(`/financeiro?mes=${mes}`)}>
              <SelectTrigger aria-label="Selecionar período" className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{dados.mesesDisponiveis.map((mes) => <SelectItem key={mes} value={mes}><span className="capitalize">{mesLabel(mes)}</span></SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={sincronizar} disabled={sincronizando} aria-label="Sincronizar cobranças de ordens finalizadas" title="Sincronizar ordens finalizadas"><RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} /></Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto pb-1"><TabsList className="min-w-max">{tabItems.map((item) => <TabsTrigger key={item.value} value={item.value} className="px-4"><span className="hidden sm:inline">{item.label}</span><span className="sm:hidden">{item.short}</span></TabsTrigger>)}</TabsList></div>

          <TabsContent value="visao" className="space-y-6">
            <section aria-label="Indicadores financeiros" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Saldo atual" value={dados.resumo.saldoAtual} detail="Movimentações realizadas" icon={Landmark} tone="blue" />
              <MetricCard title="Resultado do mês" value={dados.resumo.resultadoRealizado} detail={`${formatCurrency(dados.resumo.entradas)} entradas • ${formatCurrency(dados.resumo.saidas)} saídas`} icon={TrendingUp} tone={dados.resumo.resultadoRealizado >= 0 ? 'green' : 'red'} />
              <MetricCard title="Saldo projetado" value={dados.resumo.saldoProjetado} detail="Saldo + valores ainda em aberto" icon={WalletCards} tone="indigo" />
              <MetricCard title="Recebimentos vencidos" value={dados.resumo.vencidoReceber} detail={`${dados.resumo.quantidadeVencidas} cobrança(s) exigem atenção`} icon={AlertTriangle} tone="red" />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Card><CardHeader><div><h2 className="font-bold text-slate-900 dark:text-white">Previsto × realizado</h2><p className="text-sm text-slate-500">Leitura do período selecionado</p></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
                <FlowBlock title="Entradas" icon={ArrowUpRight} previsto={dados.resumo.previstoReceber + recebimentoPeriodo} realizado={dados.resumo.entradas} tone="emerald" />
                <FlowBlock title="Saídas" icon={ArrowDownRight} previsto={dados.resumo.previstoPagar + dados.resumo.saidas} realizado={dados.resumo.saidas} tone="red" />
              </CardContent></Card>
              <Card><CardHeader><div><h2 className="font-bold text-slate-900 dark:text-white">Agenda financeira</h2><p className="text-sm text-slate-500">Prioridades por vencimento</p></div></CardHeader><CardContent className="space-y-3">
                {[...dados.receber.filter((c) => statusAberto(c.status)).map((c) => ({ ...c, tipo: 'Entrada' })), ...dados.pagar.filter((c) => statusAberto(c.status)).map((c) => ({ ...c, tipo: 'Saída' }))].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 5).map((item) => (
                  <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.descricao}</p><p className="text-xs text-slate-500">{formatDate(item.vencimento)} • {item.tipo}</p></div><p className="shrink-0 text-sm font-bold">{formatCurrency(item.restante)}</p></div>
                ))}
                {dados.receber.length + dados.pagar.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Sem compromissos neste período.</p>}
              </CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="receber" className="space-y-4"><FilterBar busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} onAdd={() => setNovoTipo('receber')} addLabel="Nova receita" /><LancamentosList itens={receberFiltrado} tipo="receber" onBaixa={setBaixa} onEditar={(item) => setEdicao({ ...item, tipo: 'receber' })} onCancelar={(id) => setCancelamento({ id, tipo: 'receber' })} /></TabsContent>
          <TabsContent value="pagar" className="space-y-4"><FilterBar busca={busca} onBusca={setBusca} status={status} onStatus={setStatus} onAdd={() => setNovoTipo('pagar')} addLabel="Nova despesa" /><LancamentosList itens={pagarFiltrado} tipo="pagar" onBaixa={setBaixa} onEditar={(item) => setEdicao({ ...item, tipo: 'pagar' })} onCancelar={(id) => setCancelamento({ id, tipo: 'pagar' })} /></TabsContent>

          <TabsContent value="caixa" className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-3"><MetricCard title="Entradas realizadas" value={dados.resumo.entradas} detail="Dinheiro confirmado" icon={ArrowUpRight} tone="green" /><MetricCard title="Saídas realizadas" value={dados.resumo.saidas} detail="Pagamentos confirmados" icon={ArrowDownRight} tone="red" /><MetricCard title="Resultado realizado" value={dados.resumo.resultadoRealizado} detail="Entradas menos saídas" icon={Banknote} tone="blue" /></section>
            <Card><CardHeader><div><h2 className="font-bold">Movimentações do caixa</h2><p className="text-sm text-slate-500">Somente baixas efetivamente confirmadas</p></div></CardHeader><CardContent className="space-y-2">{dados.movimentacoes.map((item) => <div key={item.id} className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><p className="font-semibold">{item.descricao}</p><p className="text-xs text-slate-500">{item.pessoa || item.conta} • {item.formaPagamento}</p></div><p className="text-sm text-slate-500">{formatDate(item.data)}</p><p className={`font-bold ${item.tipo === 'Entrada' ? 'text-emerald-600' : 'text-red-600'}`}>{item.tipo === 'Entrada' ? '+' : '-'} {formatCurrency(item.valor)}</p></div>)}{dados.movimentacoes.length === 0 && <EmptyMessage text="Nenhuma movimentação realizada neste período." />}</CardContent></Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><ReportCard title="Inadimplência" value={`${taxaInadimplencia.toFixed(1)}%`} description="Do saldo a receber está vencido" icon={AlertTriangle} /><ReportCard title="Ticket médio" value={formatCurrency(ticketMedio)} description="Por cobrança no período" icon={CircleDollarSign} /><ReportCard title="Resultado caixa" value={formatCurrency(dados.resumo.resultadoRealizado)} description="Entradas menos saídas realizadas" icon={FileBarChart} /><ReportCard title="Compromissos" value={formatCurrency(dados.resumo.previstoPagar)} description="Ainda a pagar no período" icon={CalendarDays} /></section>
            <Card><CardHeader><div><h2 className="font-bold">Resumo gerencial</h2><p className="text-sm text-slate-500">Indicadores prontos para decisão</p></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><SummaryLine label="Receita prevista" value={dados.resumo.previstoReceber + recebimentoPeriodo} /><SummaryLine label="Receita realizada" value={dados.resumo.entradas} /><SummaryLine label="Despesa prevista" value={dados.resumo.previstoPagar + dados.resumo.saidas} /><SummaryLine label="Despesa realizada" value={dados.resumo.saidas} /><SummaryLine label="Vencido a receber" value={dados.resumo.vencidoReceber} alert /><SummaryLine label="Saldo projetado" value={dados.resumo.saldoProjetado} /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </main>
    </DashboardLayout>
  )
}

function MetricCard({ title, value, detail, icon: Icon, tone }: { title: string; value: number; detail: string; icon: typeof Landmark; tone: 'blue' | 'green' | 'red' | 'indigo' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300', indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300' }
  return <Card><CardContent className="p-5"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(value)}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></CardContent></Card>
}

function FlowBlock({ title, icon: Icon, previsto, realizado, tone }: { title: string; icon: typeof ArrowUpRight; previsto: number; realizado: number; tone: 'emerald' | 'red' }) {
  const percentual = previsto > 0 ? Math.min(100, (realizado / previsto) * 100) : 0
  return <div className="rounded-2xl border p-4"><div className="flex items-center gap-2"><Icon className={`h-5 w-5 ${tone === 'emerald' ? 'text-emerald-600' : 'text-red-600'}`} /><p className="font-bold">{title}</p></div><div className="mt-5 flex justify-between text-sm"><span className="text-slate-500">Realizado</span><strong>{formatCurrency(realizado)}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800"><div className={`h-full rounded-full ${tone === 'emerald' ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${percentual}%` }} /></div><div className="mt-2 flex justify-between text-xs text-slate-500"><span>{percentual.toFixed(0)}% confirmado</span><span>Previsto {formatCurrency(previsto)}</span></div></div>
}

function FilterBar({ busca, onBusca, status, onStatus, onAdd, addLabel }: { busca: string; onBusca: (value: string) => void; status: string; onStatus: (value: string) => void; onAdd: () => void; addLabel: string }) {
  return <div className="flex flex-col gap-3 rounded-2xl border bg-white p-4 dark:border-white/10 dark:bg-zinc-900 lg:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="Buscar lançamentos" value={busca} onChange={(event) => onBusca(event.target.value)} placeholder="Buscar cliente, fornecedor, paciente ou OS" className="pl-9" /></div><Select value={status} onValueChange={onStatus}><SelectTrigger aria-label="Filtrar por situação" className="w-full lg:w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todos">Todas as situações</SelectItem><SelectItem value="abertos">Somente em aberto</SelectItem><SelectItem value="vencido">Vencidos</SelectItem><SelectItem value="parcial">Parciais</SelectItem><SelectItem value="cancelado">Cancelados</SelectItem></SelectContent></Select><Button onClick={onAdd}><Plus className="h-4 w-4" />{addLabel}</Button></div>
}

function LancamentosList({ itens, tipo, onBaixa, onEditar, onCancelar }: { itens: Lancamento[]; tipo: 'receber' | 'pagar'; onBaixa: (conta: { id: number; tipo: 'receber' | 'pagar'; descricao: string; restante: number }) => void; onEditar: (item: Lancamento) => void; onCancelar: (id: number) => void }) {
  return <Card><CardContent className="p-0"><div className="hidden overflow-x-auto md:block"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:bg-white/5"><th className="px-5 py-4">Lançamento</th><th className="px-5 py-4">{tipo === 'receber' ? 'Cliente' : 'Fornecedor / categoria'}</th><th className="px-5 py-4">Vencimento</th><th className="px-5 py-4">Situação</th><th className="px-5 py-4 text-right">Saldo</th><th className="px-5 py-4 text-right">Ações</th></tr></thead><tbody>{itens.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-5 py-4"><p className="font-semibold">{item.descricao}</p>{item.ordemId && <a href={`/ordens?id=${item.ordemId}`} className="text-xs font-semibold text-indigo-600 hover:underline">OS #{item.ordemId} • {item.paciente}</a>}</td><td className="px-5 py-4"><p>{tipo === 'receber' ? item.cliente : item.fornecedor}</p><p className="text-xs text-slate-500">{tipo === 'pagar' ? item.categoria : item.servico}</p></td><td className="px-5 py-4">{formatDate(item.vencimento)}</td><td className="px-5 py-4"><Badge variant={badgeVariant(item.status)}>{item.status}</Badge>{item.liquidado > 0 && statusAberto(item.status) && <p className="mt-1 text-xs text-slate-500">{formatCurrency(item.liquidado)} liquidado</p>}</td><td className="px-5 py-4 text-right font-bold">{formatCurrency(item.restante)}</td><td className="px-5 py-4"><div className="flex justify-end gap-1">{statusAberto(item.status) && <Button size="sm" variant="outline" onClick={() => onBaixa({ id: item.id, tipo, descricao: item.descricao, restante: item.restante })}><CheckCircle2 className="h-4 w-4" />{tipo === 'receber' ? 'Receber' : 'Pagar'}</Button>}{item.status !== 'Cancelado' && <Button size="icon" variant="ghost" onClick={() => onEditar(item)} aria-label={`Editar ${item.descricao}`} title="Editar lançamento"><Pencil className="h-4 w-4 text-slate-400" /></Button>}{item.liquidado === 0 && item.status !== 'Cancelado' && <Button size="icon" variant="ghost" onClick={() => onCancelar(item.id)} aria-label={`Cancelar ${item.descricao}`} title="Cancelar lançamento"><XCircle className="h-4 w-4 text-slate-400" /></Button>}</div></td></tr>)}</tbody></table></div><div className="divide-y md:hidden">{itens.map((item) => <article key={item.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.descricao}</p><p className="text-xs text-slate-500">{tipo === 'receber' ? item.cliente : `${item.fornecedor} • ${item.categoria}`}</p></div><Badge variant={badgeVariant(item.status)}>{item.status}</Badge></div><div className="flex items-end justify-between"><div><p className="text-xs text-slate-500">Vence em {formatDate(item.vencimento)}</p><p className="text-lg font-bold">{formatCurrency(item.restante)}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => onEditar(item)} aria-label={`Editar ${item.descricao}`}><Pencil className="h-4 w-4" /></Button>{statusAberto(item.status) && <Button size="sm" onClick={() => onBaixa({ id: item.id, tipo, descricao: item.descricao, restante: item.restante })}>{tipo === 'receber' ? 'Receber' : 'Pagar'}</Button>}</div></div></article>)}</div>{itens.length === 0 && <EmptyMessage text="Nenhum lançamento encontrado com estes filtros." />}</CardContent></Card>
}

function EmptyMessage({ text }: { text: string }) { return <div className="p-12 text-center text-sm text-slate-500">{text}</div> }
function ReportCard({ title, value, description, icon: Icon }: { title: string; value: string; description: string; icon: typeof AlertTriangle }) { return <Card><CardContent className="p-5"><Icon className="mb-4 h-5 w-5 text-indigo-600" /><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="mt-2 text-xs text-slate-500">{description}</p></CardContent></Card> }
function SummaryLine({ label, value, alert }: { label: string; value: number; alert?: boolean }) { return <div className="flex items-center justify-between rounded-xl border p-4"><span className="text-sm text-slate-600 dark:text-slate-300">{label}</span><strong className={alert ? 'text-red-600' : ''}>{formatCurrency(value)}</strong></div> }
