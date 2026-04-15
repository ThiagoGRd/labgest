'use client'

import { useState, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { moverOrdem, enviarParaProva } from '@/actions/producao'
import { getOrdemById } from '@/actions/ordens'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { AbrirCicloModal } from '@/components/producao/abrir-ciclo-modal'
import { ConfirmarRetornoModal } from '@/components/producao/confirmar-retorno-modal'
import {
  Calendar,
  GripVertical,
  LayoutGrid,
  List,
  FileText,
  FlaskConical,
  PackageCheck,
  Clock,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

// Etapas de produção
const etapas = [
  { id: 'Recebimento', nome: 'Recebimento', cor: '#6366f1' },
  { id: 'Planejamento', nome: 'Planejamento/CAD', cor: '#8b5cf6' },
  { id: 'Impressão', nome: 'Impressão/Fresagem', cor: '#a855f7' },
  { id: 'EmProva', nome: 'Em Prova (Clínica)', cor: '#f59e0b' },
  { id: 'Acabamento', nome: 'Acabamento', cor: '#d946ef' },
  { id: 'Conferência', nome: 'Conferência Final', cor: '#ec4899' },
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
  elementos?: string | null
  foto?: string | null
  tipoWorkflow?: string
  cicloAtivoId?: number | null
  cicloStatus?: string | null
  cicloNumero?: number | null
  cicloComprometido?: string | null
  cicloDentistaDeci?: string | null
  cicloObs?: string | null
  cicloFotos?: string[]
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

function getDaysRemaining(dateStr: string, isEmProva: boolean) {
  if (isEmProva) return null // prazo pausado quando está em prova
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const entrega = new Date(dateStr)
  entrega.setHours(0, 0, 0, 0)
  return Math.ceil((entrega.getTime() - hoje.getTime()) / 86400000)
}

// Card do Kanban com controles de ciclo
function KanbanCard({
  ordem,
  etapaId,
  onDragStart,
  onPatientClick,
  onEnviarProva,
  onConfirmarRetorno,
}: {
  ordem: Ordem
  etapaId: string
  onDragStart: (e: React.DragEvent, ordem: Ordem, etapaId: string) => void
  onPatientClick: () => void
  onEnviarProva: () => void
  onConfirmarRetorno: () => void
}) {
  const isEmProva = ordem.cicloStatus === 'em_prova' || etapaId === 'EmProva'
  const hasRetorno = ordem.cicloDentistaDeci !== null && ordem.cicloStatus === 'em_prova'
  const daysLeft = getDaysRemaining(
    ordem.cicloComprometido || ordem.entrega,
    isEmProva
  )
  const isAtrasado = daysLeft !== null && daysLeft < 0

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ordem, etapaId)}
      className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-l-4 ${getPriorityColor(ordem.prioridade)} cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 group`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-4 w-4 text-slate-300 dark:text-zinc-600 flex-shrink-0" />
          <div className="min-w-0">
            <button
              onClick={onPatientClick}
              className="font-bold text-sm text-slate-900 dark:text-white truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left"
            >
              {ordem.paciente}
            </button>
            <p className="text-xs text-slate-500 dark:text-zinc-500 truncate">{ordem.dentista}</p>
          </div>
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-600 flex-shrink-0">#{ordem.id}</span>
      </div>

      {/* Serviço */}
      <div className="px-4 pb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg">
          {ordem.servico}
        </span>
      </div>

      {/* Badge de ciclo — se for cíclico */}
      {ordem.tipoWorkflow === 'ciclico' && ordem.cicloNumero && (
        <div className="px-4 pb-2 flex items-center gap-1.5">
          <RotateCcw className="h-3 w-3 text-indigo-400" />
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
            Ciclo #{ordem.cicloNumero}
          </span>
        </div>
      )}

      {/* Badge "Retornou" com decisão do dentista */}
      {hasRetorno && (
        <div className={`mx-4 mb-2 px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
          ordem.cicloDentistaDeci === 'aprovado'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
        }`}>
          {ordem.cicloDentistaDeci === 'aprovado'
            ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            : <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          }
          <span>
            {ordem.cicloDentistaDeci === 'aprovado' ? 'Aprovado! Pode finalizar.' : `Ajustes: ${ordem.cicloObs?.slice(0, 50) || 'Ver detalhes'}`}
          </span>
        </div>
      )}

      {/* Prazo */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          <span className={`text-xs font-medium ${isAtrasado ? 'text-red-500' : isEmProva ? 'text-amber-400' : 'text-slate-500 dark:text-zinc-400'}`}>
            {isEmProva
              ? '⏸ Na clínica'
              : isAtrasado
              ? `${Math.abs(daysLeft!)}d atrasado`
              : daysLeft === 0
              ? 'Entrega hoje'
              : daysLeft !== null
              ? `${daysLeft}d restantes`
              : new Date(ordem.entrega).toLocaleDateString('pt-BR')
            }
          </span>
        </div>

        {/* Badges de prioridade */}
        {ordem.prioridade === 'Urgente' && (
          <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/50">
            URGENTE
          </span>
        )}
      </div>

      {/* Ações de Ciclo */}
      <div className="border-t border-slate-100 dark:border-zinc-800 px-3 py-2 flex gap-2">
        {/* Se está no lab → botão Enviar p/ Prova */}
        {ordem.cicloAtivoId && ordem.cicloStatus === 'no_lab' && (
          <button
            onClick={(e) => { e.stopPropagation(); onEnviarProva() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all"
          >
            <FlaskConical className="h-3.5 w-3.5" />
            Enviar p/ Prova
          </button>
        )}

        {/* Se está em prova e dentista enviou feedback → confirmar retorno */}
        {ordem.cicloAtivoId && (ordem.cicloStatus === 'em_prova' || hasRetorno) && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmarRetorno() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            Retornou
          </button>
        )}
      </div>
    </div>
  )
}

// Checklist modal simplificado para mover entre etapas
function ChecklistModal({ isOpen, onClose, onConfirm, etapaDestino }: any) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-zinc-800">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Mover para {etapaDestino}?</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Confirma a mudança de etapa desta ordem?</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={onConfirm} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">Confirmar</Button>
        </div>
      </div>
    </div>
  )
}

export function ProducaoView({ initialOrdens }: ProducaoViewProps) {
  const [ordensPorEtapa, setOrdensPorEtapa] = useState<Record<string, Ordem[]>>({})
  const [draggedItem, setDraggedItem] = useState<{ ordem: Ordem; fromEtapa: string } | null>(null)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<{ ordem: Ordem; fromEtapa: string; toEtapa: string } | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedFullOrdem, setSelectedFullOrdem] = useState<any | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('todas')

  // Modais de ciclo
  const [abrirCicloOrdem, setAbrirCicloOrdem] = useState<Ordem | null>(null)
  const [confirmarRetornoOrdem, setConfirmarRetornoOrdem] = useState<Ordem | null>(null)

  useEffect(() => {
    const agrupado: Record<string, Ordem[]> = {}
    etapas.forEach(e => agrupado[e.id] = [])

    const ordensFiltradas = initialOrdens.filter(o => {
      const matchSearch = String(o.paciente).toLowerCase().includes(searchTerm.toLowerCase()) || String(o.id).includes(searchTerm)
      const matchPriority = priorityFilter === 'todas' || o.prioridade === priorityFilter
      return matchSearch && matchPriority
    })

    ordensFiltradas.forEach(o => {
      // Ordens em prova vão para coluna EmProva
      let etapaKey = etapas.find(e => e.nome === o.etapa || e.id === o.etapa)?.id || 'Recebimento'
      if (o.cicloStatus === 'em_prova') etapaKey = 'EmProva'
      if (!agrupado[etapaKey]) agrupado[etapaKey] = []
      agrupado[etapaKey].push(o)
    })

    setOrdensPorEtapa(agrupado)
  }, [initialOrdens, searchTerm, priorityFilter])

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

    // Se arrastar para EmProva → aciona enviarParaProva se tiver ciclo
    if (toEtapa === 'EmProva' && draggedItem.ordem.cicloAtivoId) {
      await handleEnviarProva(draggedItem.ordem)
      setDraggedItem(null)
      return
    }

    setPendingMove({ ordem: draggedItem.ordem, fromEtapa: draggedItem.fromEtapa, toEtapa })
    setChecklistOpen(true)
    setDraggedItem(null)
  }

  const confirmMove = async () => {
    if (!pendingMove) return
    const { ordem, fromEtapa, toEtapa } = pendingMove
    setOrdensPorEtapa(prev => {
      const newOrdens = { ...prev }
      newOrdens[fromEtapa] = newOrdens[fromEtapa].filter(o => o.id !== ordem.id)
      newOrdens[toEtapa] = [...(newOrdens[toEtapa] || []), { ...ordem, etapa: toEtapa }]
      return newOrdens
    })
    const result = await moverOrdem(ordem.id, toEtapa)
    if (!result.success) alert('Erro ao mover ordem.')
    setChecklistOpen(false)
    setPendingMove(null)
  }

  const handleEnviarProva = async (ordem: Ordem) => {
    if (!ordem.cicloAtivoId) return
    await enviarParaProva(ordem.cicloAtivoId)
    // Move visualmente para EmProva
    setOrdensPorEtapa(prev => {
      const newOrdens = { ...prev }
      const etapaOrigem = Object.keys(newOrdens).find(k => newOrdens[k].some(o => o.id === ordem.id)) || ''
      if (etapaOrigem) newOrdens[etapaOrigem] = newOrdens[etapaOrigem].filter(o => o.id !== ordem.id)
      newOrdens['EmProva'] = [...(newOrdens['EmProva'] || []), { ...ordem, cicloStatus: 'em_prova' }]
      return newOrdens
    })
  }

  const totalOrdens = Object.values(ordensPorEtapa).reduce((acc, arr) => acc + arr.length, 0)

  const handlePatientClick = async (id: number) => {
    const fullOrdem = await getOrdemById(id)
    if (fullOrdem) { setSelectedFullOrdem(fullOrdem); setViewModalOpen(true) }
  }

  return (
    <DashboardLayout>
      <VisualizarOrdemModal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setSelectedFullOrdem(null) }}
        ordem={selectedFullOrdem}
      />
      {pendingMove && (
        <ChecklistModal
          isOpen={checklistOpen}
          onClose={() => { setChecklistOpen(false); setPendingMove(null) }}
          onConfirm={confirmMove}
          etapaDestino={pendingMove.toEtapa}
        />
      )}

      {/* Modal Abrir Ciclo */}
      {abrirCicloOrdem && (
        <AbrirCicloModal
          isOpen={true}
          onClose={() => setAbrirCicloOrdem(null)}
          ordemId={abrirCicloOrdem.id}
          paciente={abrirCicloOrdem.paciente}
          numeroCicloAtual={(abrirCicloOrdem.cicloNumero || 0) + 1}
        />
      )}

      {/* Modal Confirmar Retorno */}
      {confirmarRetornoOrdem?.cicloAtivoId && (
        <ConfirmarRetornoModal
          isOpen={true}
          onClose={() => setConfirmarRetornoOrdem(null)}
          cicloId={confirmarRetornoOrdem.cicloAtivoId}
          paciente={confirmarRetornoOrdem.paciente}
          decisaoDentista={confirmarRetornoOrdem.cicloDentistaDeci}
          observacoesDentista={confirmarRetornoOrdem.cicloObs}
          fotosProva={confirmarRetornoOrdem.cicloFotos}
        />
      )}

      <Header title="Produção" subtitle={`${totalOrdens} ordens em andamento`} />

      <div className="p-6">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Buscar paciente ou #ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 text-slate-900 dark:text-white"
            />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            >
              <option value="todas">Todas as Prioridades</option>
              <option value="Baixa">Baixa</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="icon"><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon"><List className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* KanBan Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory min-h-[calc(100vh-250px)]">
          {etapas.map((etapa) => (
            <div
              key={etapa.id}
              className="flex-shrink-0 w-80 snap-center"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, etapa.id)}
            >
              {/* Cabeçalho da coluna */}
              <div
                className="rounded-t-2xl px-5 py-4 flex items-center justify-between border-b border-black/5 dark:border-white/5"
                style={{ backgroundColor: etapa.cor + '25' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: etapa.cor }} />
                  <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">{etapa.nome}</h3>
                </div>
                <Badge variant="secondary" className="bg-white/50 dark:bg-black/20 border-none font-bold">
                  {ordensPorEtapa[etapa.id]?.length || 0}
                </Badge>
              </div>

              {/* Cards */}
              <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-b-2xl p-3 min-h-[600px] space-y-3 border-x border-b border-slate-200 dark:border-white/5">
                {ordensPorEtapa[etapa.id]?.map((ordem) => (
                  <KanbanCard
                    key={ordem.id}
                    ordem={ordem}
                    etapaId={etapa.id}
                    onDragStart={handleDragStart}
                    onPatientClick={() => handlePatientClick(ordem.id)}
                    onEnviarProva={() => handleEnviarProva(ordem)}
                    onConfirmarRetorno={() => setConfirmarRetornoOrdem(ordem)}
                  />
                ))}

                {(!ordensPorEtapa[etapa.id] || ordensPorEtapa[etapa.id].length === 0) && (
                  <EmptyState
                    icon={FileText}
                    title="Sem ordens"
                    description="Arraste uma ordem para esta etapa"
                    className="py-6"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legenda */}
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm text-slate-500">
          <span className="font-medium text-slate-700 dark:text-slate-300">Prioridade:</span>
          {[
            { cor: 'border-l-slate-400', label: 'Baixa' },
            { cor: 'border-l-blue-400', label: 'Normal' },
            { cor: 'border-l-orange-400', label: 'Alta' },
            { cor: 'border-l-red-500', label: 'Urgente' },
          ].map(({ cor, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border-l-4 ${cor} bg-slate-100 dark:bg-zinc-800`} />
              <span>{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 ml-4">
            <RotateCcw className="h-4 w-4 text-indigo-400" />
            <span className="text-xs">Trabalho cíclico (vai e volta)</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
