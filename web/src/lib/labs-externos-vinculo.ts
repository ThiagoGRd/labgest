import { estadosArquivamento, type ArchiveQuery } from '@/lib/labs-externos-arquivo'

// Caller holds the Ordem row lock throughout the transaction. No name matching.
export async function registrarPedidoFornecedor(tx: ArchiveQuery, ordem: { id: number; nomePaciente: string; clienteNome: string; servicoNome: string }, labId: number, dataEnvio: Date, prazo: Date | null) {
  if (!Number.isSafeInteger(labId) || labId <= 0) throw new Error('Selecione um laboratório válido.')
  const [lab] = await tx.$queryRaw<Array<{ id: number; nome: string }>>`SELECT id, nome FROM labs_externos WHERE id = ${labId} AND ativo = true`
  if (!lab) throw new Error('Selecione um laboratório válido.')
  const ativos = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM labs_externos_pedidos WHERE ordem_id = ${ordem.id} AND fornecedor_confirmado_em IS NULL FOR UPDATE`
  if (ativos.length) throw new Error('Esta OS já possui um envio vinculado aberto. Confirme o recebimento na Produção.')
  // SQL DATE is a civil day, never an instant cast using the database timezone.
  const envioCivil = dataEnvio.toLocaleDateString('en-CA', { timeZone: 'America/Maceio' })
  const prazoCivil = prazo?.toLocaleDateString('en-CA', { timeZone: 'America/Maceio' }) ?? null
  await tx.$executeRaw`INSERT INTO labs_externos_pedidos (ordem_id, lab_id, lab_nome, paciente, dentista, servico, data_envio, prazo, situacao)
    VALUES (${ordem.id}, ${lab.id}, ${lab.nome}, ${ordem.nomePaciente}, ${ordem.clienteNome}, ${ordem.servicoNome}, ${envioCivil}::date, ${prazoCivil}::date, 'Enviado')`
  return lab
}

export async function confirmarPedidoFornecedor(tx: ArchiveQuery, ordemId: number, confirmadoEm: Date = new Date()) {
  const [pedido] = await tx.$queryRaw<Array<{ id: number; data_retorno: Date | null }>>`SELECT id, data_retorno FROM labs_externos_pedidos WHERE ordem_id = ${ordemId} AND fornecedor_confirmado_em IS NULL FOR UPDATE`
  if (!pedido) return null
  await garantirPedidoNaoArquivado(tx, pedido.id)
  const retornoCivil = confirmadoEm.toLocaleDateString('en-CA', { timeZone: 'America/Maceio' })
  // Timestamp-without-timezone column stores an explicit UTC carrier.
  const eventoUtc = confirmadoEm.toISOString()
  await tx.$executeRaw`UPDATE labs_externos_pedidos SET situacao = 'Pronto', data_retorno = COALESCE(data_retorno, ${retornoCivil}::date), fornecedor_confirmado_em = (${eventoUtc}::timestamptz AT TIME ZONE 'UTC'), updated_at = NOW() WHERE id = ${pedido.id}`
  return { dataRetorno: pedido.data_retorno ?? new Date(`${retornoCivil}T00:00:00Z`) }
}

export async function garantirPedidoNaoArquivado(tx: ArchiveQuery, id: number) {
  const { states } = await estadosArquivamento(tx)
  if (states.some(state => state.pedido_id === id && state.archived)) throw new Error('Pedido arquivado. Restaure antes de alterar.')
}
