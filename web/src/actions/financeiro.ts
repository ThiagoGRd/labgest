'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function getContas() {
  await requireUser()
  try {
    const [aReceber, aPagar] = await Promise.all([
      prisma.contaReceber.findMany({
        orderBy: { dataVencimento: 'asc' },
        include: { cliente: { select: { nome: true } } }
      }),
      prisma.contaPagar.findMany({
        orderBy: { dataVencimento: 'asc' },
      })
    ])

    return {
      receber: aReceber.map(c => ({
        id: c.id,
        descricao: c.descricao,
        cliente: c.clienteNome || c.cliente?.nome || '',
        valor: Number(c.valor),
        vencimento: c.dataVencimento.toISOString(),
        status: c.status || 'Pendente',
        observacoes: c.observacoes || '',
      })),
      pagar: aPagar.map(c => ({
        id: c.id,
        descricao: c.descricao,
        categoria: c.categoria || 'Outros',
        valor: Number(c.valor),
        vencimento: c.dataVencimento.toISOString(),
        status: c.status || 'Pendente',
        observacoes: c.observacoes || '',
      }))
    }
  } catch (error) {
    console.error('Erro ao buscar contas:', error)
    return { receber: [], pagar: [] }
  }
}

export async function createConta(data: {
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  vencimento: string
  cliente?: string
  categoria?: string
  observacoes?: string
}) {
  try {
    if (data.tipo === 'receber') {
      // Find cliente by name if passed as string, or handle ID
      // For now assume client name string match or fail
      // In real app, select should pass ID.
      // Let's try to find match or just store name if not found/optional
      // Actually schema has clienteId (Int) and clienteNome (String).
      
      let clienteId = null
      if (data.cliente) {
        const cliente = await prisma.cliente.findFirst({ where: { nome: data.cliente } })
        if (cliente) clienteId = cliente.id
      }

      await prisma.contaReceber.create({
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento: new Date(data.vencimento),
          clienteNome: data.cliente,
          clienteId,
          observacoes: data.observacoes,
          status: 'Pendente',
        }
      })
    } else {
      await prisma.contaPagar.create({
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento: new Date(data.vencimento),
          categoria: data.categoria,
          observacoes: data.observacoes,
          status: 'Pendente',
        }
      })
    }
    
    revalidatePath('/financeiro')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar conta:', error)
    return { success: false, error: 'Erro ao criar conta' }
  }
}
