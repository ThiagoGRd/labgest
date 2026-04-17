'use server'

import { createClient } from '@/lib/supabase/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  const cliente = await prisma.cliente.findFirst({
    where: { email: user.email }
  })

  return { user, cliente }
}

export async function getContasCliente() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { pendentes: [], pagas: [] }
  }

  const contas = await prisma.contaReceber.findMany({
    where: { clienteId: logado.cliente.id },
    orderBy: { dataVencimento: 'desc' },
    include: {
      ordem: { select: { nomePaciente: true, servicoNome: true } }
    }
  })

  const formatConta = (c: any) => ({
    id: c.id,
    descricao: c.descricao,
    ordemId: c.ordemId,
    paciente: c.ordem?.nomePaciente || '-',
    servico: c.ordem?.servicoNome || '-',
    valor: Number(c.valor),
    vencimento: c.dataVencimento.toISOString(),
    recebimento: c.dataRecebimento ? c.dataRecebimento.toISOString() : null,
    status: c.status === 'Recebido' ? 'Pago' : c.status
  })

  const pendentes = contas
    .filter(c => c.status !== 'Recebido')
    .map(formatConta)

  const pagas = contas
    .filter(c => c.status === 'Recebido')
    .map(formatConta)

  return { pendentes, pagas }
}
