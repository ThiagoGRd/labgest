/** Finalizado may only proceed through delivery/logistics, never restart production. */
export function erroTransicaoOrdem(status: string | null, permitirFinalizado = false): string | null {
  if (status === 'Pausado') return 'Retome a ordem antes de continuar o fluxo.'
  if (status === 'Cancelado' || status === 'Entregue' || (status === 'Finalizado' && !permitirFinalizado)) {
    return 'Esta ordem já está encerrada.'
  }
  return null
}

/** A new intent must never share the revision of an earlier mutation, even in one millisecond. */
export function proximaRevisaoOrdem(anterior: Date | null | undefined, agora = new Date()): Date {
  return new Date(Math.max(agora.getTime(), (anterior?.getTime() ?? -1) + 1))
}
