import { AlertTriangle, Calendar, Eye, PauseCircle, PencilLine, Route } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { diasRestantes, filaDaOrdem, prazoOperacional } from '@/lib/producao-utils'
import { FLUXOS_PROTESE, isTipoProtese } from '@/lib/workflow-config'
import type { OrdemProducao } from './types'

interface ListaProducaoProps {
  ordens: OrdemProducao[]
  onAbrirOrdem: (id: number) => void
  onDefinirEtapa: (ordem: OrdemProducao) => void
  onAbrirFluxo: (ordem: OrdemProducao) => void
}

function textoPrazo(ordem: OrdemProducao) {
  if (ordem.status === 'Pausado') return { texto: 'Prazo suspenso', atrasado: false }
  if (filaDaOrdem(ordem) === 'clinica') return { texto: 'Aguardando clínica', atrasado: false }
  const dias = diasRestantes(prazoOperacional(ordem))
  if (dias === null) return { texto: 'Prazo não definido', atrasado: false }
  if (dias < 0) return { texto: `${Math.abs(dias)}d atrasado`, atrasado: true }
  if (dias === 0) return { texto: 'Vence hoje', atrasado: false }
  return { texto: `${dias}d restantes`, atrasado: false }
}

export function ListaProducao({ ordens, onAbrirOrdem, onDefinirEtapa, onAbrirFluxo }: ListaProducaoProps) {
  if (ordens.length === 0) {
    return <p className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-zinc-700">Nenhuma ordem nesta fila com os filtros atuais.</p>
  }

  return (
    <div className="space-y-3">
      {ordens.map((ordem) => {
        const prazo = textoPrazo(ordem)
        const tipoFluxo = isTipoProtese(ordem.tipoWorkflow) ? ordem.tipoWorkflow : null
        const fluxoDefinido = Boolean(tipoFluxo && ordem.passoFluxoAtual)
        return (
          <article key={ordem.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <button type="button" onClick={() => onAbrirOrdem(ordem.id)} className="block max-w-full truncate text-left text-sm font-bold text-slate-900 hover:text-indigo-600 dark:text-white">
                  {ordem.paciente}
                </button>
                <p className="mt-1 truncate text-xs text-slate-500">{ordem.dentista} · {ordem.servico}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-slate-400">#{ordem.id}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{ordem.subetapa || ordem.etapa}</Badge>
              {ordem.prioridade !== 'Normal' && <Badge variant={ordem.prioridade === 'Urgente' ? 'destructive' : 'outline'}>{ordem.prioridade}</Badge>}
              <span className={`flex items-center gap-1 text-xs font-semibold ${prazo.atrasado ? 'text-red-600' : 'text-slate-500'}`}>
                {ordem.status === 'Pausado' ? <PauseCircle className="h-3.5 w-3.5 text-amber-600" /> : prazo.atrasado ? <AlertTriangle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                {prazo.texto}
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => onAbrirOrdem(ordem.id)}>
                <Eye className="h-3.5 w-3.5" /> Ver OS
              </Button>
              {!ordem.passoFluxoAtual ? (
                <Button type="button" size="sm" onClick={() => onDefinirEtapa(ordem)} className="bg-amber-600 text-white hover:bg-amber-700">
                  <PencilLine className="h-3.5 w-3.5" /> Definir tipo e etapa
                </Button>
              ) : fluxoDefinido && tipoFluxo ? (
                <Button type="button" size="sm" onClick={() => onAbrirFluxo(ordem)} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  <Route className="h-3.5 w-3.5" /> Abrir {FLUXOS_PROTESE[tipoFluxo].nomeCurto}
                </Button>
              ) : null}
            </div>
          </article>
        )
      })}
    </div>
  )
}
