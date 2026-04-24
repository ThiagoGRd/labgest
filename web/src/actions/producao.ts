'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { abaterEstoquePorServico } from './estoque'
import { gerarCobrancaAutomatica } from './financeiro'
import { normalizarEtapa } from '@/lib/workflow-config'

export async function getProducao() {
  await requireUser()

  try {
    const ordens = await prisma.ordem.findMany({
      where: {
        status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] },
      },
      orderBy: { prioridade: 'asc' },
      include: {
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } },
        ciclos: {
          where: { status: { in: ['no_lab', 'em_prova'] } },
          orderBy: { numeroCiclo: 'desc' },
          take: 1
        }
      } as any
    })

    return ordens.map((o: any) => {
      const cicloAtivo = o.ciclos?.[0] ?? null
      return {
        id: o.id,
        paciente: o.nomePaciente,
        dentista: o.clienteNome || o.cliente?.nome || 'Desconhecido',
        servico: o.servicoNome || o.servico?.nome || 'Serviço',
        etapa: normalizarEtapa(o.etapaAtual || 'recebimento'),
        prioridade: o.prioridade || 'Normal',
        entrega: o.dataEntrega.toISOString(),
        cor: o.corDentes,
        elementos: o.elementos,
        foto: null,
        tipoWorkflow: (o as any).tipoWorkflow || 'simples',
        cicloAtivoId: cicloAtivo?.id ?? null,
        cicloStatus: cicloAtivo?.status ?? null,
        cicloNumero: cicloAtivo?.numeroCiclo ?? null,
        cicloComprometido: cicloAtivo?.dataComprometida?.toISOString() ?? null,
        cicloDentistaDeci: cicloAtivo?.decisao ?? null,
        cicloObs: cicloAtivo?.observacoesDentista ?? null,
        cicloFotos: (cicloAtivo?.fotosProva as string[]) ?? [],
      }
    })
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

    // Se finalizou, abate estoque e gera cobrança automaticamente
    if (novaEtapa === 'Finalizado' && ordem.servicoId) {
      await abaterEstoquePorServico(ordem.servicoId)
    }
    if (novaEtapa === 'Finalizado') {
      // Gera conta a receber (ignora erro se já existir)
      await gerarCobrancaAutomatica(id).catch(() => {})
    }

    revalidatePath('/producao')
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao mover ordem' }
  }
}
