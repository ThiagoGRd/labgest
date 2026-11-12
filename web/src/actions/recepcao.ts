'use server'

import { prisma } from '@labgest/database'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { consultarCustodiaExterna } from '@/lib/recepcao-externa-db'
import { requireRecepcao } from '@/lib/auth-utils'

export type SituacaoLogistica =
  | 'conferir_recebimento'
  | 'no_laboratorio'
  | 'aguardando_recepcao'
  | 'aguardando_distribuicao'
  | 'com_dentista'
  | 'aguardando_resultado_dentista'
  | 'aguardando_envio_laboratorio'
  | 'em_transito_laboratorio'

export type FinalidadeClinica = 'prova' | 'instalacao' | 'entrega'

export interface OrdemRecepcao {
  origem: 'interno' | 'externo'
  externo?: { revisao: string; version: number }
  id: number
  paciente: string
  clinica: string
  servico: string
  etapa: string
  status: string
  localizacao: string
  situacao: SituacaoLogistica
  dentista: string
  finalidade: FinalidadeClinica | null
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

function situacaoEfetiva(situacao: string, status: string | null, movimentadoEm?: Date | null): SituacaoLogistica {
  if (situacao === 'no_laboratorio' && status === 'Em Prova' && !movimentadoEm) return 'aguardando_recepcao'
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
          { situacaoLogistica: 'no_laboratorio', movimentacaoLogisticaEm: { not: null } },
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
      origem: 'interno',
      id: ordem.id,
      paciente: ordem.nomePaciente,
      clinica: ordem.clienteNome,
      servico: ordem.servicoNome,
      etapa: ordem.subetapaAtual || ordem.etapaAtual || 'Etapa não informada',
      status: ordem.status || 'Aguardando',
      localizacao: ordem.localizacaoAtual,
      situacao: situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm),
      dentista: ordem.dentistaResponsavel || '',
      finalidade: finalidadeEfetiva(ordem.finalidadeClinica, ordem.status),
      agendamento: ordem.agendamentoClinico?.toISOString() || null,
      movimentadoEm: ordem.movimentacaoLogisticaEm?.toISOString() || null,
      entregaPrevista: ordem.dataEntrega.toISOString(),
      decisaoDentista: ciclo?.decisao || null,
      observacaoDentista: ciclo?.observacoesDentista || null,
    }
  })

  let externosDisponiveis = false
  try {
    const externos = await consultarCustodiaExterna(prisma)
    externosDisponiveis = externos.disponivel
    itens.push(...externos.itens.map<OrdemRecepcao>((p) => ({
      origem: 'externo', id: Number(p.id), externo: { revisao: p.revisao, version: p.version ?? 0 },
      paciente: p.paciente, clinica: p.lab_nome, servico: p.servico || 'Serviço não informado',
      etapa: p.situacao_pedido, status: p.situacao_pedido,
      localizacao: p.situacao || 'Não confirmada', situacao: p.situacao || 'conferir_recebimento',
      dentista: p.dentista || '', finalidade: p.finalidade || null,
      agendamento: null, movimentadoEm: p.movimentado_em?.toISOString() || null,
      entregaPrevista: p.prazo?.toISOString() || '', decisaoDentista: null, observacaoDentista: null,
    })))
  } catch {
    // Never treat a failed external read as an empty, complete queue.
    externosDisponiveis = false
  }

  const dentistas = [...new Set(clientes.flatMap((cliente) => [cliente.dentista, cliente.nome]).filter((nome): nome is string => Boolean(nome?.trim())))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))

  return {
    itens,
    externosDisponiveis,
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
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'em_transito_recepcao',
      situacaoLogistica: 'aguardando_recepcao',
      finalidadeClinica: finalidadeEfetiva(ordem.finalidadeClinica, ordem.status),
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'enviou_recepcao', usuario, { local: 'Recepção' }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
  revalidarRecepcao()
  return { success: true }
}

export async function confirmarRecebimentoRecepcao(ordemId: number) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm)
  if (!['aguardando_recepcao', 'no_laboratorio'].includes(situacao)) return { success: false, error: 'Este trabalho não está aguardando recebimento.' }

  const agora = new Date()
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'recepcao',
      situacaoLogistica: 'aguardando_distribuicao',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_recepcao', usuario, { local: 'Recepção' }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
  revalidarRecepcao()
  return { success: true }
}

// A physical-location correction, not a clinical result, dispatch or delivery.
export async function registrarNoLaboratorio(input: {
  ordemId: number
  situacao: SituacaoLogistica
  movimentadoEm: string | null
}) {
  const usuario = await requireRecepcao()
  if (!input || !Number.isSafeInteger(input.ordemId) || input.ordemId <= 0) return { success: false, error: 'Referência inválida.' }
  const ordem = await carregarOrdem(input.ordemId)
  if (!ordem || ['Entregue', 'Cancelado'].includes(ordem.status || '')) return { success: false, error: 'Ordem não encontrada ou encerrada.' }
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm)
  if (!['aguardando_recepcao', 'aguardando_distribuicao'].includes(situacao)) return { success: false, error: 'Esta localização não pode ser alterada por esta opção.' }
  if (input.situacao !== situacao || input.movimentadoEm !== (ordem.movimentacaoLogisticaEm?.toISOString() || null)) {
    return { success: false, error: 'O trabalho foi movimentado. Atualize a página e confira novamente.' }
  }
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordem.id, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'laboratorio', situacaoLogistica: 'no_laboratorio', movimentacaoLogisticaEm: new Date(),
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'registrou_no_laboratorio', usuario, {
        local: 'Laboratório', localAnterior: ordem.localizacaoAtual, situacaoAnterior: situacao,
        observacao: 'Localização física conferida pela recepção. Não registra entrega nem altera a etapa clínica.',
      }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
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
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm)
  const corrigindo = situacao === 'com_dentista'
  if (!['aguardando_distribuicao', 'com_dentista'].includes(situacao)) return { success: false, error: 'O trabalho precisa estar na recepção antes da distribuição.' }
  if (corrigindo && !data.observacao?.trim()) return { success: false, error: 'Informe o motivo da correção da distribuição.' }

  const agendamento = data.agendamento ? new Date(data.agendamento) : null
  if (agendamento && Number.isNaN(agendamento.getTime())) return { success: false, error: 'Informe um agendamento válido.' }
  const agora = new Date()
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: data.ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
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
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
  revalidarRecepcao()
  return { success: true }
}

export async function receberDoDentista(ordemId: number) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  if (situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm) !== 'com_dentista') return { success: false, error: 'O trabalho não está registrado com o dentista.' }

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
  const situacao = situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm)
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
  if (situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm) !== 'em_transito_laboratorio') return { success: false, error: 'O trabalho não está em trânsito para o laboratório.' }

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
