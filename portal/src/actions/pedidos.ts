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

  try {
    // Pegar preço do serviço
    const servico = await prisma.servico.findUnique({
      where: { id: data.servicoId }
    })

    if (!servico) return { success: false, error: 'Serviço inválido' }

    await prisma.ordem.create({
      data: {
        clienteId: logado.cliente.id,
        clienteNome: logado.cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        dataEntrega: new Date(data.dataEntrega),
        valor: servico.preco, // Preço base
        valorFinal: servico.preco,
        prioridade: 'Normal',
        corDentes: data.corDentes,
        observacoes: data.observacoes,
        status: 'Aguardando', // Começa aguardando
        etapaAtual: 'Recebimento',
        arquivoStl: data.arquivos, // Salvando array de caminhos
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
      etapa: p.etapaAtual
    }))
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
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
      preco: Number(s.preco)
    }))
  } catch (error) {
    return []
  }
}
