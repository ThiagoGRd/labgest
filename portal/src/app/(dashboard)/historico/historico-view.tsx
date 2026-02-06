'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Search, Calendar, FileText } from 'lucide-react'

interface PedidoHistorico {
  id: number
  paciente: string
  servico: string
  status: string
  dataEntrega: string
  dataFinalizacao: string
  valor: number
}

interface HistoricoViewProps {
  user: any
  pedidos: PedidoHistorico[]
}

function getStatusVariant(status: string) {
  const map: Record<string, any> = {
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

export function HistoricoView({ user, pedidos }: HistoricoViewProps) {
  const [search, setSearch] = useState('')

  const filteredPedidos = pedidos.filter(pedido => 
    pedido.paciente.toLowerCase().includes(search.toLowerCase()) ||
    pedido.servico.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PortalLayout user={user}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Histórico de Pedidos</h1>
        <p className="text-slate-500">Consulte seus casos finalizados e entregues</p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por paciente ou serviço..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">Data Finalização</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">ID</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">Paciente</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">Serviço</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">Status</th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPedidos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    Nenhum histórico encontrado.
                  </td>
                </tr>
              ) : (
                filteredPedidos.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        {formatDate(pedido.dataFinalizacao)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">#{pedido.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{pedido.paciente}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{pedido.servico}</td>
                    <td className="px-6 py-4">
                      <Badge variant={getStatusVariant(pedido.status)}>
                        {pedido.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-900">
                      {formatCurrency(pedido.valor)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </PortalLayout>
  )
}
