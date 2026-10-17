'use client'

import Link from 'next/link'
import { CalendarClock, ExternalLink, Palette, Stethoscope, RefreshCw, Truck } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { descreverPrazo, hojeIso, paraIso, type TomPrazo } from '@/lib/labs-externos-utils'
import { filaDaOrdem, prazoOperacional, timestampValido } from '@/lib/producao-utils'
import { FLUXOS_PROTESE, SEQUENCIA_ETAPAS, etapaLabel, isTipoProtese, normalizarEtapa } from '@/lib/workflow-config'
import type { OrdemProducao } from '@/components/producao/types'
import { FILA_POR_ID } from './filas'

const TOM_PRAZO: Record<TomPrazo, string> = {
  atrasado: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  hoje: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  proximo: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  ok: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
  neutro: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/10',
}

const SELO_PRIORIDADE: Record<string, string> = {
  Urgente: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  Alta: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',
  Baixa: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-white/10 dark:text-slate-400 dark:ring-white/10',
}

/** Dia do prazo em AAAA-MM-DD: datas "só dia" são lidas direto; horários são convertidos ao fuso do laboratório. */
export function prazoIsoDaOrdem(ordem: OrdemProducao): string | null {
  const valor = prazoOperacional(ordem)
  const instante = timestampValido(valor)
  if (!valor || instante === null) return null
  return valor === ordem.entrega ? paraIso(valor) : hojeIso(new Date(instante))
}

/** Atrasada = prazo vencido numa ordem que está com o laboratório ou com fornecedor (a clínica não conta). */
export function ordemAtrasada(ordem: OrdemProducao, hoje: string): boolean {
  if (ordem.status === 'Pausado') return false
  const fila = filaDaOrdem(ordem)
  if (fila === 'clinica') return false
  const prazo = prazoIsoDaOrdem(ordem)
  return prazo !== null && prazo < hoje
}

function descricaoDoPrazo(ordem: OrdemProducao, hoje: string): { texto: string; tom: TomPrazo; data: string | null } {
  if (ordem.status === 'Pausado') return { texto: 'Prazo suspenso', tom: 'neutro', data: null }
  if (filaDaOrdem(ordem) === 'clinica') return { texto: 'Aguardando a clínica', tom: 'neutro', data: null }
  const prazo = prazoIsoDaOrdem(ordem)
  return { ...descreverPrazo(prazo, hoje), data: prazo }
}

function Progresso({ etapa }: { etapa: string }) {
  const atual = SEQUENCIA_ETAPAS.indexOf(normalizarEtapa(etapa))
  return (
    <ol className="flex items-center gap-1" aria-label={`Etapa ${atual + 1} de ${SEQUENCIA_ETAPAS.length}: ${etapaLabel(etapa)}`}>
      {SEQUENCIA_ETAPAS.map((id, i) => (
        <li key={id} title={etapaLabel(id)} className={`h-1.5 w-4 rounded-full ${i <= atual ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-white/10'}`} />
      ))}
    </ol>
  )
}

export function OrdemCard({ ordem }: { ordem: OrdemProducao }) {
  const hoje = hojeIso()
  const fila = FILA_POR_ID[filaDaOrdem(ordem)]
  const prazo = descricaoDoPrazo(ordem, hoje)
  const atrasada = ordemAtrasada(ordem, hoje)
  const pausada = ordem.status === 'Pausado'
  const retornoPendente = Boolean(ordem.cicloDentistaDeci)
  const tipo = isTipoProtese(ordem.tipoWorkflow) ? FLUXOS_PROTESE[ordem.tipoWorkflow].nomeCurto : null
  const etapaAtual = ordem.subetapa || etapaLabel(ordem.etapa)

  return (
    <article className={`relative flex overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md dark:bg-zinc-900 ${
      atrasada ? 'border-red-200 dark:border-red-500/30' : 'border-slate-200 dark:border-white/10'
    } ${pausada ? 'opacity-75' : ''}`}>
      <div className={`w-1.5 shrink-0 ${atrasada ? 'bg-red-500' : fila.barra}`} aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{ordem.paciente}</h3>
            <span className="font-mono text-xs text-slate-400">#{ordem.id}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${fila.selo}`}>{fila.com}</span>
            {ordem.prioridade !== 'Normal' && SELO_PRIORIDADE[ordem.prioridade] && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${SELO_PRIORIDADE[ordem.prioridade]}`}>{ordem.prioridade}</span>
            )}
            {pausada && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10">Pausada</span>}
            {retornoPendente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20">
                <RefreshCw className="h-3 w-3" /> Retorno da clínica
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-800 dark:text-slate-100">{ordem.servico}</span>
            {tipo && <span className="text-slate-400"> · {tipo}</span>}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Etapa atual: <span className="font-medium text-slate-700 dark:text-slate-200">{etapaAtual}</span></p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" />{ordem.dentista}</span>
            {ordem.cor && <span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Cor {ordem.cor}</span>}
            {fila.id === 'fornecedor' && ordem.fornecedorEstrutura && <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{ordem.fornecedorEstrutura}</span>}
            {ordem.entrega && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Entrega ao dentista em {formatDate(new Date(ordem.entrega))}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
          <div className="flex flex-col gap-2 sm:items-end">
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TOM_PRAZO[prazo.tom]}`}>
              <CalendarClock className="h-3.5 w-3.5" />
              {prazo.texto}
              {prazo.data && <span className="font-normal opacity-80">· {formatDate(new Date(`${prazo.data}T00:00:00Z`))}</span>}
            </span>
            <Progresso etapa={ordem.etapa} />
          </div>

          <Link
            href="/producao"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <ExternalLink className="h-4 w-4" /> Abrir na Produção
          </Link>
        </div>
      </div>
    </article>
  )
}
