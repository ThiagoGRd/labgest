import type { Prisma } from '@labgest/database'

export async function garantirEfeitosFinalizacao(
  tx: Prisma.TransactionClient,
  ordemId: number,
  finalizadaEm = new Date(),
) {
  const ordem = await tx.ordem.findUnique({
    where: { id: ordemId },
    include: {
      servico: { select: { materiais: true } },
      contasReceber: { select: { id: true }, take: 1 },
    },
  })
  if (!ordem) throw new Error('Ordem não encontrada durante a finalização')

  const baixaReservada = await tx.ordem.updateMany({
    where: { id: ordemId, estoqueBaixadoEm: null },
    data: { estoqueBaixadoEm: finalizadaEm },
  })

  if (baixaReservada.count === 1) {
    const materiais = Array.isArray(ordem.servico?.materiais)
      ? ordem.servico.materiais as Array<{ id?: number; quantidade?: number }>
      : []
    for (const material of materiais) {
      if (material.id && material.quantidade) {
        await tx.estoque.update({
          where: { id: material.id },
          data: { quantidade: { decrement: material.quantidade } },
        })
      }
    }
  }

  if (ordem.contasReceber.length === 0) {
    const vencimento = new Date(finalizadaEm.getFullYear(), finalizadaEm.getMonth() + 1, 15)
    await tx.contaReceber.create({
      data: {
        ordemId,
        descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataVencimento: vencimento,
        status: 'Pendente',
        observacoes: `Gerado automaticamente — Ordem #${ordemId} finalizada em ${finalizadaEm.toLocaleDateString('pt-BR')}`,
      },
    })
  }

  await tx.ordem.update({
    where: { id: ordemId },
    data: { cobrancaGeradaEm: finalizadaEm },
  })
}
