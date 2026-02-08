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
} from 'lucide-react'

interface Ordem {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  status: string
  prioridade: string
  dataEntrada?: string
  dataEntrega: string
  etapaAtual: string
  valor: number
  corDentes?: string
  material?: string
  observacoes?: string
}

interface VisualizarOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  ordem: Ordem | null
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

export function VisualizarOrdemModal({ isOpen, onClose, ordem }: VisualizarOrdemModalProps) {
  if (!ordem) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Ordem #${ordem.id}`}
      description="Detalhes completos da ordem de serviço"
      size="lg"
    >
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(ordem.status)} className="px-3 py-1">
            {ordem.status}
          </Badge>
          <Badge variant={getPriorityVariant(ordem.prioridade)} className="px-3 py-1">
            {ordem.prioridade}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <User className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paciente</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.paciente}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <User className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Dentista</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.cliente.nome}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <Package className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Serviço</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.servico}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <Activity className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Etapa Atual</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.etapaAtual}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <Clock className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data de Entrada</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.dataEntrada ? formatDate(ordem.dataEntrada) : '-'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
            <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Data de Entrega</p>
              <p className="font-bold text-slate-900 dark:text-white mt-0.5">{formatDate(ordem.dataEntrega)}</p>
            </div>
          </div>

          {ordem.corDentes && (
            <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl">
              <Palette className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Cor dos Dentes</p>
                <p className="font-bold text-slate-900 dark:text-white mt-0.5">{ordem.corDentes}</p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
            <DollarSign className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 opacity-70">Valor</p>
              <p className="font-black text-indigo-600 dark:text-indigo-100 text-xl leading-none mt-0.5">{formatCurrency(ordem.valor)}</p>
            </div>
          </div>
        </div>

        {ordem.observacoes && (
          <div className="p-5 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <FileText className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Observações Clínicas</p>
                <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-medium">{ordem.observacoes}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-black/5 dark:border-white/5">
          <Button variant="outline" onClick={onClose} className="rounded-xl px-8">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
