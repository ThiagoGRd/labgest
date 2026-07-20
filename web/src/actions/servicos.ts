'use server'

import { prisma, type Prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireAdmin, requireUser } from '@/lib/auth-utils'
import { isTipoProtese, type TipoProteseId } from '@labgest/shared'

export interface MaterialServicoInput {
  id: number
  quantidade: number
}

export interface ServicoInput {
  nome: string
  categoria: string
  tipoWorkflow: TipoProteseId | null
  preco: number
  tempoProducao: number
  custoMateriais: number
  descricao: string
  materiais: MaterialServicoInput[]
}

function isRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function normalizarMateriais(valor: unknown): MaterialServicoInput[] {
  if (!Array.isArray(valor)) return []
  return valor.flatMap((item) => {
    if (!isRegistro(item)) return []
    const id = Number(item.id)
    const quantidade = Number(item.quantidade)
    return Number.isInteger(id) && id > 0 && Number.isFinite(quantidade) && quantidade > 0
      ? [{ id, quantidade }]
      : []
  })
}

function validarDados(data: ServicoInput) {
  const nome = data.nome.trim()
  const categoria = data.categoria.trim()
  const descricao = data.descricao.trim()

  if (nome.length < 3 || nome.length > 255) return { success: false as const, error: 'Informe um nome entre 3 e 255 caracteres.' }
  if (!categoria || categoria.length > 100) return { success: false as const, error: 'Selecione uma categoria válida.' }
  if (data.tipoWorkflow !== null && !isTipoProtese(data.tipoWorkflow)) return { success: false as const, error: 'Selecione um fluxo de prótese válido.' }
  if (!Number.isFinite(data.preco) || data.preco <= 0) return { success: false as const, error: 'O preço de venda deve ser maior que zero.' }
  if (!Number.isInteger(data.tempoProducao) || data.tempoProducao < 0 || data.tempoProducao > 365) return { success: false as const, error: 'O prazo deve ser um número inteiro entre 0 e 365 dias.' }
  if (!Number.isFinite(data.custoMateriais) || data.custoMateriais < 0) return { success: false as const, error: 'O custo de materiais não pode ser negativo.' }

  const materiais = normalizarMateriais(data.materiais)
  if (materiais.length !== data.materiais.length) return { success: false as const, error: 'Revise as quantidades dos materiais vinculados.' }

  return { success: true as const, data: { nome, categoria, descricao, materiais } }
}

async function prepararDados(data: ServicoInput, servicoId?: number) {
  const validacao = validarDados(data)
  if (!validacao.success) return validacao

  const duplicado = await prisma.servico.findFirst({
    where: {
      nome: { equals: validacao.data.nome, mode: 'insensitive' },
      ...(servicoId ? { id: { not: servicoId } } : {}),
    },
    select: { id: true },
  })
  if (duplicado) return { success: false as const, error: 'Já existe um serviço cadastrado com este nome.' }

  const idsMateriais = [...new Set(validacao.data.materiais.map((material) => material.id))]
  const itensEstoque = idsMateriais.length > 0
    ? await prisma.estoque.findMany({
        where: { id: { in: idsMateriais }, ativo: true },
        select: { id: true, precoUnitario: true },
      })
    : []

  if (itensEstoque.length !== idsMateriais.length) return { success: false as const, error: 'Um dos materiais selecionados não existe ou está inativo.' }

  const precos = new Map(itensEstoque.map((item) => [item.id, Number(item.precoUnitario)]))
  const custoCalculado = validacao.data.materiais.reduce(
    (total, material) => total + (precos.get(material.id) ?? 0) * material.quantidade,
    0,
  )

  return {
    success: true as const,
    data: {
      nome: validacao.data.nome,
      categoria: validacao.data.categoria,
      tipoWorkflow: data.tipoWorkflow,
      preco: data.preco,
      tempoProducao: data.tempoProducao,
      custoMateriais: idsMateriais.length > 0 ? custoCalculado : data.custoMateriais,
      descricao: validacao.data.descricao,
      materiais: validacao.data.materiais.map((material) => ({
        id: material.id,
        quantidade: material.quantidade,
      })) satisfies Prisma.InputJsonArray,
    },
  }
}

export async function getServicos() {
  await requireUser()
  const limite30Dias = new Date()
  limite30Dias.setDate(limite30Dias.getDate() - 30)

  const servicos = await prisma.servico.findMany({
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    include: {
      ordens: {
        select: { status: true, dataPedido: true, dataFinalizacao: true },
      },
    },
  })

  const materiaisUsados = new Set(servicos.flatMap((servico) => normalizarMateriais(servico.materiais).map((item) => item.id)))
  const estoque = materiaisUsados.size > 0
    ? await prisma.estoque.findMany({
        where: { id: { in: [...materiaisUsados] } },
        select: { id: true, nome: true, unidade: true },
      })
    : []
  const materiaisPorId = new Map(estoque.map((item) => [item.id, item]))

  return servicos.map((servico) => {
    const preco = Number(servico.preco)
    const custo = Number(servico.custoMateriais || 0)
    const ordensValidas = servico.ordens.filter((ordem) => ordem.status !== 'Cancelado')
    const finalizadas = ordensValidas.filter((ordem) => ordem.dataPedido && ordem.dataFinalizacao)
    const tempoMedioReal = finalizadas.length > 0
      ? Math.round(finalizadas.reduce((total, ordem) => {
          const dias = (ordem.dataFinalizacao!.getTime() - ordem.dataPedido!.getTime()) / 86_400_000
          return total + Math.max(0, dias)
        }, 0) / finalizadas.length)
      : null
    const materiais = normalizarMateriais(servico.materiais).map((material) => ({
      ...material,
      nome: materiaisPorId.get(material.id)?.nome || `Material #${material.id}`,
      unidade: materiaisPorId.get(material.id)?.unidade || 'un',
    }))

    return {
      id: servico.id,
      nome: servico.nome,
      categoria: servico.categoria || 'Geral',
      tipoWorkflow: isTipoProtese(servico.tipoWorkflow) ? servico.tipoWorkflow : null,
      descricao: servico.descricao || '',
      preco,
      tempoProducao: servico.tempoProducao || 0,
      materiais,
      custoMateriais: custo,
      margemLucro: preco > 0 ? Math.round(((preco - custo) / preco) * 100) : 0,
      ativo: servico.ativo !== false,
      totalPedidos: ordensValidas.length,
      pedidos30Dias: ordensValidas.filter((ordem) => ordem.dataPedido && ordem.dataPedido >= limite30Dias).length,
      tempoMedioReal,
    }
  })
}

export async function getMateriaisDisponiveis() {
  await requireUser()
  const itens = await prisma.estoque.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, unidade: true, precoUnitario: true, quantidade: true },
  })
  return itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    unidade: item.unidade,
    precoUnitario: Number(item.precoUnitario),
    quantidadeDisponivel: Number(item.quantidade),
  }))
}

export async function createServico(data: ServicoInput) {
  await requireAdmin()
  try {
    const preparado = await prepararDados(data)
    if (!preparado.success) return { success: false, error: preparado.error }
    await prisma.servico.create({ data: preparado.data })
    revalidatePath('/servicos')
    revalidatePath('/ordens')
    revalidatePath('/novo-pedido')
    return { success: true }
  } catch (error) {
    console.error('Erro ao criar serviço:', error)
    return { success: false, error: 'Não foi possível cadastrar o serviço.' }
  }
}

export async function updateServico(id: number, data: ServicoInput) {
  await requireAdmin()
  try {
    const atual = await prisma.servico.findUnique({ where: { id }, select: { id: true } })
    if (!atual) return { success: false, error: 'Serviço não encontrado.' }
    const preparado = await prepararDados(data, id)
    if (!preparado.success) return { success: false, error: preparado.error }
    await prisma.servico.update({ where: { id }, data: preparado.data })
    revalidatePath('/servicos')
    revalidatePath('/ordens')
    revalidatePath('/novo-pedido')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error)
    return { success: false, error: 'Não foi possível atualizar o serviço.' }
  }
}

export async function toggleServicoAtivo(id: number, ativo: boolean) {
  await requireAdmin()
  try {
    const servico = await prisma.servico.findUnique({ where: { id }, select: { id: true } })
    if (!servico) return { success: false, error: 'Serviço não encontrado.' }
    await prisma.servico.update({ where: { id }, data: { ativo } })
    revalidatePath('/servicos')
    revalidatePath('/ordens')
    revalidatePath('/novo-pedido')
    return { success: true }
  } catch (error) {
    console.error('Erro ao alterar status do serviço:', error)
    return { success: false, error: 'Não foi possível alterar o status do serviço.' }
  }
}
