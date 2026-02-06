'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { baixarConta } from '@/actions/financeiro'
import { NovaContaModal } from '@/components/financeiro/nova-conta-modal'
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
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function FinanceiroView({ receber, pagar }: FinanceiroViewProps) {
  const [activeTab, setActiveTab] = useState('receber')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'receber' | 'pagar'>('receber')

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
        type={modalType}
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
        {/* Cards Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <ArrowUpRight className="h-6 w-6 text-emerald-600" />
                </div>
                <span className="text-sm font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded">
                  A Receber
                </span>
              </div>
              <p className="text-sm text-emerald-700">Previsão de Entrada</p>
              <h3 className="text-2xl font-bold text-emerald-900 mt-1">{formatCurrency(totalReceber)}</h3>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <ArrowDownRight className="h-6 w-6 text-red-600" />
                </div>
                <span className="text-sm font-medium text-red-600 bg-red-100 px-2 py-1 rounded">
                  A Pagar
                </span>
              </div>
              <p className="text-sm text-red-700">Previsão de Saída</p>
              <h3 className="text-2xl font-bold text-red-900 mt-1">{formatCurrency(totalPagar)}</h3>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  Saldo Previsto
                </span>
              </div>
              <p className="text-sm text-blue-700">Balanço</p>
              <h3 className="text-2xl font-bold text-blue-900 mt-1">{formatCurrency(saldoPrevisto)}</h3>
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
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Descrição</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Cliente</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Vencimento</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Status</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Valor</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receber.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            Nenhuma conta a receber lançada.
                          </td>
                        </tr>
                      ) : (
                        receber.map((conta) => (
                          <tr key={conta.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="p-4 font-medium">
                              {conta.descricao}
                              {conta.ordemId && (
                                <span className="ml-2 text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                  OS #{conta.ordemId}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-slate-600">{conta.cliente}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Calendar className="h-4 w-4" />
                                {formatDate(conta.vencimento)}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={conta.status === 'Pago' ? 'default' : 'outline'} className={
                                conta.status === 'Pago' ? 'bg-emerald-500 hover:bg-emerald-600' : 'text-amber-600 border-amber-200 bg-amber-50'
                              }>
                                {conta.status === 'Pago' ? 'Recebido' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium text-emerald-600">
                              {formatCurrency(conta.valor)}
                            </td>
                            <td className="p-4 text-right">
                              {conta.status !== 'Pago' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
                <div className="rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Descrição</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Categoria</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Vencimento</th>
                        <th className="h-10 px-4 text-left font-medium text-slate-500">Status</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Valor</th>
                        <th className="h-10 px-4 text-right font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagar.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            Nenhuma conta a pagar lançada.
                          </td>
                        </tr>
                      ) : (
                        pagar.map((conta) => (
                          <tr key={conta.id} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="p-4 font-medium">{conta.descricao}</td>
                            <td className="p-4">
                              <Badge variant="secondary" className="font-normal">
                                {conta.categoria}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2 text-slate-600">
                                <Calendar className="h-4 w-4" />
                                {formatDate(conta.vencimento)}
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={conta.status === 'Pago' ? 'default' : 'outline'} className={
                                conta.status === 'Pago' ? 'bg-emerald-500 hover:bg-emerald-600' : 'text-red-600 border-red-200 bg-red-50'
                              }>
                                {conta.status === 'Pago' ? 'Pago' : 'Pendente'}
                              </Badge>
                            </td>
                            <td className="p-4 text-right font-medium text-red-600">
                              {formatCurrency(conta.valor)}
                            </td>
                            <td className="p-4 text-right">
                              {conta.status !== 'Pago' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
