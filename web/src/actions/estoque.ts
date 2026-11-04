'use server'

import { prisma, type Prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { bloquearItensEstoque } from '@/lib/estoque-bloqueio'

export interface ItemEstoqueInput {
  nome: string
  marca?: string
  categoria: string
  unidade: string
  quantidadeMinima: number
  precoUnitario: number
  fornecedor?: string
  localizacao?: string
  dataValidade?: string
  codigoBarras?: string
}

function texto(valor: string | undefined, limite: number) {
  return valor?.trim().slice(0, limite) || null
}

function numeroValido(valor: number) {
  return Number.isFinite(valor) && valor >= 0
}

function dataOpcional(valor?: string) {
  if (!valor) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Informe uma data de validade válida')
  const data = new Date(`${valor}T00:00:00.000Z`)
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== valor) throw new Error('Informe uma data de validade válida')
  return data
}

function validarItem(data: ItemEstoqueInput) {
  if (!data.nome.trim()) throw new Error('Informe o nome do item')
  if (!data.categoria.trim()) throw new Error('Informe a categoria')
  if (!data.unidade.trim()) throw new Error('Informe a unidade de medida')
  if (!numeroValido(data.quantidadeMinima)) throw new Error('O estoque mínimo deve ser zero ou maior')
  if (!numeroValido(data.precoUnitario)) throw new Error('O preço unitário deve ser zero ou maior')
}

async function validarCodigoBarras(codigoBarras: string | null, ignorarId?: number) {
  if (!codigoBarras) return
  const existente = await prisma.estoque.findFirst({
    where: { codigoBarras, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
    select: { id: true, nome: true },
  })
  if (existente) throw new Error(`O código de barras já está vinculado a ${existente.nome}`)
}

export async function getEstoque() {
  await requireUser()
  try {
    const [estoque, historico] = await Promise.all([
      prisma.estoque.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
      getMovimentacoesEstoque(mesEstoqueAtual()),
    ])

    return {
      emitidoEm: new Date().toISOString(),
      itens: estoque.map(item => ({
        id: item.id,
        nome: item.nome,
        marca: item.marca || '',
        categoria: item.categoria,
        quantidade: Number(item.quantidade),
        quantidadeMinima: Number(item.quantidadeMinima),
        unidade: item.unidade,
        precoUnitario: Number(item.precoUnitario),
        fornecedor: item.fornecedor || '',
        localizacao: item.localizacao || '',
        dataValidade: item.dataValidade?.toISOString() || null,
        codigoBarras: item.codigoBarras || '',
        ativo: item.ativo !== false,
        updatedAt: item.updatedAt?.toISOString() || null,
      })),
      movimentacoes: historico.movimentacoes,
      historico: { mes: historico.mes, pagina: historico.pagina, total: historico.total, tamanhoPagina: historico.tamanhoPagina },
    }
  } catch (error) {
    console.error('Erro ao buscar estoque:', error)
    return { itens: [], movimentacoes: [], emitidoEm: new Date().toISOString() }
  }
}

export async function createItemEstoque(data: ItemEstoqueInput & { quantidade: number }) {
  const usuario = await requireUser()
  try {
    validarItem(data)
    if (!numeroValido(data.quantidade)) throw new Error('A quantidade inicial deve ser zero ou maior')
    const codigoBarras = texto(data.codigoBarras, 100)
    await validarCodigoBarras(codigoBarras)

    await prisma.$transaction(async tx => {
      const item = await tx.estoque.create({
        data: {
          nome: data.nome.trim(),
          marca: texto(data.marca, 120),
          categoria: data.categoria.trim(),
          quantidade: data.quantidade,
          unidade: data.unidade.trim(),
          quantidadeMinima: data.quantidadeMinima,
          precoUnitario: data.precoUnitario,
          fornecedor: texto(data.fornecedor, 255),
          localizacao: texto(data.localizacao, 255),
          dataValidade: dataOpcional(data.dataValidade),
          codigoBarras,
        },
      })
      if (data.quantidade > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            estoqueId: item.id,
            tipo: 'Entrada',
            quantidade: data.quantidade,
            saldoAnterior: 0,
            saldoPosterior: data.quantidade,
            valorUnitario: data.precoUnitario,
            motivo: 'Saldo inicial do cadastro',
            usuarioId: usuario.id,
            usuarioNome: usuario.nome,
          },
        })
      }
    })
    revalidatePath('/estoque')
    revalidatePath('/servicos')
    return { success: true }
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro ao criar item'
    console.error('Erro ao criar item de estoque:', error)
    return { success: false, error: mensagem }
  }
}

export async function updateItemEstoque(id: number, data: ItemEstoqueInput) {
  await requireUser()
  try {
    validarItem(data)
    const codigoBarras = texto(data.codigoBarras, 100)
    await validarCodigoBarras(codigoBarras, id)
    const existente = await prisma.estoque.findUnique({ where: { id }, select: { id: true } })
    if (!existente) throw new Error('Item de estoque não encontrado')

    await prisma.estoque.update({
      where: { id },
      data: {
        nome: data.nome.trim(),
        marca: texto(data.marca, 120),
        categoria: data.categoria.trim(),
        unidade: data.unidade.trim(),
        quantidadeMinima: data.quantidadeMinima,
        precoUnitario: data.precoUnitario,
        fornecedor: texto(data.fornecedor, 255),
        localizacao: texto(data.localizacao, 255),
        dataValidade: dataOpcional(data.dataValidade),
        codigoBarras,
      },
    })
    revalidatePath('/estoque')
    revalidatePath('/servicos')
    return { success: true }
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro ao atualizar item'
    console.error('Erro ao atualizar item de estoque:', error)
    return { success: false, error: mensagem }
  }
}

export async function alterarStatusItemEstoque(id: number, ativo: boolean) {
  await requireUser()
  try {
    await prisma.estoque.update({ where: { id }, data: { ativo } })
    revalidatePath('/estoque')
    revalidatePath('/servicos')
    return { success: true }
  } catch (error) {
    console.error('Erro ao alterar status do item:', error)
    return { success: false, error: 'Não foi possível alterar o status do item' }
  }
}

export async function registrarMovimentacaoEstoque(data: {
  estoqueId: number
  tipo: 'Entrada' | 'Saída' | 'Ajuste'
  quantidade: number
  motivo: string
  documento?: string
  valorUnitario?: number
}) {
  const usuario = await requireUser()
  try {
    if (!['Entrada', 'Saída', 'Ajuste'].includes(data.tipo)) throw new Error('Tipo de movimentação inválido')
    if (!numeroValido(data.quantidade) || (data.quantidade === 0 && data.tipo !== 'Ajuste')) throw new Error('Informe uma quantidade maior que zero')
    if (!data.motivo.trim()) throw new Error('Informe o motivo da movimentação')
    if (data.valorUnitario != null && !numeroValido(data.valorUnitario)) throw new Error('Informe um valor unitário válido')

    await prisma.$transaction(async tx => {
      await bloquearItensEstoque(tx, [data.estoqueId])
      const item = await tx.estoque.findUnique({ where: { id: data.estoqueId } })
      if (!item) throw new Error('Item de estoque não encontrado')
      if (item.ativo === false) throw new Error('Reative o item antes de movimentar o estoque')

      const saldoAnterior = Number(item.quantidade)
      const saldoPosterior = data.tipo === 'Entrada'
        ? saldoAnterior + data.quantidade
        : data.tipo === 'Saída'
          ? saldoAnterior - data.quantidade
          : data.quantidade
      if (saldoPosterior < 0) throw new Error(`Saldo insuficiente. Disponível: ${saldoAnterior} ${item.unidade}`)
      const quantidadeMovimentada = data.tipo === 'Ajuste'
        ? Math.abs(saldoPosterior - saldoAnterior)
        : data.quantidade
      if (quantidadeMovimentada === 0) throw new Error('O novo saldo é igual ao saldo atual')

      await tx.estoque.update({
        where: { id: item.id },
        data: {
          quantidade: saldoPosterior,
          ...(data.tipo === 'Entrada' && data.valorUnitario != null ? { precoUnitario: data.valorUnitario } : {}),
        },
      })
      await tx.movimentacaoEstoque.create({
        data: {
          estoqueId: item.id,
          tipo: data.tipo,
          quantidade: quantidadeMovimentada,
          saldoAnterior,
          saldoPosterior,
          valorUnitario: data.valorUnitario ?? item.precoUnitario,
          motivo: data.motivo.trim().slice(0, 255),
          documento: texto(data.documento, 100),
          usuarioId: usuario.id,
          usuarioNome: usuario.nome,
        },
      })
    }, { isolationLevel: 'Serializable' })

    revalidatePath('/estoque')
    revalidatePath('/servicos')
    return { success: true }
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Erro ao movimentar estoque'
    console.error('Erro ao movimentar estoque:', error)
    return { success: false, error: mensagem }
  }
}

// Mantida para integrações que ainda chamam a baixa diretamente pelo serviço.
export async function abaterEstoquePorServico(servicoId: number) {
  const usuario = await requireUser()
  try {
    const servico = await prisma.servico.findUnique({ where: { id: servicoId }, select: { nome: true, materiais: true } })
    if (!servico || !Array.isArray(servico.materiais)) return { success: true, message: 'Sem materiais vinculados' }

    await prisma.$transaction(async tx => {
      const materiais = servico.materiais as Array<{ id?: number; quantidade?: number }>
      await bloquearItensEstoque(tx, materiais
        .filter(material => material.id && material.quantidade && material.quantidade > 0)
        .map(material => material.id!))
      for (const material of materiais) {
        if (!material.id || !material.quantidade || material.quantidade <= 0) continue
        const item = await tx.estoque.findUnique({ where: { id: material.id } })
        if (!item) continue
        const saldoAnterior = Number(item.quantidade)
        const saldoPosterior = saldoAnterior - material.quantidade
        await tx.estoque.update({ where: { id: item.id }, data: { quantidade: saldoPosterior } })
        await tx.movimentacaoEstoque.create({
          data: {
            estoqueId: item.id,
            tipo: 'Saída',
            quantidade: material.quantidade,
            saldoAnterior,
            saldoPosterior,
            valorUnitario: item.precoUnitario,
            motivo: `Consumo do serviço ${servico.nome}`,
            usuarioId: usuario.id,
            usuarioNome: usuario.nome,
          },
        })
      }
    })
    revalidatePath('/estoque')
    return { success: true }
  } catch (error) {
    console.error('Erro ao abater estoque:', error)
    return { success: false, error: 'Erro ao atualizar estoque' }
  }
}

function mesEstoqueAtual() {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return `${partes.find(p => p.type === 'year')!.value}-${partes.find(p => p.type === 'month')!.value}`
}

function periodoEstoque(mes: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || Number(mes.slice(0, 4)) < 1900) throw new Error('Informe um mês válido')
  // Maceió opera em UTC-3; o limite exclusivo inclui todo o último dia local.
  const inicio = new Date(`${mes}-01T03:00:00.000Z`)
  const fim = new Date(inicio)
  fim.setUTCMonth(fim.getUTCMonth() + 1)
  return { createdAt: { gte: inicio, lt: fim } }
}

type MovimentoComItem = Prisma.MovimentacaoEstoqueGetPayload<{ include: { estoque: { select: { nome: true; unidade: true } } } }>
function serializarMovimentos(movimentos: MovimentoComItem[]) {
  return movimentos.map(movimento => ({
    id: movimento.id,
    estoqueId: movimento.estoqueId,
    itemNome: movimento.estoque.nome,
    unidade: movimento.estoque.unidade,
    tipo: movimento.tipo,
    quantidade: Number(movimento.quantidade),
    saldoAnterior: Number(movimento.saldoAnterior),
    saldoPosterior: Number(movimento.saldoPosterior),
    valorUnitario: movimento.valorUnitario == null ? null : Number(movimento.valorUnitario),
    motivo: movimento.motivo,
    documento: movimento.documento || '',
    ordemId: movimento.ordemId,
    usuarioNome: movimento.usuarioNome || 'Sistema',
    createdAt: movimento.createdAt.toISOString(),
  }))
}

export async function getMovimentacoesEstoque(mes: string, pagina = 1, busca = '') {
  await requireUser()
  const where = { ...periodoEstoque(mes), ...(busca.trim() ? { estoque: { nome: { contains: busca.trim().slice(0, 255), mode: 'insensitive' as const } } } : {}) }
  if (!Number.isSafeInteger(pagina) || pagina < 1) throw new Error('Página inválida')
  const tamanhoPagina = 100
  const [movimentos, total] = await Promise.all([
    prisma.movimentacaoEstoque.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (pagina - 1) * tamanhoPagina, take: tamanhoPagina, include: { estoque: { select: { nome: true, unidade: true } } } }),
    prisma.movimentacaoEstoque.count({ where }),
  ])
  return { mes, pagina, tamanhoPagina, total, movimentacoes: serializarMovimentos(movimentos) }
}

// Exportação explícita e autenticada de um único mês, sem corte silencioso.
export async function exportarMovimentacoesEstoque(mes: string) {
  await requireUser()
  const movimentos = await prisma.movimentacaoEstoque.findMany({
    where: periodoEstoque(mes), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { estoque: { select: { nome: true, unidade: true } } },
  })
  return serializarMovimentos(movimentos)
}
