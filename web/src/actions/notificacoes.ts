'use server'

import { prisma } from '@labgest/database'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { requireUser } from '@/lib/auth-utils'

export async function notificarMudancaStatus(ordemId: number, novoStatus: string) {
  await requireUser()

  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      include: { cliente: true }
    })

    if (!ordem || !ordem.cliente?.telefone) {
      return { success: false, error: 'Ordem ou telefone do cliente não encontrado' }
    }

    const mensagens: Record<string, string> = {
      'Em Produção': `Olá Dr(a). ${ordem.cliente.nome}, a ordem do paciente *${ordem.nomePaciente}* iniciou a produção! 🦷`,
      'Finalizado': `Olá Dr(a). ${ordem.cliente.nome}, a ordem do paciente *${ordem.nomePaciente}* foi finalizada e está pronta para entrega! 🎉`,
      'Entregue': `Olá Dr(a). ${ordem.cliente.nome}, a ordem do paciente *${ordem.nomePaciente}* saiu para entrega. Obrigado! 🛵`,
    }

    const mensagem = mensagens[novoStatus]
    
    if (!mensagem) {
      return { success: false, error: 'Status sem notificação configurada' }
    }

    const result = await sendWhatsAppMessage(ordem.cliente.telefone, mensagem)
    
    return result

  } catch (error) {
    console.error('Erro ao notificar:', error)
    return { success: false, error: 'Erro interno ao notificar' }
  }
}
