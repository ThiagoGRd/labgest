'use client'

import { useMemo, useState, useTransition } from 'react'
import { Building2, ClipboardList, Plus, Search, X } from 'lucide-react'
import {
  criarPedido, criarLab, atualizarSituacao, marcarRetrabalho, desmarcarRetrabalho, atualizarPedido,
  type LabExternoPedido, type LabExterno, type ResultadoAcao,
} from '@/actions/labs-externos'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { EmptyState } from '@/components/ui/empty-state'
import { ReasonModal } from '@/components/ui/reason-modal'
import { ETAPAS, ETAPA_POR_SITUACAO } from '@/components/labs-externos/etapas'
import { ModalLaboratorio, type LaboratorioFormData } from '@/components/labs-externos/modal-laboratorio'
import { ModalPedido, type PedidoFormData } from '@/components/labs-externos/modal-pedido'
import { PainelLaboratorios } from '@/components/labs-externos/painel-laboratorios'
import { PedidoCard } from '@/components/labs-externos/pedido-card'
import { PipelineLabs, type FiltroPedidos } from '@/components/labs-externos/pipeline-labs'
import { campoClasse } from '@/components/labs-externos/campos'
import type { SituacaoPedido } from '@/lib/labs-externos-utils'
import { toast } from 'sonner'

interface Stats {
  total_enviados: number
  total_provando: number
  total_prontos: number
  total_entregues: number
  total_atrasados: number
  total_retrabalhos: number
}

interface Props {
  pedidos: LabExternoPedido[]
  atrasados: LabExternoPedido[]
  retrabalhos: LabExternoPedido[]
  stats: Stats
  labs: LabExterno[]
}

const POR_PAGINA = 20

const TITULO_LISTA: Record<FiltroPedidos, { titulo: string; descricao: string }> = {
  ativos: { titulo: 'Pedidos em andamento', descricao: 'Tudo o que ainda não foi entregue ao dentista.' },
  Enviado: { titulo: ETAPA_POR_SITUACAO.Enviado.rotulo, descricao: ETAPA_POR_SITUACAO.Enviado.explicacao },
  Provando: { titulo: ETAPA_POR_SITUACAO.Provando.rotulo, descricao: ETAPA_POR_SITUACAO.Provando.explicacao },
  Pronto: { titulo: ETAPA_POR_SITUACAO.Pronto.rotulo, descricao: ETAPA_POR_SITUACAO.Pronto.explicacao },
  Entregue: { titulo: ETAPA_POR_SITUACAO.Entregue.rotulo, descricao: ETAPA_POR_SITUACAO.Entregue.explicacao },
  atrasados: { titulo: 'Prazo vencido', descricao: 'Não entregues e com o prazo vencido, do mais atrasado para o menos.' },
  retrabalhos: { titulo: 'Retrabalhos', descricao: 'Peças marcadas como retrabalho que ainda não foram entregues.' },
}

export function LabsExternosView({ pedidos, atrasados, retrabalhos, stats, labs }: Props) {
  const [filtro, setFiltro] = useState<FiltroPedidos>('ativos')
  const [busca, setBusca] = useState('')
  const [labFiltro, setLabFiltro] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [showModal, setShowModal] = useState(false)
  const [showModalLab, setShowModalLab] = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState<LabExternoPedido | undefined>(undefined)
  const [retrabalhoId, setRetrabalhoId] = useState<number | null>(null)
  const [movendoId, setMovendoId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const contagens: Record<SituacaoPedido, number> = {
    Enviado: stats.total_enviados,
    Provando: stats.total_provando,
    Pronto: stats.total_prontos,
    Entregue: stats.total_entregues,
  }

  const filtrados = useMemo(() => {
    let lista: LabExternoPedido[]
    switch (filtro) {
      case 'atrasados': lista = atrasados; break
      case 'retrabalhos': lista = retrabalhos; break
      case 'ativos': lista = pedidos.filter((p) => p.situacao !== 'Entregue'); break
      default: lista = pedidos.filter((p) => p.situacao === filtro)
    }
    if (labFiltro) lista = lista.filter((p) => String(p.labId) === labFiltro)
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter((p) =>
      p.paciente.toLowerCase().includes(termo) ||
      p.dentista?.toLowerCase().includes(termo) ||
      p.servico?.toLowerCase().includes(termo))
  }, [filtro, busca, labFiltro, pedidos, atrasados, retrabalhos])

  // Executa uma ação do servidor e mostra o resultado ao usuário (sucesso ou motivo do erro).
  function executar(acao: () => Promise<ResultadoAcao>, mensagemSucesso: string, aoConcluir?: () => void) {
    startTransition(async () => {
      try {
        const resultado = await acao()
        if (!resultado.success) {
          toast.error(resultado.error)
          return
        }
        aoConcluir?.()
        toast.success(mensagemSucesso)
      } catch {
        toast.error('Não foi possível concluir a ação. Tente novamente.')
      } finally {
        setMovendoId(null)
      }
    })
  }

  function mover(id: number, situacao: SituacaoPedido) {
    setMovendoId(id)
    executar(() => atualizarSituacao(id, situacao), `Pedido movido para "${ETAPA_POR_SITUACAO[situacao].rotulo}".`)
  }

  function confirmarRetrabalho(motivo: string) {
    if (retrabalhoId === null) return
    executar(() => marcarRetrabalho(retrabalhoId, motivo), 'Retrabalho registrado.', () => setRetrabalhoId(null))
  }

  function salvarPedido(data: PedidoFormData) {
    executar(
      () => (pedidoEditando ? atualizarPedido(pedidoEditando.id, data) : criarPedido(data)),
      pedidoEditando ? 'Pedido atualizado.' : 'Pedido cadastrado.',
      () => { setShowModal(false); setPedidoEditando(undefined) },
    )
  }

  function salvarLab(dados: LaboratorioFormData) {
    executar(() => criarLab(dados), 'Laboratório cadastrado.', () => setShowModalLab(false))
  }

  function novoPedido() {
    setPedidoEditando(undefined)
    setShowModal(true)
  }

  function mudarFiltro(novo: FiltroPedidos) {
    setFiltro(novo)
    setLimite(POR_PAGINA)
  }

  const visiveis = filtrados.slice(0, limite)
  const { titulo, descricao } = TITULO_LISTA[filtro]
  const comFiltroExtra = Boolean(busca.trim() || labFiltro)

  return (
    <DashboardLayout>
      <Header title="Laboratórios externos" subtitle="Peças enviadas a laboratórios parceiros" action={{ label: 'Novo pedido', onClick: novoPedido }} />

      <main className="space-y-6 p-4 sm:p-6">
        <PipelineLabs filtro={filtro} contagens={contagens} atrasados={stats.total_atrasados} retrabalhos={stats.total_retrabalhos} onChange={mudarFiltro} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Lista de pedidos" className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {titulo} <span className="ml-1 text-sm font-medium text-slate-400">{filtrados.length.toLocaleString('pt-BR')}</span>
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
                </div>
                {filtro !== 'ativos' && (
                  <button type="button" onClick={() => mudarFiltro('ativos')} className="inline-flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                    <X className="h-3.5 w-3.5" /> Limpar filtro
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA) }}
                    placeholder="Buscar por paciente, dentista ou peça"
                    aria-label="Buscar pedidos"
                    className={`${campoClasse} pl-10 pr-9`}
                  />
                  {busca && (
                    <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {labs.length > 1 && (
                  <select aria-label="Filtrar por laboratório" value={labFiltro} onChange={(e) => { setLabFiltro(e.target.value); setLimite(POR_PAGINA) }} className={`${campoClasse} sm:w-56`}>
                    <option value="">Todos os laboratórios</option>
                    {labs.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                )}
              </div>
            </div>

            {filtrados.length === 0 ? (
              <EmptyState
                variant="card"
                icon={ClipboardList}
                title={comFiltroExtra ? 'Nenhum pedido encontrado' : 'Nenhum pedido por aqui'}
                description={comFiltroExtra ? 'Tente outro nome ou limpe os filtros.' : 'Quando você enviar uma peça ao laboratório, ela aparece nesta lista.'}
                action={comFiltroExtra ? (
                  <button type="button" onClick={() => { setBusca(''); setLabFiltro('') }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">Limpar busca</button>
                ) : (
                  <button type="button" onClick={novoPedido} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"><Plus className="h-4 w-4" />Novo pedido</button>
                )}
              />
            ) : (
              <>
                <div className="space-y-3">
                  {visiveis.map((pedido) => (
                    <PedidoCard
                      key={pedido.id}
                      pedido={pedido}
                      ocupado={isPending && movendoId === pedido.id}
                      onMover={mover}
                      onEditar={(p) => { setPedidoEditando(p); setShowModal(true) }}
                      onRetrabalho={setRetrabalhoId}
                      onDesfazerRetrabalho={(id) => executar(() => desmarcarRetrabalho(id), 'Marcação de retrabalho removida.')}
                    />
                  ))}
                </div>
                {filtrados.length > visiveis.length && (
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mostrando {visiveis.length} de {filtrados.length.toLocaleString('pt-BR')}</p>
                    <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-white/10">
                      Mostrar mais
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Laboratórios parceiros</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{labs.length === 0 ? 'Nenhum cadastrado' : `${labs.length} ${labs.length === 1 ? 'cadastrado' : 'cadastrados'}`}</p>
                </div>
                <button type="button" onClick={() => setShowModalLab(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
                  <Building2 className="h-4 w-4" /> Novo
                </button>
              </div>
            </div>

            <PainelLaboratorios pedidos={pedidos} />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Como o pedido anda</h2>
              <ol className="mt-3 space-y-3">
                {ETAPAS.map((etapa) => {
                  const Icone = etapa.icone
                  return (
                    <li key={etapa.situacao} className="flex gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${etapa.icone_bg}`}><Icone className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{etapa.rotulo}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{etapa.explicacao}</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </aside>
        </div>
      </main>

      {showModal && (
        <ModalPedido
          labs={labs}
          pedidoEdicao={pedidoEditando}
          onClose={() => { setShowModal(false); setPedidoEditando(undefined) }}
          onSave={salvarPedido}
          isPending={isPending}
        />
      )}
      {showModalLab && <ModalLaboratorio onClose={() => setShowModalLab(false)} onSave={salvarLab} isPending={isPending} />}
      <ReasonModal
        isOpen={retrabalhoId !== null}
        onClose={() => setRetrabalhoId(null)}
        onConfirm={confirmarRetrabalho}
        title="Registrar retrabalho"
        description="A justificativa ficará vinculada ao pedido"
        label="Motivo do retrabalho"
        placeholder="Descreva o problema encontrado e o ajuste necessário."
        confirmLabel="Registrar retrabalho"
        loading={isPending}
      />
    </DashboardLayout>
  )
}
