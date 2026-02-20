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
  { id: 'EmProva', nome: 'Em Prova (Externo)', cor: '#f59e0b' }, // Nova Etapa
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

import { KanbanCard } from '@/components/producao/kanban-card'
import { ChecklistModal } from '@/components/producao/checklist-modal'

export function ProducaoView({ initialOrdens }: ProducaoViewProps) {
  // Organizar ordens por etapa
  const [ordensPorEtapa, setOrdensPorEtapa] = useState<Record<string, Ordem[]>>({})
  const [draggedItem, setDraggedItem] = useState<{ ordem: Ordem; fromEtapa: string } | null>(null)
  
  // Controle do Checklist
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<{ ordem: Ordem; fromEtapa: string; toEtapa: string } | null>(null)

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

    // Se mover para "Em Prova" ou "Retorno", aciona lógica específica
    // Por enquanto, vamos manter a lógica do Checklist para todas as etapas
    // Futuramente podemos adicionar condicionais aqui: 
    // if (toEtapa === 'EmProva') -> Modal de Envio para Prova
    
    setPendingMove({
      ordem: draggedItem.ordem,
      fromEtapa: draggedItem.fromEtapa,
      toEtapa: toEtapa
    })
    setChecklistOpen(true)
    setDraggedItem(null)
  }

  const confirmMove = async () => {
    if (!pendingMove) return

    const { ordem, fromEtapa, toEtapa } = pendingMove

    // Atualização Otimista
    setOrdensPorEtapa(prev => {
      const newOrdens = { ...prev }
      newOrdens[fromEtapa] = newOrdens[fromEtapa].filter(o => o.id !== ordem.id)
      const ordemAtualizada = { ...ordem, etapa: toEtapa }
      newOrdens[toEtapa] = [...(newOrdens[toEtapa] || []), ordemAtualizada]
      return newOrdens
    })

    // Chama Server Action
    const result = await moverOrdem(ordem.id, toEtapa)
    
    if (!result.success) {
      alert('Erro ao mover ordem: ' + result.error)
    }

    setChecklistOpen(false)
    setPendingMove(null)
  }

  const totalOrdens = Object.values(ordensPorEtapa).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <DashboardLayout>
      {pendingMove && (
        <ChecklistModal
          isOpen={checklistOpen}
          onClose={() => {
            setChecklistOpen(false)
            setPendingMove(null)
          }}
          onConfirm={confirmMove}
          etapaDestino={pendingMove.toEtapa}
          ordemId={pendingMove.ordem.id}
        />
      )}
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
                className="rounded-t-2xl px-5 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5"
                style={{ backgroundColor: etapa.cor + '25', backdropFilter: 'blur(10px)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full ring-4 ring-white/10"
                    style={{ backgroundColor: etapa.cor }}
                  />
                  <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">{etapa.nome}</h3>
                </div>
                <Badge variant="secondary" className="bg-white/50 dark:bg-black/20 border-none font-bold text-slate-700 dark:text-slate-300">
                  {ordensPorEtapa[etapa.id]?.length || 0}
                </Badge>
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-b-2xl p-3 min-h-[600px] space-y-4 border-x border-b border-slate-200 dark:border-white/5">
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
