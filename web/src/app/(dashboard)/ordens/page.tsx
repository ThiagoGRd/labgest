'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Upload,
} from 'lucide-react'

// Mock data
const ordens = [
  {
    id: 1,
    paciente: 'Maria Silva',
    cliente: { nome: 'Dr. João Santos', cro: 'CRO-AL 1234' },
    servico: 'Prótese Total Superior',
    status: 'Em Produção',
    prioridade: 'Alta',
    dataEntrega: '2026-02-07',
    valor: 850.00,
    etapa: 'Acabamento',
    progresso: 75,
  },
  {
    id: 2,
    paciente: 'Carlos Oliveira',
    cliente: { nome: 'Dra. Ana Lima', cro: 'CRO-AL 5678' },
    servico: 'Protocolo Inferior',
    status: 'Aguardando',
    prioridade: 'Urgente',
    dataEntrega: '2026-02-05',
    valor: 3200.00,
    etapa: 'Recebimento',
    progresso: 10,
  },
  {
    id: 3,
    paciente: 'José Pereira',
    cliente: { nome: 'Dr. Paulo Costa', cro: 'CRO-AL 9012' },
    servico: 'Parcial Removível',
    status: 'Em Produção',
    prioridade: 'Normal',
    dataEntrega: '2026-02-10',
    valor: 650.00,
    etapa: 'Impressão',
    progresso: 40,
  },
  {
    id: 4,
    paciente: 'Ana Santos',
    cliente: { nome: 'Dr. João Santos', cro: 'CRO-AL 1234' },
    servico: 'Provisório Unitário 21',
    status: 'Finalizado',
    prioridade: 'Normal',
    dataEntrega: '2026-02-04',
    valor: 180.00,
    etapa: 'Entregue',
    progresso: 100,
  },
  {
    id: 5,
    paciente: 'Pedro Souza',
    cliente: { nome: 'Dra. Carla Melo', cro: 'CRO-AL 3456' },
    servico: 'Ponte Adesiva 11-21',
    status: 'Aguardando',
    prioridade: 'Alta',
    dataEntrega: '2026-02-08',
    valor: 420.00,
    etapa: 'Planejamento',
    progresso: 20,
  },
  {
    id: 6,
    paciente: 'Lucia Ferreira',
    cliente: { nome: 'Dr. Marcos Alves', cro: 'CRO-AL 7890' },
    servico: 'Prótese Total Inferior',
    status: 'Pausado',
    prioridade: 'Baixa',
    dataEntrega: '2026-02-15',
    valor: 850.00,
    etapa: 'CAD',
    progresso: 30,
  },
]

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

function getPriorityVariant(priority: string) {
  const map: Record<string, any> = {
    'Baixa': 'baixa',
    'Normal': 'normal',
    'Alta': 'alta',
    'Urgente': 'urgente',
  }
  return map[priority] || 'normal'
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

function getDaysRemaining(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  const diff = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, color: 'text-red-600' }
  if (diff === 0) return { text: 'Hoje', color: 'text-amber-600' }
  if (diff === 1) return { text: 'Amanhã', color: 'text-amber-600' }
  return { text: `${diff} dias`, color: 'text-slate-600' }
}

export default function OrdensPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  const filteredOrdens = ordens.filter(ordem => {
    const matchSearch = 
      ordem.paciente.toLowerCase().includes(search.toLowerCase()) ||
      ordem.cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      ordem.servico.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || ordem.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <DashboardLayout>
      <Header 
        title="Ordens de Serviço" 
        subtitle={`${ordens.length} ordens no total`}
        action={{
          label: 'Nova Ordem',
          onClick: () => console.log('Nova ordem'),
        }}
      />
      
      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por paciente, dentista ou serviço..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {['todos', 'Aguardando', 'Em Produção', 'Finalizado', 'Pausado'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === status
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {status === 'todos' ? 'Todos' : status}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="icon">
                  <Filter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Paciente / Serviço
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Dentista
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Progresso
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-6 py-4">
                    Entrega
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
                {filteredOrdens.map((ordem) => {
                  const daysInfo = getDaysRemaining(ordem.dataEntrega)
                  return (
                    <tr key={ordem.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <FileText className="h-8 w-8 text-slate-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">{ordem.paciente}</span>
                              <Badge variant={getPriorityVariant(ordem.prioridade)} className="text-xs">
                                {ordem.prioridade}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-500">{ordem.servico}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={ordem.cliente.nome} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{ordem.cliente.nome}</p>
                            <p className="text-xs text-slate-500">{ordem.cliente.cro}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(ordem.status)}>
                          {ordem.status}
                        </Badge>
                        <p className="text-xs text-slate-500 mt-1">{ordem.etapa}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-24">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                            <span>{ordem.progresso}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                ordem.progresso === 100 
                                  ? 'bg-emerald-500' 
                                  : ordem.progresso > 50 
                                  ? 'bg-indigo-500' 
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${ordem.progresso}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-sm text-slate-900">{formatDate(ordem.dataEntrega)}</p>
                            <p className={`text-xs font-medium ${daysInfo.color}`}>{daysInfo.text}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-medium text-slate-900">{formatCurrency(ordem.valor)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Mostrando <span className="font-medium">{filteredOrdens.length}</span> de <span className="font-medium">{ordens.length}</span> ordens
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="bg-indigo-600 text-white border-indigo-600">
                1
              </Button>
              <Button variant="outline" size="sm">
                2
              </Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
