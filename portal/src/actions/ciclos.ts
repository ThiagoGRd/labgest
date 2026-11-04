'use server'

import { erroTransicaoOrdem } from '@labgest/shared'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { resolveClienteIdentity } from '@/lib/cliente-identity'
import { createClient } from '@/lib/supabase/server'

// Busca ciclos de um pedido — usado pelo Portal do Dentista
export async function getCiclosByPedido(ordemId: number) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) return []
    const identity = await resolveClienteIdentity(user)
    const cliente = identity.ok ? identity.cliente : null
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

    const identity = await resolveClienteIdentity(user)
    const cliente = identity.ok ? identity.cliente : null
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ordens WHERE id = (SELECT ordem_id FROM ciclos_producao WHERE id = ${cicloId}) AND cliente_id = ${cliente.id} FOR UPDATE`
      const cicloAtual = await tx.cicloProducao.findUnique({
        where: { id: cicloId },
        include: { ordem: { select: { clienteId: true, status: true } } },
      })
      if (!cicloAtual || cicloAtual.ordem.clienteId !== cliente.id) {
        return { success: false, error: 'Prova não encontrada' }
      }
      const erroEstado = erroTransicaoOrdem(cicloAtual.ordem.status, false)
      if (erroEstado) return { success: false as const, error: erroEstado }
      const cicloAtivo = await tx.cicloProducao.findFirst({ where: { ordemId: cicloAtual.ordemId, status: { in: ['no_lab', 'em_prova'] } }, orderBy: { numeroCiclo: 'desc' }, select: { id: true } })
      if (!cicloAtivo || cicloAtivo.id !== cicloId) return { success: false, error: 'Esta prova não é mais o ciclo ativo da ordem.' }
      if (cicloAtual.status !== 'em_prova') {
        return { success: false, error: 'Esta prova não está mais aguardando avaliação' }
      }

      await Promise.all([
        tx.cicloProducao.update({
          where: { id: cicloId },
          data: {
            observacoesDentista: observacoesNormalizadas,
            decisao,
            fotosProva: fotos,
          },
        }),
        tx.ordem.update({
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
    })
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erro ao salvar o resultado da prova' }
  }
}
