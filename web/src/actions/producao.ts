'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { abaterEstoquePorServico } from './estoque'
import { gerarCobrancaAutomatica } from './financeiro'
import { inferirTipoProtese, isEtapaId, isTipoProtese, normalizarEtapa, statusParaEtapa } from '@/lib/workflow-config'

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
    return []
  }
}

export async function moverOrdem(id: number, novaEtapa: string) {
  await requireUser()
  if (!isEtapaId(novaEtapa) || novaEtapa === 'entregue') {
    return { success: false, error: 'Etapa de produção inválida' }
  }

  try {
    const novoStatus = statusParaEtapa(novaEtapa)
    const ordem = novaEtapa === 'em_prova'
      ? await prisma.$transaction(async (tx) => {
          const ordemAtual = await tx.ordem.findUnique({
            where: { id },
            select: { id: true },
          })
          if (!ordemAtual) throw new Error('Ordem não encontrada')

          const cicloAtivo = await tx.cicloProducao.findFirst({
            where: { ordemId: id, status: { in: ['no_lab', 'em_prova'] } },
            orderBy: { numeroCiclo: 'desc' },
          })

          if (cicloAtivo) {
            await tx.cicloProducao.update({
              where: { id: cicloAtivo.id },
              data: {
                status: 'em_prova',
                dataSaida: cicloAtivo.dataSaida ?? new Date(),
              },
            })
          } else {
            const totalCiclos = await tx.cicloProducao.count({ where: { ordemId: id } })
            const dataComprometida = new Date()
            dataComprometida.setDate(dataComprometida.getDate() + 7)

            await tx.cicloProducao.create({
              data: {
                ordemId: id,
                numeroCiclo: totalCiclos + 1,
                etapa: 'Prova clínica',
                dataEntrada: new Date(),
                dataSaida: new Date(),
                prazoDias: 7,
                dataComprometida,
                status: 'em_prova',
                registradoPor: 'recuperacao-automatica-kanban',
              },
            })
          }

          return tx.ordem.update({
            where: { id },
            data: {
              etapaAtual: novaEtapa,
              status: novoStatus,
              dataFinalizacao: null,
            },
            select: { servicoId: true },
          })
        })
      : await prisma.ordem.update({
          where: { id },
          data: {
            etapaAtual: novaEtapa,
            status: novoStatus,
            dataFinalizacao: novaEtapa === 'pronto' ? new Date() : null,
          },
          select: { servicoId: true },
        })

    // Se finalizou, abate estoque e gera cobrança automaticamente
    if (novaEtapa === 'pronto' && ordem.servicoId) {
      await abaterEstoquePorServico(ordem.servicoId)
    }
    if (novaEtapa === 'pronto') {
      // Gera conta a receber (ignora erro se já existir)
      await gerarCobrancaAutomatica(id).catch(() => {})
    }

    revalidatePath('/producao')
    revalidatePath('/ordens')
    revalidatePath('/prioridades')
    return { success: true }
  } catch (error) {
    console.error('Erro ao mover ordem:', error)
    return { success: false, error: 'Erro ao mover ordem' }
  }
}
