'use server'

import { erroTransicaoOrdem } from '@labgest/shared'

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

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
    const [totalCiclos, ordem] = await Promise.all([
      tx.cicloProducao.count({ where: { ordemId } }),
      tx.ordem.findUnique({ where: { id: ordemId }, select: { etapaAtual: true, status: true, tipoWorkflow: true } }),
    ])
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }
    const erroEstado = erroTransicaoOrdem(ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    const cicloAtivo = await tx.cicloProducao.findFirst({ where: { ordemId: ordemId, status: { in: ['no_lab', 'em_prova'] } }, orderBy: { numeroCiclo: 'desc' }, select: { id: true } })
    if (cicloAtivo) return { success: false, error: 'A ordem já possui um ciclo ativo.' }
    if (isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Use o fluxo específico da prótese.' }

    const dataEntrada = new Date()
    const dataComprometida = new Date()
    dataComprometida.setDate(dataComprometida.getDate() + prazoDias)

    const subetapa = etapa?.trim() || 'Produção'
    // Abrir um ciclo registra o detalhe técnico sem trocar a macroetapa do Kanban.
    const macroetapa = normalizarEtapa(ordem.etapaAtual || 'confeccao')
    const [ciclo] = await Promise.all([
      tx.cicloProducao.create({
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
      tx.ordem.update({
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
    revalidatePath('/recepcao')
    return { success: true, ciclo }
  })
}

// Auxiliar registra que o trabalho saiu do lab para prova
export async function enviarParaProva(cicloId: number) {
  const usuario = await requireUser()

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = (SELECT ordem_id FROM ciclos_producao WHERE id = ${cicloId}) FOR UPDATE`
    const cicloAtual = await tx.cicloProducao.findUnique({ where: { id: cicloId }, include: { ordem: true } })
    if (!cicloAtual) return { success: false, error: 'Ciclo não encontrado' }
    const erroEstado = erroTransicaoOrdem(cicloAtual.ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    const cicloAtivo = await tx.cicloProducao.findFirst({ where: { ordemId: cicloAtual.ordemId, status: { in: ['no_lab', 'em_prova'] } }, orderBy: { numeroCiclo: 'desc' }, select: { id: true } })
    if (!cicloAtivo || cicloAtivo.id !== cicloId) return { success: false, error: 'Este ciclo não é mais o ciclo ativo da ordem.' }
    if (isTipoProtese(cicloAtual.ordem.tipoWorkflow)) return { success: false, error: 'Use o fluxo específico da prótese.' }
    if (cicloAtual.status !== 'no_lab') return { success: false, error: 'Este ciclo não está ativo no laboratório.' }
    const ciclo = await tx.cicloProducao.update({
      where: { id: cicloId },
      data: {
        dataSaida: new Date(),
        status: 'em_prova',
      },
      include: { ordem: true }
    })

    // Atualiza status da ordem
    await tx.ordem.update({
      where: { id: ciclo.ordemId },
      data: {
        status: 'Em Prova',
        etapaAtual: 'em_prova',
        subetapaAtual: ciclo.etapa,
        localizacaoAtual: 'em_transito_recepcao',
        situacaoLogistica: 'aguardando_recepcao',
        finalidadeClinica: 'prova',
        dentistaResponsavel: null,
        agendamentoClinico: null,
        movimentacaoLogisticaEm: new Date(),
        historicoEtapas: [
          ...(Array.isArray(ciclo.ordem.historicoEtapas) ? ciclo.ordem.historicoEtapas : []),
          { acao: 'enviou_recepcao', finalidade: 'prova', data: new Date().toISOString(), por: usuario.email },
        ],
      }
    })

    revalidatePath('/producao')
    revalidatePath('/ordens')
    revalidatePath('/recepcao')
    return { success: true, ciclo }
  })
}

// Auxiliar confirma recebimento físico e abre novo ciclo
export async function confirmarRetorno(cicloId: number, novoPrazoDias: number, novaEtapa?: string) {
  await requireUser()

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = (SELECT ordem_id FROM ciclos_producao WHERE id = ${cicloId}) FOR UPDATE`
    const cicloAtual = await tx.cicloProducao.findUnique({
      where: { id: cicloId },
      include: { ordem: true }
    })

    if (!cicloAtual) return { success: false, error: 'Ciclo de produção não encontrado' }
    const erroEstado = erroTransicaoOrdem(cicloAtual.ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    const cicloAtivo = await tx.cicloProducao.findFirst({ where: { ordemId: cicloAtual.ordemId, status: { in: ['no_lab', 'em_prova'] } }, orderBy: { numeroCiclo: 'desc' }, select: { id: true } })
    if (!cicloAtivo || cicloAtivo.id !== cicloId) return { success: false, error: 'Este ciclo não é mais o ciclo ativo da ordem.' }
    if (cicloAtual.status !== 'em_prova' || cicloAtual.dataRetorno) return { success: false, error: 'Este retorno já foi registrado ou não está em prova.' }
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
      if (!passoAtual.prova) return { success: false, error: 'A etapa atual não corresponde a uma prova.' }
      if (passoAtual.prova) {
        const destino = cicloAtual.decisao === 'aprovado'
          ? getProximoPassoProtese(tipo, passoAtual.id)
          : getPassoLaboratorialAnterior(tipo, passoAtual.id)
        if (!destino) return { success: false, error: 'Não foi possível determinar a próxima etapa do fluxo' }

        const operacoes = [
          tx.cicloProducao.update({
            where: { id: cicloId },
            data: { dataRetorno: new Date(), status: 'concluido' },
          }),
        ]

        if (cicloAtual.decisao === 'ajustes') {
          const totalCiclos = await tx.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
          const dataComprometida = calcularPrazoPasso(new Date(), destino, cicloAtual.ordem.arcadas) || new Date()
          operacoes.push(tx.cicloProducao.create({
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

        await Promise.all([
          ...operacoes,
          tx.ordem.update({
            where: { id: cicloAtual.ordemId },
            data: {
              passoFluxoAtual: destino.id,
              etapaAtual: cicloAtual.decisao === 'ajustes' ? 'ajuste' : destino.macroetapa,
              subetapaAtual: cicloAtual.decisao === 'ajustes' ? `Ajuste: ${destino.nome}` : destino.nome,
              status: statusParaPassoProtese(destino),
              prazoEtapaAtual: calcularPrazoPasso(new Date(), destino, cicloAtual.ordem.arcadas),
              localizacaoAtual: 'laboratorio',
              situacaoLogistica: 'no_laboratorio',
              movimentacaoLogisticaEm: new Date(),
            },
          }),
        ])

        revalidatePath('/producao')
        revalidatePath('/ordens')
        revalidatePath('/prioridades')
        revalidatePath('/recepcao')
        return { success: true, finalizar: cicloAtual.decisao === 'aprovado', fluxoEspecifico: true }
      }
    }

    // Se decisão foi 'aprovado', vai para finalização sem abrir novo ciclo
    if (cicloAtual.decisao === 'aprovado') {
      await Promise.all([
        tx.cicloProducao.update({
          where: { id: cicloId },
          data: { dataRetorno: new Date(), status: 'concluido' },
        }),
        tx.ordem.update({
          where: { id: cicloAtual.ordemId },
          data: {
            status: 'Em Produção',
            etapaAtual: 'acabamento',
            subetapaAtual: 'Acabamento e polimento',
            localizacaoAtual: 'laboratorio',
            situacaoLogistica: 'no_laboratorio',
            movimentacaoLogisticaEm: new Date(),
          },
        }),
      ])
      revalidatePath('/producao')
      revalidatePath('/ordens')
      revalidatePath('/prioridades')
      revalidatePath('/recepcao')
      return { success: true, finalizar: true }
    }

    const totalCiclos = await tx.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
    const dataComprometida = new Date()
    dataComprometida.setDate(dataComprometida.getDate() + novoPrazoDias)
    const subetapa = novaEtapa?.trim() || 'Ajustes solicitados pelo dentista'

    // Ajuste e abertura do novo ciclo são atômicos: ou ambos acontecem, ou nenhum.
    const [, novoCiclo] = await Promise.all([
      tx.cicloProducao.update({
        where: { id: cicloId },
        data: { dataRetorno: new Date(), status: 'concluido' },
      }),
      tx.cicloProducao.create({
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
      tx.ordem.update({
        where: { id: cicloAtual.ordemId },
        data: {
          etapaAtual: 'ajuste',
          subetapaAtual: subetapa,
          status: 'Em Produção',
          localizacaoAtual: 'laboratorio',
          situacaoLogistica: 'no_laboratorio',
          movimentacaoLogisticaEm: new Date(),
        },
      }),
    ])

    revalidatePath('/producao')
    revalidatePath('/ordens')
    revalidatePath('/prioridades')
    revalidatePath('/recepcao')
    return { success: true, novoCiclo }
  })
}

// Após executar o ajuste, permite seguir para acabamento sem exigir uma nova prova.
export async function concluirAjusteSemNovaProva(cicloId: number) {
  await requireUser()

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = (SELECT ordem_id FROM ciclos_producao WHERE id = ${cicloId}) FOR UPDATE`
    const ciclo = await tx.cicloProducao.findUnique({
      where: { id: cicloId },
      include: { ordem: true },
    })

    if (!ciclo) return { success: false, error: 'Ciclo de ajuste não encontrado' }
    const erroEstado = erroTransicaoOrdem(ciclo.ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    const cicloAtivo = await tx.cicloProducao.findFirst({ where: { ordemId: ciclo.ordemId, status: { in: ['no_lab', 'em_prova'] } }, orderBy: { numeroCiclo: 'desc' }, select: { id: true } })
    if (!cicloAtivo || cicloAtivo.id !== cicloId) return { success: false, error: 'Este ciclo não é mais o ciclo ativo da ordem.' }
    if (isTipoProtese(ciclo.ordem.tipoWorkflow)) return { success: false, error: 'Use o fluxo específico da prótese.' }
    if (ciclo.status !== 'no_lab' || normalizarEtapa(ciclo.ordem.etapaAtual || '') !== 'ajuste') {
      return { success: false, error: 'A ordem não está em um ajuste ativo' }
    }

    await Promise.all([
      tx.cicloProducao.update({
        where: { id: cicloId },
        data: {
          dataSaida: new Date(),
          status: 'concluido',
        },
      }),
      tx.ordem.update({
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
  })
}

// Busca ciclos de uma ordem (para exibir no portal e no lab)
export async function getCiclosByOrdem(ordemId: number) {
  await requireUser()
  const ciclos = await prisma.cicloProducao.findMany({
    where: { ordemId },
    orderBy: { numeroCiclo: 'asc' }
  })
  return ciclos
}

// Busca o ciclo ativo atual de uma ordem
export async function getCicloAtivo(ordemId: number) {
  await requireUser()
  return await prisma.cicloProducao.findFirst({
    where: {
      ordemId,
      status: { in: ['no_lab', 'em_prova'] }
    },
    orderBy: { numeroCiclo: 'desc' }
  })
}
