'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'

export async function getLabConfig() {
  try {
    const config = await prisma.configuracao.findFirst()
    return config
  } catch (error) {
    console.error('Erro ao buscar configurações:', error)
    return null
  }
}

export async function updateLabConfig(data: {
  nome_laboratorio: string
  cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
}) {
  try {
    const config = await prisma.configuracao.findFirst()

    if (config) {
      await prisma.configuracao.update({
        where: { id: config.id },
        data: {
          nome_laboratorio: data.nome_laboratorio,
          cnpj: data.cnpj,
          telefone: data.telefone,
          email: data.email,
          endereco: data.endereco,
        },
      })
    } else {
      await prisma.configuracao.create({
        data: {
          nome_laboratorio: data.nome_laboratorio,
          cnpj: data.cnpj,
          telefone: data.telefone,
          email: data.email,
          endereco: data.endereco,
        },
      })
    }

    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error)
    return { success: false, error: 'Erro ao salvar' }
  }
}
