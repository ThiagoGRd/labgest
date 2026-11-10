export type FiltroOrigem = 'todos' | 'interno' | 'externo'

export function filtrarOrigem<T extends { origem: 'interno' | 'externo' }>(itens: T[], origem: FiltroOrigem): T[] {
  return origem === 'todos' ? itens : itens.filter(item => item.origem === origem)
}
