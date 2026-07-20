'use client'

import { useMemo, useRef, useState } from 'react'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleCheckBig,
  ClipboardCheck,
  Clock3,
  FileText,
  Loader2,
  Search,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { getOrdemById } from '@/actions/ordens'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  RelatorioPrioridades,
  type OrdemPrioridade,
} from '@/components/prioridades/relatorio-prioridades'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { etapaLabel } from '@/lib/workflow-config'
import { cn } from '@/lib/utils'

interface PrioridadesViewProps {
  user: { nome: string; email: string; tipo: string }
  respostasDentista: OrdemPrioridade[]
  fornecedorAtrasado: OrdemPrioridade[]
  atrasados: OrdemPrioridade[]
  provasPendentesClinicorp: OrdemPrioridade[]
  hoje: OrdemPrioridade[]
  urgentes: OrdemPrioridade[]
  proximos: OrdemPrioridade[]
  clinicorpConfigurado: boolean
  dataReferencia: string
}

type OrdemDetalhada = NonNullable<Awaited<ReturnType<typeof getOrdemById>>>
type TipoCard = 'resposta' | 'fornecedor' | 'atrasado' | 'clinicorp' | 'hoje' | 'urgente' | 'amanha'
type Aba = 'acao' | 'cronograma'

const ESTILO_CARD: Record<TipoCard, { borda: string; icone: string; fundo: string }> = {
  resposta: {
    borda: 'border-l-violet-500',
    icone: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    fundo: 'hover:border-violet-300 dark:hover:border-violet-800',
  },
  fornecedor: {
    borda: 'border-l-orange-500',
    icone: 'bg-orange-500/10 text-orange-600 dark:text-orange-300',
    fundo: 'hover:border-orange-300 dark:hover:border-orange-800',
  },
  atrasado: {
    borda: 'border-l-red-500',
    icone: 'bg-red-500/10 text-red-600 dark:text-red-300',
    fundo: 'hover:border-red-300 dark:hover:border-red-800',
  },
  clinicorp: {
    borda: 'border-l-amber-500',
    icone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    fundo: 'hover:border-amber-300 dark:hover:border-amber-800',
  },
  hoje: {
    borda: 'border-l-sky-500',
    icone: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    fundo: 'hover:border-sky-300 dark:hover:border-sky-800',
  },
  urgente: {
    borda: 'border-l-rose-500',
    icone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    fundo: 'hover:border-rose-300 dark:hover:border-rose-800',
  },
  amanha: {
    borda: 'border-l-indigo-500',
    icone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    fundo: 'hover:border-indigo-300 dark:hover:border-indigo-800',
  },
}

function formatarData(data: Date | string) {
  return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short' })
}

function diasDeAtraso(data: Date | string, dataReferencia: string) {
  return Math.max(0, Math.round((new Date(dataReferencia).getTime() - new Date(data).getTime()) / 86_400_000))
}

function IconeCard({ tipo }: { tipo: TipoCard }) {
  const classe = 'h-5 w-5'
  if (tipo === 'resposta') return <ClipboardCheck className={classe} />
  if (tipo === 'fornecedor') return <Building2 className={classe} />
  if (tipo === 'atrasado') return <AlertCircle className={classe} />
  if (tipo === 'clinicorp') return <Stethoscope className={classe} />
  if (tipo === 'hoje') return <Clock3 className={classe} />
  if (tipo === 'urgente') return <AlertTriangle className={classe} />
  return <CalendarDays className={classe} />
}

function descricaoDaAcao(ordem: OrdemPrioridade, tipo: TipoCard, dataReferencia: string) {
  if (tipo === 'resposta') {
    return ordem.respostaDentista?.toLowerCase().includes('ajust')
      ? 'Dentista solicitou ajuste — encaminhar para produção'
      : 'Dentista aprovou — liberar para finalização'
  }
  if (tipo === 'fornecedor') return `${ordem.fornecedor} ainda não confirmou a entrega`
  if (tipo === 'atrasado') {
    const dias = diasDeAtraso(ordem.dataEntrega, dataReferencia)
    return `${dias} ${dias === 1 ? 'dia' : 'dias'} além do prazo do laboratório`
  }
  if (tipo === 'clinicorp') {
    return ordem.cpfCadastrado
      ? 'CPF cadastrado — aguardando consulta da agenda'
      : 'CPF ausente — complete a identificação do paciente'
  }
  if (tipo === 'hoje') return 'Entrega prevista para hoje'
  if (tipo === 'urgente') return 'Marcada como urgente'
  return 'Entrega prevista para amanhã'
}

function OrdemCard({
  ordem,
  tipo,
  dataReferencia,
  onOpen,
  opening,
}: {
  ordem: OrdemPrioridade
  tipo: TipoCard
  dataReferencia: string
  onOpen: (id: number) => void
  opening: boolean
}) {
  const estilo = ESTILO_CARD[tipo]

  return (
    <article className={cn(
      'group rounded-2xl border border-l-4 border-slate-200 bg-white p-4 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900/80',
      estilo.borda,
      estilo.fundo,
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', estilo.icone)}>
          <IconeCard tipo={tipo} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onOpen(ordem.id)}
                disabled={opening}
                className="flex max-w-full items-center gap-1.5 text-left font-semibold text-slate-950 underline-offset-4 hover:text-indigo-600 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-white dark:hover:text-indigo-300"
                aria-label={`Abrir detalhes da ordem de ${ordem.nomePaciente}`}
              >
                <span className="truncate">{ordem.nomePaciente}</span>
                {opening ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5" />}
              </button>
              <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">{ordem.servicoNome}</p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
              {ordem.prioridade === 'Urgente' && <Badge variant="urgente">Urgente</Badge>}
              <Badge variant="outline">OS #{ordem.id}</Badge>
            </div>
          </div>

          <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
            {descricaoDaAcao(ordem, tipo, dataReferencia)}
          </p>
          {tipo === 'resposta' && ordem.observacaoResposta && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">“{ordem.observacaoResposta}”</p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> {ordem.clienteNome}</span>
            <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> {formatarData(ordem.dataEntrega)}</span>
            <span>{etapaLabel(ordem.etapaAtual || 'recebimento', 'lab')}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function ListaPrioridades({
  titulo,
  descricao,
  ordens,
  tipo,
  dataReferencia,
  openingOrdemId,
  onOpen,
  vazio,
}: {
  titulo: string
  descricao: string
  ordens: OrdemPrioridade[]
  tipo: TipoCard
  dataReferencia: string
  openingOrdemId: number | null
  onOpen: (id: number) => void
  vazio: string
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/40 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950 dark:text-white">{titulo}</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
        </div>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-slate-100 px-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {ordens.length}
        </span>
      </div>

      {ordens.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-200 px-5 text-center dark:border-slate-800">
          <div>
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{vazio}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {ordens.map((ordem) => (
            <OrdemCard
              key={`${tipo}-${ordem.id}`}
              ordem={ordem}
              tipo={tipo}
              dataReferencia={dataReferencia}
              onOpen={onOpen}
              opening={openingOrdemId === ordem.id}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export function PrioridadesView(props: PrioridadesViewProps) {
  const relatorioRef = useRef<HTMLDivElement>(null)
  const [aba, setAba] = useState<Aba>('acao')
  const [busca, setBusca] = useState('')
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemDetalhada | null>(null)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [openingOrdemId, setOpeningOrdemId] = useState<number | null>(null)

  const listas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    const filtrar = (ordens: OrdemPrioridade[]) => termo
      ? ordens.filter((ordem) => [ordem.nomePaciente, ordem.clienteNome, ordem.servicoNome, String(ordem.id)]
          .some((valor) => valor.toLocaleLowerCase('pt-BR').includes(termo)))
      : ordens

    return {
      respostasDentista: filtrar(props.respostasDentista),
      fornecedorAtrasado: filtrar(props.fornecedorAtrasado),
      atrasados: filtrar(props.atrasados),
      provasPendentesClinicorp: filtrar(props.provasPendentesClinicorp),
      hoje: filtrar(props.hoje),
      urgentes: filtrar(props.urgentes),
      proximos: filtrar(props.proximos),
    }
  }, [busca, props])

  const totalAcao = new Set([
    ...props.respostasDentista,
    ...props.fornecedorAtrasado,
    ...props.atrasados,
  ].map((ordem) => ordem.id)).size
  const totalCritico = totalAcao + props.provasPendentesClinicorp.length + props.hoje.length

  const gerarRelatorio = useReactToPrint({
    contentRef: relatorioRef,
    documentTitle: `relatorio-prioridades-${new Date().toISOString().slice(0, 10)}`,
  })

  const handleOpenOrdem = async (id: number) => {
    setOpeningOrdemId(id)
    try {
      const ordem = await getOrdemById(id)
      if (!ordem) {
        toast.error('Ordem de serviço não encontrada.')
        return
      }
      setSelectedOrdem(ordem)
      setViewModalOpen(true)
    } catch {
      toast.error('Não foi possível abrir os detalhes da ordem.')
    } finally {
      setOpeningOrdemId(null)
    }
  }

  const relatorioProps = {
    respostasDentista: props.respostasDentista,
    fornecedorAtrasado: props.fornecedorAtrasado,
    atrasados: props.atrasados,
    provasPendentesClinicorp: props.provasPendentesClinicorp,
    hoje: props.hoje,
    urgentes: props.urgentes,
    proximos: props.proximos,
  }

  return (
    <DashboardLayout user={props.user}>
      <VisualizarOrdemModal
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false)
          setSelectedOrdem(null)
        }}
        ordem={selectedOrdem}
      />

      <div className="hidden">
        <RelatorioPrioridades ref={relatorioRef} {...relatorioProps} />
      </div>

      <Header
        title="Prioridades"
        subtitle={totalCritico ? `${totalCritico} ordens pedem atenção da equipe.` : 'Nenhuma pendência crítica no momento.'}
      />

      <div className="space-y-5 px-1 pt-5 sm:px-0">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Ação agora', value: totalAcao, icon: CircleCheckBig, tone: 'text-violet-500' },
            { label: 'Atraso confirmado', value: props.atrasados.length, icon: AlertCircle, tone: 'text-red-500' },
            { label: 'Conferir Clinicorp', value: props.provasPendentesClinicorp.length, icon: Stethoscope, tone: 'text-amber-500' },
            { label: 'Entrega hoje', value: props.hoje.length, icon: Clock3, tone: 'text-sky-500' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{item.label}</p>
                <item.icon className={cn('h-4 w-4', item.tone)} />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-950 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        {!props.clinicorpConfigurado && props.provasPendentesClinicorp.length > 0 && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
            <Stethoscope className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Conferência do Clinicorp ainda é manual</p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200/80">
                Ordens em prova com prazo vencido ficam separadas e não entram como atraso confirmado até consultarmos o agendamento pelo CPF.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-950/40 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" aria-label="Visão das prioridades">
            <button
              type="button"
              aria-pressed={aba === 'acao'}
              onClick={() => setAba('acao')}
              className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors lg:flex-none', aba === 'acao' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
            >
              Ação imediata
            </button>
            <button
              type="button"
              aria-pressed={aba === 'cronograma'}
              onClick={() => setAba('cronograma')}
              className={cn('flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors lg:flex-none', aba === 'cronograma' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white')}
            >
              Hoje e próximos
            </button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar paciente, dentista ou OS"
                aria-label="Buscar prioridades"
                className="pl-9"
              />
            </div>
            <Button type="button" variant="outline" onClick={() => gerarRelatorio()}>
              <FileText className="h-4 w-4" />
              Gerar relatório
            </Button>
          </div>
        </div>

        {aba === 'acao' ? (
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <ListaPrioridades
              titulo="Dentista já respondeu"
              descricao="Aprovações e ajustes aparecem primeiro."
              ordens={listas.respostasDentista}
              tipo="resposta"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhuma resposta aguardando ação do laboratório."
            />
            <ListaPrioridades
              titulo="Fornecedor em atraso"
              descricao="Estruturas que ultrapassaram o prazo informado."
              ordens={listas.fornecedorAtrasado}
              tipo="fornecedor"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhum fornecedor com prazo vencido."
            />
            <ListaPrioridades
              titulo="Atrasos confirmados"
              descricao="Prazo do laboratório vencido, fora da etapa de prova."
              ordens={listas.atrasados}
              tipo="atrasado"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhum atraso confirmado."
            />
            <ListaPrioridades
              titulo="Em prova — conferir Clinicorp"
              descricao="Separadas para aplicar a regra do agendamento por CPF."
              ordens={listas.provasPendentesClinicorp}
              tipo="clinicorp"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhuma prova aguardando conferência."
            />
          </div>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-3">
            <ListaPrioridades
              titulo="Entrega hoje"
              descricao="Confirmar acabamento e saída."
              ordens={listas.hoje}
              tipo="hoje"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhuma entrega prevista para hoje."
            />
            <ListaPrioridades
              titulo="Urgentes"
              descricao="Pedidos futuros marcados pela equipe."
              ordens={listas.urgentes}
              tipo="urgente"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhum pedido futuro marcado como urgente."
            />
            <ListaPrioridades
              titulo="Entrega amanhã"
              descricao="Antecipar o que precisa ficar pronto."
              ordens={listas.proximos}
              tipo="amanha"
              dataReferencia={props.dataReferencia}
              openingOrdemId={openingOrdemId}
              onOpen={handleOpenOrdem}
              vazio="Nenhuma entrega prevista para amanhã."
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
