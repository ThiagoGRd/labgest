'use server'

import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireRecepcao } from '@/lib/auth-utils'

export type SituacaoLogistica =
  | 'no_laboratorio'
  | 'aguardando_recepcao'
  | 'aguardando_distribuicao'
  | 'com_dentista'
  | 'aguardando_resultado_dentista'
  | 'aguardando_envio_laboratorio'
  | 'em_transito_laboratorio'

export type FinalidadeClinica = 'prova' | 'instalacao' | 'entrega'

export interface OrdemRecepcao {
  id: number
  paciente: string
  clinica: string
  servico: string
  etapa: string
  status: string
  localizacao: string
  situacao: SituacaoLogistica
  dentista: string
  finalidade: FinalidadeClinica
  agendamento: string | null
  movimentadoEm: string | null
  entregaPrevista: string
  decisaoDentista: string | null
  observacaoDentista: string | null
}

const SITUACOES_ATIVAS: SituacaoLogistica[] = [
  'aguardando_recepcao',
  'aguardando_distribuicao',
  'com_dentista',
  'aguardando_resultado_dentista',
  'aguardando_envio_laboratorio',
  'em_transito_laboratorio',
]

function revalidarRecepcao() {
  revalidatePath('/recepcao')
  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/prioridades')
}

function situacaoEfetiva(situacao: string, status: string | null): SituacaoLogistica {
  if (situacao === 'no_laboratorio' && status === 'Em Prova') return 'aguardando_recepcao'
  return SITUACOES_ATIVAS.includes(situacao as SituacaoLogistica)
    ? situacao as SituacaoLogistica
    : 'no_laboratorio'
}

function finalidadeEfetiva(finalidade: string | null, status: string | null): FinalidadeClinica {
  if (finalidade === 'instalacao' || finalidade === 'entrega' || finalidade === 'prova') return finalidade
  return status === 'Finalizado' ? 'entrega' : 'prova'
}

export async function getPainelRecepcao() {
  const usuario = await requireRecepcao()
  const inicioFinalizadosRecentes = new Date()
  inicioFinalizadosRecentes.setDate(inicioFinalizadosRecentes.getDate() - 60)
  const [ordens, clientes] = await Promise.all([
    prisma.ordem.findMany({
      where: {
        status: { notIn: ['Entregue', 'Cancelado'] },
        OR: [
          { situacaoLogistica: { in: SITUACOES_ATIVAS } },
          { status: 'Em Prova' },
          { status: 'Finalizado', dataFinalizacao: { gte: inicioFinalizadosRecentes } },
        ],
      },
      select: {
        id: true,
        nomePaciente: true,
        clienteNome: true,
        servicoNome: true,
        etapaAtual: true,
        subetapaAtual: true,
        status: true,
        localizacaoAtual: true,
        situacaoLogistica: true,
        dentistaResponsavel: true,
        finalidadeClinica: true,
        agendamentoClinico: true,
        movimentacaoLogisticaEm: true,
        dataEntrega: true,
        ciclos: {
          where: { status: 'em_prova' },
          select: { decisao: true, observacoesDentista: true },
          orderBy: { numeroCiclo: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ movimentacaoLogisticaEm: 'asc' }, { dataEntrega: 'asc' }],
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: { nome: true, dentista: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const itens = ordens.map<OrdemRecepcao>((ordem) => {
    const ciclo = ordem.ciclos[0]
    return {
      id: ordem.id,
      paciente: ordem.nomePaciente,
      clinica: ordem.clienteNome,
      servico: ordem.servicoNome,
      etapa: ordem.subetapaAtual || ordem.etapaAtual || 'Etapa não informada',
      status: ordem.status || 'Aguardando',
      localizacao: ordem.localizacaoAtual,
      situacao: situacaoEfetiva(ordem.situacaoLogistica, ordem.status),
      dentista: ordem.dentistaResponsavel || '',
      finalidade: finalidadeEfetiva(ordem.finalidadeClinica, ordem.status),
      agendamento: ordem.agendamentoClinico?.toISOString() || null,
      movimentadoEm: ordem.movimentacaoLogisticaEm?.toISOString() || null,
      entregaPrevista: ordem.dataEntrega.toISOString(),
      decisaoDentista: ciclo?.decisao || null,
      observacaoDentista: ciclo?.observacoesDentista || null,
    }
  })

  const dentistas = [...new Set(clientes.flatMap((cliente) => [cliente.dentista, cliente.nome]).filter((nome): nome is string => Boolean(nome?.trim())))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return {
    itens,
    dentistas,
    emitidoEm: new Date().toISOString(),
    usuario: { nome: usuario.nome, email: usuario.email, tipo: usuario.tipo || 'operador' },
  }
}

function eventoHistorico(
  historico: Prisma.JsonValue,
  acao: string,
  usuario: { nome: string; email: string },
  detalhes: Record<string, string>,
) {
  const atual = Array.isArray(historico) ? historico : []
  return [...atual, {
    acao,
    ...detalhes,
    data: new Date().toISOString(),
    por: usuario.email,
    responsavel: usuario.nome,
  }] as Prisma.JsonArray
}

async function carregarOrdem(ordemId: number) {
  if (!Number.isInteger(ordemId) || ordemId <= 0) return null
  return prisma.ordem.findFirst({ where: { id: ordemId, status: { notIn: ['Entregue', 'Cancelado'] } } })
}

export async function enviarParaRecepcao(ordemId: number) {
  const usuario = await requireRecepcao()
  if (usuario.tipo === 'recepcao' && !usuario.permissoes.includes('all')) {
    return { success: false, error: 'O envio para a recepção deve ser registrado pelo laboratório.' }
  }
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  const agora = new Date()
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      localizacaoAtual: 'em_transito_recepcao',
      situacaoLogistica: 'aguardando_recepcao',
      finalidadeClinica: finalidadeEfetiva(ordem.finalidadeClinica, ordem.status),
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'enviou_recepcao', usuario, { local: 'Recepção' }),
    },
  })
  revalidarRecepcao()
  return { success: true }
}

export async function confirmarRecebimentoRecepcao(ordemId: number) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status)
  if (situacao !== 'aguardando_recepcao') return { success: false, error: 'Este trabalho não está aguardando recebimento.' }

  const agora = new Date()
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      localizacaoAtual: 'recepcao',
      situacaoLogistica: 'aguardando_distribuicao',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_recepcao', usuario, { local: 'Recepção' }),
    },
  })
  revalidarRecepcao()
  return { success: true }
}

export async function distribuirParaDentista(data: {
  ordemId: number
  dentista: string
  finalidade: FinalidadeClinica
  agendamento?: string
  observacao?: string
}) {
  const usuario = await requireRecepcao()
  const dentista = data.dentista.trim().slice(0, 255)
  if (!dentista) return { success: false, error: 'Informe o dentista responsável.' }
  if (!['prova', 'instalacao', 'entrega'].includes(data.finalidade)) return { success: false, error: 'Informe uma finalidade válida.' }
  const ordem = await carregarOrdem(data.ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status)
  const corrigindo = situacao === 'com_dentista'
  if (!['aguardando_distribuicao', 'com_dentista'].includes(situacao)) return { success: false, error: 'O trabalho precisa estar na recepção antes da distribuição.' }
  if (corrigindo && !data.observacao?.trim()) return { success: false, error: 'Informe o motivo da correção da distribuição.' }

  const agendamento = data.agendamento ? new Date(data.agendamento) : null
  if (agendamento && Number.isNaN(agendamento.getTime())) return { success: false, error: 'Informe um agendamento válido.' }
  const agora = new Date()
  await prisma.ordem.update({
    where: { id: data.ordemId },
    data: {
      localizacaoAtual: 'dentista',
      situacaoLogistica: 'com_dentista',
      dentistaResponsavel: dentista,
      finalidadeClinica: data.finalidade,
      agendamentoClinico: agendamento,
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, corrigindo ? 'corrigiu_distribuicao' : 'entregou_dentista', usuario, {
        dentista,
        finalidade: data.finalidade,
        ...(data.observacao?.trim() ? { observacao: data.observacao.trim().slice(0, 500) } : {}),
      }),
    },
  })
  revalidarRecepcao()
  return { success: true }
}

export async function receberDoDentista(ordemId: number) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  if (situacaoEfetiva(ordem.situacaoLogistica, ordem.status) !== 'com_dentista') return { success: false, error: 'O trabalho não está registrado com o dentista.' }

  const ciclo = await prisma.cicloProducao.findFirst({
    where: { ordemId, status: 'em_prova' },
    select: { decisao: true },
    orderBy: { numeroCiclo: 'desc' },
  })
  const aguardandoResposta = finalidadeEfetiva(ordem.finalidadeClinica, ordem.status) === 'prova' && !ciclo?.decisao
  const agora = new Date()
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      localizacaoAtual: 'recepcao',
      situacaoLogistica: aguardandoResposta ? 'aguardando_resultado_dentista' : 'aguardando_envio_laboratorio',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_do_dentista', usuario, {
        dentista: ordem.dentistaResponsavel || 'Não informado',
      }),
    },
  })
  revalidarRecepcao()
  return { success: true, aguardandoResposta }
}

export async function enviarRetornoLaboratorio(ordemId: number) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status)
  if (!['aguardando_resultado_dentista', 'aguardando_envio_laboratorio'].includes(situacao)) return { success: false, error: 'O trabalho ainda não está pronto para retornar ao laboratório.' }

  if (finalidadeEfetiva(ordem.finalidadeClinica, ordem.status) === 'prova') {
    const ciclo = await prisma.cicloProducao.findFirst({ where: { ordemId, status: 'em_prova' }, select: { decisao: true }, orderBy: { numeroCiclo: 'desc' } })
    if (!ciclo?.decisao) return { success: false, error: 'O dentista ainda precisa registrar o resultado da prova no portal.' }
  }

  const agora = new Date()
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      localizacaoAtual: 'em_transito_laboratorio',
      situacaoLogistica: 'em_transito_laboratorio',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'enviou_retorno_laboratorio', usuario, { local: 'Laboratório' }),
    },
  })
  revalidarRecepcao()
  return { success: true }
}

export async function confirmarRecebimentoLaboratorio(ordemId: number) {
  const usuario = await requireRecepcao()
  if (usuario.tipo === 'recepcao' && !usuario.permissoes.includes('all')) {
    return { success: false, error: 'O recebimento deve ser confirmado pela equipe do laboratório.' }
  }
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  if (situacaoEfetiva(ordem.situacaoLogistica, ordem.status) !== 'em_transito_laboratorio') return { success: false, error: 'O trabalho não está em trânsito para o laboratório.' }

  const agora = new Date()
  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      localizacaoAtual: 'laboratorio',
      situacaoLogistica: 'no_laboratorio',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_laboratorio', usuario, { local: 'Laboratório' }),
    },
  })
  revalidarRecepcao()
  return { success: true }
}
