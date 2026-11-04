'use server'

import { requireClienteIdentity, resolveClienteIdentity } from '@/lib/cliente-identity'
import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'

export async function getProfile() {
  const cliente = await requireClienteIdentity()

  return {
    nome: cliente.nome,
    email: cliente.email,
    telefone: cliente.telefone,
    cro: cliente.cro,
    endereco: cliente.endereco,
  }
}

export async function updateProfile(data: {
  nome: string
  telefone: string
  cro: string
  endereco: string
}) {
  const identity = await resolveClienteIdentity()
  if (!identity.ok) return { success: false, error: identity.error }
  const cliente = identity.cliente

  try {
    // Atualiza no banco de dados
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        nome: data.nome,
        telefone: data.telefone,
        cro: data.cro,
        endereco: data.endereco,
      }
    })

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    return { success: false, error: 'Erro ao atualizar perfil' }
  }
}
