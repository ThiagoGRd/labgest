'use server'

import { requireClienteIdentity } from '@/lib/cliente-identity'
import { prisma } from '@labgest/database'

export async function getContasCliente() {
  const cliente = await requireClienteIdentity()

  const contas = await prisma.contaReceber.findMany({
    where: { clienteId: cliente.id, canceladoEm: null, status: { not: 'Cancelado' } },
    orderBy: { dataVencimento: 'asc' },
    include: {
      ordem: { select: { clienteId: true, nomePaciente: true, servicoNome: true } }
    }
  })

  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const parte = (tipo: string) => Number(partes.find(p => p.type === tipo)?.value)
  const hoje = new Date(Date.UTC(parte('year'), parte('month') - 1, parte('day')))
  const formatConta = (c: (typeof contas)[number]) => {
    const ordemSegura = !c.ordem || c.ordem.clienteId === cliente.id
    const valor = Number(c.valor)
    const liquidado = Number(c.valorRecebido)
    const restante = Math.max(0, valor - liquidado)
    const diasAtraso = c.dataVencimento < hoje && restante > 0
      ? Math.floor((hoje.getTime() - c.dataVencimento.getTime()) / 86400000)
      : 0
    const status = restante === 0
      ? 'Pago'
      : liquidado > 0
        ? (diasAtraso ? 'Parcial atrasado' : 'Parcial')
        : diasAtraso ? 'Vencido' : 'Pendente'
    return {
      id: c.id,
      descricao: ordemSegura ? c.descricao : 'Cobrança com vínculo da OS em revisão',
      ordemId: ordemSegura ? c.ordemId : null,
      paciente: ordemSegura ? c.ordem?.nomePaciente || '-' : 'Vínculo da OS em revisão',
      servico: ordemSegura ? c.ordem?.servicoNome || '-' : '-',
      valor,
      liquidado,
      restante,
      vencimento: c.dataVencimento.toISOString(),
      recebimento: c.dataRecebimento ? c.dataRecebimento.toISOString() : null,
      diasAtraso,
      status,
    }
  }

  const pendentes = contas
    .filter(c => Number(c.valorRecebido) < Number(c.valor))
    .map(formatConta)

  const pagas = contas
    .filter(c => Number(c.valorRecebido) >= Number(c.valor))
    .map(formatConta)

  return { pendentes, pagas }
}
