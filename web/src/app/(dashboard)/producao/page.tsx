'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Clock,
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

// Etapas de produção
const etapas = [
  { id: 'recebimento', nome: 'Recebimento', cor: '#6366f1' },
  { id: 'planejamento', nome: 'Planejamento/CAD', cor: '#8b5cf6' },
  { id: 'impressao', nome: 'Impressão/Fresagem', cor: '#a855f7' },
  { id: 'acabamento', nome: 'Acabamento', cor: '#d946ef' },
  { id: 'conferencia', nome: 'Conferência', cor: '#ec4899' },
  { id: 'pronto', nome: 'Pronto p/ Entrega', cor: '#22c55e' },
]

// Mock de ordens por etapa
const ordensIniciais: Record<string, any[]> = {
  recebimento: [
    {
      id: 2,
      paciente: 'Carlos Oliveira',
      servico: 'Protocolo Inferior',
      dentista: 'Dra. Ana Lima',
      prioridade: 'Urgente',
      dataEntrega: '2026-02-05',
      tecnico: null,
    },
  ],
  planejamento: [
    {
      id: 5,
      paciente: 'Pedro Souza',
      servico: 'Ponte Adesiva 11-21',
      dentista: 'Dra. Carla Melo',
      prioridade: 'Alta',
      dataEntrega: '2026-02-08',
      tecnico: 'Marcos',
    },
    {
      id: 6,
      paciente: 'Lucia Ferreira',
      servico: 'Prótese Total Inferior',
      dentista: 'Dr. Marcos Alves',
      prioridade: 'Baixa',
      dataEntrega: '2026-02-15',
      tecnico: null,
    },
  ],
  impressao: [
    {
      id: 3,
      paciente: 'José Pereira',
      servico: 'Parcial Removível',
      dentista: 'Dr. Paulo Costa',
      prioridade: 'Normal',
      dataEntrega: '2026-02-10',
      tecnico: 'João',
    },
  ],
  acabamento: [
    {
      id: 1,
      paciente: 'Maria Silva',
      servico: 'Prótese Total Superior',
      dentista: 'Dr. João Santos',
      prioridade: 'Alta',
      dataEntrega: '2026-02-07',
      tecnico: 'João',
    },
  ],
  conferencia: [],
  pronto: [
    {
      id: 4,
      paciente: 'Ana Santos',
      servico: 'Provisório Unitário 21',
      dentista: 'Dr. João Santos',
      prioridade: 'Normal',
      dataEntrega: '2026-02-04',
      tecnico: 'Marcos',
    },
  ],
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
  ordem: any
  onDragStart: (e: React.DragEvent, ordem: any, etapaId: string) => void
  etapaId: string
}

function KanbanCard({ ordem, onDragStart, etapaId }: KanbanCardProps) {
  const daysInfo = getDaysRemaining(ordem.dataEntrega)

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

      {ordem.tecnico && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <Avatar name={ordem.tecnico} size="sm" />
          <span className="text-xs text-slate-500">{ordem.tecnico}</span>
        </div>
      )}
    </div>
  )
}

export default function ProducaoPage() {
  const [ordens, setOrdens] = useState(ordensIniciais)
  const [draggedItem, setDraggedItem] = useState<{ ordem: any; fromEtapa: string } | null>(null)

  const handleDragStart = (e: React.DragEvent, ordem: any, etapaId: string) => {
    setDraggedItem({ ordem, fromEtapa: etapaId })
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, toEtapa: string) => {
    e.preventDefault()
    if (!draggedItem || draggedItem.fromEtapa === toEtapa) return

    setOrdens(prev => {
      const newOrdens = { ...prev }
      // Remove da etapa origem
      newOrdens[draggedItem.fromEtapa] = newOrdens[draggedItem.fromEtapa].filter(
        o => o.id !== draggedItem.ordem.id
      )
      // Adiciona na etapa destino
      newOrdens[toEtapa] = [...newOrdens[toEtapa], draggedItem.ordem]
      return newOrdens
    })

    setDraggedItem(null)
  }

  const totalOrdens = Object.values(ordens).reduce((acc, arr) => acc + arr.length, 0)

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
              Técnico
              <ChevronDown className="h-4 w-4 ml-2" />
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
                  {ordens[etapa.id]?.length || 0}
                </Badge>
              </div>

              <div className="bg-slate-100 rounded-b-xl p-3 min-h-[500px] space-y-3">
                {ordens[etapa.id]?.map((ordem) => (
                  <KanbanCard
                    key={ordem.id}
                    ordem={ordem}
                    etapaId={etapa.id}
                    onDragStart={handleDragStart}
                  />
                ))}

                {ordens[etapa.id]?.length === 0 && (
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
