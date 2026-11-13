import { prepararAgendamento } from './agendamento-recepcao'
// Pure logistics only. No database, authentication, clinical result or billing side effects.
export type OrigemRecepcao = 'interno' | 'externo'
export type SituacaoExterna = 'no_laboratorio' | 'conferir_recebimento' | 'aguardando_distribuicao' | 'com_dentista' | 'aguardando_envio_laboratorio' | 'em_transito_laboratorio'
export type FinalidadeExterna = 'prova' | 'instalacao' | 'entrega'
export interface CustodiaExterna {
  situacao: SituacaoExterna
  version: number
  dentista: string | null
  finalidade: FinalidadeExterna | null
  agendamento_confirmado?: boolean
  agendamento_em?: Date | null
  agendamento_dentista?: string | null
}
export interface MovimentoExterno {
  acao: 'registrar_no_laboratorio' | 'receber' | 'distribuir' | 'receber_retorno' | 'enviar_retorno' | 'agendar' | 'cancelar_agendamento'
  expectedVersion: number
  dentista?: string
  finalidade?: FinalidadeExterna
  motivo?: string
  agendamento?: string
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
  if (atual?.agendamento_confirmado !== undefined) { next.agendamento_confirmado = atual.agendamento_confirmado; next.agendamento_em = atual.agendamento_em ?? null; next.agendamento_dentista = atual.agendamento_dentista ?? null }
  if (input.acao === 'agendar' || input.acao === 'cancelar_agendamento') {
    if (!atual || (input.acao === 'agendar' && !['aguardando_distribuicao', 'com_dentista'].includes(estado))) throw new Error('O trabalho precisa estar na recepção ou com o dentista.')
    if (input.acao === 'cancelar_agendamento' && !atual.agendamento_confirmado) throw new Error('Não há agendamento ativo para cancelar.')
    const dados = prepararAgendamento(input.acao === 'agendar', input.dentista, input.agendamento)
    return { ...next, agendamento_confirmado: dados.confirmado, ...(dados.confirmado ? { agendamento_em: dados.data, agendamento_dentista: dados.dentista } : {}) }
  }
  if (input.acao === 'registrar_no_laboratorio' && ['conferir_recebimento', 'aguardando_distribuicao', 'em_transito_laboratorio'].includes(estado)) {
    return { ...next, situacao: 'no_laboratorio', ...(atual?.agendamento_confirmado ? { agendamento_confirmado: false } : {}) }
  }
  if (input.acao === 'receber' && ['conferir_recebimento', 'em_transito_laboratorio', 'no_laboratorio'].includes(estado)) {
    return { ...next, situacao: 'aguardando_distribuicao', dentista: null, finalidade: null }
  }
  if (input.acao === 'distribuir' && ['aguardando_distribuicao', 'com_dentista'].includes(estado)) {
    if (typeof input.dentista !== 'string' || !input.dentista.trim() || input.dentista.trim().length > 255) throw new Error('Informe o dentista responsável.')
    if (!input.finalidade || !['prova', 'instalacao', 'entrega'].includes(input.finalidade)) throw new Error('Informe a finalidade.')
    if (estado === 'com_dentista' && (typeof input.motivo !== 'string' || input.motivo.trim().length < 5)) throw new Error('Informe o motivo da correção.')
    if (input.motivo !== undefined && (typeof input.motivo !== 'string' || input.motivo.length > 500)) throw new Error('Motivo inválido.')
    return { ...next, situacao: 'com_dentista', dentista: input.dentista.trim(), finalidade: input.finalidade }
  }
  if (input.acao === 'receber_retorno' && estado === 'com_dentista') return { ...next, situacao: 'aguardando_envio_laboratorio', agendamento_confirmado: false }
  if (input.acao === 'enviar_retorno' && (estado === 'aguardando_envio_laboratorio' || (estado === 'aguardando_distribuicao' && atual?.agendamento_confirmado))) return { ...next, situacao: 'em_transito_laboratorio', ...(atual?.agendamento_confirmado ? { agendamento_confirmado: false } : {}) }
  throw new Error('Este movimento não está disponível no estado atual.')
}
