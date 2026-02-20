'use client'

import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  User,
  Calendar,
  Clock,
  Palette,
  FileText,
  Package,
  DollarSign,
  Activity,
  Paperclip,
  Eye,
  X,
  MapPin,
  AlertTriangle
} from 'lucide-react'

interface Pedido {
  id: number
  paciente: string
  servico: string
  status: string
  dataEntrega: string
  valor: number
  etapa: string
  // Campos extras que precisaremos buscar no getOrdemById
  corDentes?: string
  elementos?: string
  observacoes?: string
  historicoEtapas?: any[]
  arquivos?: string[]
}

interface VisualizarPedidoModalProps {
  isOpen: boolean
  onClose: () => void
  pedido: Pedido | null
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
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function VisualizarPedidoModal({ isOpen, onClose, pedido }: VisualizarPedidoModalProps) {
  if (!pedido) return null

  // Histórico reverso (mais recente primeiro)
  const historico = [...(pedido.historicoEtapas || [])].reverse()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rastreamento #${pedido.id}`}
      description={pedido.servico}
      size="lg"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Timeline Visual (Esquerda) */}
        <div className="lg:col-span-1 border-r border-slate-100 dark:border-zinc-800 pr-0 lg:pr-8">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Status do Pedido
          </h3>

          <div className="relative pl-4 border-l-2 border-emerald-100 dark:border-emerald-900/30 space-y-8">
            {/* Status Atual */}
            <div className="relative">
              <div className="absolute -left-[21px] top-0 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900 shadow-sm animate-pulse" />
              <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">Etapa Atual</p>
                <p className="font-bold text-slate-900 dark:text-white">{pedido.etapa}</p>
                <p className="text-xs text-slate-500 mt-1">{pedido.status}</p>
              </div>
            </div>

            {/* Histórico */}
            {historico.length > 0 ? historico.map((h, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-[19px] top-1.5 h-3 w-3 rounded-full bg-slate-300 dark:bg-zinc-700 ring-4 ring-white dark:ring-zinc-900" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-slate-400 mb-0.5">
                    {formatDateTime(h.data)}
                  </span>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {h.acao === 'avancou' && `Iniciou: ${h.para}`}
                    {h.acao === 'devolveu' && `Devolvido: ${h.para}`}
                    {h.acao === 'criou' && 'Pedido Criado'}
                  </p>
                  {h.motivo && (
                    <p className="text-xs text-red-500 mt-1">Motivo: {h.motivo}</p>
                  )}
                </div>
              </div>
            )) : (
              <p className="text-xs text-slate-400 italic">Sem histórico detalhado.</p>
            )}
          </div>
        </div>

        {/* Detalhes (Direita) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cabeçalho */}
          <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{pedido.paciente}</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">Paciente</span>
              </div>
              <Badge variant={getStatusVariant(pedido.status)}>{pedido.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Entrega</span>
                <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  {formatDate(pedido.dataEntrega)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Valor</span>
                <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  {formatCurrency(pedido.valor)}
                </p>
              </div>
              {pedido.corDentes && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cor</span>
                  <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                    <Palette className="h-3.5 w-3.5 text-pink-500" />
                    {pedido.corDentes}
                  </p>
                </div>
              )}
              {pedido.elementos && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Dentes</span>
                  <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    {pedido.elementos}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Observações</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
                {pedido.observacoes}
              </p>
            </div>
          )}

          {/* Botão Fechar */}
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}