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

export async function getProfile() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return null

  return {
    nome: logado.cliente.nome,
    email: logado.cliente.email,
    telefone: logado.cliente.telefone,
    cro: logado.cliente.cro,
    endereco: logado.cliente.endereco,
  }
}

export async function updateProfile(data: {
  nome: string
  telefone: string
  cro: string
  endereco: string
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado' }
  }

  try {
    // Atualiza no banco de dados
    await prisma.cliente.update({
      where: { id: logado.cliente.id },
      data: {
        nome: data.nome,
        telefone: data.telefone,
        cro: data.cro,
        endereco: data.endereco,
      }
    })

    // Tenta atualizar metadata no Auth também (opcional, mas bom pra manter sync)
    const supabase = await createClient()
    await supabase.auth.updateUser({
      data: {
        full_name: data.nome,
        cro: data.cro
      }
    })

    revalidatePath('/perfil')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { success: false, error: 'Erro ao atualizar perfil' }
  }
}
