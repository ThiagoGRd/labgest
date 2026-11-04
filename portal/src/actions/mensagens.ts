"use server"

import { randomUUID } from 'node:crypto'
import { prisma } from '@labgest/database'
import { alterarMensagens, mensagensDaOrdem, recibos } from '@labgest/database/src/mensagens'
import { revalidatePath } from 'next/cache'
import { requireClienteIdentity } from '@/lib/cliente-identity'

export async function enviarMensagem(ordemId: number, texto: string, fotoUrl?: string, requestId?: string) {
  const usuario = await requireClienteIdentity()
  if (!texto.trim() && !fotoUrl) return { success: false, error: 'Mensagem vazia' }
  if (requestId && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) return { success: false, error: 'Identificador de mensagem inválido' }
  const novaMensagem = {
    id: requestId?.toLowerCase() || randomUUID(), role: 'dentista', nome: usuario.nome || 'Dentista',
    remetenteId: usuario.id, texto: texto.trim(), createdAt: new Date().toISOString(),
    lidoPeloLab: false, lidoPeloDentista: true,
    ...(fotoUrl ? { fotoUrl } : {}),
  }
  let conflito = false
  let mensagem: ReturnType<typeof mensagensDaOrdem>[number] = novaMensagem
  const ok = await alterarMensagens(ordemId, usuario.id, atuais => {
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
  revalidatePath('/pedidos')
  revalidatePath('/historico')
  return { success: true, mensagem }
}

export async function lerMensagens(ordemId: number) {
  const usuario = await requireClienteIdentity()
  const ordem = await prisma.ordem.findFirst({ where: { id: ordemId, clienteId: usuario.id }, select: { mensagens: true } })
  if (!ordem) return { success: false, error: 'Ordem não encontrada', mensagens: [] }
  return { success: true, mensagens: mensagensDaOrdem(ordem.mensagens) }
}

export async function marcarMensagensLidas(ordemId: number, ids: string[]) {
  const usuario = await requireClienteIdentity()
  const success = await alterarMensagens(ordemId, usuario.id, atuais => recibos(atuais, ids, 'dentista'))
  return { success }
}
