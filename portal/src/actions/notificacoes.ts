'use server'

import { requireClienteIdentity } from '@/lib/cliente-identity'
import { prisma } from '@labgest/database'

export interface NotificacaoPortal {
  id: string
  titulo: string
  mensagem: string
  tipo: 'info' | 'warning' | 'destructive'
  lida: boolean
  data: string
  link: string
  count?: number
}

function isRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export async function getNotificacoesPortal() {
  const cliente = await requireClienteIdentity()

  const notificacoes: NotificacaoPortal[] = []

  // 1. Mensagens não lidas do laboratório (role = 'lab')
  const ordensComMensagens = await prisma.ordem.findMany({
    where: { clienteId: cliente.id },
    select: { id: true, nomePaciente: true, mensagens: true }
  })

  let totalMsgNaoLidas = 0
  for (const o of ordensComMensagens) {
    const msgs = Array.isArray(o.mensagens) ? o.mensagens : []
    const naoLidas = msgs.filter(
      (mensagem) => isRegistro(mensagem) && mensagem.role === 'lab' && !mensagem.lidoPeloDentista
    )
    totalMsgNaoLidas += naoLidas.length
  }

  if (totalMsgNaoLidas > 0) {
    notificacoes.push({
      id: `msg-unread`,
      titulo: `${totalMsgNaoLidas} mensagem(ns) do laboratório`,
      mensagem: 'Você possui mensagens não lidas nos seus pedidos.',
      tipo: 'info',
      lida: false,
      data: new Date().toISOString(),
      link: '/pedidos',
      count: totalMsgNaoLidas,
    })
  }

  // 2. Ordens em Prova aguardando avaliação
  const ordensProva = await prisma.ordem.findMany({
    where: { clienteId: cliente.id, status: 'Em Prova' },
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
      link: '/pedidos',
    })
  })

  // 3. Contas pendentes
  const faturasAbertas = await prisma.contaReceber.count({
    where: {
      clienteId: cliente.id,
      status: { notIn: ['Recebido', 'Pago', 'Cancelado'] }
    }
  })

  if (faturasAbertas > 0) {
    notificacoes.push({
      id: `fin-pending`,
      titulo: 'Pagamento Pendente',
      mensagem: `Você possui ${faturasAbertas} cobrança(s) em aberto.`,
      tipo: 'destructive',
      lida: false,
      data: new Date().toISOString(),
      link: '/financeiro',
    })
  }

  return notificacoes
}

/** Conta total de notificações importantes (para o badge numérico) */
export async function getContagemNotificacoes() {
  const items = await getNotificacoesPortal()
  // Mensagens somam pelo campo count (pode ser >1), o resto conta como 1 cada
  return items.reduce((acc, n) => acc + (n.count ?? 1), 0)
}
