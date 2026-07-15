'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'
import {
  calcularPrazoPasso,
  getPassoLaboratorialAnterior,
  getPassoProtese,
  getProximoPassoProtese,
  isTipoProtese,
  normalizarEtapa,
  statusParaEtapa,
  statusParaPassoProtese,
} from '@/lib/workflow-config'

// Abre um novo ciclo quando o trabalho entra no lab
export async function abrirCiclo(ordemId: number, prazoDias: number, etapa?: string) {
  await requireUser()

  if (!Number.isInteger(prazoDias) || prazoDias <= 0) {
    return { success: false, error: 'Informe um prazo válido' }
  }

  const [totalCiclos, ordem] = await Promise.all([
    prisma.cicloProducao.count({ where: { ordemId } }),
    prisma.ordem.findUnique({ where: { id: ordemId }, select: { etapaAtual: true } }),
  ])
  if (!ordem) return { success: false, error: 'Ordem não encontrada' }

  const dataEntrada = new Date()
  const dataComprometida = new Date()
  dataComprometida.setDate(dataComprometida.getDate() + prazoDias)

  const subetapa = etapa?.trim() || 'Produção'
  // Abrir um ciclo registra o detalhe técnico sem trocar a macroetapa do Kanban.
  const macroetapa = normalizarEtapa(ordem.etapaAtual || 'confeccao')
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
  if (cicloAtual.decisao === 'ajustes' && (!Number.isInteger(novoPrazoDias) || novoPrazoDias <= 0)) {
    return { success: false, error: 'Informe um prazo válido para o ajuste' }
  }

  if (isTipoProtese(cicloAtual.ordem.tipoWorkflow)) {
    const tipo = cicloAtual.ordem.tipoWorkflow
    const passoAtual = getPassoProtese(tipo, cicloAtual.ordem.passoFluxoAtual)
    if (passoAtual.prova) {
      const destino = cicloAtual.decisao === 'aprovado'
        ? getProximoPassoProtese(tipo, passoAtual.id)
        : getPassoLaboratorialAnterior(tipo, passoAtual.id)
      if (!destino) return { success: false, error: 'Não foi possível determinar a próxima etapa do fluxo' }

      const operacoes = [
        prisma.cicloProducao.update({
          where: { id: cicloId },
          data: { dataRetorno: new Date(), status: 'concluido' },
        }),
      ]

      if (cicloAtual.decisao === 'ajustes') {
        const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
        const dataComprometida = calcularPrazoPasso(new Date(), destino, cicloAtual.ordem.arcadas) || new Date()
        operacoes.push(prisma.cicloProducao.create({
          data: {
            ordemId: cicloAtual.ordemId,
            numeroCiclo: totalCiclos + 1,
            etapa: `Ajuste: ${destino.nome}`,
            dataEntrada: new Date(),
            prazoDias: novoPrazoDias,
            dataComprometida,
            status: 'no_lab',
          },
        }))
      }

      await prisma.$transaction([
        ...operacoes,
        prisma.ordem.update({
          where: { id: cicloAtual.ordemId },
          data: {
            passoFluxoAtual: destino.id,
            etapaAtual: cicloAtual.decisao === 'ajustes' ? 'ajuste' : destino.macroetapa,
            subetapaAtual: cicloAtual.decisao === 'ajustes' ? `Ajuste: ${destino.nome}` : destino.nome,
            status: statusParaPassoProtese(destino),
            prazoEtapaAtual: calcularPrazoPasso(new Date(), destino, cicloAtual.ordem.arcadas),
          },
        }),
      ])

      revalidatePath('/producao')
      revalidatePath('/ordens')
      revalidatePath('/prioridades')
      return { success: true, finalizar: cicloAtual.decisao === 'aprovado', fluxoEspecifico: true }
    }
  }

  // Se decisão foi 'aprovado', vai para finalização sem abrir novo ciclo
  if (cicloAtual.decisao === 'aprovado') {
    await prisma.$transaction([
      prisma.cicloProducao.update({
        where: { id: cicloId },
        data: { dataRetorno: new Date(), status: 'concluido' },
      }),
      prisma.ordem.update({
        where: { id: cicloAtual.ordemId },
        data: {
          status: 'Em Produção',
          etapaAtual: 'acabamento',
          subetapaAtual: 'Acabamento e polimento',
        },
      }),
    ])
    revalidatePath('/producao')
    revalidatePath('/ordens')
    revalidatePath('/prioridades')
    return { success: true, finalizar: true }
  }

  const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
  const dataComprometida = new Date()
  dataComprometida.setDate(dataComprometida.getDate() + novoPrazoDias)
  const subetapa = novaEtapa?.trim() || 'Ajustes solicitados pelo dentista'

  // Ajuste e abertura do novo ciclo são atômicos: ou ambos acontecem, ou nenhum.
  const [, novoCiclo] = await prisma.$transaction([
    prisma.cicloProducao.update({
      where: { id: cicloId },
      data: { dataRetorno: new Date(), status: 'concluido' },
    }),
    prisma.cicloProducao.create({
      data: {
        ordemId: cicloAtual.ordemId,
        numeroCiclo: totalCiclos + 1,
        etapa: subetapa,
        dataEntrada: new Date(),
        prazoDias: novoPrazoDias,
        dataComprometida,
        status: 'no_lab',
      },
    }),
    prisma.ordem.update({
      where: { id: cicloAtual.ordemId },
      data: {
        etapaAtual: 'ajuste',
        subetapaAtual: subetapa,
        status: 'Em Produção',
      },
    }),
  ])

  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
  return { success: true, novoCiclo }
}

// Após executar o ajuste, permite seguir para acabamento sem exigir uma nova prova.
export async function concluirAjusteSemNovaProva(cicloId: number) {
  await requireUser()

  const ciclo = await prisma.cicloProducao.findUnique({
    where: { id: cicloId },
    include: { ordem: true },
  })

  if (!ciclo) return { success: false, error: 'Ciclo de ajuste não encontrado' }
  if (ciclo.status !== 'no_lab' || normalizarEtapa(ciclo.ordem.etapaAtual || '') !== 'ajuste') {
    return { success: false, error: 'A ordem não está em um ajuste ativo' }
  }

  await prisma.$transaction([
    prisma.cicloProducao.update({
      where: { id: cicloId },
      data: {
        dataSaida: new Date(),
        status: 'concluido',
      },
    }),
    prisma.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        etapaAtual: 'acabamento',
        subetapaAtual: 'Acabamento e polimento',
        status: 'Em Produção',
      },
    }),
  ])

  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
  return { success: true }
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
