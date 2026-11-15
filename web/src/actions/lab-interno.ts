'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { getProducao } from '@/actions/producao'
import { listarTriagemWhatsappOs } from '@/actions/triagem-whatsapp'
import { clinicorpConfigurado } from '@/lib/clinicorp'
import {
  aplicarPassoInferidoNaOrdem,
  carregarInferenciasClinicorpParaOrdens,
} from '@/lib/clinicorp-etapas'
import { sincronizarClinicorp } from '@/lib/controle-tratamentos'
import { ordensSemEtapa, retornosRespondidos } from '@/lib/dashboard-attention'
import { hojeIso, somarDias } from '@/lib/labs-externos-utils'
import { JANELA_DESEMPENHO_DIAS, type OrdemFinalizada } from '@/lib/lab-interno-utils'

// Painel unificado do laboratório interno (substitui a antiga aba Produção):
// junta fila da bancada, retornos, etapas a definir, triagem WhatsApp e inferência Clinicorp.
export async function getLabInterno() {
  await requireUser()

  const inicio = new Date(`${somarDias(hojeIso(), -JANELA_DESEMPENHO_DIAS)}T00:00:00Z`)

  try {
    const [ordensBase, finalizadas, triagem, retornos, semEtapa, ultimaSync] = await Promise.all([
      getProducao(),
      prisma.ordem.findMany({
        where: { status: { in: ['Finalizado', 'Entregue'] }, dataFinalizacao: { gte: inicio } },
        select: {
          dataPedido: true,
          dataEntrega: true,
          dataFinalizacao: true,
          _count: { select: { ciclos: true } },
        },
        take: 2000,
      }),
      listarTriagemWhatsappOs(),
      prisma.cicloProducao.findMany({
        where: retornosRespondidos,
        orderBy: { updatedAt: 'asc' },
        select: {
          id: true,
          numeroCiclo: true,
          decisao: true,
          ordemId: true,
          ordem: { select: { nomePaciente: true, clienteNome: true, status: true, cliente: { select: { nome: true } } } },
        },
      }),
      prisma.ordem.findMany({ where: ordensSemEtapa, select: { id: true } }),
      prisma.clinicorpSincronizacao.findFirst({ where: { concluidaEm: { not: null } }, orderBy: { id: 'desc' } }),
    ])

    const inferencias = await carregarInferenciasClinicorpParaOrdens(
      ordensBase.map((o) => ({
        id: o.id,
        nomePaciente: o.paciente,
        servicoNome: o.servico,
        tipoWorkflow: o.tipoWorkflow ?? null,
        passoFluxoAtual: o.passoFluxoAtual ?? null,
        dataPedido: o.dataPedido ?? o.entrega,
        localizacaoAtual: o.localizacaoAtual ?? null,
      })),
    )

    const ordens = ordensBase.map((ordem) => ({
      ...ordem,
      clinicorpEtapa: inferencias.get(ordem.id) ?? null,
    }))

    const historico: OrdemFinalizada[] = finalizadas.map((ordem) => ({
      dataPedido: ordem.dataPedido,
      dataEntrega: ordem.dataEntrega,
      dataFinalizacao: ordem.dataFinalizacao,
      ciclos: ordem._count.ciclos,
    }))

    return {
      ordens,
      historico,
      triagem,
      semEtapaIds: semEtapa.map((ordem) => ordem.id),
      retornosDashboard: retornos.map((ciclo) => ({
        id: ciclo.id,
        numeroCiclo: ciclo.numeroCiclo,
        decisao: ciclo.decisao,
        ordemId: ciclo.ordemId,
        paciente: ciclo.ordem.nomePaciente,
        cliente: ciclo.ordem.clienteNome || ciclo.ordem.cliente?.nome || 'Cliente não informado',
        status: ciclo.ordem.status,
      })),
      clinicorpConfigurado: clinicorpConfigurado(),
      ultimaSincronizacao: ultimaSync?.concluidaEm
        ? {
            em: ultimaSync.concluidaEm.toISOString(),
            sucesso: ultimaSync.sucesso,
            erro: ultimaSync.erro,
            consultas: ultimaSync.consultas,
          }
        : null,
    }
  } catch (error) {
    console.error('Erro ao carregar o laboratório interno:', error)
    throw new Error('Não foi possível carregar o laboratório interno. Atualize a página para tentar novamente.')
  }
}

export async function sincronizarEtapasClinicorpLab() {
  await requireUser()
  const resultado = await sincronizarClinicorp('manual')
  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  revalidatePath('/tratamentos')
  revalidatePath('/recepcao')
  revalidatePath('/dashboard')
  revalidatePath('/prioridades')
  return resultado
}

export async function aplicarEtapaClinicorpNaOrdem(ordemId: number) {
  const usuario = await requireUser()
  const ordem = await prisma.ordem.findUnique({
    where: { id: ordemId },
    select: {
      id: true,
      nomePaciente: true,
      servicoNome: true,
      tipoWorkflow: true,
      passoFluxoAtual: true,
      dataPedido: true,
      localizacaoAtual: true,
      status: true,
    },
  })
  if (!ordem) return { success: false, error: 'Ordem não encontrada' }
  if (['Finalizado', 'Entregue', 'Cancelado', 'Pausado'].includes(ordem.status || '')) {
    return { success: false, error: 'Ordem encerrada ou pausada não pode ser atualizada.' }
  }

  const inferencias = await carregarInferenciasClinicorpParaOrdens([ordem])
  const inferencia = inferencias.get(ordemId)
  if (!inferencia?.passoSugeridoId) {
    return { success: false, error: 'Nenhuma etapa identificada no Clinicorp para esta OS.' }
  }

  const aplicou = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${ordemId} FOR UPDATE`
    return aplicarPassoInferidoNaOrdem(tx, ordemId, inferencia, usuario.email || 'laboratorio')
  })

  if (!aplicou) {
    return { success: false, error: 'A OS já se encontra nesta etapa.' }
  }

  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  revalidatePath('/dashboard')
  revalidatePath('/prioridades')
  revalidatePath('/recepcao')
  return { success: true, etapa: inferencia.passoSugeridoNome }
}
