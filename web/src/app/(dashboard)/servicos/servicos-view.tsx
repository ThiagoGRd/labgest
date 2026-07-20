'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ConfirmActionModal } from '@/components/ui/confirm-action-modal'
import { ServicoFormModal } from '@/components/servicos/servico-form-modal'
import { toggleServicoAtivo, type getMateriaisDisponiveis, type getServicos } from '@/actions/servicos'
import { FLUXOS_PROTESE } from '@labgest/shared'
import { Archive, Clock3, Edit3, MoreHorizontal, Package, Plus, Search, TrendingUp, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type Servico = Awaited<ReturnType<typeof getServicos>>[number]
type MaterialDisponivel = Awaited<ReturnType<typeof getMateriaisDisponiveis>>[number]

interface ServicosViewProps {
  initialData: Servico[]
  materiaisDisponiveis: MaterialDisponivel[]
  podeGerenciar: boolean
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function margemColor(margem: number) {
  if (margem >= 50) return 'text-emerald-600 dark:text-emerald-400'
  if (margem >= 30) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function ServicosView({ initialData, materiaisDisponiveis, podeGerenciar }: ServicosViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState<'ativos' | 'inativos' | 'todos'>('ativos')
  const [modalServico, setModalServico] = useState<Servico | 'novo' | null>(null)
  const [servicoParaArquivar, setServicoParaArquivar] = useState<Servico | null>(null)

  const categorias = ['Todos', ...new Set(initialData.map((servico) => servico.categoria))]
  const termo = search.trim().toLocaleLowerCase('pt-BR')
  const servicosFiltrados = initialData.filter((servico) => {
    const correspondeBusca = !termo || `${servico.nome} ${servico.descricao}`.toLocaleLowerCase('pt-BR').includes(termo)
    const correspondeCategoria = categoriaFilter === 'Todos' || servico.categoria === categoriaFilter
    const correspondeStatus = statusFilter === 'todos' || (statusFilter === 'ativos' ? servico.ativo : !servico.ativo)
    return correspondeBusca && correspondeCategoria && correspondeStatus
  })

  const ativos = initialData.filter((servico) => servico.ativo)
  const maisSolicitado = [...ativos].sort((a, b) => b.pedidos30Dias - a.pedidos30Dias)[0]
  const temposReais = ativos.flatMap((servico) => servico.tempoMedioReal === null ? [] : [servico.tempoMedioReal])
  const tempoMedio = temposReais.length > 0 ? Math.round(temposReais.reduce((total, dias) => total + dias, 0) / temposReais.length) : null
  const margemMedia = ativos.length > 0 ? Math.round(ativos.reduce((total, servico) => total + servico.margemLucro, 0) / ativos.length) : 0

  const alterarStatus = (servico: Servico, ativo: boolean) => {
    startTransition(async () => {
      const resultado = await toggleServicoAtivo(servico.id, ativo)
      if (!resultado.success) {
        toast.error(resultado.error || 'Não foi possível alterar o serviço.')
        return
      }
      toast.success(ativo ? 'Serviço reativado.' : 'Serviço arquivado. Novos pedidos não poderão selecioná-lo.')
      setServicoParaArquivar(null)
      router.refresh()
    })
  }

  return (
    <DashboardLayout>
      {modalServico && (
        <ServicoFormModal
          key={modalServico === 'novo' ? 'novo' : modalServico.id}
          servico={modalServico === 'novo' ? null : modalServico}
          materiaisDisponiveis={materiaisDisponiveis}
          onClose={() => setModalServico(null)}
        />
      )}
      <ConfirmActionModal
        isOpen={Boolean(servicoParaArquivar)}
        onClose={() => setServicoParaArquivar(null)}
        onConfirm={() => servicoParaArquivar && alterarStatus(servicoParaArquivar, false)}
        title="Arquivar serviço"
        description={`O serviço ${servicoParaArquivar?.nome || ''} deixará de aparecer em novos pedidos. As ordens existentes e o histórico serão preservados.`}
        confirmLabel="Arquivar serviço"
        loading={isPending}
        destructive
      />

      <Header
        title="Serviços"
        subtitle={`${ativos.length} ativos · ${initialData.length} cadastrados`}
        action={podeGerenciar ? { label: 'Novo serviço', onClick: () => setModalServico('novo') } : undefined}
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-indigo-100 p-2.5 dark:bg-indigo-500/10"><Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /></div><div><p className="text-xs text-slate-500">Serviços ativos</p><p className="text-xl font-bold text-slate-900 dark:text-white">{ativos.length}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-500/10"><TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div><div className="min-w-0"><p className="text-xs text-slate-500">Mais solicitado · 30 dias</p><p className="truncate text-sm font-bold text-slate-900 dark:text-white">{maisSolicitado?.pedidos30Dias ? maisSolicitado.nome : 'Sem pedidos'}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-500/10"><Clock3 className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div><div><p className="text-xs text-slate-500">Prazo real médio</p><p className="text-xl font-bold text-slate-900 dark:text-white">{tempoMedio === null ? '—' : `${tempoMedio} dias`}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-violet-100 p-2.5 dark:bg-violet-500/10"><WalletCards className="h-5 w-5 text-violet-600 dark:text-violet-400" /></div><div><p className="text-xs text-slate-500">Margem estimada</p><p className={`text-xl font-bold ${margemColor(margemMedia)}`}>{margemMedia}%</p></div></CardContent></Card>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input aria-label="Buscar serviços" placeholder="Buscar por nome ou descrição" value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" role="group" aria-label="Filtrar por status">
                {([['ativos', 'Ativos'], ['inativos', 'Arquivados'], ['todos', 'Todos']] as const).map(([valor, label]) => (
                  <Button key={valor} type="button" size="sm" variant={statusFilter === valor ? 'default' : 'outline'} onClick={() => setStatusFilter(valor)}>{label}</Button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filtrar por categoria">
              {categorias.map((categoria) => (
                <Button key={categoria} type="button" size="sm" variant={categoriaFilter === categoria ? 'secondary' : 'ghost'} onClick={() => setCategoriaFilter(categoria)} className="shrink-0">{categoria}</Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {servicosFiltrados.length === 0 ? (
          <Card><EmptyState title="Nenhum serviço encontrado" description="Ajuste os filtros ou cadastre um novo serviço." action={podeGerenciar ? <Button onClick={() => setModalServico('novo')}><Plus className="h-4 w-4" /> Novo serviço</Button> : undefined} /></Card>
        ) : (
          <>
            <Card className="hidden overflow-hidden lg:block">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <tr><th className="px-5 py-3">Serviço</th><th className="px-4 py-3">Fluxo</th><th className="px-4 py-3 text-right">Preço / custo</th><th className="px-4 py-3 text-center">Margem</th><th className="px-4 py-3 text-center">Prazo</th><th className="px-4 py-3 text-center">Pedidos</th><th className="px-4 py-3 text-center">Status</th><th className="w-14 px-3 py-3"><span className="sr-only">Ações</span></th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {servicosFiltrados.map((servico) => (
                      <tr key={servico.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50">
                        <td className="px-5 py-4"><p className="font-bold text-slate-900 dark:text-white">{servico.nome}</p><p className="mt-0.5 text-xs text-slate-500">{servico.categoria} · {servico.materiais.length} materiais</p></td>
                        <td className="max-w-52 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{servico.tipoWorkflow ? FLUXOS_PROTESE[servico.tipoWorkflow].nomeCurto : <span className="text-amber-600">Fluxo geral</span>}</td>
                        <td className="px-4 py-4 text-right"><p className="font-bold text-slate-900 dark:text-white">{formatCurrency(servico.preco)}</p><p className="text-xs text-slate-500">{formatCurrency(servico.custoMateriais)}</p></td>
                        <td className={`px-4 py-4 text-center font-bold ${margemColor(servico.margemLucro)}`}>{servico.margemLucro}%</td>
                        <td className="px-4 py-4 text-center text-sm text-slate-600 dark:text-slate-300"><p>{servico.tempoProducao} dias</p>{servico.tempoMedioReal !== null && <p className="text-xs text-slate-500">real: {servico.tempoMedioReal}d</p>}</td>
                        <td className="px-4 py-4 text-center"><p className="font-bold text-slate-900 dark:text-white">{servico.totalPedidos}</p><p className="text-xs text-slate-500">{servico.pedidos30Dias} em 30d</p></td>
                        <td className="px-4 py-4 text-center"><Badge variant={servico.ativo ? 'success' : 'secondary'}>{servico.ativo ? 'Ativo' : 'Arquivado'}</Badge></td>
                        <td className="px-3 py-4">{podeGerenciar && <ServicoMenu servico={servico} onEdit={() => setModalServico(servico)} onArchive={() => setServicoParaArquivar(servico)} onActivate={() => alterarStatus(servico, true)} disabled={isPending} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {servicosFiltrados.map((servico) => (
                <Card key={servico.id} className={!servico.ativo ? 'opacity-70' : ''}>
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Badge variant={servico.ativo ? 'success' : 'secondary'}>{servico.ativo ? 'Ativo' : 'Arquivado'}</Badge><h3 className="mt-2 font-bold text-slate-900 dark:text-white">{servico.nome}</h3><p className="text-xs text-slate-500">{servico.categoria}</p></div>{podeGerenciar && <ServicoMenu servico={servico} onEdit={() => setModalServico(servico)} onArchive={() => setServicoParaArquivar(servico)} onActivate={() => alterarStatus(servico, true)} disabled={isPending} />}</div>
                    <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-zinc-800/50"><p className="text-xs text-slate-500">Fluxo</p><p className="font-medium text-slate-800 dark:text-slate-200">{servico.tipoWorkflow ? FLUXOS_PROTESE[servico.tipoWorkflow].nomeCurto : 'Fluxo geral'}</p></div>
                    <div className="grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-slate-500">Preço</p><p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(servico.preco)}</p></div><div><p className="text-xs text-slate-500">Margem</p><p className={`text-sm font-bold ${margemColor(servico.margemLucro)}`}>{servico.margemLucro}%</p></div><div><p className="text-xs text-slate-500">Prazo</p><p className="text-sm font-bold text-slate-900 dark:text-white">{servico.tempoProducao}d</p></div></div>
                    {podeGerenciar && <Button type="button" variant="outline" className="w-full" onClick={() => setModalServico(servico)}><Edit3 className="h-4 w-4" /> Editar serviço</Button>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function ServicoMenu({ servico, onEdit, onArchive, onActivate, disabled }: { servico: Servico; onEdit: () => void; onArchive: () => void; onActivate: () => void; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Ações de ${servico.nome}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}><Edit3 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
        <DropdownMenuSeparator />
        {servico.ativo
          ? <DropdownMenuItem onSelect={onArchive} className="text-red-600 focus:text-red-600"><Archive className="mr-2 h-4 w-4" /> Arquivar</DropdownMenuItem>
          : <DropdownMenuItem onSelect={onActivate}><Package className="mr-2 h-4 w-4" /> Reativar</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
