'use client'

import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
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
    'Aguardando': 'bg-zinc-800 text-zinc-300',
    'Em Produção': 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    'Finalizado': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  }
  return colors[status] || 'bg-zinc-800 text-zinc-300'
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

// Mapeamento real das etapas de produção para % de progresso
const etapaProgresso: Record<string, number> = {
  'Aguardando': 5,
  'Recebimento': 15,
  'Planejamento': 28,
  'Impressão': 45,
  'EmProva': 60,
  'Acabamento': 75,
  'Conferência': 88,
  'Finalizado': 100,
  'Entregue': 100,
  'Cancelado': 0,
}

function getProgress(status: string, etapa?: string): number {
  if (status === 'Finalizado' || status === 'Entregue') return 100
  if (status === 'Cancelado') return 0
  if (etapa && etapaProgresso[etapa] !== undefined) return etapaProgresso[etapa]
  if (status === 'Em Produção') return 45
  return 5
}

export function DashboardView({ user, stats, pedidosRecentes }: DashboardViewProps) {
  // Se não tiver pedidos reais, usa mock para não ficar vazio
  const displayPedidos = pedidosRecentes.length > 0 ? pedidosRecentes : []

  const statCards = [
    { name: 'Em Andamento', value: stats.emAndamento.toString(), icon: Clock, color: 'bg-blue-500', shadow: 'shadow-blue-500/20' },
    { name: 'Aguardando', value: (stats.total - stats.emAndamento - stats.finalizados).toString(), icon: ClipboardList, color: 'bg-amber-500', shadow: 'shadow-amber-500/20' },
    { name: 'Finalizados', value: stats.finalizados.toString(), icon: CheckCircle, color: 'bg-emerald-500', shadow: 'shadow-emerald-500/20' },
  ]

  return (
    <PortalLayout user={user}>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Olá, {user.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-zinc-400 mt-1">
          Acompanhe seus pedidos e envie novos casos para o laboratório.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.name} className="glass-panel border-transparent hover:border-white/10 transition-colors">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color} ${stat.shadow} shadow-lg`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-zinc-400 font-medium">{stat.name}</p>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Link href="/novo-pedido">
          <Card className="glass-panel border border-emerald-500/20 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                <PlusCircle className="h-8 w-8 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">Novo Pedido</h3>
                <p className="text-sm text-zinc-400">Envie um novo caso para o laboratório</p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-emerald-400 transform group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/pedidos">
          <Card className="glass-panel border-transparent hover:border-white/10 hover:bg-white/5 transition-all cursor-pointer group">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                <Package className="h-8 w-8 text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">Ver Todos os Pedidos</h3>
                <p className="text-sm text-zinc-400">Acompanhe o status de cada caso</p>
              </div>
              <ArrowRight className="h-5 w-5 text-zinc-500 group-hover:text-blue-400 transform group-hover:translate-x-1 transition-all" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Orders */}
      <Card className="glass-panel border-transparent">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4 mb-4">
          <CardTitle className="text-white">Pedidos Recentes</CardTitle>
          <Link href="/pedidos" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
            Ver todos →
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {displayPedidos.length === 0 ? (
              <EmptyState
                title="Nenhum pedido recente"
                description="Você ainda não tem pedidos. Envie seu primeiro caso para o laboratório!"
                action={
                  <a href="/novo-pedido" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-all active:scale-[0.97]">
                    Criar Novo Pedido
                  </a>
                }
              />
            ) : (
              displayPedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white">{pedido.paciente}</span>
                        <Badge className={`${getStatusColor(pedido.status)} border-0`}>
                          {pedido.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-400">{pedido.servico}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm text-zinc-400">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(pedido.dataEntrega)}</span>
                      </div>
                      <p className="text-xs text-emerald-400/80 font-medium mt-1">{getDaysRemaining(pedido.dataEntrega)}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                      <span className="uppercase tracking-wider font-bold">{pedido.etapa}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-700"
                        style={{ width: `${getProgress(pedido.status, pedido.etapa)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 mt-1">{getProgress(pedido.status, pedido.etapa)}%</span>
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
