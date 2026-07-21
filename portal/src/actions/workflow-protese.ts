'use server'

import { Prisma, prisma } from '@labgest/database'
import {
  calcularPrazoPasso,
  getPassoProtese,
  getProximoPassoProtese,
  isTipoProtese,
  statusParaPassoProtese,
} from '@/lib/workflow-config'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function historicoComEvento(historico: Prisma.JsonValue, evento: Prisma.JsonObject) {
  return [...(Array.isArray(historico) ? historico : []), evento] as Prisma.JsonArray
}

export async function concluirEtapaClinica(ordemId: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { success: false, error: 'Não autorizado' }

  const resultado = await prisma.$transaction(async (tx) => {
    const cliente = await tx.cliente.findFirst({ where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true }, select: { id: true } })
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    const ordem = await tx.ordem.findFirst({
      where: { id: ordemId, clienteId: cliente.id },
      include: { contasReceber: { where: { status: { not: 'Cancelado' } }, take: 1 } },
    })
    if (!ordem || !isTipoProtese(ordem.tipoWorkflow)) return { success: false, error: 'Fluxo da prótese não identificado' }

    const passoAtual = getPassoProtese(ordem.tipoWorkflow, ordem.passoFluxoAtual)
    if (passoAtual.responsavel !== 'clinica') return { success: false, error: 'Esta etapa deve ser concluída pelo laboratório' }
    if (passoAtual.prova) return { success: false, error: 'Registre o resultado da prova usando Aprovar ou Solicitar ajuste' }

    if (passoAtual.entregaFinal) {
      const agora = new Date()
      if (ordem.contasReceber.length === 0) {
        await tx.contaReceber.create({
          data: {
            ordemId,
            descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
            clienteId: ordem.clienteId,
            clienteNome: ordem.clienteNome,
            valor: ordem.valorFinal,
            dataCompetencia: agora,
            dataVencimento: new Date(agora.getFullYear(), agora.getMonth() + 1, 15),
            status: 'Pendente',
            observacoes: `Gerado automaticamente na entrega clínica da OS #${ordemId}`,
          },
        })
      }
      await tx.ordem.update({
        where: { id: ordemId },
        data: {
          status: 'Entregue', etapaAtual: 'entregue', dataFinalizacao: agora, dataEntregaReal: agora,
          cobrancaGeradaEm: agora, prazoEtapaAtual: null,
          historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
            acao: 'entrega_clinica_concluida', etapa: passoAtual.nome, data: agora.toISOString(), por: user.email,
          }),
        },
      })
      return { success: true, finalizado: true }
    }

    const proximo = getProximoPassoProtese(ordem.tipoWorkflow, passoAtual.id)
    if (!proximo) return { success: false, error: 'Próxima etapa não encontrada' }

    await tx.ordem.update({
      where: { id: ordemId },
      data: {
        passoFluxoAtual: proximo.id,
        etapaAtual: proximo.macroetapa,
        subetapaAtual: proximo.nome,
        status: statusParaPassoProtese(proximo),
        prazoEtapaAtual: calcularPrazoPasso(new Date(), proximo, ordem.arcadas),
        historicoEtapas: historicoComEvento(ordem.historicoEtapas, {
          acao: 'concluiu_etapa_clinica', de: passoAtual.nome, para: proximo.nome, data: new Date().toISOString(), por: user.email,
        }),
      },
    })
    return { success: true, proximo: proximo.nome }
  })

  if (resultado.success) {
    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    revalidatePath('/financeiro')
  }
  return resultado
}
