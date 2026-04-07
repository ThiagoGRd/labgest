'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'

export type SituacaoPedido = 'Enviado' | 'Provando' | 'Pronto' | 'Entregue'

export interface LabExternoPedido {
  id: number
  labId: number | null
  labNome: string
  paciente: string
  dentista: string | null
  dataEnvio: Date | null
  prazo: Date | null
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

export async function getPedidosLabExterno(labId?: number) {
  await requireUser()

  if (labId) {
    const pedidos = await prisma.$queryRaw<any[]>`
      SELECT
        p.*,
        CASE
          WHEN p.prazo IS NOT NULL AND p.prazo < CURRENT_DATE AND p.situacao != 'Entregue'
          THEN (CURRENT_DATE - p.prazo)::int
          ELSE NULL
        END AS dias_atraso
      FROM labs_externos_pedidos p
      WHERE p.lab_id = ${labId}
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

  const pedidos = await prisma.$queryRaw<any[]>`
    SELECT
      p.*,
      CASE
        WHEN p.prazo IS NOT NULL AND p.prazo < CURRENT_DATE AND p.situacao != 'Entregue'
        THEN (CURRENT_DATE - p.prazo)::int
        ELSE NULL
      END AS dias_atraso
    FROM labs_externos_pedidos p
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
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      *,
      (CURRENT_DATE - prazo)::int AS dias_atraso
    FROM labs_externos_pedidos
    WHERE prazo IS NOT NULL AND prazo < CURRENT_DATE AND situacao != 'Entregue'
    ORDER BY dias_atraso DESC
  `
  return rows.map(normalizar)
}

export async function getRetrabalhos() {
  await requireUser()
  const rows = await prisma.$queryRaw<any[]>`
    SELECT * FROM labs_externos_pedidos
    WHERE is_retrabalho = true AND situacao != 'Entregue'
    ORDER BY created_at DESC
  `
  return rows.map(normalizar)
}

export async function getDashboardLabsExternos() {
  await requireUser()
  // Cast bigint to int to avoid JSON serialization issues
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      COUNT(*) FILTER (WHERE situacao = 'Enviado')::int   AS total_enviados,
      COUNT(*) FILTER (WHERE situacao = 'Provando')::int   AS total_provando,
      COUNT(*) FILTER (WHERE situacao = 'Pronto')::int    AS total_prontos,
      COUNT(*) FILTER (WHERE situacao = 'Entregue')::int  AS total_entregues,
      COUNT(*) FILTER (WHERE prazo IS NOT NULL AND prazo < CURRENT_DATE AND situacao != 'Entregue')::int  AS total_atrasados,
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

export async function criarPedido(data: {
  labId: number
  labNome: string
  paciente: string
  dentista?: string
  dataEnvio?: string
  prazo?: string
  servico?: string
}) {
  await requireUser()
  await prisma.$executeRaw`
    INSERT INTO labs_externos_pedidos
      (lab_id, lab_nome, paciente, dentista, data_envio, prazo, servico, situacao)
    VALUES
      (${data.labId}, ${data.labNome}, ${data.paciente},
       ${data.dentista ?? null},
       ${data.dataEnvio ? new Date(data.dataEnvio) : null},
       ${data.prazo ? new Date(data.prazo) : null},
       ${data.servico ?? null},
       'Enviado')
  `
  revalidatePath('/labs-externos')
}

export async function atualizarSituacao(id: number, situacao: SituacaoPedido) {
  await requireUser()
  await prisma.$executeRaw`
    UPDATE labs_externos_pedidos
    SET situacao = ${situacao}, updated_at = NOW()
    WHERE id = ${id}
  `
  revalidatePath('/labs-externos')
}

export async function marcarRetrabalho(id: number, motivo: string) {
  await requireUser()
  await prisma.$executeRaw`
    UPDATE labs_externos_pedidos
    SET is_retrabalho = true, motivo_retrabalho = ${motivo}, updated_at = NOW()
    WHERE id = ${id}
  `
  revalidatePath('/labs-externos')
}

export async function atualizarPedido(id: number, data: {
  paciente?: string
  dentista?: string
  dataEnvio?: string
  prazo?: string
  servico?: string
  situacao?: SituacaoPedido
}) {
  await requireUser()
  await prisma.$executeRaw`
    UPDATE labs_externos_pedidos SET
      paciente    = COALESCE(${data.paciente ?? null}, paciente),
      dentista    = COALESCE(${data.dentista ?? null}, dentista),
      data_envio  = COALESCE(${data.dataEnvio ? new Date(data.dataEnvio) : null}, data_envio),
      prazo       = COALESCE(${data.prazo ? new Date(data.prazo) : null}, prazo),
      servico     = COALESCE(${data.servico ?? null}, servico),
      situacao    = COALESCE(${data.situacao ?? null}, situacao),
      updated_at  = NOW()
    WHERE id = ${id}
  `
  revalidatePath('/labs-externos')
}

export async function excluirPedido(id: number) {
  await requireUser()
  await prisma.$executeRaw`
    DELETE FROM labs_externos_pedidos WHERE id = ${id}
  `
  revalidatePath('/labs-externos')
}

function normalizar(row: any): LabExternoPedido {
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
