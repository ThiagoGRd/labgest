'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

export async function getNotificacoesConfig() {
  await requireUser()
  return { supported: false, error: 'Preferências de notificações ainda não estão disponíveis.' }
}

export async function saveNotificacoesConfig(config: Record<string, boolean>) {
  await requireUser()
  void config // Compatibility only: these preferences have no delivery integration.
  return { success: false, error: 'Preferências de notificações ainda não estão disponíveis. Nenhuma alteração foi salva.' }
}

export async function gerarNotificacaoWhatsApp(ordemId: number) {
  await requireUser()
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
    const telefoneWhatsapp = telefone.startsWith('55') ? telefone : `55${telefone}`
    if (telefoneWhatsapp.length < 12 || telefoneWhatsapp.length > 13) {
      return { success: false, error: 'Telefone do cliente inválido para WhatsApp.' }
    }
    
    const statusAtual = ordem.status || 'Aguardando'
    let mensagem = ''
    if (statusAtual === 'Finalizado') {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, tudo bem? 
O trabalho do paciente *${ordem.nomePaciente}* (${ordem.servicoNome}) foi finalizado e está pronto para combinar a entrega.
Acesse o portal para mais detalhes: https://labgest-portal.vercel.app`
    } else if (statusAtual === 'Entregue') {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, o trabalho do paciente *${ordem.nomePaciente}* (${ordem.servicoNome}) foi registrado como entregue.`
    } else {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, o status atual do pedido *${ordem.nomePaciente}* é: *${statusAtual}*.`
    }

    const encodedMsg = encodeURIComponent(mensagem)
    const whatsappLink = `https://wa.me/${telefoneWhatsapp}?text=${encodedMsg}`

    return { success: true, whatsappLink }
  } catch (error) {
    console.error('Erro ao gerar notificação:', error)
    return { success: false, error: 'Erro interno ao processar notificação.' }
  }
}
