import { Building2, FlaskConical, PencilLine, Stethoscope } from 'lucide-react'
import type { FilaProducao } from './types'

interface ResumoProducaoProps {
  contagens: Record<FilaProducao, number>
  selecionada: FilaProducao
  retornos: number
  onSelecionar: (fila: FilaProducao) => void
}

const FILAS = [
  { id: 'laboratorio', titulo: 'No laboratório', descricao: 'Trabalhos para executar', Icone: FlaskConical, cor: 'violet' },
  { id: 'clinica', titulo: 'Aguardando clínica', descricao: 'Fora da carga do laboratório', Icone: Stethoscope, cor: 'sky' },
  { id: 'fornecedor', titulo: 'Com fornecedor', descricao: 'Prazo externo em andamento', Icone: Building2, cor: 'orange' },
  { id: 'sem_etapa', titulo: 'Etapa a definir', descricao: 'Precisam de classificação', Icone: PencilLine, cor: 'amber' },
] as const

const CORES = {
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-300',
  orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
}

export function ResumoProducao({ contagens, selecionada, retornos, onSelecionar }: ResumoProducaoProps) {
  return (
    <section aria-label="Filas da produção" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {FILAS.map(({ id, titulo, descricao, Icone, cor }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelecionar(id)}
          aria-pressed={selecionada === id}
          className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 ${CORES[cor]} ${selecionada === id ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-zinc-950' : ''}`}
        >
          <div className="flex items-start justify-between gap-3">
            <Icone className="h-5 w-5" />
            <span className="font-mono text-2xl font-bold">{contagens[id]}</span>
          </div>
          <p className="mt-3 text-sm font-bold">{titulo}</p>
          <p className="mt-1 text-xs opacity-80">
            {id === 'clinica' && retornos > 0 ? `${retornos} retorno${retornos > 1 ? 's' : ''} para confirmar` : descricao}
          </p>
        </button>
      ))}
    </section>
  )
}
