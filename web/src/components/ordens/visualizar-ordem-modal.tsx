'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { STLViewer } from '@/components/ui/stl-viewer'
import {
  Palette,
  FileText,
  Package,
  Activity,
  Paperclip,
  Download,
  Eye,
  X,
  CheckCircle2,
  Camera
} from 'lucide-react'
import { ResumoOrdem, instanteFicha, type OrdemResumo } from './resumo-ordem'
import { ChatOrdem, type Mensagem } from '@/components/ordens/chat-ordem'
import Image from 'next/image'

interface HistoricoEtapa {
  acao?: string
  para?: string
  status?: string
  data?: string
  motivo?: string
  observacao?: string
  dentista?: string
  responsavel?: string
}

interface ChecklistEsteticoDetalhes {
  [chave: string]: string | boolean | number | null | undefined
  dvo?: boolean
  registroMordida?: boolean
  linhaMedia?: boolean
  oclusao?: boolean
  corredorBucal?: boolean
  moldeiraIndividual?: boolean
  planoCera?: boolean
  montagemDente?: boolean
  barraProtocolo?: boolean
  acrilizacao?: boolean
  conserto?: boolean
  corGengiva?: string
}

interface Ordem extends OrdemResumo {
  corDentes?: string
  elementos?: string
  material?: string
  observacoes?: string
  arquivos?: string[]
  tipoWorkflow?: string | null
  tentativaAtual?: number
  historicoEtapas?: unknown[]
  checklistEstetico?: unknown
  mensagens?: unknown[]
  fotosCaso?: string[]
  localizacaoAtual?: string
  situacaoLogistica?: string
  dentistaResponsavel?: string | null
  finalidadeClinica?: string | null
  agendamentoClinico?: string | null
}

interface VisualizarOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  ordem: Ordem | null
}

function isRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor && typeof valor === 'object' && !Array.isArray(valor))
}

function isHistoricoEtapa(valor: unknown): valor is HistoricoEtapa {
  if (!isRegistro(valor)) return false
  return valor.acao === undefined || typeof valor.acao === 'string'
}

function isMensagem(valor: unknown): valor is Mensagem {
  if (!isRegistro(valor)) return false
  return typeof valor.id === 'string'
    && typeof valor.role === 'string'
    && typeof valor.nome === 'string'
    && typeof valor.texto === 'string'
    && typeof valor.createdAt === 'string'
}

function normalizarChecklist(valor: unknown): ChecklistEsteticoDetalhes {
  if (!isRegistro(valor)) return {}
  return Object.fromEntries(
    Object.entries(valor).filter(([, item]) => item === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof item))
  ) as ChecklistEsteticoDetalhes
}

const ROTULOS_HISTORICO: Record<string, string> = {
  criou: 'Pedido recebido',
  enviou_recepcao: 'Enviado para a recepção',
  recebeu_recepcao: 'Recebido pela recepção',
  entregou_dentista: 'Entregue ao dentista',
  corrigiu_distribuicao: 'Distribuição corrigida',
  recebeu_do_dentista: 'Recebido de volta do dentista',
  enviou_retorno_laboratorio: 'Enviado de volta ao laboratório',
  recebeu_laboratorio: 'Recebido pelo laboratório',
}

function descricaoHistorico(item: HistoricoEtapa) {
  if (item.acao === 'avancou') return `Avançou para ${item.para}`
  if (item.acao === 'devolveu') return `Devolvido para ${item.para}`
  return ROTULOS_HISTORICO[item.acao || ''] || item.acao?.replaceAll('_', ' ') || 'Movimentação registrada'
}

export function VisualizarOrdemModal({ isOpen, onClose, ordem }: VisualizarOrdemModalProps) {
  if (!isOpen || !ordem) return null
  return <ConteudoFicha key={ordem.id} isOpen={isOpen} onClose={onClose} ordem={ordem} />
}

function ConteudoFicha({ isOpen, onClose, ordem }: VisualizarOrdemModalProps & { ordem: Ordem }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleClose = () => {
    setPreviewUrl(null)
    onClose()
  }

  // Ordenar histórico do mais recente para o mais antigo
  const historico = (ordem.historicoEtapas || []).filter(isHistoricoEtapa).reverse()
  
  // Extrair Ficha Clínica
  const chk = normalizarChecklist(ordem.checklistEstetico)
  const mensagens = (ordem.mensagens || []).filter(isMensagem)
  const hasFichaClinica = Object.values(chk).some(val => val === true || (typeof val === 'string' && val.trim() !== ''))

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Ficha da OS #${ordem.id}`}
      description={ordem.servico}
      size="xl"
    >
      <div className="space-y-6">
        <ResumoOrdem ordem={ordem} />
        <details className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer font-semibold">Histórico da OS ({historico.length})</summary>
          <div className="mt-5 space-y-6 border-l-2 border-indigo-100 pl-4 dark:border-zinc-800">
            {historico.length === 0 && <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>}
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
                        {instanteFicha(h.data)}
                      </span>
                      
                      <p className={`text-sm font-bold ${isDevolucao ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {descricaoHistorico(h)}
                      </p>

                      {h.dentista ? <p className="mt-1 text-xs text-slate-500">Dentista: {h.dentista}</p> : null}
                      {h.responsavel ? <p className="mt-1 text-[10px] text-slate-400">Registrado por {h.responsavel}</p> : null}

                      {h.motivo && (
                        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                          <span className="font-bold block mb-1">Motivo da Devolução:</span> 
                          {h.motivo}
                        </div>
                      )}

                      {h.observacao && (
                        <p className="text-xs text-slate-500 mt-1 italic">“{h.observacao}”</p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </details>
        <div className="space-y-6">
          {(ordem.corDentes || ordem.elementos || ordem.material) && <section aria-label="Especificações do trabalho" className="rounded-xl border border-slate-200 p-4 text-sm dark:border-zinc-800"><h3 className="mb-2 font-semibold">Especificações do trabalho</h3>{ordem.corDentes && <p>Cor: {ordem.corDentes}</p>}{ordem.elementos && <p>Dentes: {ordem.elementos}</p>}{ordem.material && <p>Material: {ordem.material}</p>}</section>}
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

            {/* Fotos do Caso (Enviadas pela Clínica) */}
            {ordem.fotosCaso && ordem.fotosCaso.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Fotos Clínicas do Caso
                </h4>
                <div className="bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-700 rounded-xl p-4">
                  <div className="flex flex-wrap gap-3">
                    {ordem.fotosCaso.map((url: string, idx: number) => {
                      const fullUrl = url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lab-files/${url}`
                      return (
                        <a 
                          key={idx} 
                          href={fullUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="relative h-24 w-24 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden group shadow-sm hover:shadow-md transition-all"
                        >
                          <Image
                            src={fullUrl} 
                            alt={`Foto do Caso ${idx+1}`}
                            width={96}
                            height={96}
                            unoptimized
                            className="object-cover h-full w-full group-hover:scale-110 transition-transform duration-300"
                          />
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Chat do Pedido */}
            <details className="rounded-2xl border border-slate-200 p-4 dark:border-zinc-800">
              <summary className="mb-3 cursor-pointer font-semibold">Conversa da OS</summary>
              <ChatOrdem key={ordem.id}
                ordemId={ordem.id} 
                mensagensIniciais={mensagens}
              />
            </details>

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
                            <Button aria-label={`Visualizar STL ${arquivo.split('/').pop()}`} variant="ghost" size="icon" className="h-8 w-8 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                              <Eye className="h-4 w-4 text-indigo-600" />
                            </Button>
                          )}
                          <a aria-label={`Baixar ${arquivo.split('/').pop()}`} href={arquivo} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500">
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
                  <Button aria-label="Fechar visualização STL" variant="secondary" size="sm" onClick={() => setPreviewUrl(null)} className="h-8 w-8 p-0 rounded-full shadow-md">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <STLViewer url={previewUrl} className="w-full h-80 bg-slate-900" />
              </div>
            )}
        </div>
      </div>
    </Modal>
  )
}
