'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import {
  Brain,
  Flame,
  Gauge,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Tv,
} from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { executarAgendaAutomaticaIa, type ResultadoMotorAgendaIa } from '@/actions/agenda-tv'
import { hojeIso, somarDias } from '@/lib/labs-externos-utils'

interface MotorAgendaIaModalProps {
  isOpen: boolean
  onClose: () => void
  onApplied?: () => void
  dataInicial?: string
}

export function MotorAgendaIaModal({
  isOpen,
  onClose,
  onApplied,
  dataInicial,
}: MotorAgendaIaModalProps) {
  const hoje = hojeIso()
  const amanha = somarDias(hoje, 1)
  const [dataAlvo, setDataAlvo] = useState<string>(dataInicial || hoje)
  const [modoReotimizacao, setModoReotimizacao] = useState<'preencher_livres' | 'reorganizar_pendentes'>('preencher_livres')
  const [dividirAcrilizacao, setDividirAcrilizacao] = useState<boolean>(true)
  const [simulacao, setSimulacao] = useState<ResultadoMotorAgendaIa | null>(null)
  const [carregandoSimulacao, setCarregandoSimulacao] = useState<boolean>(false)
  const [isPending, startTransition] = useTransition()

  const rodarSimulacao = useCallback(async (alvo: string, modo: 'preencher_livres' | 'reorganizar_pendentes', dividir: boolean) => {
    setCarregandoSimulacao(true)
    try {
      const res = await executarAgendaAutomaticaIa({
        data: alvo,
        modoReotimizacao: modo,
        dividirAcrilizacao: dividir,
        usarGemini: false, // Prévia instantânea; Gemini refina ao confirmar ou ao clicar em Recalcular IA
        aplicar: false,
      })
      setSimulacao(res)
    } catch {
      toast.error('Não foi possível simular a agenda automática.')
    } finally {
      setCarregandoSimulacao(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    void rodarSimulacao(dataAlvo, modoReotimizacao, dividirAcrilizacao)
  }, [isOpen, dataAlvo, modoReotimizacao, dividirAcrilizacao, rodarSimulacao])

  function handleAplicarNaTv() {
    startTransition(async () => {
      try {
        const res = await executarAgendaAutomaticaIa({
          data: dataAlvo,
          modoReotimizacao,
          dividirAcrilizacao,
          usarGemini: true,
          aplicar: true,
        })
        if (res.success) {
          toast.success(
            `Agenda automática aplicada! ${res.plano.resumo.totalBlocos} bloco(s) programado(s) (${res.estrategia.motor === 'gemini' ? 'Gemini + Motor Adaptativo' : 'Motor Adaptativo'}).`,
          )
          onApplied?.()
          onClose()
        } else {
          toast.error(res.error || 'Falha ao aplicar agenda automática.')
        }
      } catch {
        toast.error('Erro ao gerar a agenda automática.')
      }
    })
  }

  const perfis = simulacao?.plano.perfisUsados ?? []
  const blocos = simulacao?.plano.blocos ?? []
  const ordensMap = new Map(
    (simulacao?.plano.ordensAvaliadas ?? []).map((o) => [o.ordem.id, o.ordem]),
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Motor Automático de Agenda (IA + Tempos Reais)"
      description="Prioriza urgências e Clinicorp, impede que ordens normais fiquem presas e aprende o ritmo real do Tavá e do Napoleão."
      size="xl"
    >
      <div className="space-y-4">
        {/* Controles do motor */}
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Dia da Programação
            </label>
            <div className="flex gap-1.5">
              {[
                { iso: hoje, label: 'Hoje' },
                { iso: amanha, label: 'Amanhã' },
              ].map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => setDataAlvo(d.iso)}
                  className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    dataAlvo === d.iso
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {d.label}
                </button>
              ))}
              <input
                type="date"
                value={dataAlvo}
                onChange={(e) => setDataAlvo(e.target.value)}
                className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Estratégia sobre a agenda atual
            </label>
            <select
              value={modoReotimizacao}
              onChange={(e) =>
                setModoReotimizacao(e.target.value as 'preencher_livres' | 'reorganizar_pendentes')
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="preencher_livres">Preencher apenas janelas livres</option>
              <option value="reorganizar_pendentes">Reotimizar blocos pendentes da IA</option>
            </select>
          </div>

          <div className="flex flex-col justify-between">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Produtividade de Bancada
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={dividirAcrilizacao}
                onChange={(e) => setDividirAcrilizacao(e.target.checked)}
                className="accent-indigo-600"
              />
              Separar Panela Térmica (liberar bancada)
            </label>
          </div>
        </div>

        {/* Diagnóstico da IA + Tempos Aprendidos */}
        {carregandoSimulacao ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-10 text-sm text-slate-500 dark:border-slate-700">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            Analisando urgências, fila anti-pendência e histórico real de execução...
          </div>
        ) : simulacao ? (
          <>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
              <div className="flex items-start gap-2.5">
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                <div className="space-y-1">
                  <p className="font-bold">Resumo da Inteligência para {dataAlvo.split('-').reverse().join('/')}</p>
                  <p className="leading-relaxed opacity-90">{simulacao.estrategia.briefingTurno}</p>
                </div>
              </div>
            </div>

            {/* Aprendizado real de tempos (Tavá & Napoleão) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <Gauge className="h-3.5 w-3.5 text-emerald-600" />
                  Aprendizado Real de Tempo por Procedimento (EMA Adaptativa)
                </span>
                <span className="text-[11px] text-slate-500">
                  {perfis.length > 0
                    ? `${perfis.length} procedimento(s) calibrado(s)`
                    : 'Usando tempos-base padrão até registrar conclusões'}
                </span>
              </div>

              {perfis.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {perfis.slice(0, 6).map((p) => (
                    <div
                      key={`${p.protetico}-${p.categoria}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800 dark:text-slate-200">
                          {p.protetico === 'otavio' ? 'Tavá' : 'Napoleão'} · {p.categoriaLabel}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Base {p.tempoBaseMin}m → <strong>{p.duracaoSugeridaMin}m</strong> ({p.amostras}x)
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          p.tendencia === 'diminuiu'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : p.tendencia === 'estendeu'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {p.tendencia === 'diminuiu' ? (
                          <>
                            <TrendingDown className="h-3 w-3" /> {p.desvioMin}m
                          </>
                        ) : p.tendencia === 'estendeu' ? (
                          <>
                            <TrendingUp className="h-3 w-3" /> +{p.desvioMin}m
                          </>
                        ) : (
                          'Estável'
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Conforme Tavá e Napoleão iniciarem e concluírem blocos na TV/Bancada, o motor recalibra automaticamente se cada procedimento diminuiu ou estendeu o prazo.
                </p>
              )}
            </div>

            {/* Prévia dos blocos gerados para Tavá e Napoleão */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(['otavio', 'napoleao'] as const).map((protId) => {
                const lista = blocos.filter((b) => b.protetico === protId)
                const nome = protId === 'otavio' ? 'Tavá' : 'Napoleão'
                return (
                  <div
                    key={protId}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                        <Tv className="h-3.5 w-3.5 text-indigo-600" /> Prévia — {nome}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {lista.length} bloco(s)
                      </span>
                    </div>

                    {lista.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400 dark:border-slate-800">
                        Sem novos encaixes disponíveis nesta data.
                      </p>
                    ) : (
                      <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                        {lista.map((b, i) => {
                          const ord = ordensMap.get(b.ordemId)
                          const urgente = b.faixaUrgencia === 'critica' || b.faixaUrgencia === 'urgente'
                          return (
                            <div
                              key={`${b.ordemId}-${b.horaInicio}-${i}`}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/60"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  {b.horaInicio}–{b.horaFim} ({b.duracaoPlanejadaMin}m)
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                    b.modo === 'maquina'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                      : urgente
                                        ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                                        : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                                  }`}
                                >
                                  {b.modo === 'maquina' ? (
                                    <>
                                      <Flame className="h-2.5 w-2.5" /> Panela
                                    </>
                                  ) : urgente ? (
                                    'Urgente'
                                  ) : (
                                    'Fila justa'
                                  )}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate font-semibold text-slate-800 dark:text-slate-200">
                                {ord?.paciente ?? `OS #${b.ordemId}`} · {b.etapaNome}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                                {b.motivoIa}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {simulacao.plano.ordensNaoAlocadas.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <strong>Ficaram na fila para o próximo turno:</strong>{' '}
                {simulacao.plano.ordensNaoAlocadas
                  .slice(0, 4)
                  .map((n) => `${n.paciente} (#${n.ordemId})`)
                  .join(', ')}
                {simulacao.plano.ordensNaoAlocadas.length > 4
                  ? ` e mais ${simulacao.plano.ordensNaoAlocadas.length - 4}`
                  : ''}
                .
              </div>
            )}
          </>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            disabled={carregandoSimulacao || isPending}
            onClick={() => void rodarSimulacao(dataAlvo, modoReotimizacao, dividirAcrilizacao)}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${carregandoSimulacao ? 'animate-spin' : ''}`} />
            Simular novamente
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={isPending || carregandoSimulacao || blocos.length === 0}
              onClick={handleAplicarNaTv}
              className="gap-1.5 bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Aplicar {blocos.length} bloco(s) nas TVs
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
