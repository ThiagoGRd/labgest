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
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
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
      description="Detalhes da ordem de serviço"
      size="lg"
    >
      <div className="space-y-6">
        {/* Status e Prioridade */}
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(ordem.status)} className="text-sm px-3 py-1">
            {ordem.status}
          </Badge>
          <Badge variant={getPriorityVariant(ordem.prioridade)} className="text-sm px-3 py-1">
            {ordem.prioridade}
          </Badge>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Paciente */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
            <User className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Paciente</p>
              <p className="font-medium text-slate-900">{ordem.paciente}</p>
            </div>
          </div>

          {/* Dentista */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
            <User className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Dentista</p>
              <p className="font-medium text-slate-900">{ordem.cliente.nome}</p>
            </div>
          </div>

          {/* Serviço */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
            <Package className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Serviço</p>
              <p className="font-medium text-slate-900">{ordem.servico}</p>
            </div>
          </div>

          {/* Etapa Atual */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
            <Activity className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Etapa Atual</p>
              <p className="font-medium text-slate-900">{ordem.etapaAtual}</p>
            </div>
          </div>

          {/* Data Entrada */}
          {ordem.dataEntrada && (
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <Clock className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Data de Entrada</p>
                <p className="font-medium text-slate-900">{formatDate(ordem.dataEntrada)}</p>
              </div>
            </div>
          )}

          {/* Data Entrega */}
          <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
            <Calendar className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Data de Entrega</p>
              <p className="font-medium text-slate-900">{formatDate(ordem.dataEntrega)}</p>
            </div>
          </div>

          {/* Cor dos Dentes */}
          {ordem.corDentes && (
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
              <Palette className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Cor dos Dentes</p>
                <p className="font-medium text-slate-900">{ordem.corDentes}</p>
              </div>
            </div>
          )}

          {/* Valor */}
          <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-lg">
            <DollarSign className="h-5 w-5 text-indigo-600 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Valor</p>
              <p className="font-bold text-indigo-600 text-lg">{formatCurrency(ordem.valor)}</p>
            </div>
          </div>
        </div>

        {/* Observações */}
        {ordem.observacoes && (
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Observações</p>
                <p className="text-slate-700 whitespace-pre-wrap">{ordem.observacoes}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botão Fechar */}
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
