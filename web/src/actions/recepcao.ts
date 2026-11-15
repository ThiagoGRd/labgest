'use server'

import { prisma } from '@labgest/database'
import { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { consultarCustodiaExterna } from '@/lib/recepcao-externa-db'
import { concluirEntregaInterna, type EntregaInternaInput } from '@/lib/entrega-interna-recepcao'
import { prepararAgendamento } from '@/lib/agendamento-recepcao'
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
  interno?: { atualizadoEm: string | null }
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
  agendamentoConfirmado: boolean
  agendamentoDentista: string | null
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
          // Keep only explicit corrections in this additional queue branch; do not revive legacy completed work.
          { situacaoLogistica: 'no_laboratorio', historicoEtapas: { array_contains: [{ acao: 'registrou_no_laboratorio' }] } },
          { status: 'Finalizado', dataFinalizacao: { gte: inicioFinalizadosRecentes } },
        ],
      },
      select: {
        id: true,
        updatedAt: true,
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
        agendamentoConfirmado: true,
        agendamentoDentista: true,
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
      interno: { atualizadoEm: ordem.updatedAt?.toISOString() || null },
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
      agendamentoConfirmado: ordem.agendamentoConfirmado,
      agendamentoDentista: ordem.agendamentoDentista,
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
      agendamento: p.agendamento_em?.toISOString() || null, agendamentoConfirmado: p.agendamento_confirmado ?? false, agendamentoDentista: p.agendamento_dentista, movimentadoEm: p.movimentado_em?.toISOString() || null,
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
      agendamentoConfirmado: false,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'registrou_no_laboratorio', usuario, {
        local: 'Laboratório', localAnterior: ordem.localizacaoAtual, situacaoAnterior: situacao, agendamentoEncerrado: ordem.agendamentoConfirmado ? 'sim' : 'não',
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
      // Physical distribution must not overwrite appointment data.
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
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'recepcao',
      situacaoLogistica: aguardandoResposta ? 'aguardando_resultado_dentista' : 'aguardando_envio_laboratorio',
      agendamentoConfirmado: false,
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_do_dentista', usuario, {
        dentista: ordem.dentistaResponsavel || 'Não informado',
        agendamentoEncerrado: ordem.agendamentoConfirmado ? 'sim' : 'não',
      }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
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
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'em_transito_laboratorio',
      situacaoLogistica: 'em_transito_laboratorio',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'enviou_retorno_laboratorio', usuario, { local: 'Laboratório' }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
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
  const resultado = await prisma.ordem.updateMany({
    where: {
      id: ordemId, status: ordem.status, situacaoLogistica: ordem.situacaoLogistica,
      localizacaoAtual: ordem.localizacaoAtual,
      historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull },
    },
    data: {
      localizacaoAtual: 'laboratorio',
      situacaoLogistica: 'no_laboratorio',
      movimentacaoLogisticaEm: agora,
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'recebeu_laboratorio', usuario, { local: 'Laboratório' }),
    },
  })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página e confira novamente.' }
  revalidarRecepcao()
  return { success: true }
}

// Physical delivery only. The normal production flow has already generated billing.
export async function registrarEntregaInternaRecepcao(input: EntregaInternaInput) {
  const usuario = await requireRecepcao()
  try {
    const resultado = await concluirEntregaInterna(prisma, input, usuario, new Date())
    revalidarRecepcao()
    revalidatePath('/financeiro')
    return { success: true, entregueEm: resultado.entregueEm }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const known = /^(Dados inválidos para registrar a entrega\.|Ordem não encontrada\.|A ordem foi alterada\.|Finalize a produção|Há inconsistências na cobrança|Esta OS está sem cobrança\.)/
    return { success: false, error: known.test(message) ? message : 'Não foi possível registrar a entrega. Atualize a página e confira antes de tentar novamente.' }
  }
}

// Scheduling is independent from the physical custody and clinical workflow.
export async function registrarAgendamentoInternoRecepcao(input: { ordemId: number; expectedUpdatedAt: string | null; agendado: boolean; dentista?: string; agendamento?: string }) {
  const usuario = await requireRecepcao()
  let dados: ReturnType<typeof prepararAgendamento>
  try { dados = prepararAgendamento(input.agendado, input.dentista, input.agendamento) } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Dados inválidos.' } }
  const ordem = await carregarOrdem(input.ordemId)
  if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
  if ((ordem.updatedAt?.toISOString() || null) !== input.expectedUpdatedAt) return { success: false, code: 'CONFLICT' as const, error: 'O trabalho foi alterado. Atualize a página e reabra o agendamento.' }
  if (dados.confirmado && !['aguardando_distribuicao', 'com_dentista'].includes(situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm))) return { success: false, error: 'O trabalho precisa estar na recepção ou com o dentista.' }
  if (!dados.confirmado && !ordem.agendamentoConfirmado) return { success: false, error: 'Não há agendamento ativo para cancelar.' }
  const resultado = await prisma.ordem.updateMany({
    where: { id: ordem.id, updatedAt: ordem.updatedAt, status: ordem.status, historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull } },
    data: { agendamentoConfirmado: dados.confirmado, ...(dados.confirmado ? { agendamentoClinico: dados.data, agendamentoDentista: dados.dentista } : {}),
      historicoEtapas: eventoHistorico(ordem.historicoEtapas, dados.confirmado ? 'agendou_recepcao' : 'cancelou_agendamento_recepcao', usuario, { dentista: dados.dentista || '', agendamento: dados.data?.toISOString() || '', agendamentoConfirmadoAnterior: ordem.agendamentoConfirmado ? 'sim' : 'não', agendamentoAnterior: ordem.agendamentoClinico?.toISOString() || '', dentistaAgendamentoAnterior: ordem.agendamentoDentista || '' }) },
  })
  if (resultado.count !== 1) return { success: false, code: 'CONFLICT' as const, error: 'O trabalho foi alterado. Atualize a página e reabra o agendamento.' }
  revalidarRecepcao()
  return { success: true }
}

export async function retornarAgendadoDaRecepcao(input: { ordemId: number; expectedUpdatedAt: string | null }) {
  const usuario = await requireRecepcao()
  const ordem = await carregarOrdem(input.ordemId)
  if (!ordem || !ordem.agendamentoConfirmado || situacaoEfetiva(ordem.situacaoLogistica, ordem.status, ordem.movimentacaoLogisticaEm) !== 'aguardando_distribuicao') return { success: false, error: 'Este retorno não está disponível.' }
  if ((ordem.updatedAt?.toISOString() || null) !== input.expectedUpdatedAt) return { success: false, error: 'O trabalho foi alterado. Atualize a página.' }
  const resultado = await prisma.ordem.updateMany({ where: { id: ordem.id, updatedAt: ordem.updatedAt, status: ordem.status, historicoEtapas: { equals: ordem.historicoEtapas ?? Prisma.AnyNull } }, data: { localizacaoAtual: 'em_transito_laboratorio', situacaoLogistica: 'em_transito_laboratorio', movimentacaoLogisticaEm: new Date(), agendamentoConfirmado: false, historicoEtapas: eventoHistorico(ordem.historicoEtapas, 'retornou_agendado_recepcao', usuario, { agendamentoEncerrado: 'sim', observacao: 'Retorno físico sem decisão clínica.' }) } })
  if (resultado.count !== 1) return { success: false, error: 'O trabalho foi alterado. Atualize a página.' }
  revalidarRecepcao()
  return { success: true }
}
