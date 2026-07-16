'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'

async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  const cliente = await prisma.cliente.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true }
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

  const mensagensAtuais = Array.isArray(ordem.mensagens) ? ordem.mensagens : []
  
  const novaMensagem = {
    id: Date.now().toString(),
    role: 'dentista',
    nome: logado.user.user_metadata?.full_name || 'Dentista',
    texto: texto.trim(),
    createdAt: new Date().toISOString(),
    ...(fotoUrl ? { fotoUrl } : {}),
  }

  const novasMensagens = [...mensagensAtuais, novaMensagem]

  await prisma.ordem.update({
    where: { id: ordemId },
    data: { mensagens: novasMensagens }
  })

  revalidatePath('/pedidos')
  revalidatePath('/historico')
  
  return { success: true, mensagem: novaMensagem }
}
