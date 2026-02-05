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

// Dados mockados para o dashboard
const stats = [
  {
    name: 'Ordens Hoje',
    value: '12',
    change: '+3',
    changeType: 'positive' as const,
    icon: ClipboardList,
    color: 'bg-indigo-500',
  },
  {
    name: 'Em Produção',
    value: '28',
    change: '+5',
    changeType: 'positive' as const,
    icon: Clock,
    color: 'bg-blue-500',
  },
  {
    name: 'Atrasadas',
    value: '3',
    change: '-2',
    changeType: 'negative' as const,
    icon: AlertTriangle,
    color: 'bg-red-500',
  },
  {
    name: 'Finalizadas (mês)',
    value: '156',
    change: '+12%',
    changeType: 'positive' as const,
    icon: CheckCircle,
    color: 'bg-emerald-500',
  },
]

const recentOrders = [
  { id: 1, paciente: 'Maria Silva', dentista: 'Dr. João Santos', servico: 'Prótese Total Superior', status: 'Em Produção', prioridade: 'Alta', entrega: '2 dias' },
  { id: 2, paciente: 'Carlos Oliveira', dentista: 'Dra. Ana Lima', servico: 'Protocolo', status: 'Aguardando', prioridade: 'Urgente', entrega: 'Hoje' },
  { id: 3, paciente: 'José Pereira', dentista: 'Dr. Paulo Costa', servico: 'Parcial Removível', status: 'Em Produção', prioridade: 'Normal', entrega: '5 dias' },
  { id: 4, paciente: 'Ana Santos', dentista: 'Dr. João Santos', servico: 'Provisório Unitário', status: 'Finalizado', prioridade: 'Normal', entrega: 'Entregue' },
  { id: 5, paciente: 'Pedro Souza', dentista: 'Dra. Carla Melo', servico: 'Ponte Adesiva', status: 'Aguardando', prioridade: 'Alta', entrega: '3 dias' },
]

const insights = [
  { type: 'warning', message: 'Estoque de PMMA abaixo do mínimo - 2 unidades restantes' },
  { type: 'info', message: 'Dr. João Santos não faz pedidos há 30 dias' },
  { type: 'success', message: 'Produtividade aumentou 15% este mês' },
]

function getStatusVariant(status: string) {
  const variants: Record<string, 'aguardando' | 'emProducao' | 'finalizado'> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
  }
  return variants[status] || 'default'
}

function getPriorityVariant(priority: string) {
  const variants: Record<string, 'baixa' | 'normal' | 'alta' | 'urgente'> = {
    'Baixa': 'baixa',
    'Normal': 'normal',
    'Alta': 'alta',
    'Urgente': 'urgente',
  }
  return variants[priority] || 'normal'
}

export default function DashboardPage() {
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
                    <p className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.changeType === 'positive' ? (
                        <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        stat.changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-slate-400">vs ontem</span>
                    </div>
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
          {/* Recent Orders */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ordens Recentes</CardTitle>
              <a href="/ordens" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                Ver todas →
              </a>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900 truncate">{order.paciente}</p>
                        <Badge variant={getPriorityVariant(order.prioridade)}>
                          {order.prioridade}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 truncate mt-1">
                        {order.servico} • {order.dentista}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <Badge variant={getStatusVariant(order.status)}>
                          {order.status}
                        </Badge>
                        <p className="text-xs text-slate-400 mt-1">{order.entrega}</p>
                      </div>
                    </div>
                  </div>
                ))}
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
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      insight.type === 'warning'
                        ? 'bg-amber-50 border-amber-400'
                        : insight.type === 'success'
                        ? 'bg-emerald-50 border-emerald-400'
                        : 'bg-blue-50 border-blue-400'
                    }`}
                  >
                    <p className="text-sm text-slate-700">{insight.message}</p>
                  </div>
                ))}
              </div>

              {/* AI Chat Preview */}
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
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

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-violet-100">
                  <DollarSign className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Faturamento (Mês)</p>
                  <p className="text-2xl font-bold text-slate-900">R$ 45.890</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-pink-100">
                  <Users className="h-6 w-6 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Dentistas Ativos</p>
                  <p className="text-2xl font-bold text-slate-900">6</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-amber-100">
                  <Package className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Itens Estoque Baixo</p>
                  <p className="text-2xl font-bold text-slate-900">4</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
