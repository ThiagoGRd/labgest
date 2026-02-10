'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search,
  Filter,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react'

interface Pedido {
  id: number
  paciente: string
  servico: string
  status: string
  dataEntrega: string
  valor: number
  etapa: string
}

interface PedidosViewProps {
  user: any
  pedidos: Pedido[]
}

function getStatusVariant(status: string) {
  const map: Record<string, any> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
    'Entregue': 'finalizado',
    'Cancelado': 'destructive',
  }
  return map[status] || 'default'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function PedidosView({ user, pedidos }: PedidosViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  const filteredPedidos = pedidos.filter(pedido => {
    const matchSearch = 
      pedido.paciente.toLowerCase().includes(search.toLowerCase()) ||
      pedido.servico.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || pedido.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <PortalLayout user={user}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meus Pedidos</h1>
          <p className="text-slate-500 dark:text-slate-400">Acompanhe o status das suas solicitações</p>
        </div>
        <Button onClick={() => window.location.href = '/novo-pedido'} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          Novo Pedido
        </Button>
      </div>

      <div className="space-y-6">
        {/* Filters */}
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por paciente ou serviço..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                {['todos', 'Aguardando', 'Em Produção', 'Finalizado'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      statusFilter === status
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-zinc-800 dark:text-slate-300 dark:hover:bg-zinc-700'
                    }`}
                  >
                    {status === 'todos' ? 'Todos' : status}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">ID</th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Paciente</th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Serviço</th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Entrega</th>
                  <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Valor</th>
                  <th className="text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {filteredPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPedidos.map((pedido) => (
                    <tr key={pedido.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">#{pedido.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{pedido.paciente}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{pedido.servico}</td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(pedido.status)}>
                          {pedido.status}
                        </Badge>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{pedido.etapa}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          {formatDate(pedido.dataEntrega)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-white">
                        {formatCurrency(pedido.valor)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PortalLayout>
  )

}
