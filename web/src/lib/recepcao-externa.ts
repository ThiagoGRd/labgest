// Pure logistics only. No database, authentication, clinical result or billing side effects.
export type OrigemRecepcao = 'interno' | 'externo'
export type SituacaoExterna = 'conferir_recebimento' | 'aguardando_distribuicao' | 'com_dentista' | 'aguardando_envio_laboratorio' | 'em_transito_laboratorio'
export type FinalidadeExterna = 'prova' | 'instalacao' | 'entrega'
export interface CustodiaExterna {
  situacao: SituacaoExterna
  version: number
  dentista: string | null
  finalidade: FinalidadeExterna | null
}
export interface MovimentoExterno {
  acao: 'receber' | 'distribuir' | 'receber_retorno' | 'enviar_retorno'
  expectedVersion: number
  dentista?: string
  finalidade?: FinalidadeExterna
  motivo?: string
}
export function chaveRecepcao(origem: OrigemRecepcao, id: number) {
  if (!['interno', 'externo'].includes(origem) || !Number.isSafeInteger(id) || id <= 0) throw new Error('Referência inválida.')
  return `${origem}:${id}`
}
export function estadoInicialExterno(situacao: string, arquivado: boolean): SituacaoExterna | null {
  if (arquivado || situacao === 'Entregue') return null
  if (!['Enviado', 'Provando', 'Pronto'].includes(situacao)) throw new Error('Situação externa desconhecida.')
  return 'conferir_recebimento'
}
export function transicionarExterno(atual: CustodiaExterna | null, input: MovimentoExterno): CustodiaExterna {
  if (!input || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
      || input.expectedVersion !== (atual?.version ?? 0)) throw new Error('O registro foi alterado. Atualize a página.')
  const estado = atual?.situacao ?? 'conferir_recebimento'
  const next: CustodiaExterna = { situacao: estado, version: input.expectedVersion + 1, dentista: atual?.dentista ?? null, finalidade: atual?.finalidade ?? null }
  if (input.acao === 'receber' && ['conferir_recebimento', 'em_transito_laboratorio'].includes(estado)) {
    return { ...next, situacao: 'aguardando_distribuicao', dentista: null, finalidade: null }
  }
  if (input.acao === 'distribuir' && ['aguardando_distribuicao', 'com_dentista'].includes(estado)) {
    if (typeof input.dentista !== 'string' || !input.dentista.trim() || input.dentista.trim().length > 255) throw new Error('Informe o dentista responsável.')
    if (!input.finalidade || !['prova', 'instalacao', 'entrega'].includes(input.finalidade)) throw new Error('Informe a finalidade.')
    if (estado === 'com_dentista' && (typeof input.motivo !== 'string' || input.motivo.trim().length < 5)) throw new Error('Informe o motivo da correção.')
    if (input.motivo !== undefined && (typeof input.motivo !== 'string' || input.motivo.length > 500)) throw new Error('Motivo inválido.')
    return { ...next, situacao: 'com_dentista', dentista: input.dentista.trim(), finalidade: input.finalidade }
  }
  if (input.acao === 'receber_retorno' && estado === 'com_dentista') return { ...next, situacao: 'aguardando_envio_laboratorio' }
  if (input.acao === 'enviar_retorno' && estado === 'aguardando_envio_laboratorio') return { ...next, situacao: 'em_transito_laboratorio' }
  throw new Error('Este movimento não está disponível no estado atual.')
}
