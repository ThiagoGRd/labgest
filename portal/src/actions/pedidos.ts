'use server'

import { createClient } from '@/lib/supabase/server'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// Utilitário para pegar o cliente logado
async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  // Buscar cliente pelo email do Auth
  const cliente = await prisma.cliente.findFirst({
    where: { email: user.email }
  })

  return { user, cliente }
}

export async function criarPedidoBatch(data: {
  paciente: string
  dataEntrega: string
  observacoes: string
  arquivos: string[]
  itens: Array<{
    servicoId: number
    elementos: string
    corDentes: string
  }>
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado. Complete seu cadastro.' }
  }

  const { cliente } = logado

  try {
    const promises = data.itens.map(async (item) => {
      const servico = await prisma.servico.findUnique({
        where: { id: item.servicoId }
      })

      if (!servico) throw new Error(`Serviço ID ${item.servicoId} inválido`)

      // Detectar workflow
      let tipoWorkflow = null
      const nomeLower = servico.nome.toLowerCase()
      if (nomeLower.includes('protocolo')) tipoWorkflow = 'protocolo'
      else if (nomeLower.includes('total')) tipoWorkflow = 'protese_total'
      else if (nomeLower.includes('parcial') || nomeLower.includes('ppr')) tipoWorkflow = 'parcial_removivel'

      // Etapas básicas
      const etapasMap: Record<string, string[]> = {
        protocolo: ['Recebimento (Scanner + Fotos)', 'Planejamento Digital'],
        protese_total: ['Recebimento (Moldagem/Scanner + Fotos)', 'Confecção de Rodete / Base de Prova'],
        parcial_removivel: ['Recebimento (Modelo/Scanner)', 'Delineamento']
      }
      
      const primeiraEtapa = tipoWorkflow && etapasMap[tipoWorkflow] ? etapasMap[tipoWorkflow][0] : 'Recebimento'

      return prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: servico.id,
          servicoNome: servico.nome,
          nomePaciente: data.paciente,
          dataEntrega: new Date(data.dataEntrega),
          valor: servico.preco,
          valorFinal: servico.preco,
          prioridade: 'Normal',
          corDentes: item.corDentes,
          elementos: item.elementos,
          observacoes: data.observacoes,
          status: 'Aguardando',
          etapaAtual: primeiraEtapa,
          tipoWorkflow: tipoWorkflow,
          tentativaAtual: 0,
          historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString() }],
          checklistEstetico: {},
          arquivoStl: data.arquivos,
        }
      })
    })

    await Promise.all(promises)

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    return { success: true }

  } catch (error) {
    console.error('Erro ao criar pedidos em lote:', error)
    return { success: false, error: 'Erro interno ao criar pedido' }
  }
}

export async function criarPedido(data: {
  paciente: string
  servicoId: number
  servicoNome: string
  corDentes: string
  dataEntrega: string
  observacoes: string
  arquivos: string[]
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado. Complete seu cadastro.' }
  }

  const { cliente } = logado

  try {
    // Pegar preço do serviço
    const servico = await prisma.servico.findUnique({
      where: { id: data.servicoId }
    })

    if (!servico) return { success: false, error: 'Serviço inválido' }

    // Detectar workflow
    // Importação dinâmica ou duplicada pois workflow-config está no web
    // Por enquanto vamos usar defaults simples se não conseguirmos importar
    
    // Tentar mapear workflow básico pelo nome (lógica simplificada do workflow-config)
    let tipoWorkflow = null
    const nomeLower = servico.nome.toLowerCase()
    if (nomeLower.includes('protocolo')) tipoWorkflow = 'protocolo'
    else if (nomeLower.includes('total')) tipoWorkflow = 'protese_total'
    else if (nomeLower.includes('parcial') || nomeLower.includes('ppr')) tipoWorkflow = 'parcial_removivel'

    // Etapas básicas por tipo
    const etapasMap: Record<string, string[]> = {
      protocolo: ['Recebimento (Scanner + Fotos)', 'Planejamento Digital'],
      protese_total: ['Recebimento (Moldagem/Scanner + Fotos)', 'Confecção de Rodete / Base de Prova'],
      parcial_removivel: ['Recebimento (Modelo/Scanner)', 'Delineamento']
    }
    
    const primeiraEtapa = tipoWorkflow && etapasMap[tipoWorkflow] ? etapasMap[tipoWorkflow][0] : 'Recebimento'

    await prisma.ordem.create({
      data: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        dataEntrega: new Date(data.dataEntrega),
        valor: servico.preco,
        valorFinal: servico.preco,
        prioridade: 'Normal',
        corDentes: data.corDentes,
        observacoes: data.observacoes,
        status: 'Aguardando',
        etapaAtual: primeiraEtapa,
        tipoWorkflow: tipoWorkflow,
        tentativaAtual: 0,
        historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString() }],
        checklistEstetico: {},
        arquivoStl: data.arquivos,
      }
    })

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    return { success: true }

  } catch (error) {
    console.error('Erro ao criar pedido:', error)
    return { success: false, error: 'Erro interno ao criar pedido' }
  }
}

export async function getPedidoById(id: number) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return null

  try {
    const pedido = await prisma.ordem.findFirst({
      where: { 
        id,
        clienteId: logado.cliente.id 
      },
      include: {
        servico: { select: { nome: true } }
      }
    })

    if (!pedido) return null

    return {
      id: pedido.id,
      paciente: pedido.nomePaciente,
      servico: pedido.servicoNome || pedido.servico?.nome || '',
      status: pedido.status || 'Aguardando',
      dataEntrega: pedido.dataEntrega.toISOString(),
      valor: Number(pedido.valorFinal),
      etapa: pedido.etapaAtual || 'Recebimento',
      corDentes: pedido.corDentes || '',
      elementos: pedido.elementos || '',
      observacoes: pedido.observacoes || '',
      historicoEtapas: (pedido.historicoEtapas as any[]) || [],
      arquivos: (pedido.arquivoStl as string[]) || []
    }
  } catch (error) {
    console.error('Erro ao buscar pedido:', error)
    return null
  }
}

export async function getMeusPedidos() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return []

  try {
    const pedidos = await prisma.ordem.findMany({
      where: { clienteId: logado.cliente.id },
      orderBy: { createdAt: 'desc' }
    })

    return pedidos.map(p => ({
      id: p.id,
      paciente: p.nomePaciente,
      servico: p.servicoNome,
      status: p.status || 'Aguardando',
      dataEntrega: p.dataEntrega.toISOString(),
      valor: Number(p.valorFinal),
      etapa: p.etapaAtual || 'Recebimento'
    }))
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return []
  }
}

export async function getHistoricoPedidos() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return []

  try {
    const pedidos = await prisma.ordem.findMany({
      where: { 
        clienteId: logado.cliente.id,
        status: { in: ['Finalizado', 'Entregue', 'Cancelado'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    return pedidos.map(p => ({
      id: p.id,
      paciente: p.nomePaciente,
      servico: p.servicoNome,
      status: p.status || 'Finalizado',
      dataEntrega: p.dataEntrega.toISOString(),
      dataFinalizacao: p.dataFinalizacao?.toISOString() || p.updatedAt?.toISOString() || new Date().toISOString(),
      valor: Number(p.valorFinal),
    }))
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return []
  }
}

export async function getDashboardStats() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return { total: 0, emAndamento: 0, finalizados: 0 }

  try {
    const [total, emAndamento, finalizados] = await Promise.all([
      prisma.ordem.count({ where: { clienteId: logado.cliente.id } }),
      prisma.ordem.count({ 
        where: { 
          clienteId: logado.cliente.id,
          status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
        } 
      }),
      prisma.ordem.count({ 
        where: { 
          clienteId: logado.cliente.id,
          status: 'Finalizado'
        } 
      })
    ])

    return { total, emAndamento, finalizados }
  } catch (error) {
    return { total: 0, emAndamento: 0, finalizados: 0 }
  }
}

export async function getServicosDisponiveis() {
  try {
    const servicos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, categoria: true, preco: true }
    })
    
    return servicos.map(s => ({
      ...s,
      categoria: s.categoria || 'Geral',
      preco: Number(s.preco)
    }))
  } catch (error) {
    return []
  }
}
