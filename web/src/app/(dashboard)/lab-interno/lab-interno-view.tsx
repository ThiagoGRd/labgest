'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ClipboardList, Info, Loader2, RefreshCw, Search, Sparkles, X } from 'lucide-react'
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
import { AtencaoProducao } from '@/app/(dashboard)/producao/atencao-producao'
import { ConfirmarRetornoModal } from '@/components/producao/confirmar-retorno-modal'
import { DefinirEtapaFluxoModal } from '@/components/producao/definir-etapa-fluxo-modal'
import { VisualizarOrdemModal } from '@/components/ordens/visualizar-ordem-modal'
import type { FilaProducao, OrdemProducao } from '@/components/producao/types'
import { contextoAtencao, limparAtencao, type RetornoDashboard } from '@/lib/dashboard-attention'
import { hojeIso } from '@/lib/labs-externos-utils'
import type { OrdemFinalizada } from '@/lib/lab-interno-utils'
import { filaDaOrdem, ordenarOrdensOperacionais } from '@/lib/producao-utils'
import type { ItemTriagemWhatsappOs } from '@/lib/triagem-whatsapp-os'
import {
  aplicarEtapaClinicorpNaOrdem,
  sincronizarEtapasClinicorpLab,
} from '@/actions/lab-interno'
import { getOrdemById } from '@/actions/ordens'
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
  semEtapaIds?: number[]
  retornosDashboard?: RetornoDashboard[]
  clinicorpConfigurado?: boolean
  ultimaSincronizacao?: {
    em: string
    sucesso: boolean
    erro: string | null
    consultas: number
  } | null
}

type OrdemDetalhada = NonNullable<Awaited<ReturnType<typeof getOrdemById>>>

const POR_PAGINA = 20
const PRIORIDADES = ['Urgente', 'Alta', 'Normal', 'Baixa']

const TITULOS: Record<Exclude<FiltroOrdens, FilaProducao>, { titulo: string; descricao: string }> = {
  todas: { titulo: 'Todos os trabalhos em andamento', descricao: 'Tudo o que está em produção, dos mais urgentes para os menos.' },
  atrasadas: { titulo: 'Prazo vencido', descricao: 'Trabalhos com o laboratório ou com fornecedor e o prazo da etapa vencido.' },
  retornos: { titulo: 'Retornos da clínica', descricao: 'A clínica já respondeu a prova; confirme o retorno para iniciar novo ciclo de 10 dias.' },
}

function formatarSincronizacao(iso?: string | null) {
  if (!iso) return 'Ainda não sincronizado'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Maceio',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function LabInternoView({
  ordens,
  historico,
  triagem = [],
  semEtapaIds = [],
  retornosDashboard = [],
  clinicorpConfigurado = false,
  ultimaSincronizacao = null,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const contexto = contextoAtencao(searchParams.get('atencao'), 'lab-interno')
  const [filtro, setFiltro] = useState<FiltroOrdens>('laboratorio')
  const [busca, setBusca] = useState('')
  const [prioridade, setPrioridade] = useState('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [processandoId, setProcessandoId] = useState<number | null>(null)
  const [sincronizandoClinicorp, setSincronizandoClinicorp] = useState(false)
  const [ordemRetornoModal, setOrdemRetornoModal] = useState<OrdemProducao | null>(null)
  const [ordemEtapaModal, setOrdemEtapaModal] = useState<OrdemProducao | null>(null)
  const [ordemVisualizar, setOrdemVisualizar] = useState<OrdemDetalhada | null>(null)
  const [ordemProblemaModal, setOrdemProblemaModal] = useState<OrdemProducao | null>(null)
  const [motivoProblema, setMotivoProblema] = useState('')
  const [isPending, startTransition] = useTransition()
  const hoje = hojeIso()

  const ordenadas = useMemo(() => ordenarOrdensOperacionais(ordens), [ordens])

  const { contagens, atrasadas, retornos, noLaboratorio, divergenciasClinicorp } = useMemo(() => {
    const cont: Record<FilaProducao, number> = { laboratorio: 0, clinica: 0, fornecedor: 0, sem_etapa: 0 }
    for (const ordem of ordens) cont[filaDaOrdem(ordem)] += 1
    return {
      contagens: cont,
      atrasadas: ordens.filter((o) => ordemAtrasada(o, hoje)).length,
      retornos: ordens.filter((o) => o.cicloDentistaDeci).length,
      noLaboratorio: ordens.filter((o) => filaDaOrdem(o) === 'laboratorio'),
      divergenciasClinicorp: ordens.filter((o) => o.clinicorpEtapa?.divergente).length,
    }
  }, [ordens, hoje])

  const semEtapaOrdens = useMemo(
    () => ordens.filter((o) => semEtapaIds.includes(o.id)),
    [ordens, semEtapaIds],
  )

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

  async function abrirOrdemDetalhes(ordemId: number) {
    try {
      const dados = await getOrdemById(ordemId)
      if (!dados) {
        toast.error('Ordem não encontrada.')
        return
      }
      setOrdemVisualizar(dados)
    } catch {
      toast.error('Não foi possível abrir os detalhes da OS.')
    }
  }

  function handleSincronizarClinicorp() {
    setSincronizandoClinicorp(true)
    startTransition(async () => {
      const res = await sincronizarEtapasClinicorpLab()
      setSincronizandoClinicorp(false)
      if (res.sucesso) {
        const atualizadas = res.etapasAtualizadas ?? 0
        toast.success(
          atualizadas > 0
            ? `Clinicorp sincronizado! ${res.consultas} consultas e ${atualizadas} etapa(s) avançada(s).`
            : `Clinicorp sincronizado (${res.consultas} consultas avaliadas).`,
        )
        router.refresh()
      } else {
        toast.error(res.erro || 'Não foi possível sincronizar com o Clinicorp.')
      }
    })
  }

  function handleAplicarClinicorp(ordem: OrdemProducao) {
    setProcessandoId(ordem.id)
    startTransition(async () => {
      const res = await aplicarEtapaClinicorpNaOrdem(ordem.id)
      setProcessandoId(null)
      if (res.success) {
        toast.success(`OS #${ordem.id} atualizada para: ${res.etapa}`)
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível aplicar a etapa.')
      }
    })
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
      <Header
        title="Bancada do Laboratório"
        subtitle="Etapas unificadas, prazos de bancada (10 dias) e sincronização com consultas do Clinicorp"
      />

      <VisualizarOrdemModal
        isOpen={Boolean(ordemVisualizar)}
        onClose={() => setOrdemVisualizar(null)}
        ordem={ordemVisualizar}
      />

      {ordemEtapaModal && (
        <DefinirEtapaFluxoModal
          ordem={ordemEtapaModal}
          onClose={() => setOrdemEtapaModal(null)}
          onSuccess={() => {
            setOrdemEtapaModal(null)
            toast.success('Etapa da OS atualizada!')
            router.refresh()
          }}
        />
      )}

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
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
        {/* Barra de Sincronização Automática Clinicorp */}
        <section aria-label="Sincronização de etapas com o Clinicorp" className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Etapas sincronizadas pelo Clinicorp
                </h2>
                {divergenciasClinicorp > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {divergenciasClinicorp} sugestão(ões) da agenda
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Última atualização: {formatarSincronizacao(ultimaSincronizacao?.em)}
                {ultimaSincronizacao && ` · ${ultimaSincronizacao.consultas} consultas avaliadas`}
                <span
                  title="A API do Clinicorp disponibiliza categoria, observações da consulta e comparecimentos — não expõe evolução livre de prontuário clínico."
                  className="ml-1.5 inline-flex items-center gap-1 text-slate-400"
                >
                  <Info className="h-3 w-3" /> Baseado em categoria, observações e comparecimentos da agenda
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={!clinicorpConfigurado || sincronizandoClinicorp || isPending}
              onClick={handleSincronizarClinicorp}
              className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              {sincronizandoClinicorp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {clinicorpConfigurado ? 'Sincronizar Clinicorp & Etapas' : 'Clinicorp não configurado'}
            </Button>
          </div>
        </section>

        {contexto && (
          <AtencaoProducao
            contexto={contexto}
            ordens={contexto === 'sem-etapa' ? semEtapaOrdens : ordens}
            retornos={retornosDashboard}
            onLimpar={() => router.push(limparAtencao(pathname, searchParams.toString()))}
            onAbrir={abrirOrdemDetalhes}
            onDefinir={(ordem) => setOrdemEtapaModal(ordem)}
            onConfirmar={(ordem) => setOrdemRetornoModal(ordem)}
          />
        )}

        <FilaTriagemWhatsapp itensIniciais={triagem} />

        <PipelineFila filtro={filtro} contagens={contagens} atrasadas={atrasadas} retornos={retornos} onChange={mudarFiltro} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Lista de trabalhos" className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {info.titulo} <span className="ml-1 text-sm font-medium text-slate-400 tabular-nums">{filtradas.length.toLocaleString('pt-BR')}</span>
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{info.descricao}</p>
                </div>
                {filtro !== 'todas' && (
                  <button type="button" onClick={() => mudarFiltro('todas')} className="inline-flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
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
                  <button type="button" onClick={() => { setBusca(''); setPrioridade('') }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Limpar busca</button>
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
                      onDefinirEtapa={(o) => setOrdemEtapaModal(o)}
                      onAplicarClinicorp={handleAplicarClinicorp}
                      onAbrirOs={abrirOrdemDetalhes}
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
                    <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)} className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Mostrar mais</button>
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
