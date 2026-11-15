'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  FileCode2,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  aprovarTriagemGerarOrdem,
  descartarTriagemWhatsapp,
  registrarMensagemGrupoWhatsappManual,
} from '@/actions/triagem-whatsapp'
import type { ItemTriagemWhatsappOs } from '@/lib/triagem-whatsapp-os'

interface FilaTriagemWhatsappProps {
  itensIniciais: ItemTriagemWhatsappOs[]
}

export function FilaTriagemWhatsapp({ itensIniciais }: FilaTriagemWhatsappProps) {
  const router = useRouter()
  const [itens, setItens] = useState<ItemTriagemWhatsappOs[]>(itensIniciais)
  const [mostrarCapturaManual, setMostrarCapturaManual] = useState(false)
  const [textoManual, setTextoManual] = useState('')
  const [stlManual, setStlManual] = useState('')
  const [processandoId, setProcessandoId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [edicoes, setEdicoes] = useState<Record<number, { paciente: string; dentista: string; servico: string; cor: string }>>({})

  function obterEdicao(item: ItemTriagemWhatsappOs) {
    return edicoes[item.id] ?? {
      paciente: item.pacienteSugerido || item.pacienteExtraido,
      dentista: item.dentistaSugerido,
      servico: item.servicoSugerido,
      cor: item.corSugerida,
    }
  }

  function atualizarCampo(
    item: ItemTriagemWhatsappOs,
    campo: 'paciente' | 'dentista' | 'servico' | 'cor',
    valor: string,
  ) {
    const atual = obterEdicao(item)
    setEdicoes((prev) => ({
      ...prev,
      [item.id]: { ...atual, [campo]: valor },
    }))
  }

  function handleCapturarManual(e: React.FormEvent) {
    e.preventDefault()
    if (!textoManual.trim() && !stlManual.trim()) return
    startTransition(async () => {
      const res = await registrarMensagemGrupoWhatsappManual({
        texto: textoManual,
        arquivoStlUrl: stlManual,
      })
      if (res.success && res.item) {
        setItens((prev) => [res.item!, ...prev])
        setTextoManual('')
        setStlManual('')
        setMostrarCapturaManual(false)
        toast.success('Mensagem/STL analisado e conciliado com a agenda do Clinicorp!')
        router.refresh()
      } else {
        toast.error(res.error || 'Não foi possível processar a mensagem.')
      }
    })
  }

  function handleAprovar(item: ItemTriagemWhatsappOs) {
    const editado = obterEdicao(item)
    setProcessandoId(item.id)
    startTransition(async () => {
      const res = await aprovarTriagemGerarOrdem(item.id, {
        paciente: editado.paciente,
        dentista: editado.dentista,
        servico: editado.servico,
        corDentes: editado.cor,
        elementos: item.elementosSugeridos,
      })
      setProcessandoId(null)
      if (res.success) {
        setItens((prev) => prev.filter((i) => i.id !== item.id))
        toast.success(`OS #${res.ordemId} gerada na bancada para ${res.paciente}!`)
        router.refresh()
      } else {
        toast.error(res.error || 'Erro ao gerar OS.')
      }
    })
  }

  function handleDescartar(id: number) {
    setProcessandoId(id)
    startTransition(async () => {
      const res = await descartarTriagemWhatsapp(id)
      setProcessandoId(null)
      if (res.success) {
        setItens((prev) => prev.filter((i) => i.id !== id))
        toast.success('Item removido da triagem.')
        router.refresh()
      }
    })
  }

  return (
    <section
      aria-label="Triagem do Grupo de WhatsApp (OS + STL + Clinicorp)"
      className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-white to-indigo-50/50 p-4 shadow-sm dark:border-emerald-500/20 dark:from-emerald-950/20 dark:via-zinc-900 dark:to-indigo-950/20"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Triagem Automática do Grupo WhatsApp (OS + .STL + Clinicorp)
              </h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                {itens.length} pendente{itens.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Conciliação fonética automática de nomes digitados errados no grupo com a agenda do Clinicorp.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMostrarCapturaManual((v) => !v)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-zinc-900 dark:text-emerald-200"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          {mostrarCapturaManual ? 'Fechar captura' : 'Colar OS / .STL do Grupo'}
        </button>
      </div>

      {mostrarCapturaManual && (
        <form onSubmit={handleCapturarManual} className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:border-white/10 dark:bg-zinc-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mensagem enviada no grupo de WhatsApp
              </label>
              <textarea
                rows={2}
                value={textoManual}
                onChange={(e) => setTextoManual(e.target.value)}
                placeholder="Ex: Paciente: Tais de Souza - Dra. Carla - Protocolo Superior Cor A2"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nome ou Link do Arquivo .STL (Opcional)
              </label>
              <input
                type="text"
                value={stlManual}
                onChange={(e) => setStlManual(e.target.value)}
                placeholder="Ex: uploads/Tais_Souza_Protocolo_A2.stl"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                O sistema corrige automaticamente erros de grafia comparando com os pacientes agendados no Clinicorp.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarCapturaManual(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Analisar e Conciliar com Clinicorp
            </button>
          </div>
        </form>
      )}

      {itens.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {itens.map((item) => {
            const editado = obterEdicao(item)
            const nomeCorrigido =
              item.scoreConciliacao >= 70 &&
              item.pacienteSugerido.toLowerCase() !== item.pacienteExtraido.toLowerCase()

            return (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-white/10 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        item.scoreConciliacao >= 80
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {item.motivoConciliacao}
                    </span>

                    {nomeCorrigido && (
                      <span className="text-xs text-slate-500">
                        Digitado no grupo: <del className="text-red-500">{item.pacienteExtraido}</del> →{' '}
                        <strong className="text-emerald-700 dark:text-emerald-300">{item.pacienteSugerido}</strong>
                      </span>
                    )}

                    {item.arquivosStl.map((arq, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200"
                      >
                        <FileCode2 className="h-3 w-3" />
                        {arq.split('/').pop()}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPending && processandoId === item.id}
                      onClick={() => handleAprovar(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {isPending && processandoId === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Aprovar e Gerar OS na Bancada
                    </button>
                    <button
                      type="button"
                      aria-label="Descartar pré-OS"
                      disabled={isPending && processandoId === item.id}
                      onClick={() => handleDescartar(item.id)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:border-white/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Paciente (Clinicorp)</label>
                    <input
                      value={editado.paciente}
                      onChange={(e) => atualizarCampo(item, 'paciente', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Dentista / Clínica</label>
                    <input
                      value={editado.dentista}
                      onChange={(e) => atualizarCampo(item, 'dentista', e.target.value)}
                      placeholder="Dentista responsável"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Serviço</label>
                    <input
                      value={editado.servico}
                      onChange={(e) => atualizarCampo(item, 'servico', e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400">Cor / Elementos</label>
                    <input
                      value={editado.cor}
                      onChange={(e) => atualizarCampo(item, 'cor', e.target.value)}
                      placeholder="Ex: A2"
                      className="mt-0.5 w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
