'use client'

import { useMemo } from 'react'
import type { OrdemFinalizada } from '@/lib/lab-interno-utils'
import { JANELA_DESEMPENHO_DIAS, contarPorEtapa, resumirDesempenho } from '@/lib/lab-interno-utils'
import { hojeIso } from '@/lib/labs-externos-utils'
import { KANBAN_ETAPAS, SEQUENCIA_ETAPAS, normalizarEtapa } from '@/lib/workflow-config'
import { FILAS } from './filas'
import type { OrdemProducao } from '@/components/producao/types'

const numero = (v: number) => v.toLocaleString('pt-BR')

function Linha({ rotulo, valor, tom, ajuda }: { rotulo: string; valor: string; tom?: 'alerta' | 'atencao'; ajuda?: string }) {
  const cor = tom === 'alerta' ? 'text-red-600 dark:text-red-400' : tom === 'atencao' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-sm text-slate-600 dark:text-slate-300">{rotulo}</dt>
        {ajuda && <dd className="text-xs text-slate-400 dark:text-slate-500">{ajuda}</dd>}
      </div>
      <span className={`shrink-0 text-sm font-bold ${cor}`}>{valor}</span>
    </div>
  )
}

interface PainelGestaoProps {
  /** Ordens em andamento que estão com o laboratório (a clínica e o fornecedor não entram na carga). */
  noLaboratorio: OrdemProducao[]
  historico: OrdemFinalizada[]
}

export function PainelGestao({ noLaboratorio, historico }: PainelGestaoProps) {
  const hoje = hojeIso()
  const desempenho = useMemo(() => resumirDesempenho(historico, hoje), [historico, hoje])
  const porEtapa = useMemo(
    () => contarPorEtapa(SEQUENCIA_ETAPAS, noLaboratorio.map((o) => normalizarEtapa(o.etapa))),
    [noLaboratorio],
  )
  const maior = Math.max(1, ...Object.values(porEtapa))

  return (
    <>
      <section aria-label="Carga do laboratório" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Carga do laboratório</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Trabalhos para executar, por etapa</p>
        {noLaboratorio.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Nenhum trabalho para executar agora.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {KANBAN_ETAPAS.map((etapa) => (
              <li key={etapa.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{etapa.nome}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{porEtapa[etapa.id]}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(porEtapa[etapa.id] / maior) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Desempenho do laboratório" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Desempenho</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Trabalhos finalizados nos últimos {JANELA_DESEMPENHO_DIAS} dias</p>
        <dl className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          <Linha rotulo="Finalizados" valor={numero(desempenho.finalizadas)} />
          <Linha
            rotulo="Dentro do prazo"
            valor={desempenho.taxaNoPrazo === null ? '—' : `${numero(desempenho.taxaNoPrazo)}%`}
            ajuda="Finalizados até a data de entrega combinada"
            tom={desempenho.taxaNoPrazo !== null && desempenho.taxaNoPrazo < 70 ? 'atencao' : undefined}
          />
          <Linha
            rotulo="Tempo médio de produção"
            valor={desempenho.tempoMedio === null ? '—' : `${numero(desempenho.tempoMedio)} ${desempenho.tempoMedio === 1 ? 'dia' : 'dias'}`}
            ajuda="Do pedido até a finalização"
          />
          <Linha
            rotulo="Com mais de uma prova"
            valor={desempenho.taxaMaisDeUmaProva === null ? '—' : `${numero(desempenho.taxaMaisDeUmaProva)}%`}
            ajuda={desempenho.finalizadas > 0 ? `${numero(desempenho.comMaisDeUmaProva)} de ${numero(desempenho.finalizadas)} trabalhos` : 'Sem trabalhos no período'}
            tom={desempenho.taxaMaisDeUmaProva !== null && desempenho.taxaMaisDeUmaProva >= 25 ? 'atencao' : undefined}
          />
        </dl>
      </section>

      <section aria-label="Como ler esta página" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Quem está com a peça</h2>
        <ul className="mt-3 space-y-3">
          {FILAS.map((fila) => {
            const Icone = fila.icone
            return (
              <li key={fila.id} className="flex gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${fila.icone_bg}`}><Icone className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{fila.rotulo}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{fila.explicacao}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
