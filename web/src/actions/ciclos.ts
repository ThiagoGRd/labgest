'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'
import { normalizarEtapa, statusParaEtapa } from '@/lib/workflow-config'

// Abre um novo ciclo quando o trabalho entra no lab
export async function abrirCiclo(ordemId: number, prazoDias: number, etapa?: string) {
  await requireUser()

  if (!Number.isInteger(prazoDias) || prazoDias <= 0) {
    return { success: false, error: 'Informe um prazo válido' }
  }

  // Conta quantos ciclos já existem para numerar o novo
  const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId } })

  const dataEntrada = new Date()
  const dataComprometida = new Date()
  dataComprometida.setDate(dataComprometida.getDate() + prazoDias)

  const subetapa = etapa?.trim() || 'Produção'
  const macroetapa = normalizarEtapa(subetapa)
  const [ciclo] = await prisma.$transaction([
    prisma.cicloProducao.create({
      data: {
        ordemId,
        numeroCiclo: totalCiclos + 1,
        etapa: subetapa,
        dataEntrada,
        prazoDias,
        dataComprometida,
        status: 'no_lab',
      }
    }),
    prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: macroetapa,
        subetapaAtual: subetapa,
        status: statusParaEtapa(macroetapa),
      }
    }),
  ])

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
      etapaAtual: 'em_prova',
      subetapaAtual: ciclo.etapa,
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
  const observacoesNormalizadas = observacoes.trim()
  if (decisao === 'ajustes' && !observacoesNormalizadas) {
    return { success: false, error: 'Descreva quais ajustes precisam ser realizados' }
  }

  // Esta action pode ser chamada pelo portal (sem requireUser de lab)
  const ciclo = await prisma.cicloProducao.update({
    where: { id: cicloId },
    data: {
      observacoesDentista: observacoesNormalizadas,
      decisao,
      fotosProva: fotos,
    },
    include: { ordem: true }
  })

  // A etapa permanece em prova até o laboratório confirmar o retorno físico.
  if (decisao === 'aprovado') {
    await prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: 'Em Prova',
        etapaAtual: 'em_prova',
      }
    })
  } else {
    await prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: 'Em Prova',
        etapaAtual: 'em_prova',
      }
    })
  }

  revalidatePath('/pedidos')
  return { success: true }
}

// Auxiliar confirma recebimento físico e abre novo ciclo
export async function confirmarRetorno(cicloId: number, novoPrazoDias: number, novaEtapa?: string) {
  await requireUser()

  const cicloAtual = await prisma.cicloProducao.findUnique({
    where: { id: cicloId },
    include: { ordem: true }
  })

  if (!cicloAtual) return { success: false, error: 'Ciclo de produção não encontrado' }
  if (!cicloAtual.decisao) {
    return { success: false, error: 'O dentista ainda não informou o resultado da prova' }
  }
  if (cicloAtual.decisao === 'ajustes' && !cicloAtual.observacoesDentista?.trim()) {
    return { success: false, error: 'A observação do ajuste é obrigatória antes de confirmar o retorno' }
  }

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
        etapaAtual: 'acabamento',
        subetapaAtual: 'Acabamento e polimento',
      }
    })
    revalidatePath('/producao')
    return { success: true, finalizar: true }
  }

  // Caso contrário, abre novo ciclo (ajustes)
  const resultado = await abrirCiclo(cicloClosed.ordemId, novoPrazoDias, novaEtapa || 'Ajustes solicitados pelo dentista')
  if (!resultado.success) return resultado

  await prisma.ordem.update({
    where: { id: cicloClosed.ordemId },
    data: {
      etapaAtual: 'ajuste',
      subetapaAtual: novaEtapa?.trim() || 'Ajustes solicitados pelo dentista',
      status: 'Em Produção',
    }
  })

  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
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
