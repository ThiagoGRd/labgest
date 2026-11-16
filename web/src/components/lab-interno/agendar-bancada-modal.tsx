'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, Flame, Loader2, Plus, Sparkles, Trash2, Tv, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import type { OrdemProducao } from '@/components/producao/types'
import { criarBlocosBancadaTv, type CriarBlocoTvItemInput } from '@/actions/agenda-tv'
import {
  PROTETICOS_BANCADA,
  somarMinutosHora,
  sugerirBlocosEtapa,
  type ModoBlocoTv,
  type ProteticoId,
} from '@/lib/agenda-tv'
import { hojeIso } from '@/lib/labs-externos-utils'
import { etapaLabel } from '@/lib/workflow-config'

interface AgendarBancadaModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  ordem?: OrdemProducao | null
  ordensDisponiveis?: OrdemProducao[]
  proteticoInicial?: ProteticoId
  dataInicial?: string
}

const ETAPAS_COMUNS = [
  'Montagem de dentes',
  'Acrilização',
  'Confecção do plano de orientação',
  'Confecção da moldeira individual',
  'Acabamento e polimento',
  'Execução do conserto',
  'Planejamento digital',
]

export function AgendarBancadaModal({
  isOpen,
  onClose,
  onSuccess,
  ordem = null,
  ordensDisponiveis = [],
  proteticoInicial = 'otavio',
  dataInicial,
}: AgendarBancadaModalProps) {
  const [isPending, startTransition] = useTransition()
  const [ordemSelecionadaId, setOrdemSelecionadaId] = useState<string>(
    ordem ? String(ordem.id) : ordensDisponiveis[0] ? String(ordensDisponiveis[0].id) : '',
  )
  const [protetico, setProtetico] = useState<ProteticoId>(proteticoInicial)
  const [data, setData] = useState<string>(dataInicial || hojeIso())
  const [dividirAcrilizacao, setDividirAcrilizacao] = useState<boolean>(true)
  const [blocos, setBlocos] = useState<CriarBlocoTvItemInput[]>(() => {
    const etapaInicial = ordem?.subetapa || (ordem ? etapaLabel(ordem.etapa) : 'Montagem de dentes')
    return sugerirBlocosEtapa({
      etapaNome: etapaInicial,
      arcadas: ordem?.arcadas ?? 1,
      horaInicioBase: '09:00',
      dividirAcrilizacao: true,
    })
  })

  const ordemAlvo =
    ordem ??
    ordensDisponiveis.find((o) => String(o.id) === ordemSelecionadaId) ??
    null

  function aplicarEtapaRapida(etapaNome: string) {
    const baseInicio = blocos[0]?.horaInicio || '09:00'
    setBlocos(
      sugerirBlocosEtapa({
        etapaNome,
        arcadas: ordemAlvo?.arcadas ?? 1,
        horaInicioBase: baseInicio,
        dividirAcrilizacao,
      }),
    )
  }

  function adicionarBlocoSequencial(etapaNome?: string) {
    const ultimo = blocos[blocos.length - 1]
    const inicio = ultimo?.horaFim || '09:00'
    const novos = sugerirBlocosEtapa({
      etapaNome: etapaNome || 'Acrilização',
      arcadas: ordemAlvo?.arcadas ?? 1,
      horaInicioBase: inicio,
      dividirAcrilizacao,
    })
    setBlocos((prev) => [...prev, ...novos])
  }

  function atualizarBloco(idx: number, patch: Partial<CriarBlocoTvItemInput>) {
    setBlocos((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }

  function removerBloco(idx: number) {
    setBlocos((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await criarBlocosBancadaTv({
        ordemId: ordemAlvo ? ordemAlvo.id : null,
        protetico,
        data,
        blocos,
      })

      if (res.success) {
        const nomeProtetico = protetico === 'otavio' ? 'Tavá' : 'Napoleão'
        toast.success(`${blocos.length} bloco(s) agendado(s) na TV do ${nomeProtetico}!`)
        onSuccess?.()
        onClose()
      } else {
        toast.error(res.error || 'Não foi possível agendar na TV.')
      }
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Programar Agenda da TV (Bancada)"
      description={
        ordemAlvo
          ? `OS #${ordemAlvo.id} · ${ordemAlvo.paciente}${ordemAlvo.cor ? ` · Cor ${ordemAlvo.cor}` : ''}`
          : 'Selecione o trabalho, o protético e os horários do dia'
      }
      size="lg"
    >
      <form onSubmit={handleSalvar} className="space-y-4">
        {!ordem && ordensDisponiveis.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Ordem de Serviço (OS)
            </label>
            <select
              value={ordemSelecionadaId}
              onChange={(e) => setOrdemSelecionadaId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              {ordensDisponiveis.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} — {o.paciente} ({o.subetapa || o.servico})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              TV / Protético responsável
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PROTETICOS_BANCADA.map((p) => {
                const ativo = protetico === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setProtetico(p.id)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all ${
                      ativo
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-600 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-bold">
                      <Tv className="h-3.5 w-3.5" /> {p.nome}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[11px] opacity-75">{p.especialidade}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700 dark:text-slate-300">
              Data na agenda da TV
            </label>
            <input
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={dividirAcrilizacao}
                onChange={(e) => setDividirAcrilizacao(e.target.checked)}
                className="rounded border-slate-300 accent-indigo-600"
              />
              <span>
                Dividir Acrilização (Inclusão 35m → Panela 75m livre → Acabamento 35m)
              </span>
            </label>
          </div>
        </div>

        {/* Atalhos de etapas */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Atalhos de sequência (1 clique)
            </span>
            <button
              type="button"
              onClick={() => {
                const inicio = blocos[0]?.horaInicio || '09:00'
                const fimMontagem = somarMinutosHora(inicio, 60)
                const acril = sugerirBlocosEtapa({
                  etapaNome: 'Acrilização',
                  horaInicioBase: fimMontagem,
                  dividirAcrilizacao,
                })
                setBlocos([
                  {
                    horaInicio: inicio,
                    horaFim: fimMontagem,
                    etapaNome: 'Montagem de dentes',
                    modo: 'bancada',
                    observacao: null,
                  },
                  ...acril,
                ])
              }}
              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-500"
            >
              Montagem + Acrilização em sequência
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ETAPAS_COMUNS.map((etapa) => (
              <button
                key={etapa}
                type="button"
                onClick={() => aplicarEtapaRapida(etapa)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {etapa}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Blocos */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {blocos.map((bloco, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <CalendarClock className="h-3.5 w-3.5 text-indigo-500" />
                  Bloco {idx + 1}
                </span>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                    {(['bancada', 'maquina'] as ModoBlocoTv[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => atualizarBloco(idx, { modo: m })}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold ${
                          bloco.modo === m
                            ? m === 'maquina'
                              ? 'bg-amber-500 text-white'
                              : 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {m === 'maquina' ? <Flame className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
                        {m === 'maquina' ? 'Máquina / Panela' : 'Mão na Bancada'}
                      </button>
                    ))}
                  </div>
                  {blocos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removerBloco(idx)}
                      aria-label="Remover bloco"
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_7rem_7rem]">
                <input
                  type="text"
                  required
                  value={bloco.etapaNome}
                  onChange={(e) => atualizarBloco(idx, { etapaNome: e.target.value })}
                  placeholder="Ex: Montagem de dentes"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="time"
                  required
                  value={bloco.horaInicio}
                  onChange={(e) => atualizarBloco(idx, { horaInicio: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="time"
                  required
                  value={bloco.horaFim}
                  onChange={(e) => atualizarBloco(idx, { horaFim: e.target.value })}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-mono font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {bloco.modo === 'maquina' && (
                <input
                  type="text"
                  value={bloco.equipamento || ''}
                  onChange={(e) => atualizarBloco(idx, { equipamento: e.target.value })}
                  placeholder="Equipamento (ex: Panela Térmica 1, Forno Cerâmico)"
                  className="w-full rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={() => adicionarBlocoSequencial('Acrilização')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar etapa seguinte (ex: Acrilização)
          </button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Tv className="mr-1.5 h-4 w-4" />}
              Enviar para TV
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
