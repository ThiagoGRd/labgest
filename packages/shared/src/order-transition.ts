/** Finalizado may only proceed through delivery/logistics, never restart production. */
export function erroTransicaoOrdem(status: string | null, permitirFinalizado = false): string | null {
  if (status === 'Pausado') return 'Retome a ordem antes de continuar o fluxo.'
  if (status === 'Cancelado' || status === 'Entregue' || (status === 'Finalizado' && !permitirFinalizado)) {
    return 'Esta ordem já está encerrada.'
  }
  return null
}
