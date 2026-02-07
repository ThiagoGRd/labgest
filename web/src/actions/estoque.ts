'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function getEstoque() {
  await requireUser()
  try {
    const estoque = await prisma.estoque.findMany({
      orderBy: { nome: 'asc' },
    })

    return estoque.map(e => ({
      id: e.id,
      nome: e.nome,
      categoria: e.categoria,
      quantidade: Number(e.quantidade),
      quantidadeMinima: Number(e.quantidadeMinima),
      unidade: e.unidade,
      precoUnitario: Number(e.precoUnitario),
      fornecedor: e.fornecedor || '',
      localizacao: e.localizacao || '',
      dataValidade: e.dataValidade ? e.dataValidade.toISOString() : null,
      codigoBarras: e.codigoBarras || '',
    }))
  } catch (error) {
    console.error('Erro ao buscar estoque:', error)
    return []
  }
}

export async function createItemEstoque(data: {
  nome: string
  categoria: string
  quantidade: number
  unidade: string
  quantidadeMinima: number
  precoUnitario: number
  fornecedor?: string
  localizacao?: string
  dataValidade?: string
  codigoBarras?: string
}) {
  try {
    await prisma.estoque.create({
      data: {
        nome: data.nome,
        categoria: data.categoria,
        quantidade: data.quantidade,
        unidade: data.unidade,
        quantidadeMinima: data.quantidadeMinima,
        precoUnitario: data.precoUnitario,
        fornecedor: data.fornecedor,
        localizacao: data.localizacao,
        dataValidade: data.dataValidade ? new Date(data.dataValidade) : null,
        codigoBarras: data.codigoBarras,
      }
    })
    revalidatePath('/estoque')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar item de estoque:', error)
    return { success: false, error: 'Erro ao criar item' }
  }
}

// Função para abater estoque automaticamente
export async function abaterEstoquePorServico(servicoId: number) {
  try {
    const servico = await prisma.servico.findUnique({
      where: { id: servicoId },
      select: { materiais: true }
    })

    if (!servico || !servico.materiais) return { success: true, message: 'Sem materiais vinculados' }

    const materiais = servico.materiais as Array<{ id: number; quantidade: number }>

    for (const mat of materiais) {
      if (mat.id && mat.quantidade) {
        await prisma.estoque.update({
          where: { id: mat.id },
          data: { quantidade: { decrement: mat.quantidade } }
        })
      }
    }

    revalidatePath('/estoque')
    return { success: true }
  } catch (error) {
    console.error('Erro ao abater estoque:', error)
    // Não deve bloquear o fluxo principal se falhar
    return { success: false, error: 'Erro ao atualizar estoque' }
  }
}
