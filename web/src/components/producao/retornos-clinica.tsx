'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, Eye, PackageCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface RetornoClinica {
  id: number
  paciente: string
  dentista: string
  servico: string
  cicloDentistaDeci?: string | null
  cicloObs?: string | null
  cicloRespostaEm?: string | null
}

interface RetornosClinicaProps {
  retornos: RetornoClinica[]
  onAbrirOrdem: (id: number) => void
  onConfirmarRecebimento: (id: number) => void
}

function tempoDesdeResposta(data: string | null | undefined, agora: number) {
  if (!data) return 'Resposta recebida'
  const minutos = Math.max(0, Math.floor((agora - new Date(data).getTime()) / 60000))
  if (minutos < 60) return `Respondido há ${Math.max(1, minutos)} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Respondido há ${horas}h`
  return `Respondido há ${Math.floor(horas / 24)}d`
}

export function RetornosClinica({
  retornos,
  onAbrirOrdem,
  onConfirmarRecebimento,
}: RetornosClinicaProps) {
  const [agora] = useState(() => Date.now())
  if (retornos.length === 0) return null

  return (
    <section
      aria-labelledby="retornos-clinica-titulo"
      className="mb-6 overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/70 shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/20"
    >
      <div className="flex flex-col gap-2 border-b border-indigo-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900/50">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 id="retornos-clinica-titulo" className="font-bold text-slate-900 dark:text-white">
              Retornos que precisam de atenção
            </h2>
            <Badge className="border-0 bg-red-600 text-white hover:bg-red-600">
              {retornos.length}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            O dentista já respondeu. Confirme o recebimento físico para encaminhar o trabalho.
          </p>
        </div>
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Mais antigos primeiro
        </span>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
        {retornos.map((ordem) => {
          const aprovado = ordem.cicloDentistaDeci === 'aprovado'
          return (
            <article
              key={ordem.id}
              className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-zinc-900 ${
                aprovado
                  ? 'border-emerald-200 dark:border-emerald-900/50'
                  : 'border-amber-200 dark:border-amber-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {aprovado
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />}
                    <p className={`text-xs font-bold uppercase tracking-wide ${aprovado ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {aprovado ? 'Aprovado para finalização' : 'Ajuste solicitado'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAbrirOrdem(ordem.id)}
                    className="mt-2 block max-w-full truncate text-left text-sm font-bold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                  >
                    {ordem.paciente}
                  </button>
                  <p className="truncate text-xs text-slate-500">{ordem.dentista} · {ordem.servico}</p>
                </div>
                <span className="shrink-0 font-mono text-[10px] text-slate-400">#{ordem.id}</span>
              </div>

              {!aprovado && (
                <p className="mt-3 line-clamp-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {ordem.cicloObs || 'Abra a ordem para consultar os detalhes do ajuste.'}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Clock3 className="h-3.5 w-3.5" />
                  {tempoDesdeResposta(ordem.cicloRespostaEm, agora)}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => onAbrirOrdem(ordem.id)}>
                    <Eye className="h-3.5 w-3.5" /> Ver OS
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onConfirmarRecebimento(ordem.id)}
                    className={aprovado ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-600 text-white hover:bg-amber-700'}
                  >
                    <PackageCheck className="h-3.5 w-3.5" /> Recebi
                  </Button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
