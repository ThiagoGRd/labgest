'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function getProducao() {
  await requireUser()

  try {
    const ordens = await prisma.ordem.findMany({
      where: {
        status: { not: 'Finalizado' }, // Apenas ordens ativas
        // status: { not: 'Entregue' } // Se tiver status entregue
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
      foto: null
    }))
  } catch (error) {
    console.error('Erro ao buscar produção:', error)
    return []
  }
}

export async function moverOrdem(id: number, novaEtapa: string) {
  try {
    await prisma.ordem.update({
      where: { id },
      data: { etapaAtual: novaEtapa }
    })
    revalidatePath('/producao')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao mover ordem' }
  }
}
