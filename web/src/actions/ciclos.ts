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

const PRAZO_RETORNO_LAB_DIAS = 10

// Abre um novo ciclo quando o trabalho entra no lab
export async function abrirCiclo(ordemId: number, prazoDias = PRAZO_RETORNO_LAB_DIAS, etapa?: string) {
  await requireUser()

  if (!Number.isInteger(prazoDias) || prazoDias <= 0) {
    return { success: false, error: 'Informe um prazo válido' }
  }

  const [totalCiclos, ordem] = await Promise.all([
    prisma.cicloProducao.count({ where: { ordemId } }),
    prisma.ordem.findUnique({ where: { id: ordemId }, select: { etapaAtual: true, updatedAt: true, agendamentoConfirmado: true, historicoEtapas: true } }),
  ])
  if (!ordem) return { success: false, error: 'Ordem não encontrada' }

  const dataEntrada = new Date()
  const dataComprometida = new Date(dataEntrada.getTime() + prazoDias * 86_400_000)

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
      where: { id: ordemId, updatedAt: ordem.updatedAt },
      data: {
        agendamentoConfirmado: false,
        historicoEtapas: [...(Array.isArray(ordem.historicoEtapas) ? ordem.historicoEtapas : []), { acao: 'abriu_ciclo', agendamentoEncerrado: ordem.agendamentoConfirmado, data: dataEntrada.toISOString() }],
        etapaAtual: macroetapa,
        subetapaAtual: subetapa,
        prazoEtapaAtual: dataComprometida,
        status: statusParaEtapa(macroetapa),
      }
    }),
  ])

  revalidatePath('/producao')
  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  revalidatePath('/recepcao')
  return { success: true, ciclo }
}

// Auxiliar registra que o trabalho saiu do lab para prova
export async function enviarParaProva(cicloId: number) {
  const usuario = await requireUser()

  const ciclo = await prisma.$transaction(async tx => {
    const atual = await tx.cicloProducao.findUniqueOrThrow({ where: { id: cicloId } })
    await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${atual.ordemId} FOR UPDATE`
    const ordem = await tx.ordem.findUniqueOrThrow({ where: { id: atual.ordemId } })
    const agora = new Date()
    const atualizado = await tx.cicloProducao.update({ where: { id: cicloId }, data: { dataSaida: agora, status: 'em_prova' }, include: { ordem: true } })
    await tx.ordem.update({ where: { id: atual.ordemId }, data: {
      status: 'Em Prova', etapaAtual: 'em_prova', subetapaAtual: atual.etapa,
      localizacaoAtual: 'em_transito_recepcao', situacaoLogistica: 'aguardando_recepcao', finalidadeClinica: 'prova',
      dentistaResponsavel: null, agendamentoConfirmado: false, movimentacaoLogisticaEm: agora,
      historicoEtapas: [...(Array.isArray(ordem.historicoEtapas) ? ordem.historicoEtapas : []),
        { acao: 'enviou_recepcao', finalidade: 'prova', agendamentoEncerrado: ordem.agendamentoConfirmado, data: agora.toISOString(), por: usuario.email }],
    } })
    return atualizado
  })

  revalidatePath('/producao')
  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  revalidatePath('/recepcao')
  return { success: true, ciclo }
}

// Auxiliar confirma recebimento físico e abre novo ciclo (10 dias por padrão ao retornar ao laboratório)
export async function confirmarRetorno(cicloId: number, novoPrazoDias = PRAZO_RETORNO_LAB_DIAS, novaEtapa?: string) {
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

  const prazoEfetivoDias = Number.isInteger(novoPrazoDias) && novoPrazoDias > 0 ? novoPrazoDias : PRAZO_RETORNO_LAB_DIAS
  const agora = new Date()
  const prazo10DiasRetorno = new Date(agora.getTime() + prazoEfetivoDias * 86_400_000)

  if (isTipoProtese(cicloAtual.ordem.tipoWorkflow)) {
    const tipo = cicloAtual.ordem.tipoWorkflow
    const passoAtual = getPassoProtese(tipo, cicloAtual.ordem.passoFluxoAtual)
    if (passoAtual.prova) {
      const destino = cicloAtual.decisao === 'aprovado'
        ? getProximoPassoProtese(tipo, passoAtual.id)
        : getPassoLaboratorialAnterior(tipo, passoAtual.id)
      if (!destino) return { success: false, error: 'Não foi possível determinar a próxima etapa do fluxo' }

      const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
      const prazoPasso = calcularPrazoPasso(agora, destino, cicloAtual.ordem.arcadas)
      const dataComprometida = prazoPasso && prazoPasso > prazo10DiasRetorno ? prazoPasso : prazo10DiasRetorno

      const operacoes = [
        prisma.cicloProducao.update({
          where: { id: cicloId },
          data: { dataRetorno: agora, status: 'concluido' },
        }),
        prisma.cicloProducao.create({
          data: {
            ordemId: cicloAtual.ordemId,
            numeroCiclo: totalCiclos + 1,
            etapa: cicloAtual.decisao === 'ajustes' ? `Ajuste: ${destino.nome}` : destino.nome,
            dataEntrada: agora,
            prazoDias: prazoEfetivoDias,
            dataComprometida,
            status: 'no_lab',
          },
        }),
      ]

      await prisma.$transaction([
        ...operacoes,
        prisma.ordem.update({
          where: { id: cicloAtual.ordemId, updatedAt: cicloAtual.ordem.updatedAt },
          data: {
            passoFluxoAtual: destino.id,
            etapaAtual: cicloAtual.decisao === 'ajustes' ? 'ajuste' : destino.macroetapa,
            subetapaAtual: cicloAtual.decisao === 'ajustes' ? `Ajuste: ${destino.nome}` : destino.nome,
            status: statusParaPassoProtese(destino),
            prazoEtapaAtual: dataComprometida,
            localizacaoAtual: 'laboratorio',
            situacaoLogistica: 'no_laboratorio',
            agendamentoConfirmado: false,
            historicoEtapas: [...(Array.isArray(cicloAtual.ordem.historicoEtapas) ? cicloAtual.ordem.historicoEtapas : []), { acao: 'retorno_ciclo', agendamentoEncerrado: cicloAtual.ordem.agendamentoConfirmado, prazoDias: prazoEfetivoDias, data: agora.toISOString() }],
            movimentacaoLogisticaEm: agora,
          },
        }),
      ])

      revalidatePath('/producao')
      revalidatePath('/lab-interno')
      revalidatePath('/ordens')
      revalidatePath('/prioridades')
      revalidatePath('/recepcao')
      return { success: true, finalizar: cicloAtual.decisao === 'aprovado', fluxoEspecifico: true }
    }
  }

  // Se decisão foi 'aprovado', segue para acabamento com novo prazo de 10 dias do retorno ao laboratório
  if (cicloAtual.decisao === 'aprovado') {
    await prisma.$transaction([
      prisma.cicloProducao.update({
        where: { id: cicloId },
        data: { dataRetorno: agora, status: 'concluido' },
      }),
      prisma.ordem.update({
        where: { id: cicloAtual.ordemId, updatedAt: cicloAtual.ordem.updatedAt },
        data: {
          status: 'Em Produção',
          etapaAtual: 'acabamento',
          subetapaAtual: 'Acabamento e polimento',
          prazoEtapaAtual: prazo10DiasRetorno,
          localizacaoAtual: 'laboratorio',
          situacaoLogistica: 'no_laboratorio',
          agendamentoConfirmado: false,
          historicoEtapas: [...(Array.isArray(cicloAtual.ordem.historicoEtapas) ? cicloAtual.ordem.historicoEtapas : []), { acao: 'retorno_ciclo', agendamentoEncerrado: cicloAtual.ordem.agendamentoConfirmado, prazoDias: prazoEfetivoDias, data: agora.toISOString() }],
          movimentacaoLogisticaEm: agora,
        },
      }),
    ])
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/ordens')
    revalidatePath('/prioridades')
    revalidatePath('/recepcao')
    return { success: true, finalizar: true }
  }

  const totalCiclos = await prisma.cicloProducao.count({ where: { ordemId: cicloAtual.ordemId } })
  const dataComprometida = prazo10DiasRetorno
  const subetapa = novaEtapa?.trim() || 'Ajustes solicitados pelo dentista'

  // Ajuste e abertura do novo ciclo são atômicos: ou ambos acontecem, ou nenhum.
  const [, novoCiclo] = await prisma.$transaction([
    prisma.cicloProducao.update({
      where: { id: cicloId },
      data: { dataRetorno: agora, status: 'concluido' },
    }),
    prisma.cicloProducao.create({
      data: {
        ordemId: cicloAtual.ordemId,
        numeroCiclo: totalCiclos + 1,
        etapa: subetapa,
        dataEntrada: agora,
        prazoDias: prazoEfetivoDias,
        dataComprometida,
        status: 'no_lab',
      },
    }),
    prisma.ordem.update({
      where: { id: cicloAtual.ordemId, updatedAt: cicloAtual.ordem.updatedAt },
      data: {
        etapaAtual: 'ajuste',
        subetapaAtual: subetapa,
        status: 'Em Produção',
        prazoEtapaAtual: dataComprometida,
        localizacaoAtual: 'laboratorio',
        situacaoLogistica: 'no_laboratorio',
        agendamentoConfirmado: false,
        historicoEtapas: [...(Array.isArray(cicloAtual.ordem.historicoEtapas) ? cicloAtual.ordem.historicoEtapas : []), { acao: 'retorno_ciclo', agendamentoEncerrado: cicloAtual.ordem.agendamentoConfirmado, prazoDias: prazoEfetivoDias, data: agora.toISOString() }],
        movimentacaoLogisticaEm: agora,
      },
    }),
  ])

  revalidatePath('/producao')
  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
  revalidatePath('/recepcao')
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
