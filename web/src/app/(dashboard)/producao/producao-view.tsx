'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { moverOrdem } from '@/actions/producao'
import {
  Calendar,
  User,
  GripVertical,
  Filter,
  LayoutGrid,
  List,
  ChevronDown,
  AlertTriangle,
  FileText,
} from 'lucide-react'

// Etapas de produção (IDs mapeados)
const etapas = [
  { id: 'Recebimento', nome: 'Recebimento', cor: '#6366f1' },
  { id: 'Planejamento', nome: 'Planejamento/CAD', cor: '#8b5cf6' },
  { id: 'Impressão', nome: 'Impressão/Fresagem', cor: '#a855f7' },
  { id: 'Acabamento', nome: 'Acabamento', cor: '#d946ef' },
  { id: 'Conferência', nome: 'Conferência', cor: '#ec4899' },
  { id: 'Finalizado', nome: 'Pronto p/ Entrega', cor: '#22c55e' },
]

interface Ordem {
  id: number
  paciente: string
  dentista: string
  servico: string
  etapa: string
  prioridade: string
  entrega: string
  cor?: string | null
  foto?: string | null
}

interface ProducaoViewProps {
  initialOrdens: Ordem[]
}

function getPriorityColor(priority: string) {
  const map: Record<string, string> = {
    'Baixa': 'border-l-slate-400',
    'Normal': 'border-l-blue-400',
    'Alta': 'border-l-orange-400',
    'Urgente': 'border-l-red-500',
  }
  return map[priority] || 'border-l-slate-400'
}

function getDaysRemaining(dateStr: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  const diff = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, isLate: true }
  if (diff === 0) return { text: 'Hoje', isLate: false, isToday: true }
  if (diff === 1) return { text: 'Amanhã', isLate: false }
  return { text: `${diff}d`, isLate: false }
}

interface KanbanCardProps {
  ordem: Ordem
  onDragStart: (e: React.DragEvent, ordem: Ordem, etapaId: string) => void
  etapaId: string
}

function KanbanCard({ ordem, onDragStart, etapaId }: KanbanCardProps) {
  const daysInfo = getDaysRemaining(ordem.entrega)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ordem, etapaId)}
      className={`bg-white rounded-lg border border-slate-200 border-l-4 ${getPriorityColor(ordem.prioridade)} p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          <span className="text-xs text-slate-400">#{ordem.id}</span>
        </div>
        {ordem.prioridade === 'Urgente' && (
          <Badge variant="urgente" className="text-xs">Urgente</Badge>
        )}
      </div>

      <h4 className="font-medium text-slate-900 mb-1">{ordem.paciente}</h4>
      <p className="text-sm text-slate-500 mb-3">{ordem.servico}</p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-400">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[80px]">{ordem.dentista.split(' ')[0]}</span>
        </div>
        <div className={`flex items-center gap-1 ${daysInfo.isLate ? 'text-red-600 font-medium' : daysInfo.isToday ? 'text-amber-600 font-medium' : 'text-slate-400'}`}>
          {daysInfo.isLate && <AlertTriangle className="h-3 w-3" />}
          <Calendar className="h-3 w-3" />
          <span>{daysInfo.text}</span>
        </div>
      </div>
    </div>
  )
}

export function ProducaoView({ initialOrdens }: ProducaoViewProps) {
  // Organizar ordens por etapa
  const [ordensPorEtapa, setOrdensPorEtapa] = useState<Record<string, Ordem[]>>({})
  const [draggedItem, setDraggedItem] = useState<{ ordem: Ordem; fromEtapa: string } | null>(null)

  useEffect(() => {
    const agrupado: Record<string, Ordem[]> = {}
    
    // Inicializar etapas vazias
    etapas.forEach(e => agrupado[e.id] = [])

    // Popula com ordens
    initialOrdens.forEach(o => {
      // Normaliza o nome da etapa para corresponder às chaves
      const etapaKey = etapas.find(e => e.nome === o.etapa || e.id === o.etapa)?.id || 'Recebimento'
      if (!agrupado[etapaKey]) agrupado[etapaKey] = []
      agrupado[etapaKey].push(o)
    })

    setOrdensPorEtapa(agrupado)
  }, [initialOrdens])

  const handleDragStart = (e: React.DragEvent, ordem: Ordem, etapaId: string) => {
    setDraggedItem({ ordem, fromEtapa: etapaId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, toEtapa: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.fromEtapa === toEtapa) return

    // Atualização Otimista
    setOrdensPorEtapa(prev => {
      const newOrdens = { ...prev }
      newOrdens[draggedItem.fromEtapa] = newOrdens[draggedItem.fromEtapa].filter(
        o => o.id !== draggedItem.ordem.id
      )
      // Atualiza a etapa no objeto ordem também
      const ordemAtualizada = { ...draggedItem.ordem, etapa: toEtapa }
      newOrdens[toEtapa] = [...(newOrdens[toEtapa] || []), ordemAtualizada]
      return newOrdens
    })

    // Chama Server Action
    const result = await moverOrdem(draggedItem.ordem.id, toEtapa)
    
    if (!result.success) {
      alert('Erro ao mover ordem: ' + result.error)
      // Reverter se necessário (não implementado aqui para simplicidade)
    }

    setDraggedItem(null)
  }

  const totalOrdens = Object.values(ordensPorEtapa).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <DashboardLayout>
      <Header 
        title="Produção" 
        subtitle={`${totalOrdens} ordens em andamento`}
      />
      
      <div className="p-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtrar
            </Button>
            <Button variant="outline" size="sm">
              Prioridade
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {etapas.map((etapa) => (
            <div
              key={etapa.id}
              className="flex-shrink-0 w-80"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa.id)}
            >
              <div
                className="rounded-t-xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: etapa.cor + '20' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <h3 className="font-medium text-slate-900">{etapa.nome}</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {ordensPorEtapa[etapa.id]?.length || 0}
                </Badge>
              </div>

              <div className="bg-slate-100 rounded-b-xl p-3 min-h-[500px] space-y-3">
                {ordensPorEtapa[etapa.id]?.map((ordem) => (
                  <KanbanCard
                    key={ordem.id}
                    ordem={ordem}
                    etapaId={etapa.id}
                    onDragStart={handleDragStart}
                  />
                ))}

                {(!ordensPorEtapa[etapa.id] || ordensPorEtapa[etapa.id].length === 0) && (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <FileText className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma ordem</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
          <span className="font-medium text-slate-700">Prioridade:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-4 border-l-slate-400 bg-slate-100" />
            <span>Baixa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-4 border-l-blue-400 bg-slate-100" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-4 border-l-orange-400 bg-slate-100" />
            <span>Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-l-4 border-l-red-500 bg-slate-100" />
            <span>Urgente</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
