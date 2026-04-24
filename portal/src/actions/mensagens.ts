'use server'

import { createClient } from '@/lib/supabase/server'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  const cliente = await prisma.cliente.findFirst({
    where: { email: user.email }
  })

  return { user, cliente }
}

export async function enviarMensagem(ordemId: number, texto: string, fotoUrl?: string) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Não autorizado' }
  }

  // Verifica se a ordem pertence ao cliente
  const ordem = await prisma.ordem.findFirst({
    where: { 
      id: ordemId,
      clienteId: logado.cliente.id 
    }
  })

  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada' }
  }

  // Valida: precisa ter texto ou foto
  if (!texto.trim() && !fotoUrl) {
    return { success: false, error: 'Mensagem vazia' }
  }

  const mensagensAtuais = Array.isArray((ordem as any).mensagens) ? (ordem as any).mensagens : []
  
  const novaMensagem: Record<string, any> = {
    id: Date.now().toString(),
    role: 'dentista',
    nome: logado.user.user_metadata?.full_name || 'Dentista',
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

  revalidatePath('/pedidos')
  revalidatePath('/historico')
  
  return { success: true, mensagem: novaMensagem }
}
