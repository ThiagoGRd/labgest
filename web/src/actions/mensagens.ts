"use server"

import { randomUUID } from 'node:crypto'
import { prisma } from '@labgest/database'
import { alterarMensagens, mensagensDaOrdem, recibos } from '@labgest/database/src/mensagens'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function enviarMensagemLab(ordemId: number, texto: string, fotoUrl?: string, requestId?: string) {
  const usuario = await requireUser()
  if (!texto.trim() && !fotoUrl) return { success: false, error: 'Mensagem vazia' }
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return { success: false, error: 'Identificador de mensagem inválido' }
  const novaMensagem = {
    id: requestId?.toLowerCase() || randomUUID(), role: 'lab', nome: usuario.nome || 'Equipe LabGest',
    remetenteId: usuario.id, texto: texto.trim(), createdAt: new Date().toISOString(),
    lidoPeloLab: true, lidoPeloDentista: false,
    ...(fotoUrl ? { fotoUrl } : {}),
  }
  let conflito = false
  let mensagem: ReturnType<typeof mensagensDaOrdem>[number] = novaMensagem
  const ok = await alterarMensagens(ordemId, undefined, atuais => {
    const anterior = mensagensDaOrdem(atuais).find(m => m.id === novaMensagem.id)
    if (anterior) {
      conflito = anterior.role !== novaMensagem.role || anterior.remetenteId !== usuario.id
        || anterior.texto !== novaMensagem.texto || anterior.fotoUrl !== novaMensagem.fotoUrl
      mensagem = anterior
      return atuais
    }
    return [...atuais, novaMensagem]
  })
  if (conflito) return { success: false, error: 'Identificador já utilizado por outra mensagem' }
  if (!ok) return { success: false, error: 'Ordem não encontrada' }
  revalidatePath('/ordens')
  revalidatePath('/producao')
  return { success: true, mensagem }
}

export async function lerMensagens(ordemId: number) {
  await requireUser()
  const ordem = await prisma.ordem.findFirst({ where: { id: ordemId }, select: { mensagens: true } })
  if (!ordem) return { success: false, error: 'Ordem não encontrada', mensagens: [] }
  return { success: true, mensagens: mensagensDaOrdem(ordem.mensagens) }
}

export async function marcarMensagensLidas(ordemId: number, ids: string[]) {
  await requireUser()
  const success = await alterarMensagens(ordemId, undefined, atuais => recibos(atuais, ids, 'lab'))
  return { success }
}
