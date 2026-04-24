'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function enviarMensagemLab(ordemId: number, texto: string, fotoUrl?: string) {
  const usuario = await requireUser()

  const ordem = await (prisma.ordem as any).findFirst({
    where: { id: ordemId }
  })

  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada' }
  }

  if (!texto.trim() && !fotoUrl) {
    return { success: false, error: 'Mensagem vazia' }
  }

  const mensagensAtuais = Array.isArray(ordem.mensagens) ? ordem.mensagens : []
  
  const novaMensagem: Record<string, any> = {
    id: Date.now().toString(),
    role: 'lab',
    nome: (usuario as any).nome || 'Equipe LabGest',
    texto: texto.trim(),
    createdAt: new Date().toISOString(),
  }

  if (fotoUrl) {
    novaMensagem.fotoUrl = fotoUrl
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
