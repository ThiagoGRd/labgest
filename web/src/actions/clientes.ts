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
    const campos = validarCliente(data)
    campos.email = campos.email.toLowerCase()
    await prisma.$transaction(async tx => {
      // All application email writes share this transaction lock. ReadCommitted
      // gives the duplicate query a fresh snapshot after the preceding writer.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(187431, 1)`
      if (campos.email && await tx.cliente.findFirst({ where: { email: { equals: campos.email, mode: 'insensitive' } } })) {
        throw new Error('Email já cadastrado. Revise o cadastro existente com o laboratório.')
      }
      await tx.cliente.create({ data: campos })
    }, { isolationLevel: 'ReadCommitted' })
    revalidatePath('/clientes')
    return { success: true }
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('Email já'))) console.error('Erro ao criar cliente:', error)
    return { success: false, error: error instanceof Error && error.message.startsWith('Email já') ? error.message : 'Erro ao criar cliente' }
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
    data.email = data.email.toLowerCase()
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(187431, 1)`
      const cliente = await tx.cliente.findUnique({ where: { id } })
      if (!cliente) throw new Error('Cliente não encontrado')
      if (cliente.email?.trim() && cliente.email.trim().toLowerCase() !== data.email) {
        throw new Error('O email de acesso não pode ser alterado ou removido por esta tela. Solicite ao laboratório a revisão do vínculo do portal.')
      }
      if (data.email && await tx.cliente.findFirst({ where: { id: { not: id }, email: { equals: data.email, mode: 'insensitive' } } })) {
        throw new Error('Email já cadastrado. Revise o cadastro existente com o laboratório.')
      }
      await tx.cliente.update({ where: { id }, data })
    }, { isolationLevel: 'ReadCommitted' })
    revalidatePath('/clientes')
    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { success: false, error: /^(O email de acesso|Email já|Cliente não encontrado)/.test(message) ? message : 'Não foi possível atualizar o cliente. Tente novamente.' }
  }
}
