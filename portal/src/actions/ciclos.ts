'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Busca ciclos de um pedido — usado pelo Portal do Dentista
export async function getCiclosByPedido(ordemId: number) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return []
    const cliente = await prisma.cliente.findFirst({ where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true }, select: { id: true } })
    if (!cliente) return []

    const ciclos = await prisma.cicloProducao.findMany({
      where: { ordemId, ordem: { clienteId: cliente.id } },
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
  const observacoesNormalizadas = observacoes.trim()
  if (decisao === 'ajustes' && !observacoesNormalizadas) {
    return { success: false, error: 'Descreva quais ajustes precisam ser realizados' }
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return { success: false, error: 'Não autorizado' }

    const cliente = await prisma.cliente.findFirst({
      where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true },
      select: { id: true },
    })
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    const cicloAtual = await prisma.cicloProducao.findUnique({
      where: { id: cicloId },
      include: { ordem: { select: { clienteId: true } } },
    })
    if (!cicloAtual || cicloAtual.ordem.clienteId !== cliente.id) {
      return { success: false, error: 'Prova não encontrada' }
    }
    if (cicloAtual.status !== 'em_prova') {
      return { success: false, error: 'Esta prova não está mais aguardando avaliação' }
    }

    await prisma.$transaction([
      prisma.cicloProducao.update({
        where: { id: cicloId },
        data: {
          observacoesDentista: observacoesNormalizadas,
          decisao,
          fotosProva: fotos,
        },
      }),
      prisma.ordem.update({
        where: { id: cicloAtual.ordemId },
        data: {
          status: 'Em Prova',
          etapaAtual: 'em_prova',
        },
      }),
    ])

    revalidatePath('/pedidos')
    revalidatePath('/historico')
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar o resultado da prova' }
  }
}
