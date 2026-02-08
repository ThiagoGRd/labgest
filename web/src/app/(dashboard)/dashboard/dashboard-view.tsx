'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
      color: 'from-blue-600 to-indigo-600',
    },
    {
      name: 'Em Produção',
      value: initialData.emProducao.toString(),
      icon: Clock,
      color: 'from-cyan-500 to-blue-500',
    },
    {
      name: 'Atrasadas',
      value: initialData.atrasadas.toString(),
      icon: AlertTriangle,
      color: 'from-rose-500 to-orange-500',
    },
    {
      name: 'Faturamento (Mês)',
      value: formatCurrency(initialData.faturamento),
      icon: DollarSign,
      color: 'from-emerald-500 to-teal-500',
    },
  ]

  return (
    <DashboardLayout>
      <Header 
        title="Dashboard" 
        subtitle="Visão geral do laboratório"
      />
      
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, idx) => (
            <Card 
              key={stat.name} 
              className="relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 animate-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.name}</p>
                    <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{stat.value}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg shadow-black/10 transition-transform duration-500 group-hover:rotate-12`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                
                {/* Visual Accent */}
                <div className="mt-4 flex items-center gap-2">
                  <span className="flex items-center text-xs font-bold text-emerald-500">
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    +12%
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">desde o mês passado</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Próximas Entregas */}
          <Card className="lg:col-span-2 overflow-hidden animate-in" style={{ animationDelay: '400ms' }}>
            <CardHeader className="flex flex-row items-center justify-between border-b border-black/5 dark:border-white/5 pb-6">
              <div>
                <CardTitle className="text-xl">Próximas Entregas</CardTitle>
                <p className="text-xs font-medium text-slate-400 mt-1">Casos que precisam sair em breve</p>
              </div>
              <Button variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 font-bold text-xs uppercase tracking-widest">
                Ver todas →
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {initialData.proximasEntregas.length === 0 ? (
                  <p className="text-slate-500 text-center py-12">Nenhuma entrega prevista.</p>
                ) : (
                  initialData.proximasEntregas.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-6 hover:bg-white/40 dark:hover:bg-white/5 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 transition-colors">
                           <Package className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors">{order.paciente}</p>
                          <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                            {order.servico} <span className="mx-1 text-slate-300">•</span> {order.cliente}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{formatDate(order.dataEntrega)}</p>
                          <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400 mt-0.5">Data de Entrega</p>
                        </div>
                        <Badge variant={getStatusVariant(order.status)} className="shadow-sm">
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights & Secondary column */}
          <div className="space-y-8 animate-in" style={{ animationDelay: '500ms' }}>
            <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 border-none shadow-xl shadow-indigo-600/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
                <Sparkles className="h-24 w-24 text-white" />
              </div>
              
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className="p-2 rounded-lg bg-white/20">
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </div>
                  Insights Inteligentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                  "O faturamento deste mês está 15% acima da média. Notei um aumento de 20% em pedidos de Prótese Sobre Implante."
                </p>
                <Button className="w-full bg-white text-indigo-600 hover:bg-indigo-50 font-bold rounded-xl h-11">
                  Gerar Relatório Completo
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-emerald-600 border-none shadow-xl shadow-emerald-600/20 text-white overflow-hidden relative">
               <div className="absolute -bottom-4 -right-4 p-8 opacity-10">
                <DollarSign className="h-20 w-20 text-white" />
              </div>
              <CardContent className="p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-100 mb-1">Saldo em Aberto</p>
                <p className="text-3xl font-bold tracking-tight">R$ 12.450,00</p>
                <div className="mt-4 flex justify-between items-center text-xs font-bold text-emerald-100">
                  <span>Próximos 7 dias</span>
                  <span className="px-2 py-1 rounded bg-white/20 text-white">+ R$ 4.200,00</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
