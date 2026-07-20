'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Kanban,
  Loader2,
  Package,
  PackageCheck,
  RotateCcw,
  Tags,
  WalletCards,
} from 'lucide-react'
import { getOrdemById } from '@/actions/ordens'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardData {
  usuario: {
    nome: string
    email: string
    tipo: string
  }
  totalOrdensMes: number
  totalOrdensMesAnterior: number
  emAndamento: number
  atrasadas: number
  entregasHoje: number
  retornosPendentes: number
  semEtapa: number
  prontasParaEntrega: number
  recebidoMes: number
  saldoEmAberto: number
  contasEmAberto: number
  vencendoSeteDias: number
  contasVencendoSeteDias: number
  proximasEntregas: Array<{
    id: number
    paciente: string
    cliente: string
    servico: string
    dataEntrega: string
    status: string
    prioridade: string
  }>
}

type OrdemDetalhada = NonNullable<Awaited<ReturnType<typeof getOrdemById>>>

interface DashboardViewProps {
  initialData: DashboardData
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

function getStatusVariant(status: string): NonNullable<BadgeProps['variant']> {
  const variants: Record<string, NonNullable<BadgeProps['variant']>> = {
    Aguardando: 'aguardando',
    'Em Produção': 'emProducao',
    'Em Prova': 'warning',
    Finalizado: 'finalizado',
    Cancelado: 'destructive',
    Pausado: 'pausado',
  }
  return variants[status] || 'default'
}

function comparativoOrdens(atual: number, anterior: number) {
  if (anterior === 0) {
    return atual === 0
      ? { texto: 'Sem ordens nos dois períodos', direcao: 'neutra' as const }
      : { texto: 'Primeiras ordens do período', direcao: 'alta' as const }
  }

  const percentual = Math.round(((atual - anterior) / anterior) * 100)
  if (percentual === 0) return { texto: 'Mesmo volume do mês anterior', direcao: 'neutra' as const }
  return {
    texto: `${Math.abs(percentual)}% ${percentual > 0 ? 'acima' : 'abaixo'} do mês anterior`,
    direcao: percentual > 0 ? 'alta' as const : 'baixa' as const,
  }
}

export function DashboardView({ initialData }: DashboardViewProps) {
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemDetalhada | null>(null)
  const [openingOrdemId, setOpeningOrdemId] = useState<number | null>(null)
  const comparativo = comparativoOrdens(initialData.totalOrdensMes, initialData.totalOrdensMesAnterior)
  const totalAtencao = initialData.atrasadas + initialData.entregasHoje + initialData.retornosPendentes + initialData.semEtapa

  const abrirOrdem = async (id: number) => {
    setOpeningOrdemId(id)
    try {
      const ordem = await getOrdemById(id)
      if (!ordem) {
        toast.error('Ordem de serviço não encontrada.')
        return
      }
      setSelectedOrdem(ordem)
    } catch {
      toast.error('Não foi possível abrir os detalhes da ordem.')
    } finally {
      setOpeningOrdemId(null)
    }
  }

  const stats = [
    {
      name: 'Ordens neste mês',
      value: initialData.totalOrdensMes.toString(),
      detail: comparativo.texto,
      icon: ClipboardList,
      href: '/ordens',
      tone: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
      trend: comparativo.direcao,
    },
    {
      name: 'Em andamento',
      value: initialData.emAndamento.toString(),
      detail: `${initialData.entregasHoje} com entrega hoje`,
      icon: Clock3,
      href: '/producao',
      tone: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
      trend: 'neutra' as const,
    },
    {
      name: 'Prazo vencido',
      value: initialData.atrasadas.toString(),
      detail: initialData.atrasadas ? 'Precisam de revisão' : 'Nenhuma pendência',
      icon: AlertTriangle,
      href: '/prioridades',
      tone: initialData.atrasadas
        ? 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
      trend: 'neutra' as const,
    },
    {
      name: 'Recebido neste mês',
      value: formatCurrency(initialData.recebidoMes),
      detail: 'Valores com baixa confirmada',
      icon: CircleDollarSign,
      href: '/financeiro',
      tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
      trend: 'neutra' as const,
    },
  ]

  const atencoes = [
    {
      label: 'Ordens atrasadas',
      value: initialData.atrasadas,
      description: 'Prazo de entrega já vencido',
      href: '/prioridades',
      icon: AlertTriangle,
      tone: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-300',
    },
    {
      label: 'Entregas para hoje',
      value: initialData.entregasHoje,
      description: 'Confirmar acabamento e saída',
      href: '/prioridades',
      icon: CalendarDays,
      tone: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300',
    },
    {
      label: 'Retornos respondidos',
      value: initialData.retornosPendentes,
      description: 'Dentista já aprovou ou pediu ajuste',
      href: '/producao',
      icon: RotateCcw,
      tone: 'text-violet-600 bg-violet-50 dark:bg-violet-500/10 dark:text-violet-300',
    },
    {
      label: 'Etapa a definir',
      value: initialData.semEtapa,
      description: 'Ordens antigas sem fluxo detalhado',
      href: '/producao',
      icon: Tags,
      tone: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-300',
    },
  ]

  return (
    <DashboardLayout user={initialData.usuario}>
      <VisualizarOrdemModal
        isOpen={Boolean(selectedOrdem)}
        onClose={() => setSelectedOrdem(null)}
        ordem={selectedOrdem}
      />

      <Header
        title="Painel do laboratório"
        subtitle={totalAtencao > 0 ? `${totalAtencao} ações pedem atenção hoje` : 'Operação em dia — nenhuma ação crítica agora'}
      />

      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
        <nav aria-label="Atalhos principais" className="flex gap-2 overflow-x-auto pb-1">
          <Link href="/ordens" className={buttonVariants({ className: 'shrink-0 bg-indigo-600 text-white hover:bg-indigo-700' })}><ClipboardList className="h-4 w-4" /> Ordens de serviço</Link>
          <Link href="/prioridades" className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}><AlertTriangle className="h-4 w-4" /> Prioridades</Link>
          <Link href="/producao" className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}><Kanban className="h-4 w-4" /> Produção</Link>
          <Link href="/financeiro" className={buttonVariants({ variant: 'outline', className: 'shrink-0' })}><WalletCards className="h-4 w-4" /> Financeiro</Link>
        </nav>

        <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Link key={stat.name} href={stat.href} className="group rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <Card className="h-full hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-500/30">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stat.name}</p>
                      <p className="mt-2 truncate text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{stat.value}</p>
                    </div>
                    <div className={`rounded-2xl p-3 ${stat.tone}`}><stat.icon className="h-5 w-5" /></div>
                  </div>
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {stat.trend === 'alta' && <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />}
                    {stat.trend === 'baixa' && <ArrowDownRight className="h-3.5 w-3.5 text-amber-600" />}
                    <span>{stat.detail}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">O que precisa de atenção</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Atalhos para as filas que podem travar a operação.</p>
            </div>
            <Link href="/prioridades" className="hidden text-sm font-semibold text-indigo-600 hover:text-indigo-700 sm:block">Abrir cronograma</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {atencoes.map((item) => (
              <Link key={item.label} href={item.href} className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-200 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:hover:border-indigo-500/30">
                <div className={`rounded-xl p-2.5 ${item.tone}`}><item.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.label}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">{item.value}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="overflow-hidden xl:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5">
              <div>
                <CardTitle>Próximas entregas</CardTitle>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Clique no paciente para abrir a ordem completa.</p>
              </div>
              <Link href="/ordens" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Ver todas <ArrowRight className="h-4 w-4" /></Link>
            </CardHeader>
            <CardContent className="p-0">
              {initialData.proximasEntregas.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                  <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">Nenhuma entrega futura pendente</p>
                  <p className="mt-1 text-sm text-slate-500">As novas ordens aparecerão aqui automaticamente.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {initialData.proximasEntregas.map((ordem) => (
                    <button
                      key={ordem.id}
                      type="button"
                      onClick={() => abrirOrdem(ordem.id)}
                      disabled={openingOrdemId === ordem.id}
                      className="group flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:gap-4 sm:px-6 dark:hover:bg-white/5"
                    >
                      <div className="hidden rounded-xl bg-slate-100 p-3 text-slate-500 sm:block dark:bg-white/5 dark:text-slate-400"><Package className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">{ordem.paciente}</p>
                          {openingOrdemId === ordem.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
                          {ordem.prioridade === 'Urgente' && <Badge variant="urgente">Urgente</Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{ordem.servico} · {ordem.cliente}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold capitalize text-slate-900 dark:text-white">{formatDate(ordem.dataEntrega)}</p>
                        <Badge variant={getStatusVariant(ordem.status)} className="mt-1 hidden sm:inline-flex">{ordem.status}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-emerald-600" /> Financeiro em resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Saldo em aberto</p>
                  <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{formatCurrency(initialData.saldoEmAberto)}</p>
                  <p className="mt-1 text-xs text-slate-500">{initialData.contasEmAberto} conta{initialData.contasEmAberto === 1 ? '' : 's'} pendente{initialData.contasEmAberto === 1 ? '' : 's'}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Vencem em até 7 dias</p>
                      <p className="mt-1 text-lg font-bold text-amber-900 dark:text-amber-100">{formatCurrency(initialData.vencendoSeteDias)}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-700 shadow-sm dark:bg-black/20 dark:text-amber-200">{initialData.contasVencendoSeteDias}</span>
                  </div>
                </div>
                <Link href="/financeiro" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>Abrir financeiro <ArrowRight className="h-4 w-4" /></Link>
              </CardContent>
            </Card>

            <Card className={initialData.prontasParaEntrega ? 'border-emerald-200 dark:border-emerald-500/20' : ''}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"><PackageCheck className="h-6 w-6" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Prontas para entrega</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{initialData.prontasParaEntrega} aguardando retirada ou confirmação</p>
                </div>
                <Link href="/ordens" aria-label="Ver ordens prontas" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"><ArrowRight className="h-4 w-4" /></Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
