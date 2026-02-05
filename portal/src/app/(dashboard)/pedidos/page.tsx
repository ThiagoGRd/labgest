'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Search,
  Calendar,
  Clock,
  CheckCircle,
  FileText,
  ChevronRight,
  Filter,
} from 'lucide-react'

// Mock data
const pedidos = [
  {
    id: 1,
    paciente: 'Maria Silva',
    servico: 'Prótese Total Superior',
    status: 'Em Produção',
    etapa: 'Acabamento',
    dataPedido: '2026-01-28',
    dataEntrega: '2026-02-07',
    progresso: 75,
    valor: 850.00,
  },
  {
    id: 2,
    paciente: 'Carlos Oliveira',
    servico: 'Protocolo Inferior',
    status: 'Aguardando',
    etapa: 'Recebimento',
    dataPedido: '2026-02-05',
    dataEntrega: '2026-02-20',
    progresso: 10,
    valor: 3500.00,
  },
  {
    id: 3,
    paciente: 'José Pereira',
    servico: 'Parcial Removível',
    status: 'Em Produção',
    etapa: 'Impressão/Fresagem',
    dataPedido: '2026-02-01',
    dataEntrega: '2026-02-12',
    progresso: 40,
    valor: 950.00,
  },
  {
    id: 4,
    paciente: 'Ana Santos',
    servico: 'Provisório Unitário 21',
    status: 'Finalizado',
    etapa: 'Entregue',
    dataPedido: '2026-01-25',
    dataEntrega: '2026-02-01',
    progresso: 100,
    valor: 180.00,
  },
  {
    id: 5,
    paciente: 'Pedro Costa',
    servico: 'Ponte Adesiva 11-21',
    status: 'Aguardando',
    etapa: 'Planejamento',
    dataPedido: '2026-02-03',
    dataEntrega: '2026-02-15',
    progresso: 20,
    valor: 420.00,
  },
]

function getStatusVariant(status: string) {
  const variants: Record<string, 'aguardando' | 'emProducao' | 'finalizado'> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
  }
  return variants[status] || 'default'
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export default function PedidosPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')

  const user = {
    nome: 'Dr. João Santos',
    email: 'joao.santos@clinica.com',
    cro: 'CRO-AL 1234',
  }

  const filteredPedidos = pedidos.filter(pedido => {
    const matchSearch = 
      pedido.paciente.toLowerCase().includes(search.toLowerCase()) ||
      pedido.servico.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || pedido.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <PortalLayout user={user}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Meus Pedidos</h1>
        <p className="text-slate-500">Acompanhe o status de todos os seus casos</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por paciente ou serviço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              {['todos', 'Aguardando', 'Em Produção', 'Finalizado'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status === 'todos' ? 'Todos' : status}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pedidos List */}
      <div className="space-y-4">
        {filteredPedidos.map((pedido) => (
          <Card key={pedido.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm text-slate-400">#{pedido.id.toString().padStart(3, '0')}</span>
                    <Badge variant={getStatusVariant(pedido.status)}>
                      {pedido.status}
                    </Badge>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">{pedido.paciente}</h3>
                  <p className="text-slate-500">{pedido.servico}</p>
                </div>

                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                  <div className="text-sm">
                    <p className="text-slate-400">Etapa Atual</p>
                    <p className="font-medium text-slate-900">{pedido.etapa}</p>
                  </div>

                  <div className="text-sm">
                    <p className="text-slate-400">Entrega</p>
                    <p className="font-medium text-slate-900">{formatDate(pedido.dataEntrega)}</p>
                  </div>

                  <div className="text-sm">
                    <p className="text-slate-400">Valor</p>
                    <p className="font-medium text-slate-900">{formatCurrency(pedido.valor)}</p>
                  </div>

                  <div className="w-32">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                      <span>Progresso</span>
                      <span>{pedido.progresso}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          pedido.progresso === 100 ? 'bg-emerald-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pedido.progresso}%` }}
                      />
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredPedidos.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum pedido encontrado</h3>
              <p className="text-slate-500">Tente ajustar os filtros ou faça um novo pedido.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PortalLayout>
  )
}
