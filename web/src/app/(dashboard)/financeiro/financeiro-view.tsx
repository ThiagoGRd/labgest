'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { baixarConta, sincronizarFinanceiroRetroativo } from '@/actions/financeiro'
import { NovaContaModal } from '@/components/financeiro/nova-conta-modal'
import { RefreshCw } from 'lucide-react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Filter
} from 'lucide-react'

interface Conta {
  id: number
  descricao: string
  cliente?: string
  categoria?: string
  valor: number
  vencimento: string
  status: string
  observacoes?: string
  ordemId?: number | null
}

interface FinanceiroViewProps {
  receber: Conta[]
  pagar: Conta[]
  totalReceberMes: number
  qtdReceberMes: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function FinanceiroView({ receber, pagar, totalReceberMes, qtdReceberMes }: FinanceiroViewProps) {
  const [activeTab, setActiveTab] = useState('receber')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'receber' | 'pagar'>('receber')

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const [sincronizando, setSincronizando] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const handleSincronizar = async () => {
    setSincronizando(true)
    setSyncMsg(null)
    const res = await sincronizarFinanceiroRetroativo()
    if (res.success) {
      setSyncMsg(res.criadas === 0 ? 'Tudo sincronizado! Nenhuma cobrança pendente encontrada.' : `${res.criadas} cobranças criadas com sucesso!`)
    } else {
      setSyncMsg('Erro ao sincronizar. Tente novamente.')
    }
    setSincronizando(false)
  }

  const totalReceber = receber.reduce((acc, curr) => curr.status !== 'Pago' ? acc + curr.valor : acc, 0)
  const totalPagar = pagar.reduce((acc, curr) => curr.status !== 'Pago' ? acc + curr.valor : acc, 0)
  const saldoPrevisto = totalReceber - totalPagar

  const handleBaixa = async (id: number, tipo: 'receber' | 'pagar') => {
    if (confirm('Confirmar recebimento/pagamento desta conta?')) {
      await baixarConta(id, tipo)
    }
  }

  const openNewModal = (type: 'receber' | 'pagar') => {
    setModalType(type)
    setModalOpen(true)
  }

  return (
    <DashboardLayout>
      <NovaContaModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        tipoInicial={modalType}
      />

      <Header 
        title="Financeiro" 
        subtitle="Gestão de fluxo de caixa"
        action={{
          label: 'Nova Movimentação',
          onClick: () => openNewModal(activeTab as 'receber' | 'pagar'),
        }}
      />

      <div className="p-6 space-y-6">
        {/* Banner de sincronização retroativa */}
        <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">Sincronizar ordens finalizadas</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
              {syncMsg || 'Gera cobranças retroativas para ordens já finalizadas sem registro financeiro.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSincronizar}
            disabled={sincronizando}
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-500/20 shrink-0 ml-4"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando...' : 'Sincronizar Agora'}
          </Button>
        </div>

        {/* Cards Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: A Receber Total */}
          <Card className="bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-500/10 px-2 py-1 rounded">
                  Total A Receber
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300 opacity-70">Previsão de Entrada</p>
              <h3 className="text-3xl font-bold text-emerald-900 dark:text-emerald-50 mt-1">{formatCurrency(totalReceber)}</h3>
            </CardContent>
          </Card>

          {/* Card 2: A Receber Este Mês — destaque */}
          <Card className="bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                  <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100/50 dark:bg-indigo-500/10 px-2 py-1 rounded">
                  Este Mês
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 opacity-70">Vence em {mesAtual}</p>
              <h3 className="text-3xl font-bold text-indigo-900 dark:text-indigo-50 mt-1">{formatCurrency(totalReceberMes)}</h3>
              {qtdReceberMes > 0 && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                  {qtdReceberMes} {qtdReceberMes === 1 ? 'cobrança pendente' : 'cobranças pendentes'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card 3: A Pagar */}
          <Card className="bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                  <ArrowDownRight className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-500/10 px-2 py-1 rounded">
                  A Pagar
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-300 opacity-70">Previsão de Saída</p>
              <h3 className="text-3xl font-bold text-red-900 dark:text-red-50 mt-1">{formatCurrency(totalPagar)}</h3>
            </CardContent>
          </Card>

          {/* Card 4: Saldo */}
          <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/10 px-2 py-1 rounded">
                  Saldo Previsto
                </span>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300 opacity-70">Balanço</p>
              <h3 className="text-3xl font-bold text-blue-900 dark:text-blue-50 mt-1">{formatCurrency(saldoPrevisto)}</h3>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Contas */}
        <Card>
          <CardHeader className="pb-0">
            <Tabs defaultValue="receber" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="receber" className="px-6">A Receber</TabsTrigger>
                  <TabsTrigger value="pagar" className="px-6">A Pagar</TabsTrigger>
                </TabsList>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openNewModal('receber')}>
                    <Plus className="h-4 w-4 mr-2" /> Receita
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openNewModal('pagar')}>
                    <Plus className="h-4 w-4 mr-2" /> Despesa
                  </Button>
                </div>
              </div>

              <TabsContent value="receber" className="mt-0">
                <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Descrição</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Cliente</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Vencimento</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Status</th>
                        <th className="h-12 px-4 text-right font-bold uppercase text-[10px] tracking-widest text-slate-500">Valor</th>
                        <th className="h-12 px-4 text-right font-bold uppercase text-[10px] tracking-widest text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/10">
                      {receber.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400 font-medium italic">
                            Nenhuma conta a receber lançada.
                          </td>
                        </tr>
                      ) : (
                        receber.map((conta) => (
                          <tr key={conta.id} className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">
                              {conta.descricao}
                              {conta.ordemId && (
                                <span className="ml-2 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">
                                  OS #{conta.ordemId}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{conta.cliente}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                <Calendar className="h-4 w-4" />
                                {formatDate(conta.vencimento)}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={conta.status === 'Pago' ? 'success' : 'warning'}>
                                {conta.status === 'Pago' ? 'Recebido' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(conta.valor)}
                            </td>
                            <td className="p-4 text-right">
                              {conta.status !== 'Pago' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 font-bold text-xs"
                                  onClick={() => handleBaixa(conta.id, 'receber')}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Receber
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              <TabsContent value="pagar" className="mt-0">
                <div className="rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/5 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Descrição</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Categoria</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Vencimento</th>
                        <th className="h-12 px-4 text-left font-bold uppercase text-[10px] tracking-widest text-slate-500">Status</th>
                        <th className="h-12 px-4 text-right font-bold uppercase text-[10px] tracking-widest text-slate-500">Valor</th>
                        <th className="h-12 px-4 text-right font-bold uppercase text-[10px] tracking-widest text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/10">
                      {pagar.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-slate-400 font-medium italic">
                            Nenhuma conta a pagar lançada.
                          </td>
                        </tr>
                      ) : (
                        pagar.map((conta) => (
                          <tr key={conta.id} className="hover:bg-white/40 dark:hover:bg-white/5 transition-colors">
                            <td className="p-4 font-bold text-slate-900 dark:text-white">{conta.descricao}</td>
                            <td className="p-4">
                              <Badge variant="secondary">
                                {conta.categoria}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400" suppressHydrationWarning>
                                <Calendar className="h-4 w-4" />
                                {formatDate(conta.vencimento)}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={conta.status === 'Pago' ? 'success' : 'destructive'}>
                                {conta.status === 'Pago' ? 'Pago' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">
                              {formatCurrency(conta.valor)}
                            </td>
                            <td className="p-4 text-right">
                              {conta.status !== 'Pago' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold text-xs"
                                  onClick={() => handleBaixa(conta.id, 'pagar')}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Pagar
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  )
}
