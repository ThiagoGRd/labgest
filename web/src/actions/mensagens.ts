'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function enviarMensagemLab(ordemId: number, texto: string) {
  const usuario = await requireUser()

  const ordem = await (prisma.ordem as any).findFirst({
    where: { id: ordemId }
  })

  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada' }
  }

  const mensagensAtuais = Array.isArray(ordem.mensagens) ? ordem.mensagens : []
  
  const novaMensagem = {
    id: Date.now().toString(),
    role: 'lab',
    nome: (usuario as any).nome || 'Equipe LabGest',
    texto,
    createdAt: new Date().toISOString()
  }

  const novasMensagens = [...mensagensAtuais, novaMensagem]

  await (prisma.ordem.update as any)({
    where: { id: ordemId },
    data: { mensagens: novasMensagens }
  })

  revalidatePath('/ordens')
  revalidatePath('/producao')
  
  return { success: true, mensagem: novaMensagem }
}
