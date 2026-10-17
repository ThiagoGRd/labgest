import { Building2, FlaskConical, PencilLine, Stethoscope, type LucideIcon } from 'lucide-react'
import type { FilaProducao } from '@/components/producao/types'

export interface InfoFila {
  id: FilaProducao
  rotulo: string
  /** Quem está com a peça agora. */
  com: string
  explicacao: string
  icone: LucideIcon
  barra: string
  selo: string
  icone_bg: string
}

// Em que "mão" está cada trabalho: define o que o laboratório precisa fazer hoje.
export const FILAS: InfoFila[] = [
  {
    id: 'laboratorio', rotulo: 'Para executar', com: 'Laboratório', explicacao: 'Trabalhos em que a próxima etapa é do nosso laboratório.',
    icone: FlaskConical, barra: 'bg-violet-500',
    selo: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
    icone_bg: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  {
    id: 'clinica', rotulo: 'Com a clínica', com: 'Clínica', explicacao: 'Em prova ou aguardando a clínica; fora da carga do laboratório.',
    icone: Stethoscope, barra: 'bg-sky-500',
    selo: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    icone_bg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  {
    id: 'fornecedor', rotulo: 'Com fornecedor', com: 'Fornecedor', explicacao: 'Peça enviada a um fornecedor, com prazo externo.',
    icone: Building2, barra: 'bg-orange-500',
    selo: 'bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-400/20',
    icone_bg: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300',
  },
  {
    id: 'sem_etapa', rotulo: 'Etapa a definir', com: 'A definir', explicacao: 'Ordens sem etapa do fluxo; precisam ser classificadas na Produção.',
    icone: PencilLine, barra: 'bg-amber-500',
    selo: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    icone_bg: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
]

export const FILA_POR_ID = Object.fromEntries(FILAS.map((f) => [f.id, f])) as Record<FilaProducao, InfoFila>
