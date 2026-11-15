'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ClipboardList, Loader2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { campoClasse } from '@/components/labs-externos/campos'
import { FILA_POR_ID } from '@/components/lab-interno/filas'
import { OrdemCard, ordemAtrasada } from '@/components/lab-interno/ordem-card'
import { PainelGestao } from '@/components/lab-interno/painel-gestao'
import { PipelineFila, type FiltroOrdens } from '@/components/lab-interno/pipeline-fila'
import { FilaTriagemWhatsapp } from '@/components/lab-interno/fila-triagem-whatsapp'
import { ConfirmarRetornoModal } from '@/components/producao/confirmar-retorno-modal'
import type { FilaProducao, OrdemProducao } from '@/components/producao/types'
import { hojeIso } from '@/lib/labs-externos-utils'
import type { OrdemFinalizada } from '@/lib/lab-interno-utils'
import { filaDaOrdem, ordenarOrdensOperacionais } from '@/lib/producao-utils'
import type { ItemTriagemWhatsappOs } from '@/lib/triagem-whatsapp-os'
import {
  concluirEtapaLaboratorial,
  confirmarRecebimentoFornecedor,
  iniciarFluxoNoLaboratorio,
} from '@/actions/workflow-protese'
import { reportarProblemaTecnicoOrdem } from '@/actions/notificacoes'

interface Props {
  ordens: OrdemProducao[]
  historico: OrdemFinalizada[]
  triagem?: ItemTriagemWhatsappOs[]
}

const POR_PAGINA = 20
const PRIORIDADES = ['Urgente', 'Alta', 'Normal', 'Baixa']

const TITULOS: Record<Exclude<FiltroOrdens, FilaProducao>, { titulo: string; descricao: string }> = {
  todas: { titulo: 'Todos os trabalhos em andamento', descricao: 'Tudo o que está em produção, dos mais urgentes para os menos.' },
  atrasadas: { titulo: 'Prazo vencido', descricao: 'Trabalhos com o laboratório ou com fornecedor e o prazo da etapa vencido.' },
  retornos: { titulo: 'Retornos da clínica', descricao: 'A clínica já respondeu a prova; confirme o retorno para iniciar novo ciclo de 10 dias.' },
}

export function LabInternoView({ ordens, historico, triagem = [] }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<FiltroOrdens>('laboratorio')
  const [busca, setBusca] = useState('')
  const [prioridade, setPrioridade] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [processandoId, setProcessandoId] = useState<number | null>(null)
  const [ordemRetornoModal, setOrdemRetornoModal] = useState<OrdemProducao | null>(null)
  const [ordemProblemaModal, setOrdemProblemaModal] = useState<OrdemProducao | null>(null)
  const [motivoProblema, setMotivoProblema] = useState('')
  const [isPending, startTransition] = useTransition()
  const hoje = hojeIso()

  const ordenadas = useMemo(() => ordenarOrdensOperacionais(ordens), [ordens])

  const { contagens, atrasadas, retornos, noLaboratorio } = useMemo(() => {
    const cont: Record<FilaProducao, number> = { laboratorio: 0, clinica: 0, fornecedor: 0, sem_etapa: 0 }
    for (const ordem of ordens) cont[filaDaOrdem(ordem)] += 1
    return {
      contagens: cont,
      atrasadas: ordens.filter((o) => ordemAtrasada(o, hoje)).length,
      retornos: ordens.filter((o) => o.cicloDentistaDeci).length,
      noLaboratorio: ordens.filter((o) => filaDaOrdem(o) === 'laboratorio'),
    }
  }, [ordens, hoje])

  const filtradas = useMemo(() => {
    let lista = ordenadas
    if (filtro === 'atrasadas') lista = lista.filter((o) => ordemAtrasada(o, hoje))
    else if (filtro === 'retornos') lista = lista.filter((o) => o.cicloDentistaDeci)
    else if (filtro !== 'todas') lista = lista.filter((o) => filaDaOrdem(o) === filtro)
    if (prioridade) lista = lista.filter((o) => o.prioridade === prioridade)
    const termo = busca.trim().toLowerCase()
    if (!termo) return lista
    return lista.filter((o) =>
      o.paciente.toLowerCase().includes(termo) ||
      o.dentista.toLowerCase().includes(termo) ||
      o.servico.toLowerCase().includes(termo) ||
      String(o.id) === termo.replace('#', ''))
  }, [ordenadas, filtro, busca, prioridade, hoje])

  const info = filtro in FILA_POR_ID
    ? { titulo: FILA_POR_ID[filtro as FilaProducao].rotulo, descricao: FILA_POR_ID[filtro as FilaProducao].explicacao }
    : TITULOS[filtro as keyof typeof TITULOS]
  const visiveis = filtradas.slice(0, limite)
  const comFiltroExtra = Boolean(busca.trim() || prioridade)

  function mudarFiltro(novo: FiltroOrdens) {
    setFiltro(novo)
    setLimite(POR_PAGINA)
  }

  function handleConcluirEtapa(ordem: OrdemProducao) {
    setProcessandoId(ordem.id)
    startTransition(async () => {
      const res = await concluirEtapaLaboratorial(ordem.id)
      setProcessandoId(null)
      if (res.success) {
        toast.success(`Etapa concluída! Próximo passo: ${res.proximo}`)
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível concluir a etapa.')
      }
    })
  }

  function handleIniciarFluxo(ordem: OrdemProducao) {
    setProcessandoId(ordem.id)
    startTransition(async () => {
      const res = await iniciarFluxoNoLaboratorio(ordem.id)
      setProcessandoId(null)
      if (res.success) {
        toast.success(`Trabalho iniciado na bancada (${res.etapa})!`)
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível iniciar o trabalho.')
      }
    })
  }

  function handleReceberFornecedor(ordem: OrdemProducao) {
    setProcessandoId(ordem.id)
    startTransition(async () => {
      const res = await confirmarRecebimentoFornecedor(ordem.id)
      setProcessandoId(null)
      if (res.success) {
        toast.success(`Peça recebida do fornecedor! Próxima etapa: ${res.proximo}`)
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível registrar o recebimento.')
      }
    })
  }

  function handleEnviarProblema(e: React.FormEvent) {
    e.preventDefault()
    if (!ordemProblemaModal || !motivoProblema.trim()) return
    const alvo = ordemProblemaModal
    setProcessandoId(alvo.id)
    startTransition(async () => {
      const res = await reportarProblemaTecnicoOrdem(alvo.id, motivoProblema)
      setProcessandoId(null)
      if (res.success) {
        toast.success('Problema registrado na OS e alerta enviado para Dentista e Recepção!')
        setOrdemProblemaModal(null)
        setMotivoProblema('')
        router.refresh()
      } else {
        toast.error(res.error || 'Erro ao reportar problema.')
      }
    })
  }

  return (
    <DashboardLayout>
      <Header title="Laboratório interno" subtitle="Bancada operacional, prazos de retorno (10 dias) e triagem inteligente" />

      <ConfirmarRetornoModal
        isOpen={ordemRetornoModal !== null}
        onClose={() => {
          setOrdemRetornoModal(null)
          router.refresh()
        }}
        cicloId={ordemRetornoModal?.cicloAtivoId ?? 0}
        paciente={ordemRetornoModal?.paciente ?? ''}
        decisaoDentista={ordemRetornoModal?.cicloDentistaDeci}
        observacoesDentista={ordemRetornoModal?.cicloObs}
        fotosProva={ordemRetornoModal?.cicloFotos}
      />

      <Modal
        isOpen={ordemProblemaModal !== null}
        onClose={() => {
          setOrdemProblemaModal(null)
          setMotivoProblema('')
        }}
        title={ordemProblemaModal ? `Reportar Problema Técnico — OS #${ordemProblemaModal.id}` : 'Reportar Problema'}
        description={ordemProblemaModal ? `${ordemProblemaModal.paciente} • ${ordemProblemaModal.dentista}` : ''}
      >
        <form onSubmit={handleEnviarProblema} className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Ao confirmar, o problema fica gravado no histórico e no chat da OS, e o sistema dispara imediatamente um WhatsApp para o dentista e para a recepção.
            </span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              O que aconteceu com a peça, moldagem ou escaneamento?
            </label>
            <textarea
              rows={3}
              required
              value={motivoProblema}
              onChange={(e) => setMotivoProblema(e.target.value)}
              placeholder="Ex: Distorção na moldagem do implante 14 / Escaneamento sem registro de mordida..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOrdemProblemaModal(null)
                setMotivoProblema('')
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !motivoProblema.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <AlertTriangle className="h-4 w-4 mr-1.5" />}
              Avisar Dentista e Recepção
            </Button>
          </div>
        </form>
      </Modal>

      <main className="space-y-6 p-4 sm:p-6">
        <FilaTriagemWhatsapp itensIniciais={triagem} />

        <PipelineFila filtro={filtro} contagens={contagens} atrasadas={atrasadas} retornos={retornos} onChange={mudarFiltro} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Lista de trabalhos" className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {info.titulo} <span className="ml-1 text-sm font-medium text-slate-400">{filtradas.length.toLocaleString('pt-BR')}</span>
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{info.descricao}</p>
                </div>
                {filtro !== 'todas' && (
                  <button type="button" onClick={() => mudarFiltro('todas')} className="inline-flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-300">
                    <X className="h-3.5 w-3.5" /> Ver todos
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA) }}
                    placeholder="Buscar por paciente, dentista, serviço ou nº da ordem"
                    aria-label="Buscar trabalhos"
                    className={`${campoClasse} pl-10 pr-9`}
                  />
                  {busca && (
                    <button type="button" aria-label="Limpar busca" onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <select aria-label="Filtrar por prioridade" value={prioridade} onChange={(e) => { setPrioridade(e.target.value); setLimite(POR_PAGINA) }} className={`${campoClasse} sm:w-56`}>
                  <option value="">Todas as prioridades</option>
                  {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {filtradas.length === 0 ? (
              <EmptyState
                variant="card"
                icon={ClipboardList}
                title={comFiltroExtra ? 'Nenhum trabalho encontrado' : 'Nada por aqui'}
                description={comFiltroExtra ? 'Tente outro nome ou limpe os filtros.' : 'Quando houver trabalhos nesta fila, eles aparecem nesta lista.'}
                action={comFiltroExtra ? (
                  <button type="button" onClick={() => { setBusca(''); setPrioridade('') }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">Limpar busca</button>
                ) : (
                  <Link href="/ordens" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Ver ordens</Link>
                )}
              />
            ) : (
              <>
                <div className="space-y-3">
                  {visiveis.map((ordem) => (
                    <OrdemCard
                      key={ordem.id}
                      ordem={ordem}
                      processando={isPending && processandoId === ordem.id}
                      onConcluirEtapa={handleConcluirEtapa}
                      onIniciarNoLab={handleIniciarFluxo}
                      onConfirmarRetorno={(o) => setOrdemRetornoModal(o)}
                      onReceberFornecedor={handleReceberFornecedor}
                      onReportarProblema={(o) => {
                        setOrdemProblemaModal(o)
                        setMotivoProblema('')
                      }}
                    />
                  ))}
                </div>
                {filtradas.length > visiveis.length && (
                  <div className="flex flex-col items-center gap-1 pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mostrando {visiveis.length} de {filtradas.length.toLocaleString('pt-BR')}</p>
                    <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/15 dark:bg-zinc-900 dark:text-slate-200 dark:hover:bg-white/10">Mostrar mais</button>
                  </div>
                )}
              </>
            )}
          </section>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-28 xl:self-start">
            <PainelGestao noLaboratorio={noLaboratorio} historico={historico} />
          </aside>
        </div>
      </main>
    </DashboardLayout>
  )
}

