'use client'

import { type ComponentProps, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { NovaOrdemModal } from '@/components/ordens/nova-ordem-modal'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { EditarOrdemModal } from '@/components/ordens/editar-ordem-modal'
import { formatDate, formatCurrency } from '@/lib/date-utils'
import { etapaLabel, FLUXOS_PROTESE, getWorkflowLabel, isTipoProtese } from '@/lib/workflow-config'
import { WorkflowModal } from '@/components/ordens/workflow-modal'
import { ReasonModal } from '@/components/ui/reason-modal'
import { FichaImpressao } from '@/components/ordens/ficha-impressao'
import { EtiquetaImpressao } from '@/components/ordens/etiqueta-impressao'
import { NotaEntrega } from '@/components/ordens/nota-entrega'
import { ConfirmarEntregaCobrancaModal } from '@/components/ordens/confirmar-entrega-cobranca-modal'
import { gerarNotificacaoWhatsApp } from '@/actions/notificacoes'
import { cancelarOrdem, getOrdemById, type FiltrosOrdens, type getOrdens } from '@/actions/ordens'
import {
  Search,
  Eye,
  Edit,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Bell,
  Printer,
  Package,
  GitBranch,
  RotateCcw,
  MoreHorizontal,
  Ban,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

// Types
type ResultadoOrdens = Awaited<ReturnType<typeof getOrdens>>
type Ordem = ResultadoOrdens['ordens'][number]
type OrdemDetalhada = NonNullable<Awaited<ReturnType<typeof getOrdemById>>>
type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>
type DadosFicha = ComponentProps<typeof FichaImpressao>['ordem']
type DadosEtiqueta = ComponentProps<typeof EtiquetaImpressao>['ordem']
type DadosNotaEntrega = ComponentProps<typeof NotaEntrega>['ordem']
type DadosWorkflow = ComponentProps<typeof WorkflowModal>['ordem']

interface OrdensViewProps {
  resultado: ResultadoOrdens
  clientes: { id: number; nome: string }[]
  servicos: { id: number; nome: string; preco: number; tempoProducao: number }[]
  filtros: FiltrosOrdens
  user: { nome: string; email: string; tipo: string }
}

function getStatusVariant(status: string) {
  const map: Record<string, BadgeVariant> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Em Prova': 'emProducao',
    'Finalizado': 'finalizado',
    'Entregue': 'finalizado',
    'Cancelado': 'destructive',
    'Pausado': 'pausado',
  }
  return map[status] || 'default'
}

function getPriorityVariant(priority: string) {
  const map: Record<string, BadgeVariant> = {
    'Baixa': 'baixa',
    'Normal': 'normal',
    'Alta': 'alta',
    'Urgente': 'urgente',
  }
  return map[priority] || 'normal'
}

function workflowLabel(tipo: string | null | undefined) {
  if (!tipo) return null
  if (isTipoProtese(tipo)) return FLUXOS_PROTESE[tipo].nomeCurto
  return getWorkflowLabel(tipo as never)
}

function isValidDeliveryDate(dateStr: string) {
  const dataIso = dateStr.split('T')[0]
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return ano >= 2020
    && ano <= new Date().getFullYear() + 2
    && data.getUTCFullYear() === ano
    && data.getUTCMonth() === mes - 1
    && data.getUTCDate() === dia
}


function getDaysRemaining(dateStr: string, status: string, pausadoEm?: string | null, dataEntregaReal?: string | null) {
  if (status === 'Finalizado') return { text: 'Pronto para entrega', color: 'text-emerald-600' }
  if (status === 'Entregue') return { text: dataEntregaReal ? `Entregue ${formatDate(dataEntregaReal).slice(0, 5)}` : 'Entregue', color: 'text-emerald-600' }
  if (status === 'Cancelado') return { text: 'Cancelado', color: 'text-slate-500' }
  if (status === 'Pausado') {
    const dias = pausadoEm ? Math.max(0, Math.floor((Date.now() - new Date(pausadoEm).getTime()) / 86_400_000)) : null
    return { text: dias == null ? 'Pausado' : `Pausado há ${dias}d`, color: 'text-amber-600' }
  }
  const dataIso = dateStr.split('T')[0]
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  if (!isValidDeliveryDate(dateStr)) return { text: 'Data inválida', color: 'text-red-600' }
  const hojePartes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).split('-').map(Number)
  const diff = Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(hojePartes[0], hojePartes[1] - 1, hojePartes[2])) / 86_400_000)
  
  if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, color: 'text-red-600' }
  if (diff === 0) return { text: 'Hoje', color: 'text-amber-600' }
  if (diff === 1) return { text: 'Amanhã', color: 'text-amber-600' }
  return { text: `${diff} dias`, color: 'text-slate-600 dark:text-slate-400' }
}

export function OrdensView({ resultado, clientes, servicos, filtros, user }: OrdensViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(filtros.busca || '')
  const [modalOpen, setModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [workflowModalOpen, setWorkflowModalOpen] = useState(false)
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemDetalhada | null>(null)
  const [printOrdem, setPrintOrdem] = useState<DadosFicha | null>(null)
  const [printEtiqueta, setPrintEtiqueta] = useState<DadosEtiqueta | null>(null)
  const [openingOrdemId, setOpeningOrdemId] = useState<number | null>(null)
  const [ordemParaCancelar, setOrdemParaCancelar] = useState<Ordem | null>(null)
  const [ordemParaEntregar, setOrdemParaEntregar] = useState<Ordem | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  
  const componentRef = useRef<HTMLDivElement>(null)
  const etiquetaRef = useRef<HTMLDivElement>(null)
  const notaEntregaRef = useRef<HTMLDivElement>(null)
  const [notaEntregaDados, setNotaEntregaDados] = useState<DadosNotaEntrega | null>(null)

  useEffect(() => {
    setSearch(filtros.busca || '')
  }, [filtros.busca])

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  })

  const handlePrintEtiqueta = useReactToPrint({
    contentRef: etiquetaRef,
  })

  const handlePrintNotaEntrega = useReactToPrint({
    contentRef: notaEntregaRef,
  })

  const onPrintEtiquetaClick = (ordem: Ordem) => {
    const dadosEtiqueta = {
      id: ordem.id,
      paciente: ordem.paciente,
      cliente: { nome: ordem.cliente.nome },
      servico: { nome: ordem.servico },
      dataEntrega: ordem.dataEntrega,
      tokenRastreamento: ordem.tokenRastreamento,
    }
    setPrintEtiqueta(dadosEtiqueta)
    setTimeout(() => {
      handlePrintEtiqueta()
    }, 100)
  }

  const onPrintClick = async (ordem: Ordem) => {
    const detalhes = await getOrdemById(ordem.id)
    if (!detalhes) return
    const dadosImpressao = {
      id: ordem.id,
      paciente: ordem.paciente,
      cliente: { nome: ordem.cliente.nome },
      servico: { nome: ordem.servico },
      dataEntrada: ordem.dataEntrada || new Date().toISOString(), // Fallback se não vier
      dataEntrega: ordem.dataEntrega,
      corDentes: detalhes.corDentes,
      observacoes: detalhes.observacoes,
      tokenRastreamento: ordem.tokenRastreamento,
    }
    setPrintOrdem(dadosImpressao)
    setTimeout(() => {
      handlePrint()
    }, 100)
  }

  const ordens = resultado.ordens

  const atualizarFiltros = (mudancas: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(mudancas).forEach(([chave, valor]) => {
      if (valor == null || valor === '') params.delete(chave)
      else params.set(chave, String(valor))
    })
    if (!('pagina' in mudancas)) params.delete('pagina')
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const abrirOrdem = async (id: number, destino: 'ver' | 'editar' | 'fluxo') => {
    setOpeningOrdemId(id)
    try {
      const ordem = await getOrdemById(id)
      if (!ordem) return
      setSelectedOrdem(ordem)
      if (destino === 'ver') setViewModalOpen(true)
      if (destino === 'editar') setEditModalOpen(true)
      if (destino === 'fluxo') setWorkflowModalOpen(true)
    } finally {
      setOpeningOrdemId(null)
    }
  }

  const handleNotify = async (id: number) => {
    const result = await gerarNotificacaoWhatsApp(id)
    if (result.success && result.whatsappLink) {
      window.open(result.whatsappLink, '_blank', 'noopener,noreferrer')
    } else {
      toast.error(result.error || 'Não foi possível gerar a mensagem.')
    }
  }

  const handleCancelar = (ordem: Ordem) => {
    setOrdemParaCancelar(ordem)
  }

  const confirmarCancelamento = async (motivo: string) => {
    if (!ordemParaCancelar) return
    setActionLoading(true)
    try {
      const result = await cancelarOrdem(ordemParaCancelar.id, motivo)
      if (!result.success) {
        toast.error(result.error || 'Não foi possível cancelar a ordem.')
        return
      }
      toast.success('Ordem cancelada.')
      setOrdemParaCancelar(null)
      router.refresh()
    } catch {
      toast.error('Não foi possível cancelar a ordem.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarcarEntregue = (ordem: Ordem) => {
    setOrdemParaEntregar(ordem)
  }

  const concluirEntrega = (cobranca: { contaId: number; valor: number; vencimento: string; status: string }) => {
    if (!ordemParaEntregar) return
    const ordem = ordemParaEntregar
    setOrdemParaEntregar(null)
    toast.success('Entrega confirmada e cobrança sincronizada com o financeiro.')
    setNotaEntregaDados({
      id: ordem.id,
      paciente: ordem.paciente,
      cliente: { nome: ordem.cliente.nome },
      servico: ordem.servico,
      valor: cobranca.valor,
      dataEntrega: new Date().toISOString(),
      vencimento: cobranca.vencimento,
      contaId: cobranca.contaId,
      status: cobranca.status,
    })
    setTimeout(() => handlePrintNotaEntrega(), 100)
    router.refresh()
  }

  return (
    <DashboardLayout user={user}>
      <ReasonModal
        isOpen={ordemParaCancelar !== null}
        onClose={() => setOrdemParaCancelar(null)}
        onConfirm={confirmarCancelamento}
        title={ordemParaCancelar ? `Cancelar OS #${ordemParaCancelar.id}` : 'Cancelar ordem'}
        description="O motivo ficará registrado no histórico"
        label="Motivo do cancelamento"
        placeholder="Explique por que esta ordem está sendo cancelada."
        confirmLabel="Cancelar ordem"
        loading={actionLoading}
      />
      {ordemParaEntregar && (
        <ConfirmarEntregaCobrancaModal
          key={ordemParaEntregar.id}
          ordem={ordemParaEntregar}
          onClose={() => setOrdemParaEntregar(null)}
          onSuccess={concluirEntrega}
        />
      )}
      {/* Hidden Print Components */}
      <div style={{ display: 'none' }}>
        {printOrdem && <FichaImpressao ref={componentRef} ordem={printOrdem} />}
        {printEtiqueta && <EtiquetaImpressao ref={etiquetaRef} ordem={printEtiqueta} />}
        {notaEntregaDados && <NotaEntrega ref={notaEntregaRef} ordem={notaEntregaDados} />}
      </div>

      <NovaOrdemModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        clientes={clientes}
        servicos={servicos}
        onSuccess={() => {
          setModalOpen(false)
          router.refresh()
        }}
      />

      <VisualizarOrdemModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        ordem={selectedOrdem}
      />

      <EditarOrdemModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        ordem={selectedOrdem}
        onSuccess={() => {
          setEditModalOpen(false)
          router.refresh()
        }}
      />

      <WorkflowModal
        isOpen={workflowModalOpen}
        onClose={() => setWorkflowModalOpen(false)}
        ordem={selectedOrdem as DadosWorkflow}
        onSuccess={() => {
          setWorkflowModalOpen(false)
          router.refresh()
        }}
      />
      
      <Header 
        title="Ordens de Serviço" 
        subtitle={`${resultado.contadores.ativas} ativas de ${resultado.totalGeral} ordens cadastradas`}
        action={{
          label: 'Nova Ordem',
          onClick: () => {
            setModalOpen(true)
          },
        }}
      />
      
      <div className="space-y-5 px-1 pt-5 sm:px-0">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Ordens ativas', value: resultado.contadores.ativas },
            { label: 'Em prova', value: resultado.contadores.emProva },
            { label: 'Prontas para entrega', value: resultado.contadores.finalizadas },
            { label: 'Pausadas', value: resultado.contadores.pausadas },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <form
              className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_200px_200px_190px_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                atualizarFiltros({ busca: search })
              }}
            >
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Paciente, CPF, dentista, serviço ou OS"
                  aria-label="Buscar ordens"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                aria-label="Filtrar por dentista"
                value={filtros.clienteId || ''}
                onChange={(event) => atualizarFiltros({ cliente: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">Todos os dentistas</option>
                {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
              </select>
              <select
                aria-label="Filtrar por tipo de prótese"
                value={filtros.tipoWorkflow || ''}
                onChange={(event) => atualizarFiltros({ tipo: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="">Todos os tipos</option>
                {Object.values(FLUXOS_PROTESE).map((fluxo) => <option key={fluxo.id} value={fluxo.id}>{fluxo.nomeCurto}</option>)}
              </select>
              <select
                aria-label="Ordenar ordens"
                value={filtros.ordenar || 'prazo'}
                onChange={(event) => atualizarFiltros({ ordenar: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <option value="prazo">Prazo mais próximo</option>
                <option value="atualizadas">Última movimentação</option>
                <option value="recentes">Mais recentes</option>
                <option value="paciente">Paciente A–Z</option>
              </select>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </form>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar ordens por status">
              {[
                ['ativas', 'Ativas'],
                ['Aguardando', 'Aguardando'],
                ['Em Produção', 'Em produção'],
                ['Em Prova', 'Em prova'],
                ['Finalizado', 'Prontas'],
                ['Pausado', 'Pausadas'],
                ['encerradas', 'Arquivo'],
                ['todos', 'Todas'],
              ].map(([valor, rotulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={(filtros.status || 'ativas') === valor}
                  onClick={() => atualizarFiltros({ status: valor })}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    (filtros.status || 'ativas') === valor
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {rotulo}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50">
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Paciente / Serviço
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Dentista
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Status
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Etapa
                  </th>
                  <th className="text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Entrega
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Valor
                  </th>
                  <th className="text-right text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-6 py-4">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5 relative">
                {ordens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-0">
                      <EmptyState 
                        title="Nenhuma ordem encontrada" 
                        description="Tente ajustar a busca ou os filtros para encontrar o que precisa."
                      />
                    </td>
                  </tr>
                ) : (
                  ordens.map((ordem) => {
                    const daysInfo = getDaysRemaining(ordem.dataEntrega, ordem.status, ordem.pausadoEm, ordem.dataEntregaReal)
                    return (
                      <tr key={ordem.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                              <FileText className="h-6 w-6" />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-slate-100">{ordem.paciente}</span>
                              <Badge variant={getPriorityVariant(ordem.prioridade)}>
                                {ordem.prioridade}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{ordem.servico}</p>
                            {ordem.arquivos && ordem.arquivos.length > 0 && (
                              <div className="flex items-center gap-1 mt-1.5 text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-full w-fit">
                                <Paperclip className="h-3 w-3" />
                                <span>{ordem.arquivos.length} anexo(s)</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={ordem.cliente.nome} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">{ordem.cliente.nome}</p>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Dentista</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getStatusVariant(ordem.status)}>
                          {ordem.status}
                        </Badge>
                        {ordem.status === 'Pausado' && ordem.motivoPausa && (
                          <p className="mt-1 max-w-40 line-clamp-2 text-[10px] text-amber-700 dark:text-amber-300" title={ordem.motivoPausa}>
                            {ordem.motivoPausa}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{etapaLabel(ordem.etapaAtual)}</span>
                           {ordem.tentativaAtual != null && ordem.tentativaAtual > 0 && (
                             <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                               <RotateCcw className="h-2.5 w-2.5" />
                               {ordem.tentativaAtual}x
                             </span>
                           )}
                         </div>
                         {workflowLabel(ordem.tipoWorkflow) && (
                           <p className="text-[9px] font-bold text-indigo-500 uppercase mt-0.5 flex items-center gap-1">
                             <GitBranch className="h-2.5 w-2.5" />
                             {workflowLabel(ordem.tipoWorkflow)}
                           </p>
                         )}
                         {ordem.subetapaAtual && (
                           <p className="mt-1 max-w-48 truncate text-[10px] text-slate-500 dark:text-slate-400" title={ordem.subetapaAtual}>
                             {ordem.subetapaAtual}
                           </p>
                         )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div suppressHydrationWarning>
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{isValidDeliveryDate(ordem.dataEntrega) ? formatDate(ordem.dataEntrega) : '—'}</p>
                            <p className={`text-[10px] font-bold uppercase ${daysInfo.color}`}>{daysInfo.text}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-black text-slate-900 dark:text-slate-100 text-base">{formatCurrency(ordem.valor)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status) && (
                            <>
                              <button
                                onClick={() => abrirOrdem(ordem.id, 'fluxo')}
                                disabled={openingOrdemId === ordem.id}
                                aria-label={`Abrir fluxo da OS ${ordem.id}`}
                                className="p-2 text-slate-400 hover:text-purple-600 dark:text-slate-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-all"
                                title="Fluxo de Trabalho"
                              >
                                {openingOrdemId === ordem.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <GitBranch className="h-5 w-5" />}
                              </button>
                              <button
                                onClick={() => abrirOrdem(ordem.id, 'editar')}
                                disabled={openingOrdemId === ordem.id}
                                aria-label={`Editar OS ${ordem.id}`}
                                className="p-2 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl transition-all"
                                title="Editar Ordem"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                            </>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button aria-label={`Mais ações da OS ${ordem.id}`} className="p-2 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all outline-none">
                                <MoreHorizontal className="h-5 w-5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl">
                              <DropdownMenuLabel className="text-xs font-bold text-slate-500 uppercase px-2 py-1.5">Ações</DropdownMenuLabel>

                              {ordem.status === 'Finalizado' && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => handleMarcarEntregue(ordem)}
                                    className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:bg-emerald-50 dark:focus:bg-emerald-900/20"
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Marcar como Entregue
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-zinc-800" />
                                </>
                              )}

                              <DropdownMenuItem onClick={() => abrirOrdem(ordem.id, 'ver')} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Eye className="mr-2 h-4 w-4 text-slate-400" />
                                Visualizar Detalhes
                              </DropdownMenuItem>

                              <DropdownMenuItem onClick={() => handleNotify(ordem.id)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Bell className="mr-2 h-4 w-4 text-slate-400" />
                                Notificar WhatsApp
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-zinc-800" />
                              
                              <DropdownMenuItem onClick={() => onPrintClick(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Printer className="mr-2 h-4 w-4 text-slate-400" />
                                Imprimir Ficha
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => onPrintEtiquetaClick(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 focus:bg-slate-50 dark:focus:bg-zinc-800">
                                <Package className="mr-2 h-4 w-4 text-slate-400" />
                                Imprimir Etiqueta
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-zinc-800" />
                              
                              {!['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status) && (
                                <DropdownMenuItem onClick={() => handleCancelar(ordem)} className="cursor-pointer rounded-lg px-2 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20">
                                  <Ban className="mr-2 h-4 w-4" />
                                  Cancelar Ordem
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/10">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mostrando{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {resultado.total === 0 ? 0 : (resultado.pagina - 1) * resultado.porPagina + 1}–{Math.min(resultado.pagina * resultado.porPagina, resultado.total)}
              </span>{' '}
              de <span className="font-semibold text-slate-700 dark:text-slate-200">{resultado.total}</span> ordens
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={resultado.pagina === 1 || isPending}
                onClick={() => atualizarFiltros({ pagina: resultado.pagina - 1 })}
                className="h-8 w-8 p-0"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: resultado.totalPaginas }, (_, i) => i + 1)
                .filter(p => p === 1 || p === resultado.totalPaginas || Math.abs(p - resultado.pagina) <= 1)
                .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                  ) : (
                    <Button
                      key={p}
                      variant="outline"
                      size="sm"
                      onClick={() => atualizarFiltros({ pagina: p as number })}
                      className={`h-8 w-8 p-0 text-sm font-medium ${
                        resultado.pagina === p
                          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                          : ''
                      }`}
                    >
                      {p}
                    </Button>
                  )
                )
              }
              <Button
                variant="outline"
                size="sm"
                disabled={resultado.pagina === resultado.totalPaginas || resultado.total === 0 || isPending}
                onClick={() => atualizarFiltros({ pagina: resultado.pagina + 1 })}
                className="h-8 w-8 p-0"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
