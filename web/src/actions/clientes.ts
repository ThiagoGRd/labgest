'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { validarCliente } from '@/lib/clientes-utils'

export async function getClientes() {
  await requireUser()
  try {
    const clientes = await prisma.cliente.findMany({
      orderBy: { nome: 'asc' },
      include: {
        ordens: {
          select: {
            valorFinal: true,
            createdAt: true,
          }
        }
      }
    })

    // Mapear para o formato da interface, calculando totais
    return clientes.map(c => {
      const totalPedidos = c.ordens.length
      const valorTotal = c.ordens.reduce((acc, o) => acc + Number(o.valorFinal), 0)
      const ultimoPedido = c.ordens.length > 0 
        ? c.ordens.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0].createdAt?.toISOString() || null
        : null

      return {
        id: c.id,
        nome: c.nome,
        telefone: c.telefone || '',
        email: c.email || '',
        cro: c.cro,
        endereco: c.endereco || '',
        ativo: c.ativo,
        observacoes: c.observacoes || '',
        totalPedidos,
        valorTotal,
        ultimoPedido,
      }
    })
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    return []
  }
}

export async function createCliente(data: {
  nome: string
  telefone: string
  email?: string
  cro: string
  endereco?: string
  observacoes?: string
}) {
  await requireUser()
  try {
    await prisma.cliente.create({
      data: validarCliente(data)
    })
    revalidatePath('/clientes')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    return { success: false, error: 'Erro ao criar cliente' }
  }
}

export async function toggleClienteStatus(id: string, ativo: boolean) {
  await requireUser()
  try {
    await prisma.cliente.update({
      where: { id: Number(id) },
      data: { ativo }
    })
    revalidatePath('/clientes')
    return { success: true }
  } catch {
    return { success: false, error: 'Erro ao atualizar status' }
  }
}

export async function updateCliente(id: number, input: unknown) {
  await requireUser()
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
    return { success: false, error: 'Cliente inválido' }
  }
  let data
  try {
    data = validarCliente(input)
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Dados inválidos' }
  }
  try {
    await prisma.cliente.update({ where: { id }, data })
    revalidatePath('/clientes')
    return { success: true }
  } catch {
    return { success: false, error: 'Não foi possível atualizar o cliente. Tente novamente.' }
  }
}
