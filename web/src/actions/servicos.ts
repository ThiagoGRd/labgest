'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function getServicos() {
  await requireUser()
  try {
    const servicos = await prisma.servico.findMany({
      orderBy: { nome: 'asc' },
      include: {
        ordens: { select: { id: true } }
      }
    })

    return servicos.map(s => {
      const preco = Number(s.preco)
      const custo = Number(s.custoMateriais || 0)
      const margemLucro = preco > 0 ? Math.round(((preco - custo) / preco) * 100) : 0
      
      // Parse materiais
      let materiais: string[] = []
      if (Array.isArray(s.materiais)) {
        materiais = s.materiais as string[]
      } else if (typeof s.materiais === 'string') {
        try {
          materiais = JSON.parse(s.materiais)
        } catch {
          materiais = []
        }
      }

      return {
        id: s.id,
        nome: s.nome,
        categoria: s.categoria || 'Geral',
        descricao: s.descricao || '',
        preco,
        tempoProducao: s.tempoProducao || 0,
        materiais, 
        custoMateriais: custo,
        margemLucro,
        ativo: s.ativo,
        totalPedidos: s.ordens.length,
      }
    })
  } catch (error) {
    console.error('Erro ao buscar serviços:', error)
    return []
  }
}

export async function createServico(data: {
  nome: string
  categoria: string
  preco: number
  tempoProducao: number
  custoMateriais: number
  descricao: string
}) {
  try {
    await prisma.servico.create({
      data: {
        ...data,
        materiais: [], // TODO: Adicionar campo de materiais no modal
      }
    })
    revalidatePath('/servicos')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar serviço:', error)
    return { success: false, error: 'Erro ao criar serviço' }
  }
}
