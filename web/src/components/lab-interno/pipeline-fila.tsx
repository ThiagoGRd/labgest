'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { FilaProducao } from '@/components/producao/types'
import { FILAS } from './filas'

export type FiltroOrdens = 'todas' | FilaProducao | 'atrasadas' | 'retornos'

interface PipelineFilaProps {
  filtro: FiltroOrdens
  contagens: Record<FilaProducao, number>
  atrasadas: number
  retornos: number
  onChange: (filtro: FiltroOrdens) => void
}

export function PipelineFila({ filtro, contagens, atrasadas, retornos, onChange }: PipelineFilaProps) {
  const alternar = (alvo: FiltroOrdens) => onChange(filtro === alvo ? 'todas' : alvo)

  return (
    <section aria-label="Onde está cada trabalho" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FILAS.map((fila) => {
          const Icone = fila.icone
          const ativo = filtro === fila.id
          return (
            <button
              key={fila.id}
              type="button"
              onClick={() => alternar(fila.id)}
              aria-pressed={ativo}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                ativo
                  ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20'
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${fila.icone_bg}`}><Icone className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none text-slate-900 dark:text-white">{contagens[fila.id].toLocaleString('pt-BR')}</span>
                <span className="mt-1 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">{fila.rotulo}</span>
              </span>
            </button>
          )
        })}
      </div>

      {(atrasadas > 0 || retornos > 0) && (
        <div className="flex flex-wrap gap-2">
          {atrasadas > 0 && (
            <button
              type="button"
              onClick={() => alternar('atrasadas')}
              aria-pressed={filtro === 'atrasadas'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 ${
                filtro === 'atrasadas' ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {atrasadas} {atrasadas === 1 ? 'trabalho com prazo vencido' : 'trabalhos com prazo vencido'}
            </button>
          )}
          {retornos > 0 && (
            <button
              type="button"
              onClick={() => alternar('retornos')}
              aria-pressed={filtro === 'retornos'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 ${
                filtro === 'retornos' ? 'border-sky-500 bg-sky-600 text-white' : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              {retornos} {retornos === 1 ? 'retorno da clínica para confirmar' : 'retornos da clínica para confirmar'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
