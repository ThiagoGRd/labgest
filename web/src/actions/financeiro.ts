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

    // Vencimento padrão laboratório: dia 10 do mês seguinte à finalização
    const hoje = new Date()
    const vencimento = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10)

    await prisma.contaReceber.create({
      data: {
        ordemId: ordem.id,
        descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataVencimento: vencimento,
        status: 'Pendente',
        observacoes: `Gerado automaticamente — Ordem #${ordem.id} finalizada em ${hoje.toLocaleDateString('pt-BR')}`,
      }
    })

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
    // Limites do mês corrente
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    const [aReceber, aPagar, receberMes] = await Promise.all([
      prisma.contaReceber.findMany({
        orderBy: { dataVencimento: 'asc' },
        include: { cliente: { select: { nome: true } } }
      }),
      prisma.contaPagar.findMany({
        orderBy: { dataVencimento: 'asc' },
      }),
      // Contas a receber com vencimento neste mês ainda pendentes
      prisma.contaReceber.aggregate({
        where: {
          status: { not: 'Pago' },
          dataVencimento: {
            gte: inicioMes,
            lte: fimMes,
          }
        },
        _sum: { valor: true },
        _count: true,
      }),
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
      })),
      totalReceberMes: Number(receberMes._sum.valor || 0),
      qtdReceberMes: receberMes._count,
    }
  } catch (error) {
    console.error('Erro ao buscar contas:', error)
    return { receber: [], pagar: [], totalReceberMes: 0, qtdReceberMes: 0 }
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
