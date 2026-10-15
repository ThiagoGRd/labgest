'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { ETAPAS } from './etapas'
import type { SituacaoPedido } from '@/lib/labs-externos-utils'

export type FiltroPedidos = 'ativos' | SituacaoPedido | 'atrasados' | 'retrabalhos'

interface PipelineLabsProps {
  filtro: FiltroPedidos
  contagens: Record<SituacaoPedido, number>
  atrasados: number
  retrabalhos: number
  onChange: (filtro: FiltroPedidos) => void
}

function Bloco({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
        ativo
          ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20'
      }`}
    >
      {children}
    </button>
  )
}

// Fluxo do pedido de ponta a ponta; cada bloco filtra a lista logo abaixo.
export function PipelineLabs({ filtro, contagens, atrasados, retrabalhos, onChange }: PipelineLabsProps) {
  return (
    <section aria-label="Etapas dos pedidos" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ETAPAS.map((etapa) => {
          const Icone = etapa.icone
          return (
            <Bloco key={etapa.situacao} ativo={filtro === etapa.situacao} onClick={() => onChange(filtro === etapa.situacao ? 'ativos' : etapa.situacao)}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${etapa.icone_bg}`}><Icone className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-2xl font-bold leading-none text-slate-900 dark:text-white">{contagens[etapa.situacao].toLocaleString('pt-BR')}</span>
                <span className="mt-1 block truncate text-xs font-medium text-slate-500 dark:text-slate-400">{etapa.rotulo}</span>
              </span>
            </Bloco>
          )
        })}
      </div>

      {(atrasados > 0 || retrabalhos > 0) && (
        <div className="flex flex-wrap gap-2">
          {atrasados > 0 && (
            <button
              type="button"
              onClick={() => onChange(filtro === 'atrasados' ? 'ativos' : 'atrasados')}
              aria-pressed={filtro === 'atrasados'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 ${
                filtro === 'atrasados' ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {atrasados} {atrasados === 1 ? 'pedido com prazo vencido' : 'pedidos com prazo vencido'}
            </button>
          )}
          {retrabalhos > 0 && (
            <button
              type="button"
              onClick={() => onChange(filtro === 'retrabalhos' ? 'ativos' : 'retrabalhos')}
              aria-pressed={filtro === 'retrabalhos'}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-600 ${
                filtro === 'retrabalhos' ? 'border-orange-500 bg-orange-600 text-white' : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300'
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              {retrabalhos} {retrabalhos === 1 ? 'retrabalho em andamento' : 'retrabalhos em andamento'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
