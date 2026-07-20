'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ConfirmActionModal } from '@/components/ui/confirm-action-modal'
import { EmptyState } from '@/components/ui/empty-state'
import { moverOrdem } from '@/actions/producao'
import { concluirAjusteSemNovaProva, enviarParaProva } from '@/actions/ciclos'
import { getOrdemById } from '@/actions/ordens'
import { FLUXOS_PROTESE, KANBAN_ETAPAS, TIPOS_PROTESE, etapaLabel, isTipoProtese, normalizarEtapa, type TipoProteseId } from '@/lib/workflow-config'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { AbrirCicloModal } from '@/components/producao/abrir-ciclo-modal'
import { ConfirmarRetornoModal } from '@/components/producao/confirmar-retorno-modal'
import { RetornosClinica } from '@/components/producao/retornos-clinica'
import { FluxoProteseBoard } from '@/components/producao/fluxo-protese-board'
import { DefinirEtapaFluxoModal } from '@/components/producao/definir-etapa-fluxo-modal'
import { ListaProducao } from '@/components/producao/lista-producao'
import { ResumoProducao } from '@/components/producao/resumo-producao'
import type { FilaProducao, OrdemProducao, VisualizacaoProducao } from '@/components/producao/types'
import { diasRestantes, filaDaOrdem, ordenarOrdensOperacionais } from '@/lib/producao-utils'
import {
  Calendar,
  GripVertical,
  LayoutGrid,
  List,
  FileText,
  FlaskConical,
  PackageCheck,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PencilLine,
  Route,
} from 'lucide-react'
import { toast } from 'sonner'

const etapas = KANBAN_ETAPAS


interface ProducaoViewProps {
  initialOrdens: OrdemProducao[]
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

function ehRetornoPendente(ordem: OrdemProducao) {
  return Boolean(ordem.cicloDentistaDeci) && ordem.cicloStatus === 'em_prova'
}

function agruparOrdens(ordens: OrdemProducao[]) {
  const agrupado: Record<string, OrdemProducao[]> = {}
  etapas.forEach((etapa) => { agrupado[etapa.id] = [] })

  ordens.forEach((ordem) => {
    let etapaKey = normalizarEtapa(ordem.etapa || 'recebimento')
    if (ordem.cicloStatus === 'em_prova') etapaKey = 'em_prova'
    if (!agrupado[etapaKey]) agrupado.recebimento.push(ordem)
    else agrupado[etapaKey].push(ordem)
  })

  return agrupado
}

// Card do Kanban com controles de ciclo
function KanbanCard({
  ordem,
  etapaId,
  onDragStart,
  onPatientClick,
  onEnviarProva,
  onConfirmarRetorno,
  onAbrirCiclo,
  onConcluirAjuste,
  onDefinirEtapa,
  onAbrirFluxo,
}: {
  ordem: OrdemProducao
  etapaId: string
  onDragStart: (e: React.DragEvent, ordem: OrdemProducao, etapaId: string) => void
  onPatientClick: () => void
  onEnviarProva: () => void
  onConfirmarRetorno: () => void
  onAbrirCiclo: () => void
  onConcluirAjuste: () => void
  onDefinirEtapa: () => void
  onAbrirFluxo: () => void
}) {
  const isEmProva = ordem.cicloStatus === 'em_prova' || etapaId === 'em_prova'
  const hasRetorno = Boolean(ordem.cicloDentistaDeci) && ordem.cicloStatus === 'em_prova'
  const isAjusteNoLab = etapaId === 'ajuste' && ordem.cicloStatus === 'no_lab'
  const daysLeft = diasRestantes(
    ordem.cicloComprometido || ordem.entrega,
    isEmProva || ordem.status === 'Pausado'
  )
  const isAtrasado = daysLeft !== null && daysLeft < 0
  const isPausada = ordem.status === 'Pausado'
  const fluxoEspecifico = isTipoProtese(ordem.tipoWorkflow) && Boolean(ordem.passoFluxoAtual)

  return (
    <div
      draggable={!isPausada && !isTipoProtese(ordem.tipoWorkflow)}
      onDragStart={(e) => onDragStart(e, ordem, etapaId)}
      className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800 border-l-4 ${getPriorityColor(ordem.prioridade)} ${isPausada || isTipoProtese(ordem.tipoWorkflow) ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${isPausada ? 'opacity-80' : ''} hover:shadow-md transition-all duration-200 group`}
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
        {ordem.subetapa && (
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-zinc-500">{ordem.subetapa}</p>
        )}
        {isPausada && <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-amber-600"><PauseCircle className="h-3.5 w-3.5" /> Ordem pausada</p>}
      </div>

      {/* Badge de ciclo — se for cíclico */}
      {ordem.cicloNumero && (
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
            {isPausada
              ? 'Prazo suspenso'
              : isEmProva
              ? '⏸ Na clínica'
              : isAtrasado
              ? `${Math.abs(daysLeft!)}d atrasado`
              : daysLeft === 0
              ? 'Entrega hoje'
              : daysLeft !== null
              ? `${daysLeft}d restantes`
              : 'Prazo não definido'
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
        {fluxoEspecifico && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAbrirFluxo() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 transition-all"
          >
            <Route className="h-3.5 w-3.5" /> Abrir fluxo da prótese
          </button>
        )}
        {!ordem.passoFluxoAtual && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDefinirEtapa() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-all"
          >
            <PencilLine className="h-3.5 w-3.5" />
            Definir tipo e etapa
          </button>
        )}

        {!fluxoEspecifico && !isPausada && !ordem.cicloAtivoId && (etapaId === 'confeccao' || etapaId === 'ajuste') && (
          <button
            onClick={(e) => { e.stopPropagation(); onAbrirCiclo() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Iniciar ciclo de prova
          </button>
        )}

        {/* Se está no lab → botão Enviar p/ Prova */}
        {!fluxoEspecifico && !isPausada && ordem.cicloAtivoId && ordem.cicloStatus === 'no_lab' && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onEnviarProva() }}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {isAjusteNoLab ? 'Enviar para nova prova' : 'Enviar para prova'}
            </button>
            {isAjusteNoLab && (
              <button
                onClick={(e) => { e.stopPropagation(); onConcluirAjuste() }}
                className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Seguir para acabamento
              </button>
            )}
          </>
        )}

        {!fluxoEspecifico && !isPausada && ordem.cicloAtivoId && ordem.cicloStatus === 'em_prova' && !hasRetorno && (
          <span className="flex-1 py-1.5 text-center text-[11px] font-bold text-amber-600 dark:text-amber-400">
            Aguardando decisão do dentista
          </span>
        )}

        {/* Se está em prova e dentista enviou feedback → confirmar retorno */}
        {!fluxoEspecifico && !isPausada && ordem.cicloAtivoId && hasRetorno && (
          <button
            onClick={(e) => { e.stopPropagation(); onConfirmarRetorno() }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 transition-all"
          >
            <PackageCheck className="h-3.5 w-3.5" />
            {ordem.cicloDentistaDeci === 'aprovado' ? 'Confirmar retorno aprovado' : 'Confirmar retorno para ajustes'}
          </button>
        )}
      </div>
    </div>
  )
}

interface ChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  etapaDestino: string
  loading: boolean
}

// Checklist modal simplificado para mover entre etapas
function ChecklistModal({ isOpen, onClose, onConfirm, etapaDestino, loading }: ChecklistModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mover para ${etapaDestino}?`} description="Confirme a mudança de etapa" size="sm" dismissible={!loading}>
      <div className="space-y-6">
        <p className="text-sm text-slate-600 dark:text-zinc-300">
          A ordem será movimentada no Kanban e o histórico operacional será atualizado.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={loading} className="bg-indigo-600 text-white hover:bg-indigo-700">{loading ? 'Movendo...' : 'Confirmar movimentação'}</Button>
        </div>
      </div>
    </Modal>
  )
}

export function ProducaoView({ initialOrdens }: ProducaoViewProps) {
  const router = useRouter()
  const ordensPorEtapa = useMemo(() => agruparOrdens(initialOrdens), [initialOrdens])
  const [draggedItem, setDraggedItem] = useState<{ ordem: OrdemProducao; fromEtapa: string } | null>(null)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [pendingMove, setPendingMove] = useState<{ ordem: OrdemProducao; fromEtapa: string; toEtapa: string } | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedFullOrdem, setSelectedFullOrdem] = useState<Awaited<ReturnType<typeof getOrdemById>>>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('todas')
  const [tipoSelecionado, setTipoSelecionado] = useState<'todos' | TipoProteseId>('todos')
  const [filaSelecionada, setFilaSelecionada] = useState<FilaProducao>('laboratorio')
  const [visualizacao, setVisualizacao] = useState<VisualizacaoProducao>('kanban')
  const [ordemParaDefinirEtapa, setOrdemParaDefinirEtapa] = useState<OrdemProducao | null>(null)
  const [movendoOrdem, setMovendoOrdem] = useState(false)
  const [ajusteParaConcluir, setAjusteParaConcluir] = useState<OrdemProducao | null>(null)
  const [concluindoAjuste, setConcluindoAjuste] = useState(false)

  // Modais de ciclo
  const [abrirCicloOrdem, setAbrirCicloOrdem] = useState<OrdemProducao | null>(null)
  const [confirmarRetornoOrdem, setConfirmarRetornoOrdem] = useState<OrdemProducao | null>(null)

  const handleDragStart = (e: React.DragEvent, ordem: OrdemProducao, etapaId: string) => {
    if (isTipoProtese(ordem.tipoWorkflow)) {
      e.preventDefault()
      toast.info('Use a etapa específica da prótese para avançar esta ordem.')
      return
    }
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

    // Se arrastar para em_prova → aciona enviarParaProva se tiver ciclo
    if (toEtapa === 'em_prova' && draggedItem.ordem.cicloAtivoId) {
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
    setMovendoOrdem(true)
    const { ordem, toEtapa } = pendingMove
    try {
      const result = await moverOrdem(ordem.id, toEtapa)
      if (!result.success) throw new Error(result.error || 'Não foi possível mover a ordem.')
      toast.success('Ordem movimentada.')
      setChecklistOpen(false)
      setPendingMove(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível mover a ordem.')
    } finally {
      setMovendoOrdem(false)
    }
  }

  const handleEnviarProva = async (ordem: OrdemProducao) => {
    if (!ordem.cicloAtivoId) return
    const result = await enviarParaProva(ordem.cicloAtivoId)
    if (!result.success) {
      const mensagem = 'error' in result && typeof result.error === 'string'
        ? result.error
        : 'Não foi possível enviar o trabalho para prova.'
      toast.error(mensagem)
      return
    }
    toast.success('Trabalho enviado para prova.')
    router.refresh()
  }

  const handleConcluirAjuste = (ordem: OrdemProducao) => {
    if (!ordem.cicloAtivoId) return
    setAjusteParaConcluir(ordem)
  }

  const confirmarConclusaoAjuste = async () => {
    if (!ajusteParaConcluir?.cicloAtivoId) return
    setConcluindoAjuste(true)
    try {
      const result = await concluirAjusteSemNovaProva(ajusteParaConcluir.cicloAtivoId)
      if (!result.success) {
        toast.error(result.error || 'Não foi possível concluir o ajuste.')
        return
      }
      setAjusteParaConcluir(null)
      toast.success('Ajuste concluído e enviado para acabamento.')
      router.refresh()
    } catch {
      toast.error('Não foi possível concluir o ajuste.')
    } finally {
      setConcluindoAjuste(false)
    }
  }

  const todasOrdens = useMemo(() => Object.values(ordensPorEtapa).flat(), [ordensPorEtapa])
  const termoNormalizado = searchTerm.trim().toLowerCase()
  const ordensBuscaPrioridade = useMemo(() => ordenarOrdensOperacionais(todasOrdens.filter((ordem) => {
    const correspondeBusca = !termoNormalizado
      || ordem.paciente.toLowerCase().includes(termoNormalizado)
      || ordem.dentista.toLowerCase().includes(termoNormalizado)
      || String(ordem.id).includes(termoNormalizado)
    const correspondePrioridade = priorityFilter === 'todas' || ordem.prioridade === priorityFilter
    return correspondeBusca && correspondePrioridade
  })), [priorityFilter, todasOrdens, termoNormalizado])

  const ordensExibidas = useMemo(() => tipoSelecionado === 'todos'
    ? ordensBuscaPrioridade.filter((ordem) => filaDaOrdem(ordem) === filaSelecionada)
    : ordensBuscaPrioridade.filter((ordem) => ordem.tipoWorkflow === tipoSelecionado),
  [filaSelecionada, ordensBuscaPrioridade, tipoSelecionado])

  const ordensFiltradasPorEtapa = useMemo(() => agruparOrdens(ordensExibidas), [ordensExibidas])
  const contagens = useMemo(() => todasOrdens.reduce<Record<FilaProducao, number>>((acc, ordem) => {
    acc[filaDaOrdem(ordem)] += 1
    return acc
  }, { laboratorio: 0, clinica: 0, fornecedor: 0, sem_etapa: 0 }), [todasOrdens])
  // Pendências operacionais nunca obedecem aos filtros do Kanban: precisam permanecer visíveis.
  const retornosPendentes = todasOrdens
    .filter(ehRetornoPendente)
    .sort((a, b) => {
      const dataA = a.cicloRespostaEm ? new Date(a.cicloRespostaEm).getTime() : 0
      const dataB = b.cicloRespostaEm ? new Date(b.cicloRespostaEm).getTime() : 0
      return dataA - dataB
    })

  const handlePatientClick = async (id: number) => {
    try {
      const fullOrdem = await getOrdemById(id)
      if (fullOrdem) { setSelectedFullOrdem(fullOrdem); setViewModalOpen(true) }
      else toast.error('Não foi possível abrir esta ordem.')
    } catch {
      toast.error('Não foi possível abrir esta ordem.')
    }
  }

  return (
    <DashboardLayout>
      <VisualizarOrdemModal
        isOpen={viewModalOpen}
        onClose={() => { setViewModalOpen(false); setSelectedFullOrdem(null) }}
        ordem={selectedFullOrdem}
      />
      {ordemParaDefinirEtapa && (
        <DefinirEtapaFluxoModal
          key={ordemParaDefinirEtapa.id}
          ordem={ordemParaDefinirEtapa}
          onClose={() => setOrdemParaDefinirEtapa(null)}
          onSuccess={() => {
            setOrdemParaDefinirEtapa(null)
            router.refresh()
          }}
        />
      )}
      {pendingMove && (
        <ChecklistModal
          isOpen={checklistOpen}
          onClose={() => { setChecklistOpen(false); setPendingMove(null) }}
          onConfirm={confirmMove}
          etapaDestino={etapaLabel(pendingMove.toEtapa)}
          loading={movendoOrdem}
        />
      )}
      <ConfirmActionModal
        isOpen={ajusteParaConcluir !== null}
        onClose={() => setAjusteParaConcluir(null)}
        onConfirm={confirmarConclusaoAjuste}
        title="Concluir ajuste"
        description="Confirma que o ajuste está concluído e pode seguir diretamente para acabamento, sem uma nova prova?"
        confirmLabel="Seguir para acabamento"
        loading={concluindoAjuste}
      />

      {/* Modal Abrir Ciclo */}
      {abrirCicloOrdem && (
        <AbrirCicloModal
          isOpen={true}
          onClose={() => setAbrirCicloOrdem(null)}
          ordemId={abrirCicloOrdem.id}
          paciente={abrirCicloOrdem.paciente}
          servico={abrirCicloOrdem.servico}
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

      <Header
        title="Produção"
        subtitle={`${contagens.laboratorio} no laboratório · ${contagens.clinica} na clínica · ${contagens.fornecedor} com fornecedor${retornosPendentes.length > 0 ? ` · ${retornosPendentes.length} retorno${retornosPendentes.length > 1 ? 's' : ''} para confirmar` : ''}`}
      />

      <main className="p-4 sm:p-6">
        {tipoSelecionado === 'todos' && (
          <ResumoProducao
            contagens={contagens}
            selecionada={filaSelecionada}
            retornos={retornosPendentes.length}
            onSelecionar={(fila) => {
              setFilaSelecionada(fila)
              if (fila !== 'laboratorio') setVisualizacao('lista')
            }}
          />
        )}

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <select
              value={tipoSelecionado}
              onChange={(event) => {
                setTipoSelecionado(event.target.value as 'todos' | TipoProteseId)
                if (event.target.value !== 'todos') setVisualizacao('kanban')
              }}
              aria-label="Selecionar tipo de prótese"
              className="max-w-full flex-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200 sm:flex-none"
            >
              <option value="todos">Visão geral — todas as próteses</option>
              {TIPOS_PROTESE.map((tipo) => (
                <option key={tipo} value={tipo}>{FLUXOS_PROTESE[tipo].nome}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Buscar paciente ou #ID..."
              aria-label="Buscar paciente, dentista ou número da ordem"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-zinc-800 dark:text-white sm:w-64"
            />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filtrar por prioridade"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-white/10 dark:bg-zinc-800 dark:text-white"
            >
              <option value="todas">Todas as Prioridades</option>
              <option value="Baixa">Baixa</option>
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
          {tipoSelecionado === 'todos' && (
            <div className="hidden items-center gap-2 md:flex" role="group" aria-label="Modo de visualização">
              <Button type="button" variant={visualizacao === 'kanban' ? 'secondary' : 'outline'} size="icon" onClick={() => setVisualizacao('kanban')} aria-label="Visualizar como Kanban" aria-pressed={visualizacao === 'kanban'}><LayoutGrid className="h-4 w-4" /></Button>
              <Button type="button" variant={visualizacao === 'lista' ? 'secondary' : 'outline'} size="icon" onClick={() => setVisualizacao('lista')} aria-label="Visualizar como lista" aria-pressed={visualizacao === 'lista'}><List className="h-4 w-4" /></Button>
            </div>
          )}
        </div>

        <RetornosClinica
          retornos={retornosPendentes}
          onAbrirOrdem={handlePatientClick}
          onConfirmarRecebimento={(id) => {
            const ordem = retornosPendentes.find((item) => item.id === id)
            if (ordem) setConfirmarRetornoOrdem(ordem)
          }}
        />

        {tipoSelecionado !== 'todos' ? (
          <FluxoProteseBoard
            tipo={tipoSelecionado}
            ordens={ordensExibidas}
            onAbrirOrdem={handlePatientClick}
            onDefinirEtapa={(ordemId) => {
              const ordem = Object.values(ordensPorEtapa).flat().find((item) => item.id === ordemId)
              if (ordem) setOrdemParaDefinirEtapa(ordem)
            }}
          />
        ) : visualizacao === 'lista' ? (
          <ListaProducao
            ordens={ordensExibidas.filter((ordem) => !ehRetornoPendente(ordem))}
            onAbrirOrdem={handlePatientClick}
            onDefinirEtapa={setOrdemParaDefinirEtapa}
            onAbrirFluxo={(ordem) => {
              if (isTipoProtese(ordem.tipoWorkflow)) setTipoSelecionado(ordem.tipoWorkflow)
            }}
          />
        ) : (
        /* KanBan Board */
        <>
        <div className="md:hidden">
          <ListaProducao
            ordens={ordensExibidas.filter((ordem) => !ehRetornoPendente(ordem))}
            onAbrirOrdem={handlePatientClick}
            onDefinirEtapa={setOrdemParaDefinirEtapa}
            onAbrirFluxo={(ordem) => {
              if (isTipoProtese(ordem.tipoWorkflow)) setTipoSelecionado(ordem.tipoWorkflow)
            }}
          />
        </div>
        <div className="hidden gap-4 overflow-x-auto pb-4 snap-x snap-mandatory min-h-[calc(100vh-250px)] md:flex">
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
                  {ordensFiltradasPorEtapa[etapa.id]?.filter((ordem) => !ehRetornoPendente(ordem)).length || 0}
                </Badge>
              </div>

              {/* Cards */}
              <div className="bg-slate-50/50 dark:bg-slate-900/20 rounded-b-2xl p-3 min-h-[600px] space-y-3 border-x border-b border-slate-200 dark:border-white/5">
                {ordensFiltradasPorEtapa[etapa.id]
                  ?.filter((ordem) => !ehRetornoPendente(ordem))
                  .map((ordem) => (
                  <KanbanCard
                    key={ordem.id}
                    ordem={ordem}
                    etapaId={etapa.id}
                    onDragStart={handleDragStart}
                    onPatientClick={() => handlePatientClick(ordem.id)}
                    onEnviarProva={() => handleEnviarProva(ordem)}
                    onConfirmarRetorno={() => setConfirmarRetornoOrdem(ordem)}
                    onAbrirCiclo={() => setAbrirCicloOrdem(ordem)}
                    onConcluirAjuste={() => handleConcluirAjuste(ordem)}
                    onDefinirEtapa={() => setOrdemParaDefinirEtapa(ordem)}
                    onAbrirFluxo={() => {
                      if (isTipoProtese(ordem.tipoWorkflow)) setTipoSelecionado(ordem.tipoWorkflow)
                    }}
                  />
                ))}

                {(!ordensFiltradasPorEtapa[etapa.id] || ordensFiltradasPorEtapa[etapa.id].filter((ordem) => !ehRetornoPendente(ordem)).length === 0) && (
                  <EmptyState
                    icon={FileText}
                    title="Sem ordens"
                    description={filaSelecionada === 'laboratorio' ? 'Nenhuma ordem desta fila está nesta etapa' : 'Nenhuma ordem nesta etapa'}
                    className="py-6"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        </>
        )}

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
      </main>
    </DashboardLayout>
  )
}
