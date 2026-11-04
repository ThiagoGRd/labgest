'use server'

import { registrarEnvioFornecedor } from './workflow-protese'
import { garantirPedidoNaoArquivado } from '@/lib/labs-externos-vinculo'
import type { ArchiveQuery } from '@/lib/labs-externos-arquivo'
import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin, requireUser } from '@/lib/auth-utils'
import { alterarArquivamento, capacidadeArquivamento, estadosArquivamento, type ArchiveInput, type ArchiveEvent } from '@/lib/labs-externos-arquivo'
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
  ordemId: number | null
  fornecedorConfirmadoEm: Date | null
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
  revisao: string
  arquivoVersao: number
  arquivado: boolean
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
  ordem_id: number | null
  fornecedor_confirmado_em: Date | null
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
  revisao: string
}

const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe uma data válida.')

const pedidoSchema = z.object({
  ordemId: z.number().int().positive().optional(),
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
  revalidatePath('/producao')
  revalidatePath('/ordens')
}

async function buscarPedido(id: number, db: ArchiveQuery = prisma) {
  const linhas = await db.$queryRaw<LabExternoPedidoRow[]>`
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

// Linkage is immutable: discover order first, then always lock order before external row.
async function alterarPedidoBloqueado(id: number, fn: (tx: ArchiveQuery, atual: LabExternoPedidoRow) => Promise<ResultadoAcao>) {
  if (!Number.isSafeInteger(id) || id <= 0) return erro('Pedido inválido.')
  return prisma.$transaction(async tx => {
    const anterior = await buscarPedido(id, tx)
    if (!anterior) return erro('Pedido não encontrado.')
    if (anterior.ordem_id) await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${anterior.ordem_id} FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM labs_externos_pedidos WHERE id = ${id} FOR UPDATE`
    const atual = await buscarPedido(id, tx)
    if (!atual) return erro('Pedido não encontrado.')
    await garantirPedidoNaoArquivado(tx, id)
    return fn(tx, atual)
  })
}

function validarSituacaoVinculada(atual: LabExternoPedidoRow, situacao: SituacaoPedido) {
  if (!atual.ordem_id) return null
  if (situacao === 'Entregue' && !atual.fornecedor_confirmado_em) return 'Confirme o recebimento na Produção antes da entrega externa.'
  if (atual.data_retorno && (situacao === 'Enviado' || situacao === 'Provando')) return 'O retorno já foi registrado. Um novo envio exige um novo ciclo na Produção.'
  return null
}

// ─── Consultas ──────────────────────────────────────────────────────────────

export async function getPedidosLabExterno(labId?: number, arquivados = false): Promise<LabExternoPedido[]> {
  await requireUser()
  const hoje = hojeIso()
  const pedidos: LabExternoPedidoRow[] = await prisma.$queryRaw<LabExternoPedidoRow[]>`
    SELECT
      p.*, md5(to_jsonb(p)::text) AS revisao,
      CASE
        WHEN p.prazo IS NOT NULL AND p.prazo < ${hoje}::date AND p.situacao IN ('Enviado', 'Provando') AND p.data_retorno IS NULL
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
  const { states } = await estadosArquivamento(prisma)
  const byId = new Map(states.map(state => [state.pedido_id, state]))
  return pedidos.map(row => {
    const state = byId.get(Number(row.id))
    return { ...normalizar(row), arquivado: state?.archived ?? false, arquivoVersao: state?.version ?? 0 }
  }).filter(pedido => pedido.arquivado === arquivados)
}

export async function getAtrasados() {
  const pedidos = await getPedidosLabExterno()
  return pedidos.filter(p => (p.diasAtraso ?? 0) > 0).sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0))
}

export async function getRetrabalhos() {
  const pedidos = await getPedidosLabExterno()
  return pedidos.filter(p => p.isRetrabalho && p.situacao !== 'Entregue')
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export async function getDashboardLabsExternos() {
  const pedidos = await getPedidosLabExterno()
  return {
    total_enviados: pedidos.filter(p => p.situacao === 'Enviado').length,
    total_provando: pedidos.filter(p => p.situacao === 'Provando').length,
    total_prontos: pedidos.filter(p => p.situacao === 'Pronto').length,
    total_entregues: pedidos.filter(p => p.situacao === 'Entregue').length,
    total_atrasados: pedidos.filter(p => (p.diasAtraso ?? 0) > 0).length,
    total_retrabalhos: pedidos.filter(p => p.isRetrabalho && p.situacao !== 'Entregue').length,
  }
}

export async function getArquivamentoDisponivel(): Promise<boolean> {
  const user = await requireUser()
  const capability = await capacidadeArquivamento(prisma)
  return capability.enabled && (user.tipo === 'admin' || user.permissoes.includes('all'))
}

export async function alterarArquivoPedido(input: ArchiveInput): Promise<ResultadoAcao> {
  const user = await requireAdmin()
  try {
    await alterarArquivamento(prisma, input, user)
    revalidarLabs()
    return { success: true }
  } catch (error) {
    // Validation/domain errors are safe; database errors must not disclose SQL or credentials.
    const message = error instanceof Error ? error.message : ''
    const known = /^(Confirme|Conclua|Arquivamento seguro|Pedido não encontrado|O registro foi alterado|O arquivamento foi alterado|Este registro não está arquivado)/
    return erro(known.test(message) ? message : 'Não foi possível confirmar o resultado. Atualize a página e confira o histórico antes de tentar novamente.')
  }
}

export async function getHistoricoArquivo(id: number): Promise<ArchiveEvent[]> {
  await requireAdmin()
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Pedido inválido.')
  const capability = await capacidadeArquivamento(prisma)
  if (!capability.installed) return []
  return prisma.$queryRaw<ArchiveEvent[]>`
    SELECT id::text, action, version, occurred_at, actor_name, reason, snapshot, reconciliation_review
    FROM labgest_private.external_order_archive_event WHERE pedido_id = ${id} ORDER BY version DESC
  `
}

export async function getLabsExternos(): Promise<LabExterno[]> {
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
    if (pedido.ordemId) {
      const resultado = await registrarEnvioFornecedor(pedido.ordemId, '', pedido.labId)
      return resultado.success ? { success: true } : erro(resultado.error || 'Não foi possível enviar a ordem ao fornecedor.')
    }
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
  return atualizarPedido(id, { situacao })
}

export async function marcarRetrabalho(id: number, motivo: string): Promise<ResultadoAcao> {
  await requireUser()
  if (motivo.trim().length < 5) return erro('Explique o motivo do retrabalho.')

  try {
    const resultado = await alterarPedidoBloqueado(id, async tx => {
      await tx.$executeRaw`
      UPDATE labs_externos_pedidos
      SET is_retrabalho = true, motivo_retrabalho = ${motivo.trim()}, updated_at = NOW()
      WHERE id = ${id}
    `
      return { success: true }
    })
    if (resultado.success) revalidarLabs()
    return resultado
  } catch (e) {
    console.error('Erro ao registrar retrabalho:', e)
    return erro('Não foi possível registrar o retrabalho.')
  }
}

// Permite corrigir um retrabalho marcado por engano.
export async function desmarcarRetrabalho(id: number): Promise<ResultadoAcao> {
  await requireUser()
  try {
    const resultado = await alterarPedidoBloqueado(id, async tx => {
      await tx.$executeRaw`
      UPDATE labs_externos_pedidos
      SET is_retrabalho = false, motivo_retrabalho = NULL, updated_at = NOW()
      WHERE id = ${id}
    `
      return { success: true }
    })
    if (resultado.success) revalidarLabs()
    return resultado
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
    const resultado = await alterarPedidoBloqueado(id, async (tx, atual) => {
      if (atual.ordem_id && (
        (alteracoes.labId !== undefined && alteracoes.labId !== Number(atual.lab_id)) ||
        (alteracoes.dataEnvio !== undefined && alteracoes.dataEnvio !== (paraIso(atual.data_envio) ?? '')) ||
        (alteracoes.prazo !== undefined && alteracoes.prazo !== (paraIso(atual.prazo) ?? ''))
      )) return erro('Laboratório e datas do envio vinculado são definidos pela Produção.')
      const erroSituacao = validarSituacaoVinculada(atual, alteracoes.situacao ?? atual.situacao)
      if (erroSituacao) return erro(erroSituacao)

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
      const retorno = alteracoes.situacao === undefined ? paraIso(atual.data_retorno) : dataRetornoPara(situacao, paraIso(atual.data_retorno), hojeIso())
      const labId = lab ? lab.id : atual.lab_id
      const labNome = lab ? lab.nome : atual.lab_nome

      await tx.$executeRaw`
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
      return { success: true }
    })
    if (resultado.success) revalidarLabs()
    return resultado
  } catch (e) {
    console.error('Erro ao atualizar pedido de laboratório externo:', e)
    return erro('Não foi possível salvar o pedido.')
  }
}

export async function excluirPedido(id: number): Promise<ResultadoAcao> {
  await requireUser()
  if (!Number.isSafeInteger(id) || id <= 0) return erro('Pedido inválido.')
  // Legacy endpoint: keep authenticated callers safe until audited, reversible
  // archival and reconciliation checks exist. Never physically delete orders.
  return erro('Exclusão indisponível: o cancelamento seguro exige histórico e conferência financeira e de estoque. Nenhum pedido foi removido.')
}

function normalizar(row: LabExternoPedidoRow): LabExternoPedido {
  return {
    id:               Number(row.id),
    revisao:          row.revisao,
    arquivoVersao:    0,
    arquivado:        false,
    ordemId:          row.ordem_id ?? null,
    fornecedorConfirmadoEm: row.fornecedor_confirmado_em ?? null,
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
