'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import {
  getWorkflowForServico,
  getNextEtapa,
  getRetornoEtapa,
  getEtapas,
  getEtapaNome,
  getProgresso,
  isEtapaProva,
  canAdvance,
  type ChecklistEstetico,
  type TipoWorkflow,
} from '@/lib/workflow-config'

export async function getOrdens() {
  await requireUser()
  try {
    const ordens = await prisma.ordem.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } },
      }
    })

    return ordens.map(o => ({
      id: o.id,
      paciente: o.nomePaciente,
      cliente: { nome: o.clienteNome || o.cliente?.nome || 'Cliente Desconhecido' },
      servico: o.servicoNome || o.servico?.nome || 'Serviço',
      status: o.status || 'Aguardando',
      prioridade: o.prioridade || 'Normal',
      dataEntrada: o.dataPedido ? o.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: o.dataEntrega && !isNaN(o.dataEntrega.getTime()) ? o.dataEntrega.toISOString() : new Date().toISOString(),
      etapaAtual: o.etapaAtual || 'Recebimento',
      valor: Number(o.valorFinal || o.valor),
      corDentes: o.corDentes || '',
      material: o.material || '',
      observacoes: o.observacoes || '',
      foto: null,
      arquivos: (o.arquivoStl as string[]) || [],
      // Workflow fields
      tipoWorkflow: (o.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: o.tentativaAtual || 0,
      historicoEtapas: (o.historicoEtapas as any[]) || [],
      checklistEstetico: (o.checklistEstetico as Partial<ChecklistEstetico>) || {},
      fotosProva: (o.fotosProva as any[]) || [],
    }))
  } catch (error) {
    console.error('Erro ao buscar ordens:', error)
    return []
  }
}

export async function createOrdem(data: {
  clienteId: string
  servicoId: string
  paciente: string
  dataEntrega: string
  prioridade: string
  corDentes: string
  material: string
  observacoes: string
  arquivos?: string[]
}) {
  try {
    // Buscar cliente e serviço para pegar nomes e valores
    const [cliente, servico] = await Promise.all([
      prisma.cliente.findUnique({ where: { id: Number(data.clienteId) } }),
      prisma.servico.findUnique({ where: { id: Number(data.servicoId) } })
    ])

    if (!cliente || !servico) {
      return { success: false, error: 'Cliente ou Serviço não encontrado' }
    }

    const valor = Number(servico.preco)

    // Detectar tipo de workflow
    const tipoWorkflow = getWorkflowForServico(servico.nome)
    const etapas = getEtapas(tipoWorkflow)
    const primeiraEtapa = getEtapaNome(etapas[0])

    await prisma.ordem.create({
      data: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        dataEntrega: new Date(data.dataEntrega),
        valor: valor,
        valorFinal: valor,
        prioridade: data.prioridade,
        corDentes: data.corDentes,
        material: data.material,
        observacoes: data.observacoes,
        status: 'Aguardando',
        etapaAtual: primeiraEtapa,
        tipoWorkflow: tipoWorkflow,
        tentativaAtual: 0,
        historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString() }],
        checklistEstetico: {},
        arquivoStl: data.arquivos || [],
      }
    })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar ordem:', error)
    return { success: false, error: 'Erro ao criar ordem' }
  }
}

export async function updateOrdem(id: number, data: {
  paciente: string
  dataEntrega: string
  prioridade: string
  status: string
  etapaAtual: string
  corDentes: string
  material: string
  observacoes: string
}) {
  await requireUser()
  try {
    await prisma.ordem.update({
      where: { id },
      data: {
        nomePaciente: data.paciente,
        dataEntrega: new Date(data.dataEntrega),
        prioridade: data.prioridade,
        status: data.status,
        etapaAtual: data.etapaAtual,
        corDentes: data.corDentes,
        material: data.material,
        observacoes: data.observacoes,
      }
    })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar ordem:', error)
    return { success: false, error: 'Erro ao atualizar ordem' }
  }
}

export async function getOrdemById(id: number) {
  await requireUser()
  return getOrdemPublic(id)
}

export async function getOrdemPublic(id: number) {
  console.log('[getOrdemPublic] Buscando ordem ID:', id)
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
      cliente: { id: ordem.cliente?.id, nome: ordem.clienteNome || ordem.cliente?.nome || 'Cliente Desconhecido' },
      clienteId: ordem.clienteId,
      servico: ordem.servicoNome || ordem.servico?.nome || 'Serviço',
      servicoId: ordem.servicoId,
      status: ordem.status || 'Aguardando',
      prioridade: ordem.prioridade || 'Normal',
      dataEntrada: ordem.dataPedido ? ordem.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: ordem.dataEntrega?.toISOString() || new Date().toISOString(),
      etapaAtual: ordem.etapaAtual || 'Recebimento',
      valor: Number(ordem.valorFinal || ordem.valor),
      corDentes: ordem.corDentes || '',
      material: ordem.material || '',
      observacoes: ordem.observacoes || '',
      arquivos: (ordem.arquivoStl as string[]) || [],
      // Workflow fields
      tipoWorkflow: (ordem.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: ordem.tentativaAtual || 0,
      historicoEtapas: (ordem.historicoEtapas as any[]) || [],
      checklistEstetico: (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {},
      fotosProva: (ordem.fotosProva as any[]) || [],
    }
  } catch (error) {
    console.error('[getOrdemPublic] Erro ao buscar ordem:', error)
    return null
  }
}

export async function getDadosNovaOrdem() {
  try {
    const [clientes, servicosRaw] = await Promise.all([
      prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, preco: true } })
    ])

    const servicos = servicosRaw.map(s => ({
      ...s,
      preco: Number(s.preco)
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
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
    const etapaAtual = ordem.etapaAtual || 'Recebimento'
    const proxima = getNextEtapa(tipoWorkflow, etapaAtual)

    if (!proxima) return { success: false, error: 'Já está na última etapa' }

    // Se é etapa de prova, verificar checklist
    if (isEtapaProva(tipoWorkflow, etapaAtual)) {
      const checklist = (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {}
      if (!canAdvance(tipoWorkflow, etapaAtual, checklist)) {
        return { success: false, error: 'Complete o checklist de registro estético antes de avançar' }
      }
    }

    const historico = (ordem.historicoEtapas as any[]) || []
    historico.push({
      etapa: etapaAtual,
      acao: 'avancou',
      para: proxima,
      data: new Date().toISOString(),
      observacao: observacao || undefined,
      tentativa: ordem.tentativaAtual || 0,
    })

    // Determinar novo status
    const etapas = getEtapas(tipoWorkflow)
    const lastEtapaNome = getEtapaNome(etapas[etapas.length - 1])
    const novoStatus = proxima === lastEtapaNome ? 'Finalizado' : 'Em Produção'

    // Calcular progresso
    const progresso = getProgresso(tipoWorkflow, proxima)

    await prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: proxima,
        historicoEtapas: historico,
        status: novoStatus,
        progresso: progresso,
        // Limpar checklist ao avançar (próxima prova precisa preencher de novo)
        checklistEstetico: {},
      }
    })

    revalidatePath('/ordens')
    return { success: true, novaEtapa: proxima }
  } catch (error) {
    console.error('Erro ao avançar etapa:', error)
    return { success: false, error: 'Erro ao avançar etapa' }
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

    const historico = (ordem.historicoEtapas as any[]) || []
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
        status: 'Em Produção',
        progresso: progresso,
        checklistEstetico: {},
      }
    })

    revalidatePath('/ordens')
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

    const fotos = (ordem.fotosProva as any[]) || []
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
    return (ordem?.fotosProva as any[]) || []
  } catch (error) {
    console.error('Erro ao buscar fotos:', error)
    return []
  }
}
