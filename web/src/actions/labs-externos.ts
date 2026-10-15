'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireUser } from '@/lib/auth-utils'
import {
  dataRetornoPara,
  hojeIso,
  isSituacao,
  paraIso,
  prazoSugerido,
  type SituacaoPedido,
} from '@/lib/labs-externos-utils'

export type ResultadoAcao = { success: true } | { success: false; error: string }

export interface LabExternoPedido {
  id: number
  labId: number | null
  labNome: string
  paciente: string
  dentista: string | null
  dataEnvio: Date | null
  prazo: Date | null
  /** Dia em que a peça voltou pronta do laboratório (preenchido ao marcar "Pronto"). */
  dataRetorno: Date | null
  situacao: SituacaoPedido
  servico: string | null
  isRetrabalho: boolean
  motivoRetrabalho: string | null
  createdAt: Date
  updatedAt: Date
  diasAtraso?: number
}

export interface LabExterno {
  id: number
  nome: string
  cidade: string | null
  telefone: string | null
  contato: string | null
  ativo: boolean
}

interface LabExternoPedidoRow {
  id: number | bigint
  lab_id: number | bigint | null
  lab_nome: string
  paciente: string
  dentista: string | null
  data_envio: Date | null
  prazo: Date | null
  data_retorno: Date | null
  situacao: SituacaoPedido
  servico: string | null
  is_retrabalho: boolean
  motivo_retrabalho: string | null
  created_at: Date
  updated_at: Date
  dias_atraso?: number | bigint | null
}

interface DashboardLabsExternosRow {
  total_enviados: number
  total_provando: number
  total_prontos: number
  total_entregues: number
  total_atrasados: number
  total_retrabalhos: number
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.')

const pedidoSchema = z.object({
  labId: z.number().int().positive('Selecione o laboratório.'),
  paciente: z.string().trim().min(2, 'Informe o nome do paciente.').max(255),
  dentista: z.string().trim().max(255).optional(),
  dataEnvio: dataIso.or(z.literal('')).optional(),
  prazo: dataIso.or(z.literal('')).optional(),
  servico: z.string().trim().max(2000).optional(),
})

const labSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome do laboratório.').max(255),
  cidade: z.string().trim().max(255).optional(),
  telefone: z.string().trim().max(50).optional(),
  contato: z.string().trim().max(255).optional(),
})

function erro(mensagem: string): ResultadoAcao {
  return { success: false, error: mensagem }
}

function primeiraMensagem(error: z.ZodError, padrao: string) {
  return error.issues[0]?.message ?? padrao
}

function revalidarLabs() {
  revalidatePath('/labs-externos')
}

async function buscarPedido(id: number) {
  const linhas = await prisma.$queryRaw<LabExternoPedidoRow[]>`
    SELECT * FROM labs_externos_pedidos WHERE id = ${id}
  `
  return linhas[0] ?? null
}

async function buscarLabAtivo(id: number) {
  const linhas = await prisma.$queryRaw<Array<{ id: number; nome: string }>>`
    SELECT id, nome FROM labs_externos WHERE id = ${id} AND ativo = true
  `
  return linhas[0] ?? null
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function getPedidosLabExterno(labId?: number) {
  await requireUser()
  const hoje = hojeIso()
  const pedidos = await prisma.$queryRaw<LabExternoPedidoRow[]>`
    SELECT
      p.*,
      CASE
        WHEN p.prazo IS NOT NULL AND p.prazo < ${hoje}::date AND p.situacao != 'Entregue'
        THEN (${hoje}::date - p.prazo)::int
        ELSE NULL
      END AS dias_atraso
    FROM labs_externos_pedidos p
    WHERE (${labId ?? null}::int IS NULL OR p.lab_id = ${labId ?? null}::int)
    ORDER BY
      CASE p.situacao
        WHEN 'Enviado'  THEN 1
        WHEN 'Provando' THEN 2
        WHEN 'Pronto'   THEN 3
        WHEN 'Entregue' THEN 4
      END,
      p.prazo ASC NULLS LAST,
      p.created_at DESC
  `
  return pedidos.map(normalizar)
}

export async function getAtrasados() {
  await requireUser()
  const hoje = hojeIso()
  const rows = await prisma.$queryRaw<LabExternoPedidoRow[]>`
    SELECT
      *,
      (${hoje}::date - prazo)::int AS dias_atraso
    FROM labs_externos_pedidos
    WHERE prazo IS NOT NULL AND prazo < ${hoje}::date AND situacao != 'Entregue'
    ORDER BY dias_atraso DESC
  `
  return rows.map(normalizar)
}

export async function getRetrabalhos() {
  await requireUser()
  const rows = await prisma.$queryRaw<LabExternoPedidoRow[]>`
    SELECT * FROM labs_externos_pedidos
    WHERE is_retrabalho = true AND situacao != 'Entregue'
    ORDER BY created_at DESC
  `
  return rows.map(normalizar)
}

export async function getDashboardLabsExternos() {
  await requireUser()
  const hoje = hojeIso()
  // Cast bigint to int to avoid JSON serialization issues
  const rows = await prisma.$queryRaw<DashboardLabsExternosRow[]>`
    SELECT
      COUNT(*) FILTER (WHERE situacao = 'Enviado')::int   AS total_enviados,
      COUNT(*) FILTER (WHERE situacao = 'Provando')::int   AS total_provando,
      COUNT(*) FILTER (WHERE situacao = 'Pronto')::int    AS total_prontos,
      COUNT(*) FILTER (WHERE situacao = 'Entregue')::int  AS total_entregues,
      COUNT(*) FILTER (WHERE prazo IS NOT NULL AND prazo < ${hoje}::date AND situacao != 'Entregue')::int  AS total_atrasados,
      COUNT(*) FILTER (WHERE is_retrabalho = true AND situacao != 'Entregue')::int AS total_retrabalhos
    FROM labs_externos_pedidos
  `
  return rows[0] ?? {
    total_enviados: 0,
    total_provando: 0,
    total_prontos: 0,
    total_entregues: 0,
    total_atrasados: 0,
    total_retrabalhos: 0,
  }
}

export async function getLabsExternos() {
  await requireUser()
  const labs = await prisma.$queryRaw<LabExterno[]>`
    SELECT * FROM labs_externos WHERE ativo = true ORDER BY nome
  `
  return labs
}

// ─── Laboratórios ───────────────────────────────────────────────────────────

export async function criarLab(input: z.input<typeof labSchema>): Promise<ResultadoAcao> {
  await requireUser()
  const parsed = labSchema.safeParse(input)
  if (!parsed.success) return erro(primeiraMensagem(parsed.error, 'Revise os dados do laboratório.'))
  const lab = parsed.data

  try {
    const existente = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id FROM labs_externos WHERE lower(nome) = lower(${lab.nome}) AND ativo = true LIMIT 1
    `
    if (existente.length > 0) return erro('Já existe um laboratório com este nome.')

    await prisma.$executeRaw`
      INSERT INTO labs_externos (nome, cidade, telefone, contato, ativo)
      VALUES (${lab.nome}, ${lab.cidade || null}, ${lab.telefone || null}, ${lab.contato || null}, true)
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao cadastrar laboratório externo:', e)
    return erro('Não foi possível cadastrar o laboratório.')
  }
}

// ─── Pedidos ────────────────────────────────────────────────────────────────

export async function criarPedido(input: z.input<typeof pedidoSchema>): Promise<ResultadoAcao> {
  await requireUser()
  const parsed = pedidoSchema.safeParse(input)
  if (!parsed.success) return erro(primeiraMensagem(parsed.error, 'Revise os dados do pedido.'))
  const pedido = parsed.data

  try {
    const lab = await buscarLabAtivo(pedido.labId)
    if (!lab) return erro('Selecione um laboratório válido.')

    // Sem data informada, o envio é hoje e o prazo segue a regra padrão (15 dias).
    const dataEnvio = pedido.dataEnvio || hojeIso()
    const prazo = pedido.prazo || prazoSugerido(dataEnvio)
    if (prazo < dataEnvio) return erro('O prazo não pode ser anterior à data de envio.')

    await prisma.$executeRaw`
      INSERT INTO labs_externos_pedidos
        (lab_id, lab_nome, paciente, dentista, data_envio, prazo, servico, situacao)
      VALUES
        (${lab.id}, ${lab.nome}, ${pedido.paciente}, ${pedido.dentista || null},
         ${dataEnvio}::date, ${prazo}::date, ${pedido.servico || null}, 'Enviado')
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao cadastrar pedido de laboratório externo:', e)
    return erro('Não foi possível cadastrar o pedido.')
  }
}

export async function atualizarSituacao(id: number, situacao: SituacaoPedido): Promise<ResultadoAcao> {
  await requireUser()
  if (!isSituacao(situacao)) return erro('Situação inválida.')

  try {
    const atual = await buscarPedido(id)
    if (!atual) return erro('Pedido não encontrado.')

    const retorno = dataRetornoPara(situacao, paraIso(atual.data_retorno), hojeIso())
    await prisma.$executeRaw`
      UPDATE labs_externos_pedidos
      SET situacao = ${situacao}, data_retorno = ${retorno}::date, updated_at = NOW()
      WHERE id = ${id}
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao atualizar situação do pedido:', e)
    return erro('Não foi possível atualizar a situação do pedido.')
  }
}

export async function marcarRetrabalho(id: number, motivo: string): Promise<ResultadoAcao> {
  await requireUser()
  if (motivo.trim().length < 5) return erro('Explique o motivo do retrabalho.')

  try {
    await prisma.$executeRaw`
      UPDATE labs_externos_pedidos
      SET is_retrabalho = true, motivo_retrabalho = ${motivo.trim()}, updated_at = NOW()
      WHERE id = ${id}
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao registrar retrabalho:', e)
    return erro('Não foi possível registrar o retrabalho.')
  }
}

// Permite corrigir um retrabalho marcado por engano.
export async function desmarcarRetrabalho(id: number): Promise<ResultadoAcao> {
  await requireUser()
  try {
    await prisma.$executeRaw`
      UPDATE labs_externos_pedidos
      SET is_retrabalho = false, motivo_retrabalho = NULL, updated_at = NOW()
      WHERE id = ${id}
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao desfazer retrabalho:', e)
    return erro('Não foi possível desfazer o retrabalho.')
  }
}

// Campos não informados (undefined) são mantidos; texto vazio limpa o campo.
export async function atualizarPedido(id: number, alteracoes: {
  labId?: number
  paciente?: string
  dentista?: string
  dataEnvio?: string
  prazo?: string
  servico?: string
  situacao?: SituacaoPedido
}): Promise<ResultadoAcao> {
  await requireUser()
  if (alteracoes.situacao !== undefined && !isSituacao(alteracoes.situacao)) return erro('Situação inválida.')
  if (alteracoes.paciente !== undefined && alteracoes.paciente.trim().length < 2) return erro('Informe o nome do paciente.')
  for (const campo of [alteracoes.dataEnvio, alteracoes.prazo]) {
    if (campo && !dataIso.safeParse(campo).success) return erro('Informe uma data válida.')
  }

  try {
    const atual = await buscarPedido(id)
    if (!atual) return erro('Pedido não encontrado.')

    const lab = alteracoes.labId !== undefined && alteracoes.labId !== Number(atual.lab_id)
      ? await buscarLabAtivo(alteracoes.labId)
      : null
    if (alteracoes.labId !== undefined && alteracoes.labId !== Number(atual.lab_id) && !lab) {
      return erro('Selecione um laboratório válido.')
    }

    const texto = (novo: string | undefined, antigo: string | null) =>
      novo === undefined ? antigo : novo.trim() || null
    const dataEnvio = alteracoes.dataEnvio === undefined ? paraIso(atual.data_envio) : alteracoes.dataEnvio || null
    const prazo = alteracoes.prazo === undefined ? paraIso(atual.prazo) : alteracoes.prazo || null
    if (dataEnvio && prazo && prazo < dataEnvio) return erro('O prazo não pode ser anterior à data de envio.')

    const situacao = alteracoes.situacao ?? atual.situacao
    const retorno = dataRetornoPara(situacao, paraIso(atual.data_retorno), hojeIso())
    const labId = lab ? lab.id : atual.lab_id
    const labNome = lab ? lab.nome : atual.lab_nome

    await prisma.$executeRaw`
      UPDATE labs_externos_pedidos SET
        lab_id       = ${labId},
        lab_nome     = ${labNome},
        paciente     = ${alteracoes.paciente?.trim() ?? atual.paciente},
        dentista     = ${texto(alteracoes.dentista, atual.dentista)},
        data_envio   = ${dataEnvio}::date,
        prazo        = ${prazo}::date,
        servico      = ${texto(alteracoes.servico, atual.servico)},
        situacao     = ${situacao},
        data_retorno = ${retorno}::date,
        updated_at   = NOW()
      WHERE id = ${id}
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao atualizar pedido de laboratório externo:', e)
    return erro('Não foi possível salvar o pedido.')
  }
}

export async function excluirPedido(id: number): Promise<ResultadoAcao> {
  await requireUser()
  try {
    await prisma.$executeRaw`
      DELETE FROM labs_externos_pedidos WHERE id = ${id}
    `
    revalidarLabs()
    return { success: true }
  } catch (e) {
    console.error('Erro ao excluir pedido de laboratório externo:', e)
    return erro('Não foi possível excluir o pedido.')
  }
}

function normalizar(row: LabExternoPedidoRow): LabExternoPedido {
  return {
    id:               Number(row.id),
    labId:            row.lab_id ? Number(row.lab_id) : null,
    labNome:          row.lab_nome,
    paciente:         row.paciente,
    dentista:         row.dentista,
    dataEnvio:        row.data_envio,
    prazo:            row.prazo,
    dataRetorno:      row.data_retorno,
    situacao:         row.situacao,
    servico:          row.servico,
    isRetrabalho:     row.is_retrabalho,
    motivoRetrabalho: row.motivo_retrabalho,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
    diasAtraso:       row.dias_atraso != null ? Number(row.dias_atraso) : undefined,
  }
}
