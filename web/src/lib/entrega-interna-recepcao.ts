import type { Prisma } from '@prisma/client'

export interface EntregaInternaInput { ordemId: number; expectedUpdatedAt: string | null }
interface Actor { id: number; email: string; nome: string }
interface Database {
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>
}
const inconsistente = () => new Error('Há inconsistências na cobrança desta ordem. Peça ao administrador para conferir antes de registrar a entrega.')
function dataValida(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime())
}
// Decimal database values are never coerced to floating point or rounded.
function centavos(value: unknown): bigint {
  const text = value !== null && value !== undefined ? String(value) : ''
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw inconsistente()
  const [inteiro, fracao = ''] = text.split('.')
  return BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, '0'))
}

export async function concluirEntregaInterna(db: Database, input: EntregaInternaInput, actor: Actor, agora: Date) {
  if (!input || !Number.isSafeInteger(input.ordemId) || input.ordemId <= 0
    || !(input.expectedUpdatedAt === null || (typeof input.expectedUpdatedAt === 'string' && dataValida(new Date(input.expectedUpdatedAt))))
    || !actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 || !actor.email?.trim() || !actor.nome?.trim()
    || !dataValida(agora)) throw new Error('Dados inválidos para registrar a entrega.')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${input.ordemId} FOR UPDATE`
    const ordem = await tx.ordem.findUnique({ where: { id: input.ordemId } })
    if (!ordem) throw new Error('Ordem não encontrada.')
    if ((ordem.updatedAt?.toISOString() ?? null) !== input.expectedUpdatedAt) throw new Error('A ordem foi alterada. Atualize a página antes de registrar a entrega.')
    if (ordem.status !== 'Finalizado') throw new Error('Finalize a produção antes de registrar a entrega ao paciente.')
    if (ordem.historicoEtapas !== null && !Array.isArray(ordem.historicoEtapas)) throw inconsistente()
    const total = centavos(ordem.valorFinal)
    if (total <= BigInt(0)) throw inconsistente()
    await tx.$queryRaw`SELECT id FROM contas_receber WHERE ordem_id = ${input.ordemId} ORDER BY id FOR UPDATE`
    const contas = await tx.contaReceber.findMany({ where: { ordemId: input.ordemId }, orderBy: { id: 'asc' } })
    for (const conta of contas) {
      if ((conta.status === 'Cancelado') !== (conta.canceladoEm !== null) || (conta.canceladoEm !== null && !dataValida(conta.canceladoEm))) throw inconsistente()
    }
    const ativas = contas.filter(conta => conta.status !== 'Cancelado')
    if (ativas.length > 1 || (contas.length > 0 && ativas.length === 0)) throw inconsistente()
    if (contas.length === 0) throw new Error('Esta OS está sem cobrança. Peça à administração para regularizar antes de registrar a entrega.')
    const conta = ativas[0]
    const recebido = centavos(conta.valorRecebido)
    if (centavos(conta.valor) !== total || recebido > total || conta.clienteId !== ordem.clienteId
      || (conta.clienteId === null && conta.clienteNome?.trim() !== ordem.clienteNome.trim())
      || !dataValida(conta.dataVencimento)
      || conta.status !== (recebido === total ? 'Recebido' : recebido > BigInt(0) ? 'Parcial' : 'Pendente')) throw inconsistente()
    const historico = Array.isArray(ordem.historicoEtapas) ? ordem.historicoEtapas : []
    await tx.ordem.update({ where: { id: ordem.id }, data: {
      status: 'Entregue', etapaAtual: 'entregue', progresso: 100, dataEntregaReal: agora,
      historicoEtapas: [...historico, { acao: 'entrega_paciente_recepcao', data: agora.toISOString(), por: actor.email,
        responsavel: actor.nome, usuarioId: actor.id, contaId: conta.id }],
    } })
    return { contaId: conta.id, entregueEm: agora.toISOString() }
  })
}
