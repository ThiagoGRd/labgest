'use server'

import { erroTransicaoOrdem } from '@labgest/shared'

import { Prisma, prisma } from '@labgest/database'
import {
  calcularPrazoPasso,
  getFluxoProtese,
  getPassoProtese,
  getProximoPassoProtese,
  isTipoProtese,
  statusParaPassoProtese,
  type TipoProteseId,
} from '@/lib/workflow-config'
import { requireUser } from '@/lib/auth-utils'
import { revalidatePath } from 'next/cache'
import { registrarPedidoFornecedor, confirmarPedidoFornecedor } from '@/lib/labs-externos-vinculo'
import { garantirEfeitosFinalizacao } from '@/lib/finalizacao-ordem'

function historicoComEvento(historico: Prisma.JsonValue, evento: Prisma.JsonObject) {
  return [...(Array.isArray(historico) ? historico : []), evento] as Prisma.JsonArray
}

function revalidarFluxo() {
  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
  revalidatePath('/financeiro')
  revalidatePath('/estoque')
  revalidatePath('/recepcao')
  revalidatePath('/labs-externos')
}

export async function definirEtapaFluxoProtese(ordemId: number, tipo: string, passoId: string, revisaoEsperada: string) {
  const usuario = await requireUser()
  if (!isTipoProtese(tipo)) return { success: false, error: 'Selecione um tipo de prótese válido' }

  const fluxo = getFluxoProtese(tipo)
  const passo = fluxo.passos.find((item) => item.id === passoId)
  if (!passo) return { success: false, error: 'Selecione uma etapa válida para este tipo de prótese' }

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }
    const erroEstado = erroTransicaoOrdem(ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status || '')) {
      return { success: false, error: 'Esta ordem já está encerrada e não pode ser reposicionada pela Produção' }
    }

    if (!revisaoEsperada || ordem.updatedAt?.toISOString() !== revisaoEsperada) return { success: false, error: 'A ordem foi alterada. Atualize antes de definir a etapa.' }
    const agora = new Date()
    const cicloAtivo = await tx.cicloProducao.findFirst({
      where: { ordemId, status: { in: ['no_lab', 'em_prova'] } },
      orderBy: { numeroCiclo: 'desc' },
    })

    if (passo.prova) {
      if (cicloAtivo?.status === 'em_prova' && cicloAtivo.etapa === passo.nome) {
        await tx.cicloProducao.update({
          where: { id: cicloAtivo.id },
          data: { dataSaida: cicloAtivo.dataSaida ?? agora },
        })
      } else {
        if (cicloAtivo) {
          await tx.cicloProducao.update({
            where: { id: cicloAtivo.id },
            data: { status: 'concluido', dataSaida: cicloAtivo.dataSaida ?? agora, dataRetorno: agora },
          })
        }
        const totalCiclos = await tx.cicloProducao.count({ where: { ordemId } })
        await tx.cicloProducao.create({
          data: {
            ordemId,
            numeroCiclo: totalCiclos + 1,
            etapa: passo.nome,
            dataEntrada: agora,
            dataSaida: agora,
            prazoDias: 7,
            dataComprometida: ordem.dataEntrega,
            status: 'em_prova',
            registradoPor: usuario.email || 'laboratorio',
          },
        })
      }
    } else if (cicloAtivo) {
      await tx.cicloProducao.update({
        where: { id: cicloAtivo.id },
        data: { status: 'concluido', dataSaida: cicloAtivo.dataSaida ?? agora, dataRetorno: cicloAtivo.status === 'em_prova' ? agora : cicloAtivo.dataRetorno },
      })
    }

    const progresso = Math.round((fluxo.passos.indexOf(passo) / Math.max(1, fluxo.passos.length - 1)) * 100)
    const statusCalculado = statusParaPassoProtese(passo)
    const status = ordem.status === 'Pausado' ? 'Pausado' : statusCalculado
    const vaiParaClinica = passo.responsavel === 'clinica' && status !== 'Pausado'

    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        tipoWorkflow: tipo as TipoProteseId,
        passoFluxoAtual: passo.id,
        etapaAtual: passo.macroetapa,
        subetapaAtual: passo.nome,
        status,
        progresso,
        prazoEtapaAtual: calcularPrazoPasso(agora, passo, ordem.arcadas),
        dataFinalizacao: statusCalculado === 'Finalizado' && status !== 'Pausado' ? agora : null,
        ...(vaiParaClinica ? {
          localizacaoAtual: 'em_transito_recepcao',
          situacaoLogistica: 'aguardando_recepcao',
          finalidadeClinica: passo.entregaFinal ? 'entrega' : passo.prova ? 'prova' : 'instalacao',
          dentistaResponsavel: null,
          agendamentoClinico: null,
          movimentacaoLogisticaEm: agora,
        } : {}),
        historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
          acao: 'definiu_fluxo_manualmente',
          tipo: fluxo.nome,
          etapa: passo.nome,
          data: agora.toISOString(),
          por: usuario.email || 'laboratorio',
        }),
      },
    })

    if (statusCalculado === 'Finalizado' && status !== 'Pausado') {
      await garantirEfeitosFinalizacao(tx, ordemId, agora)
    }

    return { success: true, tipo: fluxo.nome, etapa: passo.nome }
  })

  if (resultado.success) revalidarFluxo()
  return resultado
}

export async function concluirEtapaLaboratorial(ordemId: number, etapaEsperada: string) {
  const usuario = await requireUser()

  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Fluxo da prótese não identificado' }
    const erroEstado = erroTransicaoOrdem(ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }

    if (!etapaEsperada || ordem.passoFluxoAtual !== etapaEsperada) return { success: false as const, error: 'A etapa foi alterada. Atualize a ordem antes de continuar.' }
    const passoAtual = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    if (passoAtual.responsavel !== 'laboratorio') return { success: false, error: 'Esta etapa deve ser concluída pela clínica' }

    const proximo = getProximoPassoProtese(ordem.tipoWorkflow, passoAtual.id)
    if (!proximo) return { success: false, error: 'O fluxo já chegou ao final' }

    await tx.cicloProducao.updateMany({
      where: { ordemId, status: 'no_lab' },
      data: { status: 'concluido', dataSaida: new Date() },
    })

    if (proximo.prova) {
      const totalCiclos = await tx.cicloProducao.count({ where: { ordemId } })
      await tx.cicloProducao.create({
        data: {
          ordemId,
          numeroCiclo: totalCiclos + 1,
          etapa: proximo.nome,
          dataEntrada: new Date(),
          dataSaida: new Date(),
          prazoDias: 7,
          dataComprometida: ordem.dataEntrega,
          status: 'em_prova',
          registradoPor: usuario.email || 'laboratorio',
        },
      })
    }

    const agora = new Date()
    const novoStatus = statusParaPassoProtese(proximo)
    const vaiParaClinica = proximo.responsavel === 'clinica'
    const historicoTecnico = historicoComEvento(ordem.historicoEtapas, {
      acao: 'concluiu_etapa_laboratorial',
      de: passoAtual.nome,
      para: proximo.nome,
      data: agora.toISOString(),
      por: usuario.email || 'laboratorio',
    })
    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        passoFluxoAtual: proximo.id,
        etapaAtual: proximo.macroetapa,
        subetapaAtual: proximo.nome,
        status: novoStatus,
        dataFinalizacao: novoStatus === 'Finalizado' ? agora : null,
        prazoEtapaAtual: calcularPrazoPasso(agora, proximo, ordem.arcadas),
        ...(vaiParaClinica ? {
          localizacaoAtual: 'em_transito_recepcao',
          situacaoLogistica: 'aguardando_recepcao',
          finalidadeClinica: proximo.entregaFinal ? 'entrega' : proximo.prova ? 'prova' : 'instalacao',
          dentistaResponsavel: null,
          agendamentoClinico: null,
          movimentacaoLogisticaEm: agora,
        } : {}),
        historicoEtapas: vaiParaClinica
          ? historicoComEvento(historicoTecnico, {
              acao: 'enviou_recepcao',
              finalidade: proximo.entregaFinal ? 'entrega' : proximo.prova ? 'prova' : 'instalacao',
              data: agora.toISOString(),
              por: usuario.email || 'laboratorio',
            })
          : historicoTecnico,
      },
    })

    if (novoStatus === 'Finalizado') {
      await garantirEfeitosFinalizacao(tx, ordemId, agora)
    }

    return { success: true, proximo: proximo.nome }
  })

  if (resultado.success) revalidarFluxo()
  return resultado
}

export async function registrarEnvioFornecedor(ordemId: number, fornecedor: string, labId?: number) {
  const usuario = await requireUser()
  if (labId === undefined && !fornecedor.trim()) return { success: false, error: 'Informe o nome do fornecedor' }

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
  if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Ordem não encontrada' }
    const erroEstado = erroTransicaoOrdem(ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
  const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
  if (passo.responsavel !== 'fornecedor') return { success: false, error: 'A ordem não está na etapa do fornecedor' }

  if (ordem.dataEnvioFornecedor && !ordem.dataRecebimentoFornecedor) return { success: false, error: 'O envio já foi registrado. Confirme o recebimento antes de um novo envio.' }
  const agora = new Date()
  const prazo = calcularPrazoPasso(agora, passo, ordem.arcadas)
  const lab = labId === undefined ? null : await registrarPedidoFornecedor(tx, ordem, labId, agora, prazo)
  const nomeFornecedor = lab?.nome || fornecedor.trim()
  await tx.ordem.update({
    where: { id: ordemId },
    data: {
      fornecedorEstrutura: nomeFornecedor,
      dataEnvioFornecedor: agora,
      prazoFornecedor: prazo,
      prazoEtapaAtual: prazo,
      dataRecebimentoFornecedor: null,
      justificativaAtrasoFornecedor: null,
      historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
        acao: 'enviado_fornecedor', fornecedor: nomeFornecedor, data: agora.toISOString(), por: usuario.email || 'laboratorio',
      }),
    },
  })

  revalidarFluxo()
  return { success: true, prazo: prazo?.toISOString() }
  })
}

export async function confirmarRecebimentoFornecedor(ordemId: number, justificativaAtraso?: string) {
  const usuario = await requireUser()

  try {
  const resultado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Ordem não encontrada' }
    const erroEstado = erroTransicaoOrdem(ordem.status, false)
    if (erroEstado) return { success: false as const, error: erroEstado }
    const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    if (passo.responsavel !== 'fornecedor' || !ordem.dataEnvioFornecedor || ordem.dataRecebimentoFornecedor) return { success: false, error: 'O envio ao fornecedor ainda não foi registrado' }

    const agora = new Date()
    const vinculado = await confirmarPedidoFornecedor(tx, ordemId)
    const retorno = vinculado?.dataRetorno || agora
    const atrasado = Boolean(ordem.prazoFornecedor && retorno > ordem.prazoFornecedor)
    if (atrasado && !justificativaAtraso?.trim()) throw new Error('Informe a justificativa do fornecedor para o atraso')

    const proximo = getProximoPassoProtese(ordem.tipoWorkflow, passo.id)
    if (!proximo) return { success: false, error: 'Próxima etapa não encontrada' }

    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        dataRecebimentoFornecedor: retorno,
        justificativaAtrasoFornecedor: justificativaAtraso?.trim() || null,
        passoFluxoAtual: proximo.id,
        etapaAtual: proximo.macroetapa,
        subetapaAtual: proximo.nome,
        status: statusParaPassoProtese(proximo),
        prazoEtapaAtual: calcularPrazoPasso(agora, proximo, ordem.arcadas),
        historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
          acao: 'recebeu_fornecedor', fornecedor: ordem.fornecedorEstrutura || 'Fornecedor', atrasado,
          justificativa: justificativaAtraso?.trim() || null, data: agora.toISOString(), por: usuario.email || 'laboratorio',
        }),
      },
    })
    return { success: true, proximo: proximo.nome }
  })

  if (resultado.success) revalidarFluxo()
  return resultado
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return { success: false, error: message === 'Informe a justificativa do fornecedor para o atraso' ? message : 'Não foi possível confirmar o recebimento. Atualize e tente novamente.' }
  }
}
