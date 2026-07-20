'use server'

import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireAdmin, requireUser } from '@/lib/auth-utils'
import { gerarCobrancaAutomatica } from './financeiro'
import { parseDateLocal } from '@/lib/date-utils'
import { isCpfValido, normalizarCpf } from '@/lib/cpf'
import {
  getWorkflowForServico,
  getNextEtapa,
  getRetornoEtapa,
  getProgresso,
  isEtapaProva,
  canAdvance,
  normalizarEtapa,
  statusParaEtapa,
  ETAPA_FINAL,
  type ChecklistEstetico,
  type TipoWorkflow,
  calcularPrazoPasso,
  getFluxoProtese,
  inferirTipoProtese,
  isTipoProtese,
} from '@/lib/workflow-config'

export interface FiltrosOrdens {
  busca?: string
  status?: string
  clienteId?: number
  tipoWorkflow?: string
  ordenar?: 'prazo' | 'recentes' | 'atualizadas' | 'paciente'
  pagina?: number
  porPagina?: number
}

const STATUS_ENCERRADOS = ['Finalizado', 'Entregue', 'Cancelado']

function validarDataEntrega(valor: string, permitirPassado = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (ano < 2020 || ano > new Date().getFullYear() + 2) return null
  const data = parseDateLocal(valor)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null
  if (!permitirPassado) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    if (data < hoje) return null
  }
  return data
}

export async function getOrdens(filtros: FiltrosOrdens = {}) {
  await requireUser()

  const pagina = Math.max(1, filtros.pagina || 1)
  const porPagina = Math.min(50, Math.max(10, filtros.porPagina || 20))
  const busca = filtros.busca?.trim() || ''
  const cpfBusca = busca.replace(/\D/g, '')
  const status = filtros.status || 'ativas'
  const condicoesBusca: Prisma.OrdemWhereInput[] = busca ? [
    { nomePaciente: { contains: busca, mode: 'insensitive' } },
    { clienteNome: { contains: busca, mode: 'insensitive' } },
    { servicoNome: { contains: busca, mode: 'insensitive' } },
    ...(cpfBusca ? [{ cpfPaciente: { contains: cpfBusca } } satisfies Prisma.OrdemWhereInput] : []),
    ...(/^\d+$/.test(busca) ? [{ id: Number(busca) }] : []),
  ] : []

  const where: Prisma.OrdemWhereInput = {
    ...(status === 'ativas'
      ? { status: { notIn: STATUS_ENCERRADOS } }
      : status === 'encerradas'
        ? { status: { in: STATUS_ENCERRADOS } }
        : status !== 'todos'
          ? { status }
          : {}),
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.tipoWorkflow ? { tipoWorkflow: filtros.tipoWorkflow } : {}),
    ...(busca ? { OR: condicoesBusca } : {}),
  }

  const orderBy: Prisma.OrdemOrderByWithRelationInput[] = filtros.ordenar === 'recentes'
    ? [{ createdAt: 'desc' }]
    : filtros.ordenar === 'atualizadas'
      ? [{ updatedAt: 'desc' }]
      : filtros.ordenar === 'paciente'
        ? [{ nomePaciente: 'asc' }]
        : [{ dataEntrega: 'asc' }, { prioridade: 'desc' }]

  const [ordens, total, totalGeral, ativas, emProva, finalizadas, pausadas, encerradas] = await Promise.all([
    prisma.ordem.findMany({
      where,
      orderBy,
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        nomePaciente: true,
        cpfPaciente: true,
        clienteNome: true,
        servicoNome: true,
        status: true,
        prioridade: true,
        dataPedido: true,
        dataEntrega: true,
        dataEntregaReal: true,
        etapaAtual: true,
        subetapaAtual: true,
        valor: true,
        valorFinal: true,
        arquivoStl: true,
        tipoWorkflow: true,
        tentativaAtual: true,
        tokenRastreamento: true,
        motivoPausa: true,
        pausadoEm: true,
        updatedAt: true,
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } },
      },
    }),
    prisma.ordem.count({ where }),
    prisma.ordem.count(),
    prisma.ordem.count({ where: { status: { notIn: STATUS_ENCERRADOS } } }),
    prisma.ordem.count({ where: { status: 'Em Prova' } }),
    prisma.ordem.count({ where: { status: 'Finalizado' } }),
    prisma.ordem.count({ where: { status: 'Pausado' } }),
    prisma.ordem.count({ where: { status: { in: STATUS_ENCERRADOS } } }),
  ])

  return {
    ordens: ordens.map(o => ({
      id: o.id,
      paciente: o.nomePaciente,
      cpfPaciente: o.cpfPaciente || '',
      cliente: { nome: o.clienteNome || o.cliente?.nome || 'Cliente Desconhecido' },
      servico: o.servicoNome || o.servico?.nome || 'Serviço',
      status: o.status || 'Aguardando',
      prioridade: o.prioridade || 'Normal',
      dataEntrada: o.dataPedido ? o.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: o.dataEntrega && !isNaN(o.dataEntrega.getTime()) ? o.dataEntrega.toISOString() : new Date().toISOString(),
      dataEntregaReal: o.dataEntregaReal?.toISOString() || null,
      etapaAtual: normalizarEtapa(o.etapaAtual || 'recebimento'),
      subetapaAtual: o.subetapaAtual || '',
      valor: Number(o.valorFinal || o.valor),
      arquivos: (o.arquivoStl as string[]) || [],
      tipoWorkflow: (o.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: o.tentativaAtual || 0,
      tokenRastreamento: o.tokenRastreamento,
      motivoPausa: o.motivoPausa,
      pausadoEm: o.pausadoEm?.toISOString() || null,
      updatedAt: o.updatedAt?.toISOString() || null,
    })),
    total,
    totalGeral,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    contadores: { ativas, emProva, finalizadas, pausadas, encerradas },
  }
}

export async function createBatchOrdens(data: {
  clienteId: string
  paciente: string
  cpfPaciente: string
  dataEntrega: string
  prioridade: string
  observacoes: string
  arquivos?: string[]
  itens: Array<{
    servicoId: string
    elementos: string
    corDentes: string
    material: string
    arcadas?: number
    tipoProtese?: string
  }>
}) {
  const usuario = await requireUser()
  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }
    const dataEntrega = validarDataEntrega(data.dataEntrega)
    if (!dataEntrega) return { success: false, error: 'Informe uma data de entrega válida, entre hoje e os próximos 2 anos' }
    if (!data.itens.length) return { success: false, error: 'Adicione pelo menos um serviço ao pedido' }

    const cliente = await prisma.cliente.findUnique({ where: { id: Number(data.clienteId) } })
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    const idsServicos = [...new Set(data.itens.map((item) => Number(item.servicoId)))]
    const servicos = await prisma.servico.findMany({ where: { id: { in: idsServicos }, ativo: true } })
    if (servicos.length !== idsServicos.length) return { success: false, error: 'Um dos serviços não existe ou está inativo' }
    const servicosPorId = new Map(servicos.map((servico) => [servico.id, servico]))

    const operacoes = data.itens.map((item) => {
      const servico = servicosPorId.get(Number(item.servicoId))!
      const valor = Number(servico.preco)
      const tipoProtese = isTipoProtese(item.tipoProtese) ? item.tipoProtese : inferirTipoProtese(servico.nome)
      const primeiroPasso = tipoProtese ? getFluxoProtese(tipoProtese).passos[0] : null
      const tipoWorkflow = tipoProtese || getWorkflowForServico(servico.nome)
      const primeiraEtapa = primeiroPasso?.macroetapa || 'recebimento'
      const arcadas = item.arcadas === 2 ? 2 : 1

      return prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: servico.id,
          servicoNome: servico.nome,
          nomePaciente: data.paciente,
          cpfPaciente,
          dataEntrega,
          valor: valor,
          valorFinal: valor,
          prioridade: data.prioridade,
          corDentes: item.corDentes,
          elementos: item.elementos,
          material: item.material,
          observacoes: data.observacoes,
          status: 'Aguardando',
          etapaAtual: primeiraEtapa,
          subetapaAtual: primeiroPasso?.nome,
          tipoWorkflow: tipoWorkflow,
          passoFluxoAtual: primeiroPasso?.id,
          arcadas,
          prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(new Date(), primeiroPasso, arcadas) : null,
          tentativaAtual: 0,
          historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString(), por: usuario.email }],
          checklistEstetico: {},
          arquivoStl: data.arquivos || [],
        }
      })
    })

    await prisma.$transaction(operacoes)
    revalidatePath('/ordens')
    revalidatePath('/producao')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar ordens em lote:', error)
    return { success: false, error: 'Erro ao criar ordens' }
  }
}

export async function updateOrdem(id: number, data: {
  paciente: string
  cpfPaciente: string
  dataEntrega: string
  prioridade: string
  status: string
  etapaAtual: string
  corDentes: string
  material: string
  observacoes: string
  motivoStatus?: string
}) {
  const usuario = await requireUser()
  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }
    const dataEntrega = validarDataEntrega(data.dataEntrega, true)
    if (!dataEntrega) return { success: false, error: 'Informe uma data de entrega válida entre 2020 e os próximos 2 anos' }
    if (data.status === 'Pausado' && !data.motivoStatus?.trim()) {
      return { success: false, error: 'Informe o motivo da pausa' }
    }

    // Normaliza etapaAtual para ID canônico antes de salvar
    const etapaCanonica = normalizarEtapa(data.etapaAtual)
    const novoStatus = data.status === 'Pausado'
      ? data.status
      : statusParaEtapa(etapaCanonica)

    const ordemAtual = await prisma.ordem.findUnique({ where: { id }, select: { status: true, etapaAtual: true, historicoEtapas: true } })
    if (!ordemAtual) return { success: false, error: 'Ordem não encontrada' }
    if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordemAtual.status || '')) {
      return { success: false, error: 'Ordens encerradas não podem ser alteradas' }
    }
    const historico = (ordemAtual.historicoEtapas as Prisma.InputJsonObject[]) || []
    if (novoStatus === 'Pausado' && ordemAtual.status !== 'Pausado') {
      historico.push({ etapa: ordemAtual.etapaAtual || etapaCanonica, acao: 'pausou', motivo: data.motivoStatus?.trim(), data: new Date().toISOString(), por: usuario.email })
    } else if (ordemAtual.status === 'Pausado' && novoStatus !== 'Pausado') {
      historico.push({ etapa: etapaCanonica, acao: 'retomou', data: new Date().toISOString(), por: usuario.email })
    }

    await prisma.ordem.update({
      where: { id },
      data: {
        nomePaciente: data.paciente,
        cpfPaciente,
        dataEntrega,
        prioridade: data.prioridade,
        status: novoStatus,
        etapaAtual: etapaCanonica,
        corDentes: data.corDentes,
        material: data.material,
        observacoes: data.observacoes,
        dataFinalizacao: novoStatus === 'Finalizado' ? new Date() : null,
        motivoPausa: novoStatus === 'Pausado' ? data.motivoStatus?.trim() : null,
        pausadoEm: novoStatus === 'Pausado' ? new Date() : null,
        pausadoPor: novoStatus === 'Pausado' ? usuario.email : null,
        historicoEtapas: historico,
      }
    })

    // Se entrou em status Finalizado via edição, gera cobrança
    if (novoStatus === 'Finalizado') {
      await gerarCobrancaAutomatica(id).catch(() => {})
    }

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao atualizar ordem: ${errorMsg}` }
  }
}

export async function getOrdemById(id: number) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true } },
        servico: { select: { id: true, nome: true } },
      }
    })

    if (!ordem) {
      console.log('[getOrdemPublic] Ordem não encontrada para ID:', id)
      return null
    }

    return {
      id: ordem.id,
      paciente: ordem.nomePaciente,
      cpfPaciente: ordem.cpfPaciente || '',
      cliente: { id: ordem.cliente?.id, nome: ordem.clienteNome || ordem.cliente?.nome || 'Cliente Desconhecido' },
      clienteId: ordem.clienteId ?? undefined,
      servico: ordem.servicoNome || ordem.servico?.nome || 'Serviço',
      servicoId: ordem.servicoId ?? undefined,
      status: ordem.status || 'Aguardando',
      prioridade: ordem.prioridade || 'Normal',
      dataEntrada: ordem.dataPedido ? ordem.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: ordem.dataEntrega?.toISOString() || new Date().toISOString(),
      etapaAtual: normalizarEtapa(ordem.etapaAtual || 'recebimento'),
      subetapaAtual: ordem.subetapaAtual || '',
      valor: Number(ordem.valorFinal || ordem.valor),
      corDentes: ordem.corDentes || '',
      material: ordem.material || '',
      observacoes: ordem.observacoes || '',
      arquivos: (ordem.arquivoStl as string[]) || [],
      // Workflow fields
      tipoWorkflow: (ordem.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: ordem.tentativaAtual || 0,
      historicoEtapas: (ordem.historicoEtapas as unknown[]) || [],
      checklistEstetico: (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {},
      fotosProva: (ordem.fotosProva as unknown[]) || [],
      fotosCaso: Array.isArray(ordem.fotosCaso) ? ordem.fotosCaso.filter((foto): foto is string => typeof foto === 'string') : [],
      mensagens: Array.isArray(ordem.mensagens) ? ordem.mensagens : [],
      tokenRastreamento: ordem.tokenRastreamento,
      motivoPausa: ordem.motivoPausa,
      pausadoEm: ordem.pausadoEm?.toISOString() || null,
    }
  } catch (error) {
    console.error('[getOrdemById] Erro ao buscar ordem:', error)
    return null
  }
}

export async function getOrdemPublic(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) return null

  const ordem = await prisma.ordem.findUnique({
    where: { tokenRastreamento: token },
    select: {
      id: true,
      nomePaciente: true,
      clienteNome: true,
      servicoNome: true,
      status: true,
      prioridade: true,
      dataEntrega: true,
      etapaAtual: true,
      passoFluxoAtual: true,
      tipoWorkflow: true,
    },
  })
  if (!ordem) return null

  const partesNome = ordem.nomePaciente.trim().split(/\s+/)
  const pacienteMascarado = partesNome.length > 1
    ? `${partesNome[0]} ${partesNome.at(-1)?.charAt(0) || ''}.`
    : partesNome[0]

  return {
    id: ordem.id,
    paciente: pacienteMascarado,
    cliente: { nome: ordem.clienteNome },
    servico: ordem.servicoNome,
    status: ordem.status || 'Aguardando',
    prioridade: ordem.prioridade || 'Normal',
    dataEntrega: ordem.dataEntrega.toISOString(),
    etapaAtual: normalizarEtapa(ordem.etapaAtual || 'recebimento'),
    passoFluxoAtual: ordem.passoFluxoAtual,
    tipoWorkflow: ordem.tipoWorkflow,
  }
}

export async function deleteOrdem(id: number) {
  await requireAdmin()
  try {
    const ordem = await prisma.ordem.findUnique({ where: { id }, select: { status: true, historicoEtapas: true } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }
    if ((ordem.historicoEtapas as unknown[] | null)?.length || ordem.status !== 'Aguardando') {
      return { success: false, error: 'Ordens que já entraram no fluxo devem ser canceladas, não excluídas' }
    }
    await prisma.ordem.delete({ where: { id } })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir ordem:', error)
    return { success: false, error: 'Erro ao excluir ordem' }
  }
}

export async function cancelarOrdem(id: number, motivo: string) {
  const usuario = await requireUser()
  if (!motivo.trim()) return { success: false, error: 'Informe o motivo do cancelamento' }

  const ordem = await prisma.ordem.findUnique({ where: { id } })
  if (!ordem) return { success: false, error: 'Ordem não encontrada' }
  if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status || '')) {
    return { success: false, error: 'Esta ordem não pode mais ser cancelada' }
  }

  const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
  historico.push({
    etapa: ordem.etapaAtual || 'recebimento',
    acao: 'cancelou',
    motivo: motivo.trim(),
    data: new Date().toISOString(),
    por: usuario.email,
  })

  await prisma.ordem.update({
    where: { id },
    data: {
      status: 'Cancelado',
      motivoCancelamento: motivo.trim(),
      canceladoEm: new Date(),
      canceladoPor: usuario.email,
      historicoEtapas: historico,
    },
  })

  revalidatePath('/ordens')
  revalidatePath('/producao')
  revalidatePath('/prioridades')
  return { success: true }
}

export async function getDadosNovaOrdem() {
  await requireUser()
  try {
    const [clientes, servicosRaw] = await Promise.all([
      prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, preco: true, tempoProducao: true } })
    ])

    const servicos = servicosRaw.map(s => ({
      ...s,
      preco: Number(s.preco),
      tempoProducao: s.tempoProducao || 0,
    }))

    return { clientes, servicos }
  } catch (error) {
    console.error('Erro ao buscar dados para nova ordem:', error)
    return { clientes: [], servicos: [] }
  }
}

// ============================================================
// Workflow Actions — Avançar / Devolver etapas
// ============================================================

export async function avancarEtapa(ordemId: number, observacao?: string) {
  await requireUser()
  try {
    console.log('[avancarEtapa] Iniciando para ordem ID:', ordemId)
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) {
      console.error('[avancarEtapa] Ordem não encontrada:', ordemId)
      return { success: false, error: 'Ordem não encontrada' }
    }

    const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
    // Normaliza etapa atual para ID canônico (lida com dados legados)
    const etapaAtualCanonica = normalizarEtapa(ordem.etapaAtual || 'recebimento')

    const proxima = getNextEtapa(tipoWorkflow, etapaAtualCanonica)
    if (!proxima) return { success: false, error: 'Já está na última etapa' }

    // Se é etapa de prova, verificar checklist
    if (isEtapaProva(tipoWorkflow, etapaAtualCanonica)) {
      const checklist = (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {}
      if (!canAdvance(tipoWorkflow, etapaAtualCanonica, checklist)) {
        return { success: false, error: 'Complete o checklist de registro estético antes de avançar' }
      }
    }

    const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
    historico.push({
      etapa: etapaAtualCanonica,
      acao: 'avancou',
      para: proxima,
      data: new Date().toISOString(),
      observacao: observacao || undefined,
    })

    // Determinar novo status: finalizado somente ao chegar em ETAPA_FINAL
    const novoStatus = statusParaEtapa(proxima)
    const progresso = getProgresso(tipoWorkflow, proxima)

    await prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: proxima,
        historicoEtapas: historico,
        status: novoStatus,
        progresso: progresso,
        checklistEstetico: {},
        dataFinalizacao: proxima === ETAPA_FINAL ? new Date() : null,
      }
    })

    // Se finalizou, gera cobrança automaticamente
    if (novoStatus === 'Finalizado') {
      await gerarCobrancaAutomatica(ordemId).catch(() => {})
    }

    console.log('[avancarEtapa] Sucesso!')
    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    return { success: true, novaEtapa: proxima }
  } catch (error) {
    console.error('[avancarEtapa] Erro detalhado:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao avançar etapa: ${errorMsg}` }
  }
}

export async function marcarEntregue(ordemId: number) {
  try {
    const usuario = await requireUser()
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }
    if (ordem.status !== 'Finalizado') {
      return { success: false, error: 'Finalize o fluxo de produção antes de registrar a entrega' }
    }

    const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
    historico.push({
      etapa: ordem.etapaAtual || 'pronto',
      acao: 'avancou',
      para: 'entregue',
      data: new Date().toISOString(),
      por: usuario.email,
    })

    await prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: 'entregue',
        status: 'Entregue',
        historicoEtapas: historico,
        progresso: 100,
        dataEntregaReal: new Date(),
      }
    })

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[marcarEntregue] Erro:', msg)
    return { success: false, error: msg }
  }
}

export async function retornarEtapa(ordemId: number, motivoRetorno: string) {
  await requireUser()
  try {
    if (!motivoRetorno.trim()) {
      return { success: false, error: 'Informe o motivo da devolução' }
    }

    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
    const etapaAtual = ordem.etapaAtual || 'Recebimento'
    const retorno = getRetornoEtapa(tipoWorkflow, etapaAtual)

    if (!retorno) return { success: false, error: 'Não é possível retornar desta etapa' }

    const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
    const novaTentativa = (ordem.tentativaAtual || 0) + 1

    historico.push({
      etapa: etapaAtual,
      acao: 'devolveu',
      para: retorno,
      data: new Date().toISOString(),
      motivo: motivoRetorno,
      tentativa: novaTentativa,
    })

    const progresso = getProgresso(tipoWorkflow, retorno)

    await prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: retorno,
        tentativaAtual: novaTentativa,
        historicoEtapas: historico,
        status: statusParaEtapa(retorno),
        progresso: progresso,
        checklistEstetico: {},
      }
    })

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    return { success: true, novaEtapa: retorno, tentativa: novaTentativa }
  } catch (error) {
    console.error('Erro ao retornar etapa:', error)
    return { success: false, error: 'Erro ao retornar etapa' }
  }
}

export async function updateChecklistEstetico(ordemId: number, checklist: Partial<ChecklistEstetico>) {
  await requireUser()
  try {
    await prisma.ordem.update({
      where: { id: ordemId },
      data: { checklistEstetico: checklist }
    })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar checklist:', error)
    return { success: false, error: 'Erro ao atualizar checklist' }
  }
}

export async function uploadFotoProva(ordemId: number, fotoUrl: string, numeroProva: number, descricao?: string) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    const fotos = (ordem.fotosProva as Prisma.InputJsonObject[]) || []
    fotos.push({
      url: fotoUrl,
      numeroProva,
      descricao: descricao || '',
      dataUpload: new Date().toISOString(),
      etapa: ordem.etapaAtual,
    })

    await prisma.ordem.update({
      where: { id: ordemId },
      data: { fotosProva: fotos }
    })

    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao upload foto prova:', error)
    return { success: false, error: 'Erro ao salvar foto' }
  }
}

export async function getFotosProva(ordemId: number) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      select: { fotosProva: true }
    })
    return (ordem?.fotosProva as unknown[]) || []
  } catch (error) {
    console.error('Erro ao buscar fotos:', error)
    return []
  }
}
