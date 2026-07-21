'use server'

import { Prisma, prisma } from '@labgest/database'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-utils'
import { parseDateLocal } from '@/lib/date-utils'

const contaSchema = z.object({
  tipo: z.enum(['receber', 'pagar']),
  descricao: z.string().trim().min(3, 'Informe uma descrição com pelo menos 3 caracteres.').max(255),
  valor: z.number().positive('O valor deve ser maior que zero.'),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe um vencimento válido.'),
  competencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  clienteId: z.number().int().positive().optional(),
  categoria: z.string().trim().max(50).optional(),
  fornecedor: z.string().trim().max(255).optional(),
  observacoes: z.string().trim().max(2000).optional(),
  parcelas: z.number().int().min(1).max(60).default(1),
})

const baixaSchema = z.object({
  id: z.number().int().positive(),
  tipo: z.enum(['receber', 'pagar']),
  valor: z.number().positive('Informe um valor maior que zero.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.'),
  formaPagamento: z.string().trim().min(2, 'Informe a forma de pagamento.').max(100),
  contaFinanceiraId: z.number().int().positive().optional(),
  observacoes: z.string().trim().max(1000).optional(),
})

function revalidarFinanceiro() {
  revalidatePath('/financeiro')
  revalidatePath('/relatorios')
}

function inicioDoDia(data = new Date()) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

function adicionarMesesMantendoDia(data: Date, quantidade: number) {
  const ano = data.getFullYear()
  const mes = data.getMonth() + quantidade
  const ultimoDia = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(data.getDate(), ultimoDia))
}

function statusReceber(status: string | null, vencimento: Date, recebido: number, total: number) {
  if (status === 'Cancelado') return 'Cancelado'
  if (recebido >= total) return 'Recebido'
  if (recebido > 0) return vencimento < inicioDoDia() ? 'Parcial atrasado' : 'Parcial'
  return vencimento < inicioDoDia() ? 'Vencido' : 'Pendente'
}

function statusPagar(status: string | null, vencimento: Date, pago: number, total: number) {
  if (status === 'Cancelado') return 'Cancelado'
  if (pago >= total) return 'Pago'
  if (pago > 0) return vencimento < inicioDoDia() ? 'Parcial atrasado' : 'Parcial'
  return vencimento < inicioDoDia() ? 'Vencido' : 'Pendente'
}

export async function sincronizarFinanceiroRetroativo() {
  const usuario = await requireUser()
  try {
    const ordens = await prisma.ordem.findMany({
      where: {
        status: { in: ['Finalizado', 'Entregue'] },
        contasReceber: { none: {} },
        valorFinal: { gt: 0 },
      },
      select: {
        id: true, servicoNome: true, nomePaciente: true, clienteId: true,
        clienteNome: true, valorFinal: true, dataFinalizacao: true, updatedAt: true,
      },
    })

    for (const ordem of ordens) {
      const base = ordem.dataFinalizacao ?? ordem.updatedAt ?? new Date()
      await prisma.contaReceber.create({
        data: {
          ordemId: ordem.id,
          descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
          clienteId: ordem.clienteId,
          clienteNome: ordem.clienteNome,
          valor: ordem.valorFinal,
          dataCompetencia: base,
          dataVencimento: new Date(base.getFullYear(), base.getMonth(), base.getDate()),
          status: 'Pendente',
          usuarioId: usuario.id,
          observacoes: `Gerado retroativamente — Ordem #${ordem.id}`,
        },
      })
    }
    revalidarFinanceiro()
    return { success: true, criadas: ordens.length }
  } catch (error) {
    console.error('Erro na sincronização retroativa:', error)
    return { success: false, error: 'Não foi possível sincronizar as cobranças.' }
  }
}

export async function gerarCobrancaAutomatica(ordemId: number) {
  const usuario = await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
    if (await prisma.contaReceber.findFirst({ where: { ordemId } })) {
      return { success: false, error: 'Já existe uma cobrança para esta ordem.' }
    }
    const base = ordem.dataFinalizacao ?? new Date()
    await prisma.contaReceber.create({
      data: {
        ordemId,
        descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
        clienteId: ordem.clienteId,
        clienteNome: ordem.clienteNome,
        valor: ordem.valorFinal,
        dataCompetencia: base,
        dataVencimento: new Date(base.getFullYear(), base.getMonth(), base.getDate()),
        status: 'Pendente',
        usuarioId: usuario.id,
        observacoes: `Gerado automaticamente — Ordem #${ordem.id}`,
      },
    })
    revalidarFinanceiro()
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao gerar cobrança:', error)
    return { success: false, error: 'Não foi possível gerar a cobrança.' }
  }
}

export async function getFinanceiroPageData(filtroMes?: string) {
  await requireUser()
  const hoje = new Date()
  const mesValido = /^\d{4}-\d{2}$/.test(filtroMes ?? '') ? filtroMes! : null
  const [ano, mes] = mesValido
    ? mesValido.split('-').map(Number)
    : [hoje.getFullYear(), hoje.getMonth() + 1]
  const inicio = new Date(ano, mes - 1, 1)
  const fim = new Date(ano, mes, 0, 23, 59, 59)

  const [receber, pagar, movimentacoes, contasFinanceiras, clientes, mesesReceber, mesesPagar, vencidasGlobais] = await Promise.all([
    prisma.contaReceber.findMany({
      where: { dataVencimento: { gte: inicio, lte: fim } },
      include: { cliente: { select: { nome: true } }, ordem: { select: { nomePaciente: true, servicoNome: true } } },
      orderBy: [{ status: 'asc' }, { dataVencimento: 'asc' }],
    }),
    prisma.contaPagar.findMany({
      where: { dataVencimento: { gte: inicio, lte: fim } },
      orderBy: [{ status: 'asc' }, { dataVencimento: 'asc' }],
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: { dataMovimentacao: { gte: inicio, lte: fim }, estornadaEm: null },
      include: {
        contaReceber: { select: { descricao: true, clienteNome: true } },
        contaPagar: { select: { descricao: true, fornecedor: true } },
        contaFinanceira: { select: { nome: true } },
      },
      orderBy: [{ dataMovimentacao: 'desc' }, { id: 'desc' }],
    }),
    prisma.contaFinanceira.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.contaReceber.findMany({ select: { dataVencimento: true } }),
    prisma.contaPagar.findMany({ select: { dataVencimento: true } }),
    prisma.contaReceber.findMany({
      where: { dataVencimento: { lt: inicioDoDia() }, status: { notIn: ['Recebido', 'Cancelado'] } },
      select: { valor: true, valorRecebido: true },
    }),
  ])

  const contasReceber = receber.map((conta) => {
    const valor = Number(conta.valor)
    const liquidado = Number(conta.valorRecebido)
    return {
      id: conta.id,
      descricao: conta.descricao,
      cliente: conta.clienteNome || conta.cliente?.nome || 'Sem cliente',
      clienteId: conta.clienteId,
      paciente: conta.ordem?.nomePaciente ?? null,
      servico: conta.ordem?.servicoNome ?? null,
      ordemId: conta.ordemId,
      valor,
      liquidado,
      restante: Math.max(0, valor - liquidado),
      vencimento: conta.dataVencimento.toISOString(),
      competencia: conta.dataCompetencia?.toISOString() ?? null,
      dataBaixa: conta.dataRecebimento?.toISOString() ?? null,
      status: statusReceber(conta.status, conta.dataVencimento, liquidado, valor),
      observacoes: conta.observacoes ?? '',
    }
  })

  const contasPagar = pagar.map((conta) => {
    const valor = Number(conta.valor)
    const liquidado = Number(conta.valorPago)
    return {
      id: conta.id,
      descricao: conta.descricao,
      categoria: conta.categoria || 'Outros',
      fornecedor: conta.fornecedor || 'Não informado',
      parcelaNumero: conta.parcelaNumero,
      parcelaTotal: conta.parcelaTotal,
      valor,
      liquidado,
      restante: Math.max(0, valor - liquidado),
      vencimento: conta.dataVencimento.toISOString(),
      competencia: conta.dataCompetencia?.toISOString() ?? null,
      dataBaixa: conta.dataPagamento?.toISOString() ?? null,
      status: statusPagar(conta.status, conta.dataVencimento, liquidado, valor),
      observacoes: conta.observacoes ?? '',
    }
  })

  const entradas = movimentacoes.filter((m) => m.tipo === 'Entrada').reduce((s, m) => s + Number(m.valor), 0)
  const saidas = movimentacoes.filter((m) => m.tipo === 'Saida').reduce((s, m) => s + Number(m.valor), 0)
  const previstoReceber = contasReceber.filter((c) => c.status !== 'Cancelado').reduce((s, c) => s + c.restante, 0)
  const previstoPagar = contasPagar.filter((c) => c.status !== 'Cancelado').reduce((s, c) => s + c.restante, 0)
  const vencidoReceber = vencidasGlobais.reduce((s, c) => s + Math.max(0, Number(c.valor) - Number(c.valorRecebido)), 0)
  const resultadoProjetado = entradas - saidas + previstoReceber - previstoPagar

  const meses = new Set<string>([`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`])
  for (const conta of [...mesesReceber, ...mesesPagar]) {
    meses.add(`${conta.dataVencimento.getFullYear()}-${String(conta.dataVencimento.getMonth() + 1).padStart(2, '0')}`)
  }

  return {
    periodo: `${ano}-${String(mes).padStart(2, '0')}`,
    receber: contasReceber,
    pagar: contasPagar,
    clientes,
    contasFinanceiras: contasFinanceiras.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
    movimentacoes: movimentacoes.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      valor: Number(m.valor),
      data: m.dataMovimentacao.toISOString(),
      descricao: m.contaReceber?.descricao || m.contaPagar?.descricao || m.observacoes || 'Movimentação avulsa',
      pessoa: m.contaReceber?.clienteNome || m.contaPagar?.fornecedor || '',
      conta: m.contaFinanceira?.nome || 'Não informada',
      formaPagamento: m.formaPagamento || 'Não informada',
    })),
    resumo: {
      entradas,
      saidas,
      resultadoRealizado: entradas - saidas,
      previstoReceber,
      previstoPagar,
      resultadoProjetado,
      vencidoReceber,
      quantidadeVencidas: vencidasGlobais.length,
    },
    mesesDisponiveis: Array.from(meses).sort().reverse(),
  }
}

// Compatibilidade com consumidores antigos enquanto o módulo é migrado.
export async function getContas(filtroMes?: string) {
  const dados = await getFinanceiroPageData(filtroMes)
  return { receber: dados.receber, pagar: dados.pagar, totalReceberMes: dados.resumo.previstoReceber, qtdReceberMes: dados.receber.length }
}

export async function getMesesDisponiveis() {
  const dados = await getFinanceiroPageData()
  return dados.mesesDisponiveis
}

export async function createConta(input: z.input<typeof contaSchema>) {
  const usuario = await requireUser()
  try {
    const data = contaSchema.parse(input)
    const vencimento = parseDateLocal(data.vencimento)
    const competencia = data.competencia ? parseDateLocal(data.competencia) : vencimento

    if (data.tipo === 'receber') {
      if (!data.clienteId) return { success: false, error: 'Selecione um dentista/cliente.' }
      const cliente = await prisma.cliente.findUnique({ where: { id: data.clienteId }, select: { nome: true } })
      if (!cliente) return { success: false, error: 'Cliente não encontrado.' }
      await prisma.contaReceber.create({ data: {
        descricao: data.descricao, valor: data.valor, dataVencimento: vencimento,
        dataCompetencia: competencia, clienteId: data.clienteId, clienteNome: cliente.nome,
        observacoes: data.observacoes, status: 'Pendente', usuarioId: usuario.id,
      } })
    } else {
      const quantidadeParcelas = data.parcelas
      const grupoParcelamento = quantidadeParcelas > 1 ? randomUUID() : null
      const totalCentavos = Math.round(data.valor * 100)
      const centavosPorParcela = Math.floor(totalCentavos / quantidadeParcelas)
      const centavosRestantes = totalCentavos - centavosPorParcela * quantidadeParcelas

      await prisma.$transaction(
        Array.from({ length: quantidadeParcelas }, (_, indice) => {
          const numero = indice + 1
          const valorCentavos = centavosPorParcela + (indice < centavosRestantes ? 1 : 0)
          return prisma.contaPagar.create({ data: {
            descricao: quantidadeParcelas > 1 ? `${data.descricao} (${numero}/${quantidadeParcelas})` : data.descricao,
            valor: valorCentavos / 100,
            dataVencimento: adicionarMesesMantendoDia(vencimento, indice),
            dataCompetencia: competencia,
            categoria: data.categoria || 'Outros',
            fornecedor: data.fornecedor,
            observacoes: data.observacoes,
            status: 'Pendente',
            usuarioId: usuario.id,
            grupoParcelamento,
            parcelaNumero: quantidadeParcelas > 1 ? numero : null,
            parcelaTotal: quantidadeParcelas > 1 ? quantidadeParcelas : null,
          } })
        }),
      )
    }
    revalidarFinanceiro()
    return { success: true, parcelasCriadas: data.tipo === 'pagar' ? data.parcelas : 1 }
  } catch (error) {
    const mensagem = error instanceof z.ZodError ? error.issues[0]?.message : 'Não foi possível criar o lançamento.'
    return { success: false, error: mensagem }
  }
}

export async function editarConta(id: number, tipo: 'receber' | 'pagar', input: {
  descricao: string; valor: number; vencimento: string; categoria?: string; fornecedor?: string; observacoes?: string
}) {
  await requireUser()
  try {
    if (!input.descricao.trim() || input.valor <= 0) return { success: false, error: 'Revise a descrição e o valor.' }
    const dataVencimento = parseDateLocal(input.vencimento)
    if (tipo === 'receber') {
      const conta = await prisma.contaReceber.findUnique({ where: { id } })
      if (!conta || conta.status === 'Cancelado') return { success: false, error: 'Esta conta não pode ser editada.' }
      if (input.valor < Number(conta.valorRecebido)) return { success: false, error: 'O valor não pode ser menor que o total já recebido.' }
      await prisma.contaReceber.update({ where: { id }, data: {
        descricao: input.descricao.trim(), valor: input.valor, dataVencimento, observacoes: input.observacoes,
        status: Number(conta.valorRecebido) >= input.valor ? 'Recebido' : Number(conta.valorRecebido) > 0 ? 'Parcial' : 'Pendente',
      } })
    } else {
      const conta = await prisma.contaPagar.findUnique({ where: { id } })
      if (!conta || conta.status === 'Cancelado') return { success: false, error: 'Esta conta não pode ser editada.' }
      if (input.valor < Number(conta.valorPago)) return { success: false, error: 'O valor não pode ser menor que o total já pago.' }
      await prisma.contaPagar.update({ where: { id }, data: {
        descricao: input.descricao.trim(), valor: input.valor, dataVencimento,
        categoria: input.categoria, fornecedor: input.fornecedor, observacoes: input.observacoes,
        status: Number(conta.valorPago) >= input.valor ? 'Pago' : Number(conta.valorPago) > 0 ? 'Parcial' : 'Pendente',
      } })
    }
    revalidarFinanceiro()
    return { success: true }
  } catch (error) {
    console.error('Erro ao editar conta:', error)
    return { success: false, error: 'Não foi possível editar o lançamento.' }
  }
}

export async function liquidarConta(input: z.input<typeof baixaSchema>) {
  const usuario = await requireUser()
  try {
    const data = baixaSchema.parse(input)
    await prisma.$transaction(async (tx) => {
      const contaFinanceira = data.contaFinanceiraId ?? (await tx.contaFinanceira.findFirst({ where: { ativo: true }, select: { id: true } }))?.id
      if (data.tipo === 'receber') {
        const conta = await tx.contaReceber.findUnique({ where: { id: data.id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Conta indisponível para recebimento.')
        const novoTotal = Number(conta.valorRecebido) + data.valor
        if (novoTotal > Number(conta.valor) + 0.001) throw new Error('O valor informado ultrapassa o saldo da conta.')
        await tx.movimentacaoFinanceira.create({ data: {
          tipo: 'Entrada', valor: data.valor, dataMovimentacao: parseDateLocal(data.data),
          formaPagamento: data.formaPagamento, observacoes: data.observacoes,
          contaReceberId: data.id, contaFinanceiraId: contaFinanceira, usuarioId: usuario.id,
        } })
        await tx.contaReceber.update({ where: { id: data.id }, data: {
          valorRecebido: novoTotal, status: novoTotal >= Number(conta.valor) ? 'Recebido' : 'Parcial',
          dataRecebimento: novoTotal >= Number(conta.valor) ? parseDateLocal(data.data) : null,
          formaRecebimento: data.formaPagamento,
        } })
      } else {
        const conta = await tx.contaPagar.findUnique({ where: { id: data.id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Conta indisponível para pagamento.')
        const novoTotal = Number(conta.valorPago) + data.valor
        if (novoTotal > Number(conta.valor) + 0.001) throw new Error('O valor informado ultrapassa o saldo da conta.')
        await tx.movimentacaoFinanceira.create({ data: {
          tipo: 'Saida', valor: data.valor, dataMovimentacao: parseDateLocal(data.data),
          formaPagamento: data.formaPagamento, observacoes: data.observacoes,
          contaPagarId: data.id, contaFinanceiraId: contaFinanceira, usuarioId: usuario.id,
        } })
        await tx.contaPagar.update({ where: { id: data.id }, data: {
          valorPago: novoTotal, status: novoTotal >= Number(conta.valor) ? 'Pago' : 'Parcial',
          dataPagamento: novoTotal >= Number(conta.valor) ? parseDateLocal(data.data) : null,
          formaPagamento: data.formaPagamento,
        } })
      }
    })
    revalidarFinanceiro()
    revalidatePath('/financeiro', 'page')
    return { success: true }
  } catch (error) {
    const mensagem = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Não foi possível registrar a baixa.'
    return { success: false, error: mensagem }
  }
}

export async function cancelarConta(id: number, tipo: 'receber' | 'pagar', motivo: string) {
  const usuario = await requireUser()
  if (motivo.trim().length < 5) return { success: false, error: 'Explique o motivo do cancelamento.' }
  try {
    if (tipo === 'receber') {
      const conta = await prisma.contaReceber.findUnique({ where: { id } })
      if (!conta || Number(conta.valorRecebido) > 0) return { success: false, error: 'Uma conta com recebimentos precisa ter as baixas estornadas antes.' }
      await prisma.contaReceber.update({ where: { id }, data: { status: 'Cancelado', canceladoEm: new Date(), canceladoPor: usuario.nome, motivoCancelamento: motivo.trim() } })
    } else {
      const conta = await prisma.contaPagar.findUnique({ where: { id } })
      if (!conta || Number(conta.valorPago) > 0) return { success: false, error: 'Uma conta com pagamentos precisa ter as baixas estornadas antes.' }
      await prisma.contaPagar.update({ where: { id }, data: { status: 'Cancelado', canceladoEm: new Date(), canceladoPor: usuario.nome, motivoCancelamento: motivo.trim() } })
    }
    revalidarFinanceiro()
    return { success: true }
  } catch (error) {
    console.error('Erro ao cancelar conta:', error)
    return { success: false, error: 'Não foi possível cancelar o lançamento.' }
  }
}

// Mantém a assinatura antiga sem apagar registros financeiros.
export async function excluirConta(id: number, tipo: 'receber' | 'pagar') {
  return cancelarConta(id, tipo, 'Cancelado pela tela financeira legada')
}

export async function baixarConta(id: number, tipo: 'receber' | 'pagar') {
  const conta = tipo === 'receber'
    ? await prisma.contaReceber.findUnique({ where: { id } })
    : await prisma.contaPagar.findUnique({ where: { id } })
  if (!conta) return { success: false, error: 'Conta não encontrada.' }
  const restante = tipo === 'receber'
    ? Number(conta.valor) - Number((conta as Prisma.ContaReceberGetPayload<object>).valorRecebido)
    : Number(conta.valor) - Number((conta as Prisma.ContaPagarGetPayload<object>).valorPago)
  return liquidarConta({ id, tipo, valor: restante, data: new Date().toISOString().slice(0, 10), formaPagamento: 'Não informado' })
}
