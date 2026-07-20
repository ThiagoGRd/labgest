'use server'

import { Prisma, prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

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
    where: { id: ordemId }
  })

  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada' }
  }

  if (!texto.trim() && !fotoUrl) {
    return { success: false, error: 'Mensagem vazia' }
  }

  const mensagensAtuais = Array.isArray(ordem.mensagens) ? ordem.mensagens : []
  
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
    data: { mensagens: novasMensagens as Prisma.InputJsonArray }
  })

  revalidatePath('/ordens')
  revalidatePath('/producao')
  
  return { success: true, mensagem: novaMensagem }
}
