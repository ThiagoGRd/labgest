'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NovaContaModal } from '@/components/financeiro/nova-conta-modal'
import {
  Search,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
} from 'lucide-react'

// Types
interface Conta {
  id: number
  descricao: string
  cliente?: string
  categoria?: string
  valor: number
  vencimento: string
  status: string
  observacoes: string
}

interface FinanceiroViewProps {
  initialData: {
    receber: Conta[]
    pagar: Conta[]
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function getStatusBadge(status: string) {
  const variants: Record<string, { variant: any; icon: any }> = {
    'Pendente': { variant: 'warning', icon: Clock },
    'Vencido': { variant: 'destructive', icon: AlertTriangle },
    'Recebido': { variant: 'success', icon: CheckCircle },
    'Pago': { variant: 'success', icon: CheckCircle },
  }
  return variants[status] || { variant: 'default', icon: Clock }
}

export function FinanceiroView({ initialData }: FinanceiroViewProps) {
  const [activeTab, setActiveTab] = useState<'receber' | 'pagar'>('receber')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const contasReceber = initialData?.receber || []
  const contasPagar = initialData?.pagar || []

  const totalReceber = contasReceber.filter(c => c.status !== 'Recebido').reduce((acc, c) => acc + c.valor, 0)
  const totalPagar = contasPagar.filter(c => c.status !== 'Pago').reduce((acc, c) => acc + c.valor, 0)
  const vencidas = contasReceber.filter(c => c.status === 'Vencido').length
  const saldo = totalReceber - totalPagar

  const contasFiltradas = activeTab === 'receber' 
    ? contasReceber.filter(c => c.descricao.toLowerCase().includes(search.toLowerCase()))
    : contasPagar.filter(c => c.descricao.toLowerCase().includes(search.toLowerCase()))

  return (
    <DashboardLayout>
      <NovaContaModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        tipoInicial={activeTab}
        onSuccess={() => {
          setModalOpen(false)
        }}
      />

      <Header 
        title="Financeiro" 
        subtitle="Controle de contas a receber e pagar"
      />
      
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">A Receber</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalReceber)}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-100">
                  <TrendingUp className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">A Pagar</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPagar)}</p>
                </div>
                <div className="p-3 rounded-xl bg-red-100">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Saldo Previsto</p>
                  <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatCurrency(saldo)}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${saldo >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                  <DollarSign className={`h-6 w-6 ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Vencidas</p>
                  <p className="text-2xl font-bold text-amber-600">{vencidas}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-100">
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('receber')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'receber'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4" />
              Contas a Receber
            </div>
          </button>
          <button
            onClick={() => setActiveTab('pagar')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'pagar'
                ? 'bg-red-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4" />
              Contas a Pagar
            </div>
          </button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button 
                onClick={() => setModalOpen(true)}
                className={activeTab === 'receber' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
              >
                + Nova Conta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Descrição
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    {activeTab === 'receber' ? 'Cliente' : 'Categoria'}
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Vencimento
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Valor
                  </th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contasFiltradas.map((conta: any) => {
                  const statusInfo = getStatusBadge(conta.status)
                  const StatusIcon = statusInfo.icon
                  return (
                    <tr key={conta.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{conta.descricao}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-600">
                          {activeTab === 'receber' ? conta.cliente : conta.categoria}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{formatDate(conta.vencimento)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={statusInfo.variant} className="flex items-center gap-1 w-fit">
                          <StatusIcon className="h-3 w-3" />
                          {conta.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${
                          activeTab === 'receber' ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(conta.valor)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button 
                          size="sm" 
                          variant={conta.status === 'Recebido' || conta.status === 'Pago' ? 'secondary' : 'default'}
                          className={conta.status !== 'Recebido' && conta.status !== 'Pago' 
                            ? (activeTab === 'receber' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700')
                            : ''
                          }
                          disabled={conta.status === 'Recebido' || conta.status === 'Pago'}
                        >
                          {conta.status === 'Recebido' || conta.status === 'Pago' 
                            ? 'Baixado' 
                            : (activeTab === 'receber' ? 'Receber' : 'Pagar')
                          }
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
