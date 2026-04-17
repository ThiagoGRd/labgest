'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { DollarSign, CheckCircle2, Clock, Calendar, Download } from 'lucide-react'

interface Conta {
  id: number
  descricao: string
  ordemId: number | null
  paciente: string
  servico: string
  valor: number
  vencimento: string
  recebimento: string | null
  status: string
}

interface FinanceiroViewProps {
  user: any
  pendentes: Conta[]
  pagas: Conta[]
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function FinanceiroView({ user, pendentes, pagas }: FinanceiroViewProps) {
  const [activeTab, setActiveTab] = useState<'pendentes' | 'pagas'>('pendentes')

  const totalPendente = pendentes.reduce((acc, curr) => acc + curr.valor, 0)
  const totalPago = pagas.reduce((acc, curr) => acc + curr.valor, 0)

  const activeList = activeTab === 'pendentes' ? pendentes : pagas

  return (
    <PortalLayout user={user}>
      <div className="flex flex-col mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Financeiro</h1>
        <p className="text-slate-500 dark:text-slate-400">Acompanhe seus pagamentos e faturas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-500/10 px-2 py-1 rounded">
                À Vencer / Pendente
              </span>
            </div>
            <h3 className="text-3xl font-bold text-amber-900 dark:text-amber-50 mt-1">{formatCurrency(totalPendente)}</h3>
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mt-2 opacity-80">{pendentes.length} cobranças pendentes</p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-1 rounded">
                Total Pago
              </span>
            </div>
            <h3 className="text-3xl font-bold text-emerald-900 dark:text-emerald-50 mt-1">{formatCurrency(totalPago)}</h3>
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mt-2 opacity-80">{pagas.length} cobranças liquidadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-6">
        <button
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'pendentes' 
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('pendentes')}
        >
          Pendentes
        </button>
        <button
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'pagas' 
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' 
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
          onClick={() => setActiveTab('pagas')}
        >
          Histórico Pagos
        </button>
      </div>

      <Card className="dark:bg-zinc-900 dark:border-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Descrição</th>
                <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Pedido / Paciente</th>
                <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">
                  {activeTab === 'pendentes' ? 'Vencimento' : 'Data de Pagto'}
                </th>
                <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Valor</th>
                <th className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {activeList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState 
                      title={activeTab === 'pendentes' ? "Sem pendências" : "Nenhum histórico"} 
                      description={activeTab === 'pendentes' 
                        ? "Excelente! Você não possui faturas ou boletos pendentes." 
                        : "Você ainda não possui faturas liquidadas registradas."}
                    />
                  </td>
                </tr>
              ) : (
                activeList.map((conta) => (
                  <tr key={conta.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{conta.descricao}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{conta.paciente}</p>
                      {conta.ordemId && <p className="text-xs text-slate-500 dark:text-slate-400">OS #{conta.ordemId} • {conta.servico}</p>}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(activeTab === 'pendentes' ? conta.vencimento : (conta.recebimento || conta.vencimento))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                      {formatCurrency(conta.valor)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={conta.status === 'Pendente' ? 'warning' : 'success'}>
                        {conta.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {activeTab === 'pendentes' && pendentes.length > 0 && (
        <div className="mt-6 flex justify-end">
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Para realizar o pagamento ou enviar comprovantes, entre em contato diretamente com o laboratório pelo WhatsApp.
          </p>
        </div>
      )}
    </PortalLayout>
  )
}
