'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export async function gerarCobrancaAutomatica(ordemId: number) {
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      include: { cliente: true }
    })

    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    // Verifica se já existe conta gerada para esta ordem
    const contaExistente = await prisma.contaReceber.findFirst({
      where: { ordemId: ordem.id }
    })

    if (contaExistente) return { success: false, error: 'Já existe uma cobrança para esta ordem.' }

    // Cria a conta a receber
    // Vencimento padrão: dia 10 do mês seguinte (padrão de laboratórios)
    // Mas para MVP, vamos colocar para 30 dias a partir de hoje
    const vencimento = new Date()
    vencimento.setDate(vencimento.getDate() + 30)

    await prisma.contaReceber.create({
      data: {
        ordemId: ordem.id,
        descricao: `Serviço: ${ordem.servicoNome} - Paciente: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataVencimento: vencimento,
        status: 'Pendente',
        observacoes: `Gerado automaticamente a partir da Ordem #${ordem.id}`,
      }
    })

    // Atualiza saldo do cliente (opcional, se tivermos campo de saldo)
    if (ordem.clienteId) {
      await prisma.cliente.update({
        where: { id: ordem.clienteId },
        data: {
          valorTotal: { increment: ordem.valorFinal }, // Total histórico
          // totalDevido: { increment: ordem.valorFinal } // Se existisse esse campo
        }
      })
    }

    revalidatePath('/financeiro')
    revalidatePath('/ordens')
    
    return { success: true }
  } catch (error) {
    console.error('Erro ao gerar cobrança:', error)
    return { success: false, error: 'Erro ao gerar registro financeiro' }
  }
}

export async function getContas() {
  await requireUser()
  try {
    const [aReceber, aPagar] = await Promise.all([
      prisma.contaReceber.findMany({
        orderBy: { dataVencimento: 'asc' },
        include: { cliente: { select: { nome: true } } }
      }),
      prisma.contaPagar.findMany({
        orderBy: { dataVencimento: 'asc' },
      })
    ])

    return {
      receber: aReceber.map(c => ({
        id: c.id,
        descricao: c.descricao,
        cliente: c.clienteNome || c.cliente?.nome || '',
        valor: Number(c.valor),
        vencimento: c.dataVencimento.toISOString(),
        status: c.status || 'Pendente',
        observacoes: c.observacoes || '',
        ordemId: c.ordemId
      })),
      pagar: aPagar.map(c => ({
        id: c.id,
        descricao: c.descricao,
        categoria: c.categoria || 'Outros',
        valor: Number(c.valor),
        vencimento: c.dataVencimento.toISOString(),
        status: c.status || 'Pendente',
        observacoes: c.observacoes || '',
      }))
    }
  } catch (error) {
    console.error('Erro ao buscar contas:', error)
    return { receber: [], pagar: [] }
  }
}

export async function createConta(data: {
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  vencimento: string
  cliente?: string
  categoria?: string
  observacoes?: string
}) {
  try {
    if (data.tipo === 'receber') {
      let clienteId = null
      if (data.cliente) {
        const cliente = await prisma.cliente.findFirst({ where: { nome: data.cliente } })
        if (cliente) clienteId = cliente.id
      }

      await prisma.contaReceber.create({
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento: new Date(data.vencimento),
          clienteNome: data.cliente,
          clienteId,
          observacoes: data.observacoes,
          status: 'Pendente',
        }
      })
    } else {
      await prisma.contaPagar.create({
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento: new Date(data.vencimento),
          categoria: data.categoria,
          observacoes: data.observacoes,
          status: 'Pendente',
        }
      })
    }
    
    revalidatePath('/financeiro')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar conta:', error)
    return { success: false, error: 'Erro ao criar conta' }
  }
}

export async function baixarConta(id: number, tipo: 'receber' | 'pagar') {
  try {
    if (tipo === 'receber') {
      await prisma.contaReceber.update({
        where: { id },
        data: { 
          status: 'Pago',
          dataRecebimento: new Date()
        }
      })
    } else {
      await prisma.contaPagar.update({
        where: { id },
        data: { 
          status: 'Pago',
          dataPagamento: new Date()
        }
      })
    }
    revalidatePath('/financeiro')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao dar baixa' }
  }
}
