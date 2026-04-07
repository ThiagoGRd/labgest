'use client'

import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import {
  Calendar,
  User,
  GripVertical,
  AlertTriangle,
  Clock,
  Paperclip,
  MoreHorizontal
} from 'lucide-react'

interface KanbanCardProps {
  ordem: any
  onDragStart: (e: React.DragEvent, ordem: any, etapaId: string) => void
  etapaId: string
  onClick?: () => void
  onPatientClick?: () => void
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

function getDaysRemaining(dateStr: string, isFinished: boolean = false) {
  if (isFinished) return { text: 'Concluído', isLate: false, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  const diff = Math.ceil((entrega.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, isLate: true, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' }
  if (diff === 0) return { text: 'Hoje', isLate: false, isToday: true, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' }
  if (diff === 1) return { text: 'Amanhã', isLate: false, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' }
  return { text: `${diff}d`, isLate: false, color: 'text-slate-500 bg-slate-100 dark:bg-zinc-800' }
}

export function KanbanCard({ ordem, onDragStart, etapaId, onClick, onPatientClick }: KanbanCardProps) {
  const daysInfo = getDaysRemaining(ordem.entrega, ordem.etapa === 'Finalizado' || ordem.status === 'Finalizado' || ordem.status === 'Entregue' || ordem.status === 'Pausado')

  // Extrair elementos se houver
  const elementos = ordem.elementos ? ordem.elementos.split(',').map((e: string) => e.trim()) : []

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ordem, etapaId)}
      onClick={onClick}
      className={`
        bg-white dark:bg-zinc-900 
        rounded-xl 
        border border-slate-200 dark:border-zinc-800 
        border-l-[6px] ${getPriorityColor(ordem.prioridade)} 
        p-4 
        cursor-grab active:cursor-grabbing 
        shadow-sm hover:shadow-lg hover:translate-y-[-2px] 
        transition-all duration-200 
        group 
        relative
        overflow-hidden
      `}
    >
      {/* Header com ID e Menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 cursor-grab">
            <GripVertical className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            #{ordem.id}
          </span>
        </div>
        
        {ordem.prioridade === 'Urgente' && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wider shadow-sm">
            Urgente
          </span>
        )}
      </div>

      {/* Corpo do Card */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 
            className="font-bold text-slate-900 dark:text-white leading-snug text-sm line-clamp-2 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              if (onPatientClick) onPatientClick()
            }}
          >
            {ordem.paciente}
          </h4>
          {/* Avatar do Paciente (Simulado por enquanto) */}
          <Avatar name={ordem.paciente} size="sm" className="w-8 h-8 text-[10px]" />
        </div>
        
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-2 line-clamp-1">
          {ordem.servico}
        </p>

        {/* Badges de Elementos */}
        {elementos.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {elementos.slice(0, 3).map((elem: string, i: number) => (
              <span key={i} className="text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                {elem}
              </span>
            ))}
            {elementos.length > 3 && (
              <span className="text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-400 px-1.5 py-0.5 rounded">
                +{elementos.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer com Metadados */}
      <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Foto do Dentista */}
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400" title={ordem.dentista}>
            <User className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[70px]">
              {ordem.dentista.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Prazo */}
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${daysInfo.color}`}>
          {daysInfo.isLate ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          <span className="text-[10px] font-bold uppercase tracking-wider">
            {daysInfo.text}
          </span>
        </div>
      </div>

      {/* Indicador de Anexos (se houver) */}
      {/* 
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-white dark:bg-zinc-800 shadow-sm border border-slate-200 dark:border-zinc-700 rounded-full p-1">
          <Paperclip className="h-3 w-3 text-slate-400" />
        </div>
      </div>
      */}
    </div>
  )
}