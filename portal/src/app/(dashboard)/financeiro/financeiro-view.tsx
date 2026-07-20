'use client'

import { useState } from 'react'
import { AlertTriangle, Calendar, CheckCircle2, Clock } from 'lucide-react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import type { PortalUser } from '@/components/layout/portal-layout'

interface Conta {
  id: number
  descricao: string
  ordemId: number | null
  paciente: string
  servico: string
  valor: number
  liquidado: number
  restante: number
  vencimento: string
  recebimento: string | null
  status: string
  diasAtraso: number
}

interface FinanceiroViewProps { user: PortalUser; pendentes: Conta[]; pagas: Conta[] }

function formatDate(value: string) { return new Date(value).toLocaleDateString('pt-BR') }
function formatCurrency(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) }
function statusVariant(status: string): 'success' | 'warning' | 'destructive' {
  if (status === 'Pago') return 'success'
  if (status === 'Vencido' || status.includes('atrasado')) return 'destructive'
  return 'warning'
}

export function FinanceiroView({ user, pendentes, pagas }: FinanceiroViewProps) {
  const [activeTab, setActiveTab] = useState<'pendentes' | 'pagas'>('pendentes')
  const totalPendente = pendentes.reduce((total, conta) => total + conta.restante, 0)
  const totalPago = pagas.reduce((total, conta) => total + conta.valor, 0)
  const vencidas = pendentes.filter((conta) => conta.diasAtraso > 0)
  const activeList = activeTab === 'pendentes' ? pendentes : pagas

  return (
    <PortalLayout user={user}>
      <header className="mb-6 sm:mb-8"><h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financeiro</h1><p className="text-slate-500 dark:text-slate-400">Cobranças, vencimentos e pagamentos detalhados por ordem</p></header>

      <section aria-label="Resumo financeiro" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Em aberto" value={totalPendente} detail={`${pendentes.length} cobrança(s)`} icon={Clock} tone="amber" />
        <SummaryCard title="Vencido" value={vencidas.reduce((total, conta) => total + conta.restante, 0)} detail={`${vencidas.length} cobrança(s) exigem atenção`} icon={AlertTriangle} tone="red" />
        <SummaryCard title="Total pago" value={totalPago} detail={`${pagas.length} cobrança(s) liquidadas`} icon={CheckCircle2} tone="emerald" />
      </section>

      <div className="mb-6 flex border-b border-slate-200 dark:border-zinc-800" role="tablist" aria-label="Situação das cobranças">
        <button role="tab" aria-selected={activeTab === 'pendentes'} className={`px-5 py-3 text-sm font-bold border-b-2 ${activeTab === 'pendentes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('pendentes')}>Em aberto ({pendentes.length})</button>
        <button role="tab" aria-selected={activeTab === 'pagas'} className={`px-5 py-3 text-sm font-bold border-b-2 ${activeTab === 'pagas' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'}`} onClick={() => setActiveTab('pagas')}>Pagas ({pagas.length})</button>
      </div>

      <Card className="overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-800/50"><th className="px-6 py-4">Pedido / paciente</th><th className="px-6 py-4">Vencimento</th><th className="px-6 py-4">Situação</th><th className="px-6 py-4 text-right">{activeTab === 'pendentes' ? 'Saldo' : 'Valor'}</th></tr></thead>
            <tbody className="divide-y dark:divide-zinc-800">{activeList.map((conta) => <tr key={conta.id}><td className="px-6 py-4"><p className="font-bold">{conta.paciente}</p><p className="text-xs text-slate-500">{conta.ordemId ? `OS #${conta.ordemId} • ${conta.servico}` : conta.descricao}</p></td><td className="px-6 py-4"><span className="flex items-center gap-1.5 text-slate-500"><Calendar className="h-4 w-4" />{formatDate(activeTab === 'pagas' && conta.recebimento ? conta.recebimento : conta.vencimento)}</span></td><td className="px-6 py-4"><Badge variant={statusVariant(conta.status)}>{conta.status}</Badge>{conta.diasAtraso > 0 && <p className="mt-1 text-xs font-semibold text-red-600">{conta.diasAtraso} dias em atraso</p>}</td><td className="px-6 py-4 text-right font-bold">{formatCurrency(activeTab === 'pendentes' ? conta.restante : conta.valor)}{conta.liquidado > 0 && conta.restante > 0 && <p className="text-xs font-normal text-slate-500">{formatCurrency(conta.liquidado)} já pago</p>}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="divide-y dark:divide-zinc-800 md:hidden">{activeList.map((conta) => <article key={conta.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{conta.paciente}</p><p className="text-xs text-slate-500">{conta.ordemId ? `OS #${conta.ordemId} • ${conta.servico}` : conta.descricao}</p></div><Badge variant={statusVariant(conta.status)}>{conta.status}</Badge></div><div className="flex items-end justify-between"><div><p className="text-xs text-slate-500">{activeTab === 'pagas' ? 'Pagamento' : 'Vencimento'}: {formatDate(activeTab === 'pagas' && conta.recebimento ? conta.recebimento : conta.vencimento)}</p>{conta.diasAtraso > 0 && <p className="text-xs font-semibold text-red-600">{conta.diasAtraso} dias em atraso</p>}</div><p className="text-lg font-bold">{formatCurrency(activeTab === 'pendentes' ? conta.restante : conta.valor)}</p></div>{conta.liquidado > 0 && conta.restante > 0 && <p className="text-xs text-slate-500">Já pago: {formatCurrency(conta.liquidado)}</p>}</article>)}</div>
        {activeList.length === 0 && <EmptyState title={activeTab === 'pendentes' ? 'Sem pendências' : 'Nenhum pagamento'} description={activeTab === 'pendentes' ? 'Você não possui cobranças em aberto.' : 'Você ainda não possui cobranças liquidadas.'} />}
      </Card>
      {activeTab === 'pendentes' && pendentes.length > 0 && <p className="mt-6 text-right text-sm text-slate-500">Para pagar ou enviar comprovantes, entre em contato com o laboratório pelo WhatsApp.</p>}
    </PortalLayout>
  )
}

function SummaryCard({ title, value, detail, icon: Icon, tone }: { title: string; value: number; detail: string; icon: typeof Clock; tone: 'amber' | 'red' | 'emerald' }) {
  const colors = { amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300', emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' }
  return <Card className={colors[tone]}><CardContent className="p-5"><Icon className="mb-4 h-6 w-6" /><p className="text-xs font-bold uppercase tracking-wider opacity-75">{title}</p><p className="mt-1 text-2xl font-bold">{formatCurrency(value)}</p><p className="mt-2 text-xs opacity-75">{detail}</p></CardContent></Card>
}
