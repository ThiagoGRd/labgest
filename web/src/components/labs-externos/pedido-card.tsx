'use client'

import {
  Building2, CalendarClock, Check, ChevronRight, Clock3, Loader2, MoreHorizontal,
  Pencil, RefreshCw, Undo2, Stethoscope,
} from 'lucide-react'
import type { LabExternoPedido } from '@/actions/labs-externos'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/date-utils'
import { SITUACOES, descreverPrazo, diasEntre, hojeIso, type SituacaoPedido, type TomPrazo } from '@/lib/labs-externos-utils'
import { ETAPAS, ETAPA_POR_SITUACAO } from './etapas'

const TOM_PRAZO: Record<TomPrazo, string> = {
  atrasado: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  hoje: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  proximo: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  ok: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
  neutro: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/10',
}

interface PedidoCardProps {
  pedido: LabExternoPedido
  ocupado: boolean
  onMover: (id: number, situacao: SituacaoPedido) => void
  onEditar: (pedido: LabExternoPedido) => void
  onRetrabalho: (id: number) => void
  onDesfazerRetrabalho: (id: number) => void
}

function Progresso({ situacao }: { situacao: SituacaoPedido }) {
  const atual = SITUACOES.indexOf(situacao)
  return (
    <ol className="flex items-center gap-1" aria-label={`Etapa ${atual + 1} de ${ETAPAS.length}: ${ETAPA_POR_SITUACAO[situacao].rotulo}`}>
      {ETAPAS.map((etapa, i) => (
        <li key={etapa.situacao} title={etapa.rotulo} className={`h-1.5 w-6 rounded-full ${i <= atual ? ETAPA_POR_SITUACAO[situacao].ponto : 'bg-slate-200 dark:bg-white/10'}`} />
      ))}
    </ol>
  )
}

export function PedidoCard({ pedido, ocupado, onMover, onEditar, onRetrabalho, onDesfazerRetrabalho }: PedidoCardProps) {
  const etapa = ETAPA_POR_SITUACAO[pedido.situacao]
  const hoje = hojeIso()
  const entregue = pedido.situacao === 'Entregue'
  const prazo = descreverPrazo(pedido.prazo, hoje)
  const comOLaboratorio = pedido.situacao === 'Enviado' || pedido.situacao === 'Provando'
  const diasDesdeEnvio = comOLaboratorio ? diasEntre(pedido.dataEnvio, hoje) : null
  const atrasado = !entregue && prazo.tom === 'atrasado'

  return (
    <article className={`relative flex overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${
      atrasado ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-white/10'
    } ${entregue ? 'opacity-80' : ''}`}>
      <div className={`w-1.5 shrink-0 ${atrasado ? 'bg-red-500' : etapa.barra}`} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{pedido.paciente}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${etapa.selo}`}>{etapa.rotulo}</span>
            {pedido.isRetrabalho && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20">
                <RefreshCw className="h-3 w-3" /> Retrabalho
              </span>
            )}
          </div>

          {pedido.servico && <p className="line-clamp-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{pedido.servico}</p>}

          {pedido.isRetrabalho && pedido.motivoRetrabalho && (
            <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs leading-relaxed text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
              <span className="font-semibold">Motivo do retrabalho:</span> {pedido.motivoRetrabalho}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            {pedido.dentista && <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" />{pedido.dentista}</span>}
            {pedido.labNome && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{pedido.labNome}</span>}
            {pedido.dataEnvio && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Enviado em {formatDate(pedido.dataEnvio)}</span>}
            {diasDesdeEnvio !== null && diasDesdeEnvio >= 0 && (
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />há {diasDesdeEnvio} {diasDesdeEnvio === 1 ? 'dia' : 'dias'}</span>
            )}
            {pedido.dataRetorno && <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />Pronto em {formatDate(pedido.dataRetorno)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
          <div className="flex flex-col gap-2 sm:items-end">
            {!entregue && (
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TOM_PRAZO[prazo.tom]}`}>
                <CalendarClock className="h-3.5 w-3.5" />
                {prazo.texto}
                {pedido.prazo && <span className="font-normal opacity-80">· {formatDate(pedido.prazo)}</span>}
              </span>
            )}
            <Progresso situacao={pedido.situacao} />
          </div>

          <div className="flex items-center gap-1.5">
            {etapa.proxima && (
              <button
                type="button"
                onClick={() => onMover(pedido.id, etapa.proxima!)}
                disabled={ocupado}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60"
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                {etapa.acaoAvancar}
              </button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Mais ações para ${pedido.paciente}`} disabled={ocupado} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-60 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <DropdownMenuItem onClick={() => onEditar(pedido)}><Pencil className="mr-2 h-4 w-4" />Editar pedido</DropdownMenuItem>
                {!entregue && !pedido.isRetrabalho && (
                  <DropdownMenuItem onClick={() => onRetrabalho(pedido.id)}><RefreshCw className="mr-2 h-4 w-4" />Marcar como retrabalho</DropdownMenuItem>
                )}
                {pedido.isRetrabalho && (
                  <DropdownMenuItem onClick={() => onDesfazerRetrabalho(pedido.id)}><Undo2 className="mr-2 h-4 w-4" />Não é retrabalho</DropdownMenuItem>
                )}
                {etapa.anterior && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onMover(pedido.id, etapa.anterior!)}>
                      <Undo2 className="mr-2 h-4 w-4" />
                      {entregue ? 'Desfazer entrega' : `Voltar para ${ETAPA_POR_SITUACAO[etapa.anterior].rotulo.toLowerCase()}`}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  )
}
