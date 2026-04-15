'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'

// Abre um novo ciclo quando o trabalho entra no lab
export async function abrirCiclo(ordemId: number, prazoDias: number, etapa?: string) {
  await requireUser()

  // Conta quantos ciclos já existem para numerar o novo
  const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId } })

  const dataEntrada = new Date()
  const dataComprometida = new Date()
  dataComprometida.setDate(dataComprometida.getDate() + prazoDias)

  const ciclo = await prisma.cicloProducao.create({
    data: {
      ordemId,
      numeroCiclo: totalCiclos + 1,
      etapa: etapa || 'Produção',
      dataEntrada,
      prazoDias,
      dataComprometida,
      status: 'no_lab',
    }
  })

  // Atualiza status da ordem para Em Produção se estava Aguardando
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      status: 'Em Produção',
      tipoWorkflow: 'ciclico',
    }
  })

  revalidatePath('/producao')
  revalidatePath('/ordens')
  return { success: true, ciclo }
}

// Auxiliar registra que o trabalho saiu do lab para prova
export async function enviarParaProva(cicloId: number) {
  await requireUser()

  const ciclo = await prisma.cicloProducao.update({
    where: { id: cicloId },
    data: {
      dataSaida: new Date(),
      status: 'em_prova',
    },
    include: { ordem: true }
  })

  // Atualiza status da ordem
  await prisma.ordem.update({
    where: { id: ciclo.ordemId },
    data: {
      status: 'Em Prova',
      etapaAtual: 'EmProva',
    }
  })

  revalidatePath('/producao')
  revalidatePath('/ordens')
  return { success: true, ciclo }
}

// Dentista registra resultado da prova via Portal
export async function salvarFeedbackProva(
  cicloId: number,
  observacoes: string,
  decisao: 'ajustes' | 'aprovado',
  fotos: string[] = []
) {
  // Esta action pode ser chamada pelo portal (sem requireUser de lab)
  const ciclo = await prisma.cicloProducao.update({
    where: { id: cicloId },
    data: {
      observacoesDentista: observacoes,
      decisao,
      fotosProva: fotos,
    },
    include: { ordem: true }
  })

  // Se aprovado, muda status da ordem para sinalizar ao lab
  if (decisao === 'aprovado') {
    await prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: 'Retornou - Aprovado',
        etapaAtual: 'Finalização',
      }
    })
  } else {
    await prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: 'Retornou - Ajustes',
      }
    })
  }

  revalidatePath('/pedidos')
  return { success: true }
}

// Auxiliar confirma recebimento físico e abre novo ciclo
export async function confirmarRetorno(cicloId: number, novoPrazoDias: number, novaEtapa?: string) {
  await requireUser()

  // Fecha o ciclo atual
  const cicloClosed = await prisma.cicloProducao.update({
    where: { id: cicloId },
    data: {
      dataRetorno: new Date(),
      status: 'concluido',
    },
    include: { ordem: true }
  })

  // Se decisão foi 'aprovado', vai para finalização sem abrir novo ciclo
  if (cicloClosed.decisao === 'aprovado') {
    await prisma.ordem.update({
      where: { id: cicloClosed.ordemId },
      data: {
        status: 'Em Produção',
        etapaAtual: 'Acabamento',
      }
    })
    revalidatePath('/producao')
    return { success: true, finalizar: true }
  }

  // Caso contrário, abre novo ciclo (ajustes)
  const resultado = await abrirCiclo(cicloClosed.ordemId, novoPrazoDias, novaEtapa)

  revalidatePath('/producao')
  revalidatePath('/ordens')
  return { success: true, novoCiclo: resultado.ciclo }
}

// Busca ciclos de uma ordem (para exibir no portal e no lab)
export async function getCiclosByOrdem(ordemId: number) {
  const ciclos = await prisma.cicloProducao.findMany({
    where: { ordemId },
    orderBy: { numeroCiclo: 'asc' }
  })
  return ciclos
}

// Busca o ciclo ativo atual de uma ordem
export async function getCicloAtivo(ordemId: number) {
  return await prisma.cicloProducao.findFirst({
    where: {
      ordemId,
      status: { in: ['no_lab', 'em_prova'] }
    },
    orderBy: { numeroCiclo: 'desc' }
  })
}
