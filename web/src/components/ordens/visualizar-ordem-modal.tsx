'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STLViewer } from '@/components/ui/stl-viewer'
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
  Download,
  Eye,
  X,
  GitBranch,
  RotateCcw,
  Check,
} from 'lucide-react'
import { getEtapas, getEtapaNome, getEtapaIndex, getWorkflowLabel, getProgresso, type TipoWorkflow, type EtapaConfig } from '@/lib/workflow-config'

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
  arquivos?: string[]
  tipoWorkflow?: string | null
  tentativaAtual?: number
  historicoEtapas?: any[]
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  if (!ordem) return null

  const handleClose = () => {
    setPreviewUrl(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
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

        {/* Mini Fluxo do Caso */}
        {ordem.tipoWorkflow && (() => {
          const tw = ordem.tipoWorkflow as TipoWorkflow
          const etapas = getEtapas(tw)
          const currentIdx = getEtapaIndex(tw, ordem.etapaAtual)
          const progresso = getProgresso(tw, ordem.etapaAtual)

          return (
            <div className="p-5 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                    <GitBranch className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Fluxo do Caso</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{getWorkflowLabel(tw)}</p>
                  </div>
                </div>
                {(ordem.tentativaAtual ?? 0) > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-2 py-1 rounded-full">
                    <RotateCcw className="h-3 w-3" />
                    {ordem.tentativaAtual} {ordem.tentativaAtual === 1 ? 'devolução' : 'devoluções'}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-1.5">
                  <span>Progresso</span>
                  <span>{progresso}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>

              {/* Mini etapas */}
              <div className="flex items-center gap-1 flex-wrap">
                {etapas.map((etapa, idx) => {
                  const isCompleted = idx < currentIdx
                  const isCurrent = idx === currentIdx
                  return (
                    <div key={idx} className="flex items-center gap-1">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-500 text-white'
                            : isCurrent
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-200 dark:ring-indigo-500/30'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-400'
                        }`}
                        title={getEtapaNome(etapa)}
                      >
                        {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                      </div>
                      {idx < etapas.length - 1 && (
                        <div className={`w-3 h-0.5 ${isCompleted ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-white/10'}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-slate-500">
                <span className="font-bold text-slate-700 dark:text-slate-300">Etapa atual:</span>{' '}
                {ordem.etapaAtual} ({currentIdx + 1} de {etapas.length})
              </p>
            </div>
          )
        })()}

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

        {previewUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-indigo-100 dark:border-indigo-500/30 shadow-lg">
            <div className="absolute top-3 right-3 z-10">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setPreviewUrl(null)}
                className="bg-white/80 backdrop-blur text-slate-700 hover:bg-white h-8 w-8 p-0 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="bg-slate-900 h-10 px-4 flex items-center">
              <p className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Activity className="h-3 w-3 text-indigo-400" />
                Visualização 3D
              </p>
            </div>
            <STLViewer url={previewUrl} className="w-full h-80" />
          </div>
        )}

        {ordem.arquivos && ordem.arquivos.length > 0 && (
          <div className="p-5 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm">
                <Paperclip className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">Arquivos Anexados</p>
                <div className="space-y-2">
                  {ordem.arquivos.map((arquivo, index) => {
                    const isStl = arquivo.toLowerCase().endsWith('.stl')
                    const fileName = arquivo.split('/').pop() || 'Arquivo'
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 transition-colors group"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="p-2 bg-indigo-50 dark:bg-indigo-500/20 rounded text-indigo-600 shrink-0">
                            {isStl ? <Package className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={fileName}>
                            {fileName}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {isStl && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => setPreviewUrl(arquivo)}
                              className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              title="Visualizar 3D"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <a
                            href={arquivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-md transition-colors"
                            title="Baixar"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-black/5 dark:border-white/5">
          <Button variant="outline" onClick={handleClose} className="rounded-xl px-8">
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
