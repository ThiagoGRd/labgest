'use server'

import { Prisma, prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { enviarWhatsapp, montarUrlCheckinOrdem, normalizarDestinoWhatsapp } from '@/lib/whatsapp'

export interface MensagemLab {
  id: string
  role: 'lab'
  nome: string
  texto: string
  fotoUrl?: string
  createdAt: string
}

export async function enviarMensagemLab(ordemId: number, texto: string, fotoUrl?: string) {
  const usuario = await requireUser()

  const ordem = await prisma.ordem.findFirst({
    where: { id: ordemId },
    include: { cliente: true },
  })

  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada' }
  }

  if (!texto.trim() && !fotoUrl) {
    return { success: false, error: 'Mensagem vazia' }
  }

  const mensagensAtuais = Array.isArray(ordem.mensagens)
    ? (ordem.mensagens as Array<Record<string, unknown>>).map((msg) =>
        msg && typeof msg === 'object' && msg.role === 'dentista' && !msg.lidoPeloLab
          ? { ...msg, lidoPeloLab: true }
          : msg
      )
    : []
  
  const novaMensagem: MensagemLab = {
    id: Date.now().toString(),
    role: 'lab',
    nome: usuario.nome || 'Equipe LabGest',
    texto: texto.trim(),
    createdAt: new Date().toISOString(),
  }

  if (fotoUrl) {
    novaMensagem.fotoUrl = fotoUrl
  }

  const novasMensagens = [...mensagensAtuais, novaMensagem]

  await prisma.ordem.update({
    where: { id: ordemId },
    data: { mensagens: novasMensagens as unknown as Prisma.InputJsonArray }
  })

  if (ordem.cliente?.telefone) {
    try {
      const destino = normalizarDestinoWhatsapp(ordem.cliente.telefone)
      if (destino) {
        const urlCheckin = montarUrlCheckinOrdem(ordem.tokenRastreamento || ordem.id)
        await enviarWhatsapp(
          destino,
          `💬 *Mensagem do Laboratório — OS #${ordem.id}*\n• Paciente: *${ordem.nomePaciente}*\n• ${novaMensagem.nome}: "${novaMensagem.texto}"\n• Ver / Responder: ${urlCheckin}`,
        )
      }
    } catch {
      // Falha externa de WhatsApp não bloqueia o chat
    }
  }

  revalidatePath('/ordens')
  revalidatePath('/producao')
  revalidatePath('/lab-interno')
  
  return { success: true, mensagem: novaMensagem }
}

