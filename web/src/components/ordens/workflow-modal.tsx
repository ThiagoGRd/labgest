'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Check,
  Circle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Clock,
  Loader2,
  GitBranch,
} from 'lucide-react'
import { avancarEtapa, retornarEtapa, updateChecklistEstetico } from '@/actions/ordens'
import {
  getEtapas,
  getEtapaNome,
  getEtapaIndex,
  getWorkflowLabel,
  isEtapaProva,
  canAdvance,
  canReturn,
  CHECKLIST_LABELS,
  CHECKLIST_VAZIO,
  type TipoWorkflow,
  type ChecklistEstetico,
  type EtapaConfig,
} from '@/lib/workflow-config'

interface Ordem {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  status: string
  etapaAtual: string
  tipoWorkflow: TipoWorkflow
  tentativaAtual: number
  historicoEtapas: any[]
  checklistEstetico: Partial<ChecklistEstetico>
}

interface WorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  ordem: Ordem | null
  onSuccess?: () => void
}

export function WorkflowModal({ isOpen, onClose, ordem, onSuccess }: WorkflowModalProps) {
  const [loading, setLoading] = useState(false)
  const [showRetorno, setShowRetorno] = useState(false)
  const [motivoRetorno, setMotivoRetorno] = useState('')
  const [checklist, setChecklist] = useState<Partial<ChecklistEstetico>>({})
  const [error, setError] = useState('')

  if (!ordem) return null

  const etapas = getEtapas(ordem.tipoWorkflow)
  const currentIdx = getEtapaIndex(ordem.tipoWorkflow, ordem.etapaAtual)
  const isProva = isEtapaProva(ordem.tipoWorkflow, ordem.etapaAtual)
  const mergedChecklist = { ...CHECKLIST_VAZIO, ...(ordem.checklistEstetico || {}), ...checklist }
  const podeAvancar = canAdvance(ordem.tipoWorkflow, ordem.etapaAtual, mergedChecklist)
  const podeRetornar = canReturn(ordem.tipoWorkflow, ordem.etapaAtual)

  // Contar devoluções por etapa
  const devolucoesPorEtapa: Record<string, number> = {}
  for (const h of ordem.historicoEtapas || []) {
    if (h.acao === 'devolveu') {
      devolucoesPorEtapa[h.etapa] = (devolucoesPorEtapa[h.etapa] || 0) + 1
    }
  }

  const handleAvancar = async () => {
    setLoading(true)
    setError('')
    try {
      // Salvar checklist primeiro se é prova
      if (isProva) {
        await updateChecklistEstetico(ordem.id, mergedChecklist)
      }
      const result = await avancarEtapa(ordem.id)
      if (result.success) {
        onSuccess?.()
        onClose()
      } else {
        setError(result.error || 'Erro ao avançar')
      }
    } catch {
      setError('Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleRetornar = async () => {
    if (!motivoRetorno.trim()) {
      setError('Informe o motivo da devolução')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await retornarEtapa(ordem.id, motivoRetorno)
      if (result.success) {
        setShowRetorno(false)
        setMotivoRetorno('')
        onSuccess?.()
        onClose()
      } else {
        setError(result.error || 'Erro ao devolver')
      }
    } catch {
      setError('Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleChecklistChange = async (key: keyof ChecklistEstetico, value: boolean) => {
    const newChecklist = { ...mergedChecklist, [key]: value }
    setChecklist(newChecklist)
    // Salvar automaticamente
    await updateChecklistEstetico(ordem.id, newChecklist)
  }

  const handleClose = () => {
    setShowRetorno(false)
    setMotivoRetorno('')
    setError('')
    setChecklist({})
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Fluxo da Ordem #${ordem.id}`}
      description={ordem.paciente}
      size="lg"
    >
      <div className="space-y-6">
        {/* Header info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-bold text-indigo-600">
              {getWorkflowLabel(ordem.tipoWorkflow)}
            </span>
          </div>
          {ordem.tentativaAtual > 0 && (
            <Badge variant="urgente" className="gap-1">
              <RotateCcw className="h-3 w-3" />
              {ordem.tentativaAtual} {ordem.tentativaAtual === 1 ? 'devolução' : 'devoluções'}
            </Badge>
          )}
        </div>

        {error && (
          <div className="p-3 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}

        {/* Timeline */}
        <div className="relative">
          {etapas.map((etapa, idx) => {
            const nome = getEtapaNome(etapa)
            const isCompleted = idx < currentIdx
            const isCurrent = idx === currentIdx
            const isFuture = idx > currentIdx
            const etapaConfig = typeof etapa !== 'string' ? etapa as EtapaConfig : null
            const devolvida = devolucoesPorEtapa[nome]

            return (
              <div key={nome} className="flex gap-4 relative">
                {/* Vertical line */}
                {idx < etapas.length - 1 && (
                  <div
                    className={`absolute left-[15px] top-[32px] w-0.5 h-[calc(100%-8px)] ${
                      isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  />
                )}

                {/* Circle */}
                <div className="flex-shrink-0 z-10 pt-1">
                  {isCompleted ? (
                    <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  ) : isCurrent ? (
                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/30 ring-4 ring-indigo-100 dark:ring-indigo-500/20 animate-pulse">
                      <Circle className="h-3 w-3 text-white fill-white" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-400">{idx + 1}</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 pb-6 ${isFuture ? 'opacity-40' : ''}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-bold ${
                        isCurrent
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : isCompleted
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-400'
                      }`}
                    >
                      {nome}
                    </span>
                    {etapaConfig?.isProva && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Prova
                      </span>
                    )}
                    {devolvida && (
                      <span className="text-[9px] font-bold uppercase tracking-widest bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <RotateCcw className="h-2.5 w-2.5" />
                        {devolvida}x devolvida
                      </span>
                    )}
                  </div>
                  {isCurrent && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mt-1">
                      Etapa Atual
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Checklist de Registro Estético (se etapa de prova) */}
        {isProva && (
          <div className="p-5 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-800 dark:text-amber-400">
                Checklist de Registro Estético
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400/80">
              Preencha todos os itens antes de aprovar e avançar esta etapa de prova.
            </p>
            <div className="space-y-3">
              {(Object.keys(CHECKLIST_LABELS) as (keyof ChecklistEstetico)[]).map(key => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <Checkbox
                    checked={mergedChecklist[key] || false}
                    onCheckedChange={(checked) => handleChecklistChange(key, checked as boolean)}
                  />
                  <span className={`text-sm font-medium transition-colors ${
                    mergedChecklist[key]
                      ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70'
                      : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900'
                  }`}>
                    {CHECKLIST_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Devolução */}
        {showRetorno && (
          <div className="p-5 bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-bold text-orange-800 dark:text-orange-400">
                Devolver para Ajuste
              </span>
            </div>
            <textarea
              value={motivoRetorno}
              onChange={e => setMotivoRetorno(e.target.value)}
              placeholder="Descreva o motivo da devolução (ex: DVO aumentada, corredor bucal estreito, linha média desviada...)"
              rows={3}
              className="w-full rounded-xl border border-orange-300 dark:border-orange-500/30 bg-white dark:bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowRetorno(false); setMotivoRetorno('') }}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleRetornar}
                disabled={loading || !motivoRetorno.trim()}
                className="rounded-xl bg-orange-600 hover:bg-orange-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Devolução'}
              </Button>
            </div>
          </div>
        )}

        {/* Histórico */}
        {ordem.historicoEtapas && ordem.historicoEtapas.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Histórico de Movimentações ({ordem.historicoEtapas.length})
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {[...ordem.historicoEtapas].reverse().map((h, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg text-xs ${
                    h.acao === 'devolveu'
                      ? 'bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10'
                      : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {h.acao === 'avancou' && '→ Avançou'}
                      {h.acao === 'devolveu' && '← Devolveu'}
                      {h.acao === 'criou' && '● Criou'}
                    </span>
                    <span className="text-slate-400">
                      {new Date(h.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {h.etapa} {h.para ? `→ ${h.para}` : ''}
                  </p>
                  {h.motivo && (
                    <p className="text-orange-700 dark:text-orange-400 mt-1 font-medium">
                      Motivo: {h.motivo}
                    </p>
                  )}
                  {h.tentativa > 0 && (
                    <span className="text-[9px] font-bold text-orange-600 uppercase">
                      Tentativa #{h.tentativa}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Action buttons */}
        {!showRetorno && (
          <div className="flex gap-3 justify-between pt-4 border-t border-black/5 dark:border-white/5">
            <div>
              {podeRetornar && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowRetorno(true)}
                  className="rounded-xl text-orange-600 border-orange-300 hover:bg-orange-50 gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Devolver para Ajuste
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="rounded-xl">
                Fechar
              </Button>
              {currentIdx < etapas.length - 1 && (
                <Button
                  type="button"
                  onClick={handleAvancar}
                  disabled={loading || (isProva && !podeAvancar)}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                  title={isProva && !podeAvancar ? 'Complete o checklist antes de avançar' : ''}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Avançar Etapa
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
