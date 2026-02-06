'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react'

interface DashboardData {
  totalOrdens: number
  faturamento: number
  atrasadas: number
  emProducao: number
  proximasEntregas: {
    id: number
    paciente: string
    cliente: string
    servico: string
    dataEntrega: string
    status: string
  }[]
}

interface DashboardViewProps {
  initialData: DashboardData
}

function getStatusVariant(status: string) {
  const map: Record<string, any> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
    'Cancelado': 'destructive',
    'Pausado': 'pausado',
  }
  return map[status] || 'default'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function DashboardView({ initialData }: DashboardViewProps) {
  // Stats baseados nos dados reais
  const stats = [
    {
      name: 'Total Ordens (Mês)',
      value: initialData.totalOrdens.toString(),
      icon: ClipboardList,
      color: 'bg-indigo-500',
    },
    {
      name: 'Em Produção',
      value: initialData.emProducao.toString(),
      icon: Clock,
      color: 'bg-blue-500',
    },
    {
      name: 'Atrasadas',
      value: initialData.atrasadas.toString(),
      icon: AlertTriangle,
      color: 'bg-red-500',
    },
    {
      name: 'Faturamento (Mês)',
      value: formatCurrency(initialData.faturamento),
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
  ]

  return (
    <DashboardLayout>
      <Header 
        title="Dashboard" 
        subtitle="Visão geral do laboratório"
      />
      
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.name} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.name}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.color}`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                {/* Decorative gradient */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${stat.color}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Próximas Entregas */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Próximas Entregas</CardTitle>
              <a href="/ordens" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Ver todas →
              </a>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {initialData.proximasEntregas.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Nenhuma entrega prevista.</p>
                ) : (
                  initialData.proximasEntregas.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 truncate">{order.paciente}</p>
                        </div>
                        <p className="text-sm text-slate-500 truncate mt-1">
                          {order.servico} • {order.cliente}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <div className="text-right">
                          <Badge variant={getStatusVariant(order.status)}>
                            {order.status}
                          </Badge>
                          <p className="text-xs text-slate-400 mt-1">{formatDate(order.dataEntrega)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Insights IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* AI Chat Preview */}
              <div className="mt-2 p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5" />
                  <span className="font-medium">Pergunte à IA</span>
                </div>
                <p className="text-sm opacity-90 mb-3">
                  "Qual foi o faturamento de janeiro?"
                </p>
                <a 
                  href="/relatorios"
                  className="inline-flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white"
                >
                  Abrir relatórios →
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
