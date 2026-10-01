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
      contasReceber: {
        where: { status: { not: 'Cancelado' } },
        select: { id: true },
        take: 1,
      },
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
        const item = await tx.estoque.findUnique({ where: { id: material.id } })
        if (!item) continue
        const saldoAnterior = Number(item.quantidade)
        const saldoPosterior = saldoAnterior - material.quantidade
        await tx.estoque.update({
          where: { id: material.id },
          data: { quantidade: saldoPosterior },
        })
        await tx.movimentacaoEstoque.create({
          data: {
            estoqueId: material.id,
            tipo: 'Saída',
            quantidade: material.quantidade,
            saldoAnterior,
            saldoPosterior,
            valorUnitario: item.precoUnitario,
            motivo: `Consumo automático da OS #${ordemId}`,
            ordemId,
            usuarioNome: 'Sistema',
          },
        })
      }
    }
  }

  if (ordem.contasReceber.length === 0) {
    const vencimento = new Date(finalizadaEm.getFullYear(), finalizadaEm.getMonth(), finalizadaEm.getDate())
    await tx.contaReceber.create({
      data: {
        ordemId,
        descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataCompetencia: finalizadaEm,
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
