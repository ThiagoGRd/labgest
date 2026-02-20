'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { abaterEstoquePorServico } from './estoque'

export async function getProducao() {
  await requireUser()

  try {
    const ordens = await prisma.ordem.findMany({
      where: {
        status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] },
      },
      orderBy: { prioridade: 'asc' }, // Urgente primeiro (se mapeado corretamente)
      include: {
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } }
      }
    })

    return ordens.map(o => ({
      id: o.id,
      paciente: o.nomePaciente,
      dentista: o.clienteNome || o.cliente?.nome || 'Desconhecido',
      servico: o.servicoNome || o.servico?.nome || 'Serviço',
      etapa: o.etapaAtual || 'Recebimento',
      prioridade: o.prioridade || 'Normal',
      entrega: o.dataEntrega.toISOString(),
      cor: o.corDentes,
      elementos: o.elementos,
      foto: null
    }))
  } catch (error) {
    console.error('Erro ao buscar produção:', error)
    return []
  }
}

export async function moverOrdem(id: number, novaEtapa: string) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.update({
      where: { id },
      data: { 
        etapaAtual: novaEtapa,
        // Se for movido para Finalizado no Kanban, atualiza status também
        status: novaEtapa === 'Finalizado' ? 'Finalizado' : undefined,
        dataFinalizacao: novaEtapa === 'Finalizado' ? new Date() : undefined
      },
      select: { servicoId: true }
    })

    // Se finalizou, abate estoque
    if (novaEtapa === 'Finalizado' && ordem.servicoId) {
      await abaterEstoquePorServico(ordem.servicoId)
    }

    revalidatePath('/producao')
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao mover ordem' }
  }
}
