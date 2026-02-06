'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { NovaOrdemModal } from '@/components/ordens/nova-ordem-modal'
import { notificarMudancaStatus } from '@/actions/notificacoes'
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Bell,
} from 'lucide-react'

// Types
interface Ordem {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  status: string
  prioridade: string
  dataEntrega: string
  valor: number
  etapaAtual: string
  progresso?: number // Optional/Calculated
  arquivos?: string[]
}

interface OrdensViewProps {
  initialData: Ordem[]
  clientes: any[]
  servicos: any[]
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

export function OrdensView({ initialData, clientes, servicos }: OrdensViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [modalOpen, setModalOpen] = useState(false)

  const ordens = initialData || []

  const filteredOrdens = ordens.filter(ordem => {
    const matchSearch = 
      ordem.paciente.toLowerCase().includes(search.toLowerCase()) ||
      ordem.cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      ordem.servico.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || ordem.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleNotify = async (id: number) => {
    if (confirm('Enviar notificação de conclusão via WhatsApp?')) {
      const result = await notificarMudancaStatus(id, 'Finalizado')
      if (result.success) {
        alert('Notificação enviada com sucesso!')
      } else {
        alert('Erro ao enviar: ' + (result.error || 'Verifique o console'))
      }
    }
  }

  return (
    <DashboardLayout>
      <NovaOrdemModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        clientes={clientes}
        servicos={servicos}
        onSuccess={() => {
          setModalOpen(false)
        }}
      />
      
      <Header 
        title="Ordens de Serviço" 
        subtitle={`${ordens.length} ordens no total`}
        action={{
          label: 'Nova Ordem',
          onClick: () => setModalOpen(true),
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
                    Etapa
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
                            {ordem.arquivos && ordem.arquivos.length > 0 && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full w-fit">
                                <Paperclip className="h-3 w-3" />
                                <span>{ordem.arquivos.length} anexo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={ordem.cliente.nome} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-slate-900">{ordem.cliente.nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(ordem.status)}>
                          {ordem.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-sm text-slate-600">{ordem.etapaAtual}</span>
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
                          <button 
                            onClick={() => handleNotify(ordem.id)}
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Notificar via WhatsApp"
                          >
                            <Bell className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                            <Edit className="h-4 w-4" />
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
