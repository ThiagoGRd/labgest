'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

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
  const inicioHistorico = new Date()
  inicioHistorico.setFullYear(inicioHistorico.getFullYear() - 1)

  try {
    const [estoque, movimentacoes] = await Promise.all([
      prisma.estoque.findMany({ orderBy: [{ ativo: 'desc' }, { nome: 'asc' }] }),
      prisma.movimentacaoEstoque.findMany({
        where: { createdAt: { gte: inicioHistorico } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { estoque: { select: { nome: true, unidade: true } } },
      }),
    ])

    return {
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
      movimentacoes: movimentacoes.map(movimento => ({
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
      })),
    }
  } catch (error) {
    console.error('Erro ao buscar estoque:', error)
    return { itens: [], movimentacoes: [] }
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
    if (!numeroValido(data.quantidade) || data.quantidade === 0) throw new Error('Informe uma quantidade maior que zero')
    if (!data.motivo.trim()) throw new Error('Informe o motivo da movimentação')
    if (data.valorUnitario != null && !numeroValido(data.valorUnitario)) throw new Error('Informe um valor unitário válido')

    await prisma.$transaction(async tx => {
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
      for (const material of servico.materiais as Array<{ id?: number; quantidade?: number }>) {
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
