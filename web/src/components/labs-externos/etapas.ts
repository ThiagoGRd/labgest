import { Package, PackageCheck, Send, Stethoscope, type LucideIcon } from 'lucide-react'
import type { SituacaoPedido } from '@/lib/labs-externos-utils'

// Identidade visual e vocabulário de cada etapa do pedido, num só lugar.
export interface Etapa {
  situacao: SituacaoPedido
  rotulo: string
  /** Frase curta que explica a etapa para quem usa o sistema. */
  explicacao: string
  /** Texto do botão que leva o pedido para a próxima etapa. */
  acaoAvancar?: string
  proxima?: SituacaoPedido
  anterior?: SituacaoPedido
  icone: LucideIcon
  /** Barra lateral do cartão. */
  barra: string
  /** Selo da etapa. */
  selo: string
  /** Ícone do bloco de resumo. */
  icone_bg: string
  /** Ponto preenchido no indicador de progresso. */
  ponto: string
}

export const ETAPAS: Etapa[] = [
  {
    situacao: 'Enviado', rotulo: 'No laboratório', explicacao: 'Peças enviadas, em produção no laboratório.',
    acaoAvancar: 'Enviar para prova', proxima: 'Provando', icone: Send,
    barra: 'bg-sky-500', selo: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    icone_bg: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300', ponto: 'bg-sky-500',
  },
  {
    situacao: 'Provando', rotulo: 'Em prova', explicacao: 'Peças em fase de prova com o dentista ou paciente.',
    acaoAvancar: 'Marcar como pronto', proxima: 'Pronto', anterior: 'Enviado', icone: Stethoscope,
    barra: 'bg-violet-500', selo: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
    icone_bg: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300', ponto: 'bg-violet-500',
  },
  {
    situacao: 'Pronto', rotulo: 'Pronto', explicacao: 'Peças prontas, aguardando entrega ao dentista.',
    acaoAvancar: 'Registrar entrega', proxima: 'Entregue', anterior: 'Provando', icone: PackageCheck,
    barra: 'bg-emerald-500', selo: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    icone_bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', ponto: 'bg-emerald-500',
  },
  {
    situacao: 'Entregue', rotulo: 'Entregue', explicacao: 'Peças já entregues.',
    anterior: 'Pronto', icone: Package,
    barra: 'bg-slate-300 dark:bg-slate-600', selo: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-white/10 dark:text-slate-300 dark:ring-white/10',
    icone_bg: 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300', ponto: 'bg-slate-400',
  },
]

export const ETAPA_POR_SITUACAO = Object.fromEntries(ETAPAS.map((e) => [e.situacao, e])) as Record<SituacaoPedido, Etapa>
