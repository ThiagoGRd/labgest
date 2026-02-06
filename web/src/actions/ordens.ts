'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

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
      dataEntrada: o.dataPedido && !isNaN(o.dataPedido.getTime()) ? o.dataPedido.toISOString() : null,
      dataEntrega: o.dataEntrega && !isNaN(o.dataEntrega.getTime()) ? o.dataEntrega.toISOString() : new Date().toISOString(), // Fallback para hoje se inválido
      etapaAtual: o.etapaAtual || 'Recebimento',
      valor: Number(o.valorFinal || o.valor),
      corDentes: o.corDentes || '',
      foto: null, // TODO: Handle photo
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

    await prisma.ordem.create({
      data: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        dataEntrega: new Date(data.dataEntrega),
        valor: valor,
        valorFinal: valor, // Pode aplicar desconto depois
        prioridade: data.prioridade,
        corDentes: data.corDentes,
        material: data.material,
        observacoes: data.observacoes,
        status: 'Aguardando',
        etapaAtual: 'Recebimento',
      }
    })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar ordem:', error)
    return { success: false, error: 'Erro ao criar ordem' }
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
