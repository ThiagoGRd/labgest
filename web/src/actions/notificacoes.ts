'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'

export async function getNotificacoesConfig() {
  return {
    novaOrdem: true,
    atrasos: true,
    estoqueBaixo: true,
    ordemFinalizada: false,
    resumoDiario: false
  }
}

export async function saveNotificacoesConfig(config: any) {
  console.log('Salvando preferências:', config)
  revalidatePath('/configuracoes')
  return { success: true }
}

export async function notificarMudancaStatus(ordemId: number, novoStatus: string) {
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      include: { cliente: true }
    })

    if (!ordem || !ordem.cliente || !ordem.cliente.telefone) {
      return { success: false, error: 'Cliente sem telefone cadastrado ou ordem não encontrada.' }
    }

    // Limpar telefone (apenas números)
    const telefone = ordem.cliente.telefone.replace(/\D/g, '')
    
    // Mensagem baseada no status
    let mensagem = ''
    if (novoStatus === 'Finalizado') {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, tudo bem? 
O trabalho do paciente *${ordem.nomePaciente}* (${ordem.servicoNome}) foi finalizado e já está saindo para entrega! 🛵💨
Acesse o portal para mais detalhes: https://labgest-portal.vercel.app`
    } else {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, o status do pedido *${ordem.nomePaciente}* mudou para: *${novoStatus}*.`
    }

    const encodedMsg = encodeURIComponent(mensagem)
    const whatsappLink = `https://wa.me/55${telefone}?text=${encodedMsg}`

    // Atualizar status no banco se for finalizado
    if (novoStatus === 'Finalizado') {
      await prisma.ordem.update({
        where: { id: ordemId },
        data: { 
          status: 'Finalizado',
          dataFinalizacao: new Date()
        }
      })
      revalidatePath('/ordens')
    }

    return { success: true, whatsappLink }
  } catch (error) {
    console.error('Erro ao gerar notificação:', error)
    return { success: false, error: 'Erro interno ao processar notificação.' }
  }
}
