'use server'

import { Prisma, prisma } from '@labgest/database'
import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-utils'
import { dataCivilDoLaboratorio } from '@/lib/data-civil'
import { resumirCobrancasMensais } from '@/lib/regra-cobranca-mensal'
import { resumirDespesasMensais } from '@/lib/regra-despesa-mensal'
import { contasNoPeriodo, filtroReceberPeriodo, limitesMesReceber, mesDataFinanceira } from '@/lib/periodo-receber'

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

// All mutations of a financial account acquire its row before reading balances or
// touching ledger rows. Keep this order (account -> ledger) in every transaction.
// Static table names and bound IDs keep this query safe; locks last until commit.
async function bloquearConta(tx: Prisma.TransactionClient, id: number, tipo: 'receber' | 'pagar') {
  if (tipo === 'receber') {
    await tx.$queryRaw`SELECT id FROM contas_receber WHERE id = ${id} FOR UPDATE`
  } else {
    await tx.$queryRaw`SELECT id FROM contas_pagar WHERE id = ${id} FOR UPDATE`
  }
}

function revalidarFinanceiro() {
  revalidatePath('/financeiro')
  revalidatePath('/relatorios')
}

// Explicit finance inputs describe civil dates, never instants in the server timezone.
function parseDataCivilFinanceira(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data válida.')
  const data = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== value) {
    throw new Error('Informe uma data válida.')
  }
  return data
}

function adicionarMesesMantendoDia(data: Date, quantidade: number) {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + quantidade
  const ultimoDia = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
  return new Date(Date.UTC(ano, mes, Math.min(data.getUTCDate(), ultimoDia)))
}

function statusReceber(status: string | null, vencimento: Date, recebido: number, total: number) {
  if (status === 'Cancelado') return 'Cancelado'
  if (recebido >= total) return 'Recebido'
  if (recebido > 0) return vencimento < dataCivilDoLaboratorio() ? 'Parcial atrasado' : 'Parcial'
  return vencimento < dataCivilDoLaboratorio() ? 'Vencido' : 'Pendente'
}

function statusPagar(status: string | null, vencimento: Date, pago: number, total: number) {
  if (status === 'Cancelado') return 'Cancelado'
  if (pago >= total) return 'Pago'
  if (pago > 0) return vencimento < dataCivilDoLaboratorio() ? 'Parcial atrasado' : 'Parcial'
  return vencimento < dataCivilDoLaboratorio() ? 'Vencido' : 'Pendente'
}

// Bulk backfill cannot infer historical competence/due dates safely. Recovery
// requires an explicit reviewed per-order operation with confirmed dates.
export async function sincronizarFinanceiroRetroativo() {
  await requireUser()
  return { success: false, error: 'A sincronização em massa está desativada. Revise cada cobrança e confirme suas datas antes de recuperar o lançamento.' }
}

export async function gerarCobrancaAutomatica(ordemId: number) {
  const usuario = await requireUser()
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
      const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
      if (!ordem) return { success: false, error: 'Ordem não encontrada.' }
      if (await tx.contaReceber.findFirst({ where: { ordemId } })) {
        return { success: false, error: 'Já existe uma cobrança para esta ordem.' }
      }
      const base = ordem.dataFinalizacao ?? dataCivilDoLaboratorio()
      await tx.contaReceber.create({
        data: {
          ordemId,
          descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
          clienteId: ordem.clienteId,
          clienteNome: ordem.clienteNome,
          valor: ordem.valorFinal,
          dataCompetencia: base,
          dataVencimento: base,
          status: 'Pendente',
          usuarioId: usuario.id,
          observacoes: `Gerado automaticamente — Ordem #${ordem.id}`,
        },
      })
      return { success: true as const }
    })
    if (!resultado.success) return resultado
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
  const mesValido = /^\d{4}-(0[1-9]|1[0-2])$/.test(filtroMes ?? '') ? filtroMes! : null
  const [ano, mes] = mesValido
    ? mesValido.split('-').map(Number)
    : [hoje.getFullYear(), hoje.getMonth() + 1]
  const { inicio: inicioReceber, fimExclusivo } = limitesMesReceber(ano, mes)

  const [receberNoPeriodo, pagar, movimentacoes, contasFinanceiras, clientes, mesesReceber, mesesPagar, vencidasGlobais] = await Promise.all([
    prisma.contaReceber.findMany({
      where: filtroReceberPeriodo(inicioReceber, fimExclusivo),
      include: { cliente: { select: { nome: true } }, ordem: { select: { nomePaciente: true, servicoNome: true } } },
      orderBy: [{ status: 'asc' }, { dataVencimento: 'asc' }],
    }),
    prisma.contaPagar.findMany({
      where: { dataVencimento: { gte: inicioReceber, lt: fimExclusivo } },
      orderBy: [{ status: 'asc' }, { dataVencimento: 'asc' }],
    }),
    prisma.movimentacaoFinanceira.findMany({
      where: { dataMovimentacao: { gte: inicioReceber, lt: fimExclusivo }, estornadaEm: null },
      include: {
        contaReceber: { select: { descricao: true, clienteNome: true } },
        contaPagar: { select: { descricao: true, fornecedor: true } },
        contaFinanceira: { select: { nome: true } },
      },
      orderBy: [{ dataMovimentacao: 'desc' }, { id: 'desc' }],
    }),
    prisma.contaFinanceira.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' } }),
    prisma.cliente.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    prisma.contaReceber.findMany({ select: { dataVencimento: true, dataCompetencia: true } }),
    prisma.contaPagar.findMany({ select: { dataVencimento: true } }),
    prisma.contaReceber.findMany({
      where: { dataVencimento: { lt: dataCivilDoLaboratorio() }, status: { notIn: ['Recebido', 'Cancelado'] } },
      select: { valor: true, valorRecebido: true },
    }),
  ])

  const receber = contasNoPeriodo(receberNoPeriodo, inicioReceber, fimExclusivo, 'vencimento')
  const receberCompetenciaIds = new Set(contasNoPeriodo(receberNoPeriodo, inicioReceber, fimExclusivo, 'competencia').map((conta) => conta.id))
  const receberVencimentoIds = new Set(receber.map((conta) => conta.id))
  const contasReceber = receberNoPeriodo.map((conta) => {
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
  const resumoReceberMes = resumirCobrancasMensais(receber)
  const resumoPagarMes = resumirDespesasMensais(pagar)
  const previstoReceber = resumoReceberMes.saldo
  const previstoPagar = resumoPagarMes.saldo
  const vencidoReceber = vencidasGlobais.reduce((s, c) => s + Math.max(0, Number(c.valor) - Number(c.valorRecebido)), 0)
  const resultadoProjetado = resumoReceberMes.valorPrevisto - resumoPagarMes.valorPrevisto

  const meses = new Set<string>([`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`])
  for (const conta of mesesPagar) {
    meses.add(mesDataFinanceira(conta.dataVencimento))
  }

  for (const conta of mesesReceber) {
    meses.add(mesDataFinanceira(conta.dataVencimento))
    if (conta.dataCompetencia) {
      meses.add(mesDataFinanceira(conta.dataCompetencia))
    }
  }
  meses.add(`${ano}-${String(mes).padStart(2, '0')}`)

  return {
    periodo: `${ano}-${String(mes).padStart(2, '0')}`,
    receber: contasReceber.filter((conta) => receberVencimentoIds.has(conta.id)),
    receberCompetencia: contasReceber.filter((conta) => receberCompetenciaIds.has(conta.id)),
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
      recebidoCompetencia: resumoReceberMes.valorRecebido,
      pagoCompetencia: resumoPagarMes.valorPago,
      previstoReceber,
      totalPrevistoReceber: resumoReceberMes.valorPrevisto,
      previstoPagar,
      totalPrevistoPagar: resumoPagarMes.valorPrevisto,
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
    const vencimento = parseDataCivilFinanceira(data.vencimento)
    const competencia = data.competencia ? parseDataCivilFinanceira(data.competencia) : vencimento

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
    console.error('Erro ao criar lançamento financeiro:', error)
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
    const dataVencimento = parseDataCivilFinanceira(input.vencimento)
    const resultado = await prisma.$transaction(async (tx) => {
      await bloquearConta(tx, id, tipo)
      if (tipo === 'receber') {
        const conta = await tx.contaReceber.findUnique({ where: { id } })
        if (!conta || conta.status === 'Cancelado') return { success: false, error: 'Esta conta não pode ser editada.' }
        if (input.valor < Number(conta.valorRecebido)) return { success: false, error: 'O valor não pode ser menor que o total já recebido.' }
        await tx.contaReceber.update({ where: { id }, data: {
          descricao: input.descricao.trim(), valor: input.valor, dataVencimento, observacoes: input.observacoes,
          status: Number(conta.valorRecebido) >= input.valor ? 'Recebido' : Number(conta.valorRecebido) > 0 ? 'Parcial' : 'Pendente',
        } })
      } else {
        const conta = await tx.contaPagar.findUnique({ where: { id } })
        if (!conta || conta.status === 'Cancelado') return { success: false, error: 'Esta conta não pode ser editada.' }
        if (input.valor < Number(conta.valorPago)) return { success: false, error: 'O valor não pode ser menor que o total já pago.' }
        await tx.contaPagar.update({ where: { id }, data: {
          descricao: input.descricao.trim(), valor: input.valor, dataVencimento,
          categoria: input.categoria, fornecedor: input.fornecedor, observacoes: input.observacoes,
          status: Number(conta.valorPago) >= input.valor ? 'Pago' : Number(conta.valorPago) > 0 ? 'Parcial' : 'Pendente',
        } })
      }
      return { success: true as const }
    })
    if (!resultado.success) return resultado
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
      await bloquearConta(tx, data.id, data.tipo)
      const contaFinanceira = data.contaFinanceiraId ?? (await tx.contaFinanceira.findFirst({ where: { ativo: true }, select: { id: true } }))?.id
      if (data.tipo === 'receber') {
        const conta = await tx.contaReceber.findUnique({ where: { id: data.id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Conta indisponível para recebimento.')
        const novoTotal = Number(conta.valorRecebido) + data.valor
        if (novoTotal > Number(conta.valor) + 0.001) throw new Error('O valor informado ultrapassa o saldo da conta.')
        await tx.movimentacaoFinanceira.create({ data: {
          tipo: 'Entrada', valor: data.valor, dataMovimentacao: parseDataCivilFinanceira(data.data),
          formaPagamento: data.formaPagamento, observacoes: data.observacoes,
          contaReceberId: data.id, contaFinanceiraId: contaFinanceira, usuarioId: usuario.id,
        } })
        await tx.contaReceber.update({ where: { id: data.id }, data: {
          valorRecebido: novoTotal, status: novoTotal >= Number(conta.valor) ? 'Recebido' : 'Parcial',
          dataRecebimento: novoTotal >= Number(conta.valor) ? parseDataCivilFinanceira(data.data) : null,
          formaRecebimento: data.formaPagamento,
        } })
      } else {
        const conta = await tx.contaPagar.findUnique({ where: { id: data.id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Conta indisponível para pagamento.')
        const novoTotal = Number(conta.valorPago) + data.valor
        if (novoTotal > Number(conta.valor) + 0.001) throw new Error('O valor informado ultrapassa o saldo da conta.')
        await tx.movimentacaoFinanceira.create({ data: {
          tipo: 'Saida', valor: data.valor, dataMovimentacao: parseDataCivilFinanceira(data.data),
          formaPagamento: data.formaPagamento, observacoes: data.observacoes,
          contaPagarId: data.id, contaFinanceiraId: contaFinanceira, usuarioId: usuario.id,
        } })
        await tx.contaPagar.update({ where: { id: data.id }, data: {
          valorPago: novoTotal, status: novoTotal >= Number(conta.valor) ? 'Pago' : 'Parcial',
          dataPagamento: novoTotal >= Number(conta.valor) ? parseDataCivilFinanceira(data.data) : null,
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

// Desfaz uma baixa lançada por engano: as movimentações são marcadas como estornadas
// (preservadas para auditoria) e a conta volta a ficar em aberto.
export async function estornarBaixa(id: number, tipo: 'receber' | 'pagar', motivo: string) {
  const usuario = await requireUser()
  const motivoLimpo = motivo.trim()
  if (motivoLimpo.length < 5) return { success: false, error: 'Explique o motivo do estorno.' }
  try {
    await prisma.$transaction(async (tx) => {
      await bloquearConta(tx, id, tipo)
      const estorno = { estornadaEm: new Date(), estornadaPor: usuario.nome, motivoEstorno: motivoLimpo }
      if (tipo === 'receber') {
        const conta = await tx.contaReceber.findUnique({ where: { id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Esta conta não está disponível para estorno.')
        if (Number(conta.valorRecebido) <= 0) throw new Error('Esta conta não possui baixa para estornar.')
        await tx.movimentacaoFinanceira.updateMany({ where: { contaReceberId: id, estornadaEm: null }, data: estorno })
        await tx.contaReceber.update({ where: { id }, data: {
          valorRecebido: 0, status: 'Pendente', dataRecebimento: null, formaRecebimento: null,
        } })
      } else {
        const conta = await tx.contaPagar.findUnique({ where: { id } })
        if (!conta || conta.status === 'Cancelado') throw new Error('Esta conta não está disponível para estorno.')
        if (Number(conta.valorPago) <= 0) throw new Error('Esta conta não possui pagamento para estornar.')
        await tx.movimentacaoFinanceira.updateMany({ where: { contaPagarId: id, estornadaEm: null }, data: estorno })
        await tx.contaPagar.update({ where: { id }, data: {
          valorPago: 0, status: 'Pendente', dataPagamento: null, formaPagamento: null,
        } })
      }
    })
    revalidarFinanceiro()
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Erro ao estornar baixa:', error)
    const mensagem = error instanceof Error && !(error instanceof Prisma.PrismaClientKnownRequestError)
      ? error.message
      : 'Não foi possível estornar a baixa.'
    return { success: false, error: mensagem }
  }
}

export async function cancelarConta(id: number, tipo: 'receber' | 'pagar', motivo: string) {
  const usuario = await requireUser()
  if (motivo.trim().length < 5) return { success: false, error: 'Explique o motivo do cancelamento.' }
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      await bloquearConta(tx, id, tipo)
      if (tipo === 'receber') {
        const conta = await tx.contaReceber.findUnique({ where: { id } })
        if (conta?.status === 'Cancelado') return { success: false, error: 'Esta conta já está cancelada.' }
        if (!conta || Number(conta.valorRecebido) > 0) return { success: false, error: 'Uma conta com recebimentos precisa ter as baixas estornadas antes.' }
        await tx.contaReceber.update({ where: { id }, data: { status: 'Cancelado', canceladoEm: new Date(), canceladoPor: usuario.nome, motivoCancelamento: motivo.trim() } })
      } else {
        const conta = await tx.contaPagar.findUnique({ where: { id } })
        if (conta?.status === 'Cancelado') return { success: false, error: 'Esta conta já está cancelada.' }
        if (!conta || Number(conta.valorPago) > 0) return { success: false, error: 'Uma conta com pagamentos precisa ter as baixas estornadas antes.' }
        await tx.contaPagar.update({ where: { id }, data: { status: 'Cancelado', canceladoEm: new Date(), canceladoPor: usuario.nome, motivoCancelamento: motivo.trim() } })
      }
      return { success: true as const }
    })
    if (!resultado.success) return resultado
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
  return liquidarConta({ id, tipo, valor: restante, data: dataCivilDoLaboratorio().toISOString().slice(0, 10), formaPagamento: 'Não informado' })
}
