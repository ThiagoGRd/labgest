'use server'

import { Prisma, prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { inferirTipoProtese, isEtapaId, isTipoProtese, normalizarEtapa, statusParaEtapa } from '@/lib/workflow-config'
import { garantirEfeitosFinalizacao } from '@/lib/finalizacao-ordem'

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
      }
    })

    return ordens.map((o) => {
      const cicloAtivo = o.ciclos?.[0] ?? null
      return {
        id: o.id,
        paciente: o.nomePaciente,
        dentista: o.clienteNome || o.cliente?.nome || 'Desconhecido',
        servico: o.servicoNome || o.servico?.nome || 'Serviço',
        status: o.status || 'Aguardando',
        updatedAt: o.updatedAt?.toISOString() ?? [o.passoFluxoAtual, o.status, cicloAtivo?.status, cicloAtivo?.decisao].join(':'),
        etapa: normalizarEtapa(o.etapaAtual || 'recebimento'),
        subetapa: o.subetapaAtual,
        prioridade: o.prioridade || 'Normal',
        entrega: o.dataEntrega.toISOString(),
        cor: o.corDentes,
        elementos: o.elementos,
        foto: null,
        tipoWorkflow: isTipoProtese(o.tipoWorkflow) ? o.tipoWorkflow : inferirTipoProtese(o.servicoNome || o.servico?.nome || '', o.tipoWorkflow),
        passoFluxoAtual: o.passoFluxoAtual,
        arcadas: o.arcadas || 1,
        prazoEtapaAtual: o.prazoEtapaAtual?.toISOString() ?? null,
        fornecedorEstrutura: o.fornecedorEstrutura,
        dataEnvioFornecedor: o.dataEnvioFornecedor?.toISOString() ?? null,
        prazoFornecedor: o.prazoFornecedor?.toISOString() ?? null,
        dataRecebimentoFornecedor: o.dataRecebimentoFornecedor?.toISOString() ?? null,
        justificativaAtrasoFornecedor: o.justificativaAtrasoFornecedor,
        cicloAtivoId: cicloAtivo?.id ?? null,
        cicloStatus: cicloAtivo?.status ?? null,
        cicloNumero: cicloAtivo?.numeroCiclo ?? null,
        cicloComprometido: cicloAtivo?.dataComprometida?.toISOString() ?? null,
        cicloDentistaDeci: cicloAtivo?.decisao ?? null,
        cicloRespostaEm: cicloAtivo?.decisao ? cicloAtivo.updatedAt?.toISOString() ?? null : null,
        cicloObs: cicloAtivo?.observacoesDentista ?? null,
        cicloFotos: (cicloAtivo?.fotosProva as string[]) ?? [],
      }
    })
  } catch (error) {
    console.error('Erro ao buscar produção:', error)
    throw new Error('Não foi possível carregar a produção. Atualize a página para tentar novamente.')
  }
}

export async function moverOrdem(id: number, novaEtapa: string) {
  await requireUser()
  if (!isEtapaId(novaEtapa) || novaEtapa === 'entregue') {
    return { success: false, error: 'Etapa de produção inválida' }
  }

  try {
    const novoStatus = statusParaEtapa(novaEtapa)
    const resultado = await prisma.$transaction(async (tx) => {
      const ordemAtual = await tx.ordem.findUnique({
        where: { id },
      })
      if (!ordemAtual) return { success: false, error: 'Ordem não encontrada' }
      if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordemAtual.status || '')) {
        return { success: false, error: 'Esta ordem já está encerrada e não pode ser movimentada.' }
      }
      if (isTipoProtese(ordemAtual.tipoWorkflow) && ordemAtual.passoFluxoAtual) {
        return {
          success: false,
          error: 'Esta ordem possui fluxo clínico-laboratorial. Avance pela etapa específica da prótese.',
        }
      }

      const agora = new Date()
      const historico = (Array.isArray(ordemAtual.historicoEtapas) ? ordemAtual.historicoEtapas : []) as Prisma.InputJsonObject[]
      const proximoHistorico = [
        ...historico,
        {
          acao: 'movimentou_kanban_legado',
          de: ordemAtual.etapaAtual || 'recebimento',
          para: novaEtapa,
          data: agora.toISOString(),
        },
      ]

      if (novaEtapa === 'em_prova') {
        const cicloAtivo = await tx.cicloProducao.findFirst({
          where: { ordemId: id, status: { in: ['no_lab', 'em_prova'] } },
          orderBy: { numeroCiclo: 'desc' },
        })

        if (cicloAtivo) {
          await tx.cicloProducao.update({
            where: { id: cicloAtivo.id },
            data: { status: 'em_prova', dataSaida: cicloAtivo.dataSaida ?? agora },
          })
        } else {
          return {
            success: false,
            error: 'Inicie um ciclo de prova antes de enviar o trabalho para a clínica.',
          }
        }

        await tx.ordem.update({
          where: { id },
          data: { etapaAtual: novaEtapa, status: novoStatus, dataFinalizacao: null, historicoEtapas: proximoHistorico },
        })
        return { success: true }
      }

      if (novaEtapa === 'pronto') {
        await tx.ordem.update({
          where: { id },
          data: { etapaAtual: novaEtapa, status: novoStatus, dataFinalizacao: agora, historicoEtapas: proximoHistorico },
        })
        await garantirEfeitosFinalizacao(tx, id, agora)
        return { success: true }
      }

      await tx.ordem.update({
        where: { id },
        data: {
          etapaAtual: novaEtapa,
          status: novoStatus,
          dataFinalizacao: null,
          historicoEtapas: proximoHistorico,
        },
      })
      return { success: true }
    })

    if (!resultado.success) return resultado

    revalidatePath('/producao')
    revalidatePath('/ordens')
    revalidatePath('/prioridades')
    revalidatePath('/financeiro')
    revalidatePath('/estoque')
    return resultado
  } catch (error) {
    console.error('Erro ao mover ordem:', error)
    return { success: false, error: 'Erro ao mover ordem' }
  }
}
