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
  RotateCcw,
  CheckCircle2,
  Circle,
  Truck,
  AlertCircle,
  MapPin
} from 'lucide-react'
import { getEtapaNome, getEtapas, getEtapaIndex, getWorkflowLabel, getProgresso, type TipoWorkflow } from '@/lib/workflow-config'

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
  elementos?: string
  material?: string
  observacoes?: string
  arquivos?: string[]
  tipoWorkflow?: string | null
  tentativaAtual?: number
  historicoEtapas?: any[]
  checklistEstetico?: any
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    hour: '2-digit', 
    minute: '2-digit' 
  })
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

  // Ordenar histórico do mais recente para o mais antigo
  const historico = [...(ordem.historicoEtapas || [])].reverse()
  
  // Calcular progresso para a barra
  const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
  const progresso = getProgresso(tipoWorkflow, ordem.etapaAtual)

  // Extrair Ficha Clínica
  const chk = ordem.checklistEstetico || {}
  const hasFichaClinica = Object.values(chk).some(val => val === true || (typeof val === 'string' && val.trim() !== ''))

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Rastreamento #${ordem.id}`}
      description={ordem.servico}
      size="xl"
    >
      <div className="space-y-8">
        
        {/* Barra de Progresso Visual (Topo) */}
        <div className="relative pt-2 px-1">
          <div className="flex justify-between mb-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Progresso do Caso</span>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{progresso}% Concluído</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
              style={{ width: `${progresso}%` }} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Esquerda: Timeline / Rastreio */}
          <div className="lg:col-span-1 border-r border-slate-100 dark:border-zinc-800 pr-0 lg:pr-8">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Rastreio
            </h3>

            <div className="relative pl-4 border-l-2 border-indigo-100 dark:border-zinc-800 space-y-8">
              {/* Estado Atual (Topo) */}
              <div className="relative">
                <div className="absolute -left-[23px] top-0 h-5 w-5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-zinc-900 shadow-lg flex items-center justify-center animate-pulse">
                  <div className="h-2 w-2 bg-white rounded-full" />
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                  <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 mb-1">Status Atual</p>
                  <p className="font-bold text-slate-900 dark:text-white leading-tight">{ordem.etapaAtual}</p>
                  <p className="text-xs text-slate-500 mt-1">{ordem.status}</p>
                </div>
              </div>

              {/* Histórico */}
              {historico.map((h, i) => {
                const isDevolucao = h.acao === 'devolveu'
                const isFinalizado = h.para === 'Pronto para Entrega' || h.status === 'Finalizado'
                const isCriacao = h.acao === 'criou'
                
                return (
                  <div key={i} className="relative">
                    <div className={`
                      absolute -left-[21px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-zinc-900
                      ${isDevolucao ? 'bg-red-500' : isFinalizado ? 'bg-emerald-500' : isCriacao ? 'bg-slate-900 dark:bg-white' : 'bg-slate-300 dark:bg-zinc-600'}
                    `} />
                    
                    <div className="flex flex-col">
                      <span className="text-[10px] font-medium text-slate-400 mb-0.5 font-mono">
                        {formatDateTime(h.data)}
                      </span>
                      
                      <p className={`text-sm font-bold ${isDevolucao ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {h.acao === 'avancou' && `Avançou para ${h.para}`}
                        {h.acao === 'devolveu' && `Devolvido para ${h.para}`}
                        {h.acao === 'criou' && 'Pedido Recebido'}
                      </p>

                      {h.motivo && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                          <span className="font-bold block mb-1">Motivo da Devolução:</span> 
                          {h.motivo}
                        </div>
                      )}

                      {h.observacao && (
                        <p className="text-xs text-slate-500 mt-1 italic">"{h.observacao}"</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Coluna Direita: Detalhes do Pedido */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{ordem.paciente}</h2>
                  <div className="flex items-center gap-2 mt-1 text-slate-500 dark:text-slate-400 text-sm">
                    <User className="h-4 w-4" />
                    <span>Dr(a). {ordem.cliente.nome}</span>
                  </div>
                </div>
                <Badge variant={getStatusVariant(ordem.status)}>{ordem.status}</Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Entrega</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                    <Calendar className="h-4 w-4 text-indigo-500" />
                    {formatDate(ordem.dataEntrega)}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Valor</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                    <DollarSign className="h-4 w-4 text-emerald-500" />
                    {formatCurrency(ordem.valor)}
                  </p>
                </div>
                {ordem.corDentes && (
                  <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Cor</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                      <Palette className="h-4 w-4 text-pink-500" />
                      {ordem.corDentes}
                    </p>
                  </div>
                )}
                {ordem.elementos && (
                  <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-lg">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Dentes</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-1">
                      <Activity className="h-4 w-4 text-blue-500" />
                      {ordem.elementos}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ficha Clínica do Portal */}
            {hasFichaClinica && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Quadro Clínico Solicitado
                </h4>
                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Dados Clínicos Enviados</span>
                      <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                        {chk.dvo && <li><CheckCircle2 className="inline h-3 w-3 text-blue-500 mr-1" /> D.V.O.</li>}
                        {chk.registroMordida && <li><CheckCircle2 className="inline h-3 w-3 text-blue-500 mr-1" /> Registro de Mordida</li>}
                        {chk.linhaMedia && <li><CheckCircle2 className="inline h-3 w-3 text-blue-500 mr-1" /> Linha Média</li>}
                        {chk.oclusao && <li><CheckCircle2 className="inline h-3 w-3 text-blue-500 mr-1" /> Oclusão</li>}
                        {chk.corredorBucal && <li><CheckCircle2 className="inline h-3 w-3 text-blue-500 mr-1" /> Corredor Bucal</li>}
                        {!chk.dvo && !chk.registroMordida && !chk.linhaMedia && !chk.oclusao && !chk.corredorBucal && (
                          <li className="text-slate-400 italic">Nenhum dado assinalado</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Solicitação Específica</span>
                      <ul className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                        {chk.moldeiraIndividual && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Moldeira Individual</li>}
                        {chk.planoCera && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Plano de Cera</li>}
                        {chk.montagemDente && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Montagem de Dente</li>}
                        {chk.barraProtocolo && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Barra de Protocolo</li>}
                        {chk.acrilizacao && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Acrilização</li>}
                        {chk.conserto && <li><CheckCircle2 className="inline h-3 w-3 text-emerald-500 mr-1" /> Conserto</li>}
                        {!chk.moldeiraIndividual && !chk.planoCera && !chk.montagemDente && !chk.barraProtocolo && !chk.acrilizacao && !chk.conserto && (
                          <li className="text-slate-400 italic">Nenhuma solicitação assinalada</li>
                        )}
                      </ul>
                    </div>
                  </div>
                  {chk.corGengiva && (
                    <div className="pt-2 border-t border-blue-100 dark:border-blue-900/30">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Escala de Gengiva</span>
                      <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Palette className="h-4 w-4 text-pink-500" />
                        {chk.corGengiva}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Observações */}
            {ordem.observacoes && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Observações Adicionais</h4>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl text-amber-900 dark:text-amber-100 text-sm">
                  {ordem.observacoes}
                </div>
              </div>
            )}

            {/* Arquivos */}
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                <Paperclip className="h-3 w-3" />
                Arquivos do Caso ({ordem.arquivos?.length || 0})
              </h4>
              
              {ordem.arquivos && ordem.arquivos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {ordem.arquivos.map((arquivo, idx) => {
                    const isStl = arquivo.toLowerCase().endsWith('.stl')
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg group hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => isStl && setPreviewUrl(arquivo)}>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`p-2 rounded-lg ${isStl ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-500 dark:bg-zinc-800'}`}>
                            {isStl ? <Package className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <span className="text-xs font-medium truncate max-w-[150px]">{arquivo.split('/').pop()}</span>
                        </div>
                        <div className="flex gap-1">
                          {isStl && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                              <Eye className="h-4 w-4 text-indigo-600" />
                            </Button>
                          )}
                          <a href={arquivo} target="_blank" onClick={(e) => e.stopPropagation()} className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500">
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
                  <p className="text-sm text-slate-400">Nenhum arquivo anexado.</p>
                </div>
              )}
            </div>

            {/* Preview 3D */}
            {previewUrl && (
              <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden relative shadow-lg">
                <div className="absolute top-2 right-2 z-10">
                  <Button variant="secondary" size="sm" onClick={() => setPreviewUrl(null)} className="h-8 w-8 p-0 rounded-full shadow-md">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <STLViewer url={previewUrl} className="w-full h-80 bg-slate-900" />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}