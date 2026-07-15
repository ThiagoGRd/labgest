'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Palette,
  DollarSign,
  Activity,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Camera
} from 'lucide-react'
import { FeedbackProva } from '@/components/pedidos/feedback-prova'
import { TimelineCiclos } from '@/components/pedidos/timeline-ciclos'
import type { Ciclo } from '@/components/pedidos/timeline-ciclos'
import { ChatPedido } from '@/components/pedidos/chat-pedido'
import type { BadgeProps } from '@/components/ui/badge'
import { CameraUpload } from '@/components/ui/camera-upload'
import { adicionarFotoCaso } from '@/actions/pedidos'
import { toast } from 'sonner'
import { concluirEtapaClinica } from '@/actions/workflow-protese'
import { getPassoProtese, isTipoProtese } from '@/lib/workflow-config'

interface HistoricoEtapa {
  data: string
  acao: 'avancou' | 'devolveu' | 'aprovou_prova' | 'criou' | string
  para?: string
  motivo?: string
}

interface MensagemPedido {
  id: string
  role: string
  nome: string
  texto: string
  fotoUrl?: string
  createdAt: string
}

interface FichaClinicaPortal {
  [campo: string]: boolean | string | undefined
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

interface Pedido {
  id: number
  paciente: string
  servico: string
  status: string
  dataEntrega: string
  valor: number
  etapa: string
  etapaId?: string
  corDentes?: string
  elementos?: string
  observacoes?: string
  historicoEtapas?: HistoricoEtapa[]
  arquivos?: string[]
  checklistEstetico?: FichaClinicaPortal
  ciclos?: Ciclo[]
  cicloAtivoId?: number | null
  tipoWorkflow?: string | null
  passoFluxoAtual?: string | null
  subetapaAtual?: string | null
  arcadas?: number
  prazoEtapaAtual?: string | null
  mensagens?: MensagemPedido[]
  fotosCaso?: string[]
}

interface VisualizarPedidoModalProps {
  isOpen: boolean
  onClose: () => void
  pedido: Pedido | null
}

function getStatusVariant(status: string): BadgeProps['variant'] {
  const map: Record<string, BadgeProps['variant']> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
    'Entregue': 'finalizado',
    'Cancelado': 'destructive',
  }
  return map[status] || 'default'
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string) {
  if (!dateStr) return '-'
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

export function VisualizarPedidoModal({ isOpen, onClose, pedido }: VisualizarPedidoModalProps) {
  const router = useRouter()
  const [fotosAdicionadas, setFotosAdicionadas] = useState<Record<number, string[]>>({})
  const [concluindoEtapa, setConcluindoEtapa] = useState(false)
  
  if (!pedido) return null

  const fotosCaso = [...(pedido.fotosCaso || []), ...(fotosAdicionadas[pedido.id] || [])]

  // Histórico reverso (mais recente primeiro)
  const historico = [...(pedido.historicoEtapas || [])].reverse()
  const cicloEmProva = [...(pedido.ciclos || [])].reverse().find(ciclo => ciclo.status === 'em_prova')
  const decisaoRegistrada = cicloEmProva?.decisao as 'ajustes' | 'aprovado' | null | undefined
  const passoAtual = isTipoProtese(pedido.tipoWorkflow)
    ? getPassoProtese(pedido.tipoWorkflow, pedido.passoFluxoAtual)
    : null

  const handleConcluirEtapaClinica = async () => {
    setConcluindoEtapa(true)
    const resultado = await concluirEtapaClinica(pedido.id)
    setConcluindoEtapa(false)
    if (!resultado.success) {
      toast.error(resultado.error || 'Não foi possível concluir a etapa')
      return
    }
    toast.success('Etapa clínica concluída')
    router.refresh()
    onClose()
  }

  // Extrair Ficha Clínica
  const chk = pedido.checklistEstetico || {}
  const hasFichaClinica = Object.values(chk).some(val => val === true || (typeof val === 'string' && val.trim() !== ''))

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rastreamento #${pedido.id}`}
      description={pedido.servico}
      size="xl"
      mobileFullscreen
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
        
        {/* Linha do Tempo + Ciclos */}
        <div className="order-2 border-t border-slate-100 pt-6 dark:border-zinc-800 xl:order-1 xl:col-span-1 xl:border-r xl:border-t-0 xl:pr-8 xl:pt-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
            <MapPin className="h-3 w-3" />
            Histórico do Caso
          </h3>

          {/* Timeline de Ciclos (se tiver) */}
          {pedido.ciclos && pedido.ciclos.length > 0 ? (
            <TimelineCiclos ciclos={pedido.ciclos} />
          ) : (
            <div className="relative pl-4 border-l-2 border-emerald-100 dark:border-emerald-900/30 space-y-8">
              {/* Status Atual */}
              <div className="relative">
                <div className="absolute -left-[21px] top-0 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900 shadow-sm animate-pulse" />
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/20">
                  <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1">Etapa Atual</p>
                  <p className="font-bold text-slate-900 dark:text-white">{pedido.etapa}</p>
                  <p className="text-xs text-slate-500 mt-1">{pedido.status}</p>
                </div>
              </div>
              {historico.length > 0 ? historico.map((h, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[19px] top-1.5 h-3 w-3 rounded-full bg-slate-300 dark:bg-zinc-700 ring-4 ring-white dark:ring-zinc-900" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-slate-400 mb-0.5">{formatDateTime(h.data)}</span>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {h.acao === 'avancou' && `Iniciou: ${h.para}`}
                      {h.acao === 'devolveu' && `Devolvido: ${h.para}`}
                      {h.acao === 'aprovou_prova' && 'Prova Aprovada'}
                      {h.acao === 'criou' && 'Pedido Criado'}
                    </p>
                    {h.motivo && <p className="text-xs text-red-500 mt-1">Motivo: {h.motivo}</p>}
                  </div>
                </div>
              )) : <p className="text-xs text-slate-400 italic">Sem histórico detalhado.</p>}
            </div>
          )}
        </div>{/* fim col-span-1 */}

        {/* Detalhes (Direita) */}
        <div className="order-1 space-y-6 xl:order-2 xl:col-span-2">

          {passoAtual?.responsavel === 'clinica' && !passoAtual.prova && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:p-5 dark:border-sky-900/40 dark:bg-sky-950/20">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">Ação da clínica</p>
              <h3 className="mt-1 font-bold text-slate-900 dark:text-white">{passoAtual.nome}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {passoAtual.entregaFinal
                  ? 'Confirme quando o trabalho tiver sido entregue ao paciente.'
                  : 'Confirme quando esta etapa clínica estiver concluída para liberar a próxima etapa.'}
              </p>
              <Button
                type="button"
                onClick={handleConcluirEtapaClinica}
                disabled={concluindoEtapa}
                className="mt-4 h-12 w-full bg-sky-600 text-white hover:bg-sky-700 sm:w-auto"
              >
                <CheckCircle2 className="h-4 w-4" />
                {concluindoEtapa ? 'Atualizando...' : passoAtual.entregaFinal ? 'Confirmar entrega ao paciente' : 'Etapa concluída'}
              </Button>
            </div>
          )}
          
          {/* Feedback de Prova (ciclo ativo em prova) */}
          {pedido.status === 'Em Prova' && pedido.cicloAtivoId && !decisaoRegistrada && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5 dark:border-amber-900/30 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Registre o Resultado da Prova</h3>
              </div>
              <FeedbackProva
                cicloId={pedido.cicloAtivoId}
                numeroCiclo={pedido.ciclos?.length || 1}
                onSubmit={onClose}
              />
            </div>
          )}

          {pedido.status === 'Em Prova' && decisaoRegistrada && (
            <div className={`rounded-xl border p-5 ${
              decisaoRegistrada === 'aprovado'
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                : 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
            }`}>
              <div className="flex items-start gap-3">
                {decisaoRegistrada === 'aprovado'
                  ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                }
                <div>
                  <h3 className={`text-sm font-bold ${decisaoRegistrada === 'aprovado' ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'}`}>
                    {decisaoRegistrada === 'aprovado' ? 'Prova aprovada' : 'Ajustes solicitados'}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Decisão enviada. Aguardando o laboratório confirmar o retorno físico do trabalho.
                  </p>
                  {cicloEmProva?.observacoesDentista && (
                    <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm text-slate-700 dark:bg-black/20 dark:text-slate-300">
                      {cicloEmProva.observacoesDentista}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cabeçalho */}
          <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{pedido.paciente}</h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">Paciente</span>
              </div>
              <Badge variant={getStatusVariant(pedido.status)}>{pedido.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Entrega</span>
                <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                  {formatDate(pedido.dataEntrega)}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Valor</span>
                <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  {formatCurrency(pedido.valor)}
                </p>
              </div>
              {pedido.corDentes && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Cor</span>
                  <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                    <Palette className="h-3.5 w-3.5 text-pink-500" />
                    {pedido.corDentes}
                  </p>
                </div>
              )}
              {pedido.elementos && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Dentes</span>
                  <p className="text-sm font-medium flex items-center gap-1.5 mt-1">
                    <Activity className="h-3.5 w-3.5 text-blue-500" />
                    {pedido.elementos}
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
          {pedido.observacoes && (
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Observações Iniciais</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 p-3 rounded-lg border border-slate-100 dark:border-zinc-800">
                {pedido.observacoes}
              </p>
            </div>
          )}

          {/* Fotos do Caso - Aberto a Qualquer Momento */}
          <div>
            <h4 className="text-xs font-bold uppercase text-slate-500 mb-2 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Fotos Clínicas do Caso
            </h4>
            
            <div className="bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-4">
              {fotosCaso.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-4">
                  {fotosCaso.map((url: string) => (
                    <a 
                      key={url}
                      href={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lab-files/${url}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="relative h-20 w-20 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden group"
                    >
                      <Image
                        fill
                        unoptimized
                        src={url.startsWith('http') ? url : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lab-files/${url}`} 
                        alt="Foto do Caso" 
                        className="object-cover group-hover:scale-110 transition-transform"
                      />
                    </a>
                  ))}
                </div>
              )}
              
              <CameraUpload 
                onUploadComplete={async (path: string) => {
                  if (!path) return;
                  const res = await adicionarFotoCaso(pedido.id, path)
                  if (res.success) {
                    setFotosAdicionadas(prev => ({
                      ...prev,
                      [pedido.id]: [...(prev[pedido.id] || []), path],
                    }))
                    toast.success("Foto enviada com sucesso!")
                  } else {
                    toast.error("Falha ao salvar a foto na Ordem.")
                  }
                }}
              />
            </div>
          </div>

          {/* Chat do Pedido */}
          <div className="pt-2">
            <ChatPedido 
              ordemId={pedido.id} 
              mensagensIniciais={pedido.mensagens || []} 
              dentistaNome="" 
            />
          </div>

          {/* Botão Fechar */}
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
