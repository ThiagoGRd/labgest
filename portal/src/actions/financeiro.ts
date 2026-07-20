'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'

async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  const cliente = await prisma.cliente.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true }
  })

  return { user, cliente }
}

export async function getContasCliente() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { pendentes: [], pagas: [] }
  }

  const contas = await prisma.contaReceber.findMany({
    where: { clienteId: logado.cliente.id, status: { not: 'Cancelado' } },
    orderBy: { dataVencimento: 'asc' },
    include: {
      ordem: { select: { nomePaciente: true, servicoNome: true } }
    }
  })

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const formatConta = (c: (typeof contas)[number]) => {
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
      descricao: c.descricao,
      ordemId: c.ordemId,
      paciente: c.ordem?.nomePaciente || '-',
      servico: c.ordem?.servicoNome || '-',
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
