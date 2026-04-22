'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { parseDateLocal } from '@/lib/date-utils'

/**
 * Cria ContasReceber para TODAS as ordens com status 'Finalizado'
 * que ainda não têm cobrança associada.
 * Deve ser chamada ONE-TIME via trigger ou admin panel.
 */
export async function sincronizarFinanceiroRetroativo() {
  await requireUser()
  try {
    // Busca ordens finalizadas sem ContaReceber
    const ordensSemCobranca = await prisma.ordem.findMany({
      where: {
        status: { in: ['Finalizado', 'Entregue'] },
        contasReceber: { none: {} },
        valorFinal: { gt: 0 },
      },
      select: {
        id: true,
        servicoNome: true,
        nomePaciente: true,
        clienteId: true,
        clienteNome: true,
        valorFinal: true,
        dataFinalizacao: true,
        updatedAt: true,
      }
    } as any)

    let criadas = 0
    for (const ordem of (ordensSemCobranca as any[])) {
      // CORREÇÃO: usa data de finalização para determinar o mês correto
      // Vencimento: dia 15 do mês SEGUINTE ao da finalização
      const base = ordem.dataFinalizacao ? new Date(ordem.dataFinalizacao) : new Date(ordem.updatedAt || Date.now())
      const vencimento = new Date(base.getFullYear(), base.getMonth() + 1, 15)

      await prisma.contaReceber.create({
        data: {
          ordemId: ordem.id,
          descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
          clienteId: ordem.clienteId,
          clienteNome: ordem.clienteNome,
          valor: ordem.valorFinal,
          dataVencimento: vencimento,
          status: 'Pendente',
          observacoes: `Gerado retroativamente — Ordem #${ordem.id} (finalizada em ${base.toLocaleDateString('pt-BR')})`,
        }
      })
      criadas++
    }

    revalidatePath('/financeiro')
    return { success: true, criadas }
  } catch (error) {
    console.error('Erro na sincronização retroativa:', error)
    return { success: false, error: 'Erro ao sincronizar financeiro' }
  }
}


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

    // CORREÇÃO: usa a data de finalização da ordem (não "hoje") para calcular o mês correto
    // Isso evita o bug onde uma ordem finalizada em março gera vencimento em abril
    const dataBase = (ordem as any).dataFinalizacao
      ? new Date((ordem as any).dataFinalizacao)
      : new Date()

    // Vencimento: dia 15 do mês SEGUINTE ao da finalização (padrão boleto laboratorial)
    const vencimento = new Date(dataBase.getFullYear(), dataBase.getMonth() + 1, 15)

    const dataFmt = dataBase.toLocaleDateString('pt-BR')

    await prisma.contaReceber.create({
      data: {
        ordemId: ordem.id,
        descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataVencimento: vencimento,
        status: 'Pendente',
        observacoes: `Gerado automaticamente — Ordem #${ordem.id} finalizada em ${dataFmt}`,
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

export async function getContas(filtroMes?: string) {
  await requireUser()
  try {
    const hoje = new Date()

    // Se filtroMes for passado no formato "YYYY-MM", filtra por aquele mês
    // Caso contrário, retorna todos os registros
    let whereReceber: any = {}
    let wherePagar: any = {}
    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-').map(Number)
      const inicio = new Date(ano, mes - 1, 1)
      const fim = new Date(ano, mes, 0, 23, 59, 59)
      whereReceber = { dataVencimento: { gte: inicio, lte: fim } }
      wherePagar = { dataVencimento: { gte: inicio, lte: fim } }
    }

    // Limites do mês corrente (para o card de resumo)
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59)

    const [aReceber, aPagar, receberMes] = await Promise.all([
      prisma.contaReceber.findMany({
        where: whereReceber,
        orderBy: { dataVencimento: 'desc' },
        include: { cliente: { select: { nome: true } } }
      }),
      prisma.contaPagar.findMany({
        where: wherePagar,
        orderBy: { dataVencimento: 'desc' },
      }),
      // Contas a receber com vencimento neste mês ainda pendentes
      prisma.contaReceber.aggregate({
        where: {
          status: { not: 'Recebido' },
          dataVencimento: { gte: inicioMes, lte: fimMes },
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
        ordemId: c.ordemId,
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

/**
 * Retorna os meses disponíveis no histórico financeiro (para o filtro de mês)
 */
export async function getMesesDisponiveis() {
  await requireUser()
  try {
    const contas = await prisma.contaReceber.findMany({
      select: { dataVencimento: true },
      orderBy: { dataVencimento: 'desc' },
    })
    const meses = new Set<string>()
    contas.forEach(c => {
      const d = new Date(c.dataVencimento)
      meses.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    })
    return Array.from(meses).sort().reverse()
  } catch {
    return []
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
    // Usa parseDateLocal para evitar bug de fuso horário (UTC vs BRT)
    const dataVencimento = parseDateLocal(data.vencimento)

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
          dataVencimento,
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
          dataVencimento,
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

export async function editarConta(id: number, tipo: 'receber' | 'pagar', data: {
  descricao: string
  valor: number
  vencimento: string
  categoria?: string
  observacoes?: string
}) {
  await requireUser()
  try {
    const dataVencimento = parseDateLocal(data.vencimento)

    if (tipo === 'receber') {
      await prisma.contaReceber.update({
        where: { id },
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento,
          observacoes: data.observacoes,
        }
      })
    } else {
      await prisma.contaPagar.update({
        where: { id },
        data: {
          descricao: data.descricao,
          valor: data.valor,
          dataVencimento,
          categoria: data.categoria,
          observacoes: data.observacoes,
        }
      })
    }

    revalidatePath('/financeiro')
    return { success: true }
  } catch (error) {
    console.error('Erro ao editar conta:', error)
    return { success: false, error: 'Erro ao editar conta' }
  }
}

export async function baixarConta(id: number, tipo: 'receber' | 'pagar') {
  try {
    if (tipo === 'receber') {
      await prisma.contaReceber.update({
        where: { id },
        data: { 
          status: 'Recebido',
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
