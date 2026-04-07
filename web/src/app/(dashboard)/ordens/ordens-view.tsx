'use client'

import { useState, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { NovaOrdemModal } from '@/components/ordens/nova-ordem-modal'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { EditarOrdemModal } from '@/components/ordens/editar-ordem-modal'
import { WorkflowModal } from '@/components/ordens/workflow-modal'
import { FichaImpressao } from '@/components/ordens/ficha-impressao'
import { EtiquetaImpressao } from '@/components/ordens/etiqueta-impressao'
import { notificarMudancaStatus } from '@/actions/notificacoes'
import { deleteOrdem } from '@/actions/ordens'
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
  Printer,
  Package,
  GitBranch,
  RotateCcw,
  MoreHorizontal,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  progresso?: number
  arquivos?: string[]
  dataEntrada?: string
  corDentes?: string
  observacoes?: string
  // Workflow fields
  tipoWorkflow?: string | null
  tentativaAtual?: number
  historicoEtapas?: any[]
  checklistEstetico?: any
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

function getDaysRemaining(dateStr: string, isFinished: boolean = false) {
  if (isFinished) return { text: 'Concluído', color: 'text-emerald-600' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  const diff = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, color: 'text-red-600' }
  if (diff === 0) return { text: 'Hoje', color: 'text-amber-600' }
  if (diff === 1) return { text: 'Amanhã', color: 'text-amber-600' }
  return { text: `${diff} dias`, color: 'text-slate-600 dark:text-slate-400' }
}

export function OrdensView({ initialData, clientes, servicos }: OrdensViewProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [selectedOrdem, setSelectedOrdem] = useState<Ordem | null>(null)
  const [printOrdem, setPrintOrdem] = useState<any>(null)
  const [printEtiqueta, setPrintEtiqueta] = useState<any>(null)
  
  const componentRef = useRef<HTMLDivElement>(null)
  const etiquetaRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  })

  const handlePrintEtiqueta = useReactToPrint({
    contentRef: etiquetaRef,
  })

  const onPrintEtiquetaClick = (ordem: Ordem) => {
    const dadosEtiqueta = {
      id: ordem.id,
      paciente: ordem.paciente,
      cliente: { nome: ordem.cliente.nome },
      servico: { nome: ordem.servico },
      dataEntrega: ordem.dataEntrega,
    }
    setPrintEtiqueta(dadosEtiqueta)
    setTimeout(() => {
      handlePrintEtiqueta()
    }, 100)
  }

  // Função intermediária para carregar dados e imprimir
  const onPrintClick = (ordem: Ordem) => {
    // Adaptar dados para o formato da ficha
    const dadosImpressao = {
      id: ordem.id,
      paciente: ordem.paciente,
      cliente: { nome: ordem.cliente.nome },
      servico: { nome: ordem.servico },
      dataEntrada: ordem.dataEntrada || new Date().toISOString(), // Fallback se não vier
      dataEntrega: ordem.dataEntrega,
      corDentes: ordem.corDentes,
      observacoes: ordem.observacoes,
    }
    setPrintOrdem(dadosImpressao)
    // Pequeno delay para garantir que o state atualizou e o componente renderizou antes de imprimir
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  const ordens = initialData || []

  const filteredOrdens = ordens.filter(ordem => {
    const matchSearch = 
      ordem.paciente.toLowerCase().includes(search.toLowerCase()) ||
      ordem.cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      ordem.servico.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || ordem.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleView = (ordem: Ordem) => {
    setSelectedOrdem(ordem)
    setViewModalOpen(true)
  }

  const handleEdit = (ordem: Ordem) => {
    setSelectedOrdem(ordem)
    setEditModalOpen(true)
  }

  const handleWorkflow = (ordem: Ordem) => {
    setSelectedOrdem(ordem)
    setWorkflowModalOpen(true)
  }

  const handleNotify = async (id: number) => {
    if (confirm('Finalizar ordem e notificar dentista via WhatsApp?')) {
      const result = await notificarMudancaStatus(id, 'Finalizado')
      if (result.success && result.whatsappLink) {
        window.open(result.whatsappLink, '_blank')
      } else {
        alert('Erro ao enviar: ' + (result.error || 'Verifique o console'))
      }
    }
  }

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir esta ordem? Esta ação não pode ser desfeita.')) {
      const result = await deleteOrdem(id)
      if (!result.success) {
        alert('Erro ao excluir: ' + (result.error || 'Tente novamente'))
      }
    }
  }

  return (
    <DashboardLayout>
      {/* Hidden Print Components */}
      <div style={{ display: 'none' }}>
        {printOrdem && <FichaImpressao ref={componentRef} ordem={printOrdem} />}
        {printEtiqueta && <EtiquetaImpressao ref={etiquetaRef} ordem={printEtiqueta} />}
      </div>

      <NovaOrdemModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        clientes={clientes}
        servicos={servicos}
        onSuccess={() => {
          setModalOpen(false)
        }}
      />

      <VisualizarOrdemModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        ordem={selectedOrdem}
      />

      <EditarOrdemModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        ordem={selectedOrdem}
        clientes={clientes}
        servicos={servicos}
        onSuccess={() => {
          setEditModalOpen(false)
        }}
      />

      <WorkflowModal
        isOpen={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        ordem={selectedOrdem as any}
        onSuccess={() => {
          setWorkflowModalOpen(false)
        }}
      />
      
      <Header 
        title="Ordens de Serviço" 
        subtitle={`${ordens.length} ordens no total`}
        action={{
          label: 'Nova Ordem',
          onClick: () => {
            console.log('Botão Nova Ordem clicado')
            setModalOpen(true)
          },
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

              {/* Actions 
               * (Filtro Genérico e Download ocultados por serem não-funcionais)
               */}
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Paciente / Serviço
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Dentista
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Etapa
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Entrega
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Valor
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {filteredOrdens.map((ordem) => {
                  const daysInfo = getDaysRemaining(ordem.dataEntrega, ordem.status === 'Finalizado' || ordem.status === 'Cancelado' || ordem.status === 'Entregue' || ordem.status === 'Pausado')
                  return (
                    <tr key={ordem.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                              <FileText className="h-6 w-6" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{ordem.paciente}</span>
                              <Badge variant={getPriorityVariant(ordem.prioridade)}>
                                {ordem.prioridade}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{ordem.servico}</p>
                            {ordem.arquivos && ordem.arquivos.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full w-fit">
                                <Paperclip className="h-3 w-3" />
                                <span>{ordem.arquivos.length} anexo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={ordem.cliente.nome} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">{ordem.cliente.nome}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Dentista</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(ordem.status)}>
                          {ordem.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{ordem.etapaAtual}</span>
                           {ordem.tentativaAtual != null && ordem.tentativaAtual > 0 && (
                             <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                               <RotateCcw className="h-2.5 w-2.5" />
                               {ordem.tentativaAtual}x
                             </span>
                           )}
                         </div>
                         {ordem.tipoWorkflow && (
                           <p className="text-[9px] font-bold text-indigo-500 uppercase mt-0.5 flex items-center gap-1">
                             <GitBranch className="h-2.5 w-2.5" />
                             {ordem.tipoWorkflow === 'protocolo' ? 'Protocolo' : ordem.tipoWorkflow === 'protese_total' ? 'Total' : 'PPR'}
                           </p>
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div suppressHydrationWarning>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDate(ordem.dataEntrega)}</p>
                            <p className={`text-[10px] font-bold uppercase ${daysInfo.color}`}>{daysInfo.text}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-base">{formatCurrency(ordem.valor)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => handleWorkflow(ordem)}
                            className="p-2 text-slate-400 hover:text-purple-600 dark:text-slate-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-all"
                            title="Fluxo de Trabalho"
                          >
                            <GitBranch className="h-5 w-5" />
                          </button>
                          
                          <button 
                            onClick={() => handleEdit(ordem)}
                            className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                            title="Editar Ordem"
                          >
                            <Edit className="h-5 w-5" />
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-2 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all outline-none">
                                <MoreHorizontal className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl">
                              <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase px-2 py-1.5">Ações</DropdownMenuLabel>
                              
                              <DropdownMenuItem onClick={() => handleView(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Eye className="mr-2 h-4 w-4 text-slate-400" />
                                Visualizar Detalhes
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => handleNotify(ordem.id)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Bell className="mr-2 h-4 w-4 text-slate-400" />
                                Notificar WhatsApp
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-zinc-800" />
                              
                              <DropdownMenuItem onClick={() => onPrintClick(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Printer className="mr-2 h-4 w-4 text-slate-400" />
                                Imprimir Ficha
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => onPrintEtiquetaClick(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Package className="mr-2 h-4 w-4 text-slate-400" />
                                Imprimir Etiqueta
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-zinc-800" />
                              
                              <DropdownMenuItem onClick={() => handleDelete(ordem.id)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Ordem
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
