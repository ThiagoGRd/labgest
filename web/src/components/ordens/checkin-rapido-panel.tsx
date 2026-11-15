'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  Stethoscope,
  ThumbsUp,
  Wrench,
} from 'lucide-react'
import { executarCheckinRapidoOrdem } from '@/actions/notificacoes'
import { PRAZO_RETORNO_LAB_DIAS } from '@/lib/producao-utils'

interface CheckinRapidoPanelProps {
  tokenOuId: string
  ordemId: number
  statusAtual: string
}

export function CheckinRapidoPanel({ tokenOuId, ordemId, statusAtual }: CheckinRapidoPanelProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [acaoAtiva, setAcaoAtiva] = useState<string | null>(null)
  const [mostrarAjuste, setMostrarAjuste] = useState(false)
  const [observacaoAjuste, setObservacaoAjuste] = useState('')
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  if (['Entregue', 'Cancelado'].includes(statusAtual)) {
    return null
  }

  function disparar(
    acao: 'receber_recepcao' | 'entregar_dentista' | 'aprovar_prova' | 'pedir_ajuste' | 'confirmar_entrada_lab',
    obs?: string,
  ) {
    setFeedback(null)
    setAcaoAtiva(acao)
    startTransition(async () => {
      const res = await executarCheckinRapidoOrdem(tokenOuId, acao, obs)
      setAcaoAtiva(null)
      if (res.success) {
        setFeedback({ tipo: 'ok', texto: res.mensagem || 'Movimentação registrada com sucesso!' })
        setMostrarAjuste(false)
        setObservacaoAjuste('')
        router.refresh()
      } else {
        setFeedback({ tipo: 'erro', texto: res.error || 'Não foi possível registrar a ação.' })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600">
            Check-in Ativo 1-Toque (QR Code / WhatsApp)
          </p>
          <h3 className="text-base font-bold text-slate-900 mt-0.5">
            Atualizar localização ou decisão da OS #{ordemId.toString().padStart(4, '0')}
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Registre em 1 toque onde a peça está para disparar os avisos automáticos no WhatsApp.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2 ${
            feedback.tipo === 'ok'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback.texto}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <button
          type="button"
          disabled={isPending}
          onClick={() => disparar('receber_recepcao')}
          className="flex items-center justify-center gap-2 rounded-xl bg-white border border-indigo-200 px-4 py-3 text-xs font-bold text-indigo-900 shadow-sm hover:bg-indigo-100/60 disabled:opacity-50 transition-all"
        >
          {isPending && acaoAtiva === 'receber_recepcao' ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          )}
          Chegou na Recepção (Avisar Dentista)
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => disparar('entregar_dentista')}
          className="flex items-center justify-center gap-2 rounded-xl bg-white border border-indigo-200 px-4 py-3 text-xs font-bold text-indigo-900 shadow-sm hover:bg-indigo-100/60 disabled:opacity-50 transition-all"
        >
          {isPending && acaoAtiva === 'entregar_dentista' ? (
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          ) : (
            <Stethoscope className="h-4 w-4 text-indigo-600" />
          )}
          Entregue ao Dentista / Consultório
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => disparar('aprovar_prova')}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-all"
        >
          {isPending && acaoAtiva === 'aprovar_prova' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ThumbsUp className="h-4 w-4" />
          )}
          Dentista: Aprovar Prova
        </button>

        <button
          type="button"
          disabled={isPending}
          onClick={() => setMostrarAjuste((v) => !v)}
          className="flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-amber-500 disabled:opacity-50 transition-all"
        >
          <Wrench className="h-4 w-4" />
          Dentista: Solicitar Ajuste
        </button>
      </div>

      {mostrarAjuste && (
        <div className="rounded-xl bg-white p-3.5 border border-amber-200 space-y-2.5">
          <label className="block text-xs font-bold text-slate-700">
            O que precisa ser ajustado na peça?
          </label>
          <textarea
            rows={2}
            value={observacaoAjuste}
            onChange={(e) => setObservacaoAjuste(e.target.value)}
            placeholder="Ex: Ajustar oclusão no 26 e escurecer cervical para A3..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-amber-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarAjuste(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => disparar('pedir_ajuste', observacaoAjuste)}
              className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              Confirmar Pedido de Ajuste
            </button>
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-indigo-200/60">
        <button
          type="button"
          disabled={isPending}
          onClick={() => disparar('confirmar_entrada_lab')}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition-all"
        >
          {isPending && acaoAtiva === 'confirmar_entrada_lab' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          Bancada Lab: Confirmar Entrada no Laboratório (+{PRAZO_RETORNO_LAB_DIAS} dias úteis)
        </button>
      </div>
    </div>
  )
}
