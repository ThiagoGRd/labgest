'use server'

import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// Busca ciclos de um pedido — usado pelo Portal do Dentista
export async function getCiclosByPedido(ordemId: number) {
  try {
    const ciclos = await prisma.cicloProducao.findMany({
      where: { ordemId },
      orderBy: { numeroCiclo: 'asc' }
    })
    return ciclos.map(c => ({
      ...c,
      dataEntrada: c.dataEntrada.toISOString(),
      dataComprometida: c.dataComprometida.toISOString(),
      dataSaida: c.dataSaida?.toISOString() || null,
      dataRetorno: c.dataRetorno?.toISOString() || null,
      fotosProva: (c.fotosProva as string[]) || [],
    }))
  } catch {
    return []
  }
}

// O dentista salva o resultado da prova via Portal
export async function salvarFeedbackProva(
  cicloId: number,
  observacoes: string,
  decisao: 'ajustes' | 'aprovado',
  fotos: string[] = []
) {
  try {
    const ciclo = await prisma.cicloProducao.update({
      where: { id: cicloId },
      data: {
        observacoesDentista: observacoes,
        decisao,
        fotosProva: fotos,
      },
      include: { ordem: true }
    })

    // Atualiza status da ordem para sinalizar ao lab
    await prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: decisao === 'aprovado' ? 'Retornou - Aprovado' : 'Retornou - Ajustes',
      }
    })

    revalidatePath('/pedidos')
    revalidatePath('/historico')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
