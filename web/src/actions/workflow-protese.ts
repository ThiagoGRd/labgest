'use server'

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

function historicoComEvento(historico: Prisma.JsonValue, evento: Prisma.JsonObject) {
  return [...(Array.isArray(historico) ? historico : []), evento] as Prisma.JsonArray
}

function revalidarFluxo() {
  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
}

export async function definirEtapaFluxoProtese(ordemId: number, tipo: string, passoId: string) {
  const usuario = await requireUser()
  if (!isTipoProtese(tipo)) return { success: false, error: 'Selecione um tipo de prótese válido' }

  const fluxo = getFluxoProtese(tipo)
  const passo = fluxo.passos.find((item) => item.id === passoId)
  if (!passo) return { success: false, error: 'Selecione uma etapa válida para este tipo de prótese' }

  const resultado = await prisma.$transaction(async (tx) => {
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }
    if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status || '')) {
      return { success: false, error: 'Esta ordem já está encerrada e não pode ser reposicionada pela Produção' }
    }

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
        historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
          acao: 'definiu_fluxo_manualmente',
          tipo: fluxo.nome,
          etapa: passo.nome,
          data: agora.toISOString(),
          por: usuario.email || 'laboratorio',
        }),
      },
    })

    return { success: true, tipo: fluxo.nome, etapa: passo.nome }
  })

  if (resultado.success) revalidarFluxo()
  return resultado
}

export async function concluirEtapaLaboratorial(ordemId: number) {
  const usuario = await requireUser()

  const resultado = await prisma.$transaction(async (tx) => {
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Fluxo da prótese não identificado' }

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

    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        passoFluxoAtual: proximo.id,
        etapaAtual: proximo.macroetapa,
        subetapaAtual: proximo.nome,
        status: statusParaPassoProtese(proximo),
        prazoEtapaAtual: calcularPrazoPasso(new Date(), proximo, ordem.arcadas),
        historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
          acao: 'concluiu_etapa_laboratorial',
          de: passoAtual.nome,
          para: proximo.nome,
          data: new Date().toISOString(),
          por: usuario.email || 'laboratorio',
        }),
      },
    })

    return { success: true, proximo: proximo.nome }
  })

  if (resultado.success) revalidarFluxo()
  return resultado
}

export async function registrarEnvioFornecedor(ordemId: number, fornecedor: string) {
  const usuario = await requireUser()
  if (!fornecedor.trim()) return { success: false, error: 'Informe o nome do fornecedor' }

  const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
  if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Ordem não encontrada' }
  const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
  if (passo.responsavel !== 'fornecedor') return { success: false, error: 'A ordem não está na etapa do fornecedor' }

  const agora = new Date()
  const prazo = calcularPrazoPasso(agora, passo, ordem.arcadas)
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      fornecedorEstrutura: fornecedor.trim(),
      dataEnvioFornecedor: agora,
      prazoFornecedor: prazo,
      prazoEtapaAtual: prazo,
      dataRecebimentoFornecedor: null,
      justificativaAtrasoFornecedor: null,
      historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
        acao: 'enviado_fornecedor', fornecedor: fornecedor.trim(), data: agora.toISOString(), por: usuario.email || 'laboratorio',
      }),
    },
  })

  revalidarFluxo()
  return { success: true, prazo: prazo?.toISOString() }
}

export async function confirmarRecebimentoFornecedor(ordemId: number, justificativaAtraso?: string) {
  const usuario = await requireUser()

  const resultado = await prisma.$transaction(async (tx) => {
    const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Ordem não encontrada' }
    const passo = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    if (passo.responsavel !== 'fornecedor' || !ordem.dataEnvioFornecedor) return { success: false, error: 'O envio ao fornecedor ainda não foi registrado' }

    const agora = new Date()
    const atrasado = Boolean(ordem.prazoFornecedor && agora > ordem.prazoFornecedor)
    if (atrasado && !justificativaAtraso?.trim()) return { success: false, error: 'Informe a justificativa do fornecedor para o atraso' }

    const proximo = getProximoPassoProtese(ordem.tipoWorkflow, passo.id)
    if (!proximo) return { success: false, error: 'Próxima etapa não encontrada' }

    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        dataRecebimentoFornecedor: agora,
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
}
