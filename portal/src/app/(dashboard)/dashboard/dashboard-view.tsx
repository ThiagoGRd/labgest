'use client'

import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardList,
  Clock,
  CheckCircle,
  PlusCircle,
  ArrowRight,
  Calendar,
  Package,
} from 'lucide-react'
import Link from 'next/link'

// Mock data para quando não houver dados reais
const mockPedidos = [
  {
    id: 1,
    paciente: 'Exemplo: Maria Silva',
    servico: 'Prótese Total',
    status: 'Em Produção',
    etapa: 'Acabamento',
    dataEntrega: new Date().toISOString(),
    progresso: 75,
  },
]

interface DashboardViewProps {
  user: any
  stats: {
    total: number
    emAndamento: number
    finalizados: number
  }
  pedidosRecentes: any[]
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'Aguardando': 'bg-slate-100 text-slate-700',
    'Em Produção': 'bg-blue-100 text-blue-700',
    'Finalizado': 'bg-emerald-100 text-emerald-700',
  }
  return colors[status] || 'bg-slate-100 text-slate-700'
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function getDaysRemaining(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  const diff = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff < 0) return `${Math.abs(diff)} dias atrasado`
  return `${diff} dias`
}

export function DashboardView({ user, stats, pedidosRecentes }: DashboardViewProps) {
  // Se não tiver pedidos reais, usa mock para não ficar vazio
  const displayPedidos = pedidosRecentes.length > 0 ? pedidosRecentes : []

  const statCards = [
    { name: 'Em Andamento', value: stats.emAndamento.toString(), icon: Clock, color: 'bg-blue-500' },
    { name: 'Aguardando', value: (stats.total - stats.emAndamento - stats.finalizados).toString(), icon: ClipboardList, color: 'bg-amber-500' },
    { name: 'Finalizados', value: stats.finalizados.toString(), icon: CheckCircle, color: 'bg-emerald-500' },
  ]

  return (
    <PortalLayout user={user}>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Olá, {user.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-slate-500 mt-1">
          Acompanhe seus pedidos e envie novos casos para o laboratório.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{stat.name}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/novo-pedido">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-emerald-200 bg-emerald-50/50">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 rounded-xl bg-emerald-100">
                <PlusCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Novo Pedido</h3>
                <p className="text-sm text-slate-500">Envie um novo caso para o laboratório</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/pedidos">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 rounded-xl bg-blue-100">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Ver Todos os Pedidos</h3>
                <p className="text-sm text-slate-500">Acompanhe o status de cada caso</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos Recentes</CardTitle>
          <Link href="/pedidos" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayPedidos.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Você ainda não tem pedidos recentes.
              </div>
            ) : (
              displayPedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-slate-900">{pedido.paciente}</span>
                        <Badge className={getStatusColor(pedido.status)}>
                          {pedido.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500">{pedido.servico}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(pedido.dataEntrega)}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{getDaysRemaining(pedido.dataEntrega)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>{pedido.etapa}</span>
                      {/* Por enquanto escondemos a porcentagem pois não calculamos ainda */}
                      {/* <span>{pedido.progresso}%</span> */}
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        // Mock de progresso baseado no status
                        style={{ width: pedido.status === 'Finalizado' ? '100%' : '30%' }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </PortalLayout>
  )
}
