'use client'

import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Flame, Palette, Play, RefreshCw, Stethoscope, Truck } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'
import { descreverPrazo, hojeIso, paraIso, type TomPrazo } from '@/lib/labs-externos-utils'
import { calcularRelogiosOrdem, filaDaOrdem, prazoOperacional, timestampValido } from '@/lib/producao-utils'
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

/** Atrasada = prazo vencido (do ciclo ou total da OS) numa ordem que está com o laboratório ou com fornecedor. */
export function ordemAtrasada(ordem: OrdemProducao, hoje: string): boolean {
  if (ordem.status === 'Pausado') return false
  const fila = filaDaOrdem(ordem)
  if (fila === 'clinica') return false
  const relogios = calcularRelogiosOrdem(ordem, hoje)
  if (relogios.diasVencidosTotal > 0) return true
  const prazo = prazoIsoDaOrdem(ordem)
  return prazo !== null && prazo < hoje
}

function descricaoDoPrazo(ordem: OrdemProducao, hoje: string): { texto: string; tom: TomPrazo; data: string | null; renovadoPorRetorno: boolean; diasVencidosTotal: number } {
  const relogios = calcularRelogiosOrdem(ordem, hoje)
  if (ordem.status === 'Pausado') {
    return { texto: 'Prazo suspenso', tom: 'neutro', data: null, renovadoPorRetorno: false, diasVencidosTotal: 0 }
  }
  if (filaDaOrdem(ordem) === 'clinica') {
    return { texto: 'Aguardando a clínica', tom: 'neutro', data: null, renovadoPorRetorno: false, diasVencidosTotal: relogios.diasVencidosTotal }
  }
  const prazo = prazoIsoDaOrdem(ordem)
  const base = descreverPrazo(prazo, hoje)
  return {
    texto: relogios.renovadoPorRetorno ? `Novo ciclo (10d): ${base.texto}` : base.texto,
    tom: relogios.renovadoPorRetorno && base.tom === 'ok' ? 'proximo' : base.tom,
    data: prazo,
    renovadoPorRetorno: relogios.renovadoPorRetorno,
    diasVencidosTotal: relogios.diasVencidosTotal,
  }
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

export interface OrdemCardProps {
  ordem: OrdemProducao
  processando?: boolean
  onConcluirEtapa?: (ordem: OrdemProducao) => void
  onConfirmarRetorno?: (ordem: OrdemProducao) => void
  onIniciarNoLab?: (ordem: OrdemProducao) => void
  onReceberFornecedor?: (ordem: OrdemProducao) => void
  onReportarProblema?: (ordem: OrdemProducao) => void
}

export function OrdemCard({
  ordem,
  processando = false,
  onConcluirEtapa,
  onConfirmarRetorno,
  onIniciarNoLab,
  onReceberFornecedor,
  onReportarProblema,
}: OrdemCardProps) {
  const hoje = hojeIso()
  const filaId = filaDaOrdem(ordem)
  const fila = FILA_POR_ID[filaId]
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
                <RefreshCw className="h-3 w-3" /> Retorno da clínica ({ordem.cicloDentistaDeci === 'aprovado' ? 'Aprovado' : 'Ajustes'})
              </span>
            )}
            {prazo.diasVencidosTotal > 0 && (
              <span
                title="Tempo total em que a OS original está vencida — utilize para dar prioridade máxima na bancada"
                className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs"
              >
                <Flame className="h-3 w-3" />
                Vencida há {prazo.diasVencidosTotal}d no total · Prioridade
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-800 dark:text-slate-100">{ordem.servico}</span>
            {tipo && <span className="text-slate-400"> · {tipo}</span>}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Etapa atual: <span className="font-medium text-slate-700 dark:text-slate-200">{etapaAtual}</span>
            {ordem.cicloObs && (
              <span className="ml-2 inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                Obs. dentista: {ordem.cicloObs}
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><Stethoscope className="h-3.5 w-3.5" />{ordem.dentista}</span>
            {ordem.cor && <span className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Cor {ordem.cor}</span>}
            {fila.id === 'fornecedor' && ordem.fornecedorEstrutura && <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{ordem.fornecedorEstrutura}</span>}
            {ordem.entrega && <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Previsão inicial: {formatDate(new Date(ordem.entrega))}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start justify-between gap-3 sm:items-end">
          <div className="flex flex-col gap-1.5 sm:items-end">
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${TOM_PRAZO[prazo.tom]}`}>
              <CalendarClock className="h-3.5 w-3.5" />
              {prazo.texto}
              {prazo.data && <span className="font-normal opacity-80">· {formatDate(new Date(`${prazo.data}T00:00:00Z`))}</span>}
            </span>
            <Progresso etapa={ordem.etapa} />
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {retornoPendente && onConfirmarRetorno && (
              <button
                type="button"
                disabled={processando}
                onClick={() => onConfirmarRetorno(ordem)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-sky-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-500 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Confirmar retorno (+10d)
              </button>
            )}

            {!retornoPendente && filaId === 'sem_etapa' && onIniciarNoLab && !pausada && (
              <button
                type="button"
                disabled={processando}
                onClick={() => onIniciarNoLab(ordem)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" /> Iniciar na bancada
              </button>
            )}

            {!retornoPendente && filaId === 'laboratorio' && onConcluirEtapa && !pausada && (
              <button
                type="button"
                disabled={processando}
                onClick={() => onConcluirEtapa(ordem)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Concluir etapa
              </button>
            )}

            {filaId === 'fornecedor' && ordem.dataEnvioFornecedor && onReceberFornecedor && !pausada && (
              <button
                type="button"
                disabled={processando}
                onClick={() => onReceberFornecedor(ordem)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-amber-500 disabled:opacity-50"
              >
                <Truck className="h-3.5 w-3.5" /> Receber do fornecedor
              </button>
            )}

            {onReportarProblema && !pausada && (
              <button
                type="button"
                disabled={processando}
                onClick={() => onReportarProblema(ordem)}
                title="Avisar dentista e recepção no WhatsApp sobre problema técnico ou necessidade de remarcação"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> Problema
              </button>
            )}

            <a
              href={`/ordens?busca=${ordem.id}&status=todos`}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Ver OS
            </a>

            <a
              href="/producao"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir na Produção
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

