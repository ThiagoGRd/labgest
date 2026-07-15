'use server'

import { Prisma, prisma } from '@labgest/database'
import {
  calcularPrazoPasso,
  getPassoProtese,
  getProximoPassoProtese,
  isTipoProtese,
  statusParaPassoProtese,
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
