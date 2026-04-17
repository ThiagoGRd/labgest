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

export async function getNotificacoesPortal() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return []

  const notificacoes = []

  // 1. Verificar Ordens em Prova
  const ordensProva = await prisma.ordem.findMany({
    where: {
      clienteId: logado.cliente.id,
      status: 'Em Prova'
    },
    select: { id: true, nomePaciente: true }
  })

  ordensProva.forEach(o => {
    notificacoes.push({
      id: `prova-${o.id}`,
      titulo: 'Avaliação Necessária',
      mensagem: `O caso de ${o.nomePaciente} está aguardando sua prova.`,
      tipo: 'warning',
      lida: false,
      data: new Date().toISOString(),
      link: `/pedidos` // Poderia linkar direto ao modal no futuro
    })
  })

  // 2. Verificar Contas Pendentes
  const faturasAbertas = await prisma.contaReceber.count({
    where: {
      clienteId: logado.cliente.id,
      status: { notIn: ['Recebido', 'Pago'] }
    }
  })

  if (faturasAbertas > 0) {
    notificacoes.push({
      id: `fin-${Date.now()}`,
      titulo: 'Pagamento Pendente',
      mensagem: `Você possui ${faturasAbertas} cobrança(s) em aberto no laboratório.`,
      tipo: 'destructive',
      lida: false,
      data: new Date().toISOString(),
      link: `/financeiro`
    })
  }

  return notificacoes
}
