'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { gerarCobrancaAutomatica } from './financeiro'
import { parseDateLocal } from '@/lib/date-utils'
import {
  getWorkflowForServico,
  getNextEtapa,
  getRetornoEtapa,
  getEtapas,
  getEtapaNome,
  getProgresso,
  isEtapaProva,
  canAdvance,
  normalizarEtapa,
  ETAPA_FINAL,
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
      fotosCaso: Array.isArray((o as any).fotosCaso) ? (o as any).fotosCaso : [],
      mensagens: Array.isArray((o as any).mensagens) ? (o as any).mensagens : [],
    }))
  } catch (error) {
    console.error('Erro ao buscar ordens:', error)
    return []
  }
}

export async function createBatchOrdens(data: {
  clienteId: string
  paciente: string
  dataEntrega: string
  prioridade: string
  observacoes: string
  arquivos?: string[]
  itens: Array<{
    servicoId: string
    elementos: string
    corDentes: string
    material: string
  }>
}) {
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: Number(data.clienteId) } })
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    // Processar cada item como uma ordem separada
    const promises = data.itens.map(async (item) => {
      const servico = await prisma.servico.findUnique({ where: { id: Number(item.servicoId) } })
      if (!servico) throw new Error(`Serviço ID ${item.servicoId} não encontrado`)

      const valor = Number(servico.preco)
      const tipoWorkflow = getWorkflowForServico(servico.nome)
      const primeiraEtapa = 'recebimento'

      return prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: servico.id,
          servicoNome: servico.nome,
          nomePaciente: data.paciente,
          dataEntrega: parseDateLocal(data.dataEntrega),
          valor: valor,
          valorFinal: valor,
          prioridade: data.prioridade,
          corDentes: item.corDentes,
          elementos: item.elementos,
          material: item.material,
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
    })

    await Promise.all(promises)
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
    // Normaliza etapaAtual para ID canônico antes de salvar
    const etapaCanonica = normalizarEtapa(data.etapaAtual)
    const novoStatus = etapaCanonica === ETAPA_FINAL ? 'Finalizado' : data.status

    await prisma.ordem.update({
      where: { id },
      data: {
        nomePaciente: data.paciente,
        dataEntrega: parseDateLocal(data.dataEntrega),
        prioridade: data.prioridade,
        status: novoStatus,
        etapaAtual: etapaCanonica,
        corDentes: data.corDentes,
        material: data.material,
        observacoes: data.observacoes,
      }
    })

    // Se entrou em status Finalizado via edição, gera cobrança
    if (novoStatus === 'Finalizado') {
      await gerarCobrancaAutomatica(id).catch(() => {})
    }

    revalidatePath('/ordens')
    revalidatePath('/producao')
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao atualizar ordem: ${errorMsg}` }
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

export async function deleteOrdem(id: number) {
  await requireUser()
  try {
    await prisma.ordem.delete({ where: { id } })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir ordem:', error)
    return { success: false, error: 'Erro ao excluir ordem' }
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

    const historico = (ordem.historicoEtapas as any[]) || []
    historico.push({
      etapa: etapaAtualCanonica,
      acao: 'avancou',
      para: proxima,
      data: new Date().toISOString(),
      observacao: observacao || undefined,
    })

    // Determinar novo status: finalizado somente ao chegar em ETAPA_FINAL
    const novoStatus = proxima === ETAPA_FINAL ? 'Finalizado' : 'Em Produção'
    const progresso = getProgresso(tipoWorkflow, proxima)

    await prisma.ordem.update({
      where: { id: ordemId },
      data: {
        etapaAtual: proxima,
        historicoEtapas: historico,
        status: novoStatus,
        progresso: progresso,
        checklistEstetico: {},
      }
    })

    // Se finalizou, gera cobrança automaticamente
    if (novoStatus === 'Finalizado') {
      await gerarCobrancaAutomatica(ordemId).catch(() => {})
    }

    console.log('[avancarEtapa] Sucesso!')
    revalidatePath('/ordens')
    return { success: true, novaEtapa: proxima }
  } catch (error) {
    console.error('[avancarEtapa] Erro detalhado:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao avançar etapa: ${errorMsg}` }
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
