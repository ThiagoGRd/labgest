import { transicionarExterno, estadoInicialExterno, type CustodiaExterna, type MovimentoExterno } from './recepcao-externa'
import { estadosArquivamento, type ArchiveQuery, type ArchiveDatabase } from './labs-externos-arquivo'

export interface ComandoCustodiaExterna extends MovimentoExterno {
  origem: 'externo'
  id: number
  expectedRevision: string
}
export interface LinhaExterna {
  id: number; lab_nome: string; paciente: string; dentista_pedido: string | null
  servico: string | null; prazo: Date | null; situacao_pedido: string; revisao: string
  situacao: CustodiaExterna['situacao'] | null; version: number | null
  dentista: string | null; finalidade: CustodiaExterna['finalidade']; movimentado_em: Date | null
}
export async function capacidadeRecepcaoExterna(db: ArchiveQuery) {
  const [tables] = await db.$queryRaw<Array<{ count: number }>>`
    SELECT count(*)::int AS count FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'labgest_private' AND c.relkind = 'r'
      AND c.relname IN ('external_reception_capability', 'external_reception_state', 'external_reception_event')
  `
  if (tables?.count !== 3) return false
  const rows = await db.$queryRaw<Array<{ schema_version: number; enabled: boolean; permitted: boolean; full_visibility: boolean }>>`
    SELECT schema_version, enabled,
      (NOT pg_catalog.row_security_active('public.labs_externos_pedidos'::regclass)
       AND NOT pg_catalog.row_security_active('labgest_private.external_reception_capability'::regclass)
       AND NOT pg_catalog.row_security_active('labgest_private.external_reception_state'::regclass)
       AND NOT pg_catalog.row_security_active('labgest_private.external_reception_event'::regclass)) AS full_visibility,
      (has_table_privilege(current_user, 'public.labs_externos_pedidos', 'SELECT')
       AND has_table_privilege(current_user, 'public.labs_externos_pedidos', 'UPDATE')
       AND has_table_privilege(current_user, 'labgest_private.external_reception_state', 'SELECT')
       AND has_table_privilege(current_user, 'labgest_private.external_reception_state', 'INSERT')
       AND has_table_privilege(current_user, 'labgest_private.external_reception_state', 'UPDATE')
       AND has_table_privilege(current_user, 'labgest_private.external_reception_event', 'INSERT')
       AND has_sequence_privilege(current_user, 'labgest_private.external_reception_event_id_seq', 'USAGE')) AS permitted
    FROM labgest_private.external_reception_capability WHERE id = 1
  `
  return rows.length === 1 && rows[0].schema_version === 1 && rows[0].enabled === true
    && rows[0].permitted === true && rows[0].full_visibility === true
}
export async function consultarCustodiaExterna(db: ArchiveQuery) {
  if (!await capacidadeRecepcaoExterna(db)) return { disponivel: false, itens: [] as LinhaExterna[] }
  const archive = await estadosArquivamento(db)
  const archived = new Set(archive.states.filter(s => s.archived).map(s => Number(s.pedido_id)))
  const rows = await db.$queryRaw<LinhaExterna[]>`
    SELECT p.id, p.lab_nome, p.paciente, p.dentista AS dentista_pedido, p.servico, p.prazo,
      p.situacao AS situacao_pedido, md5(to_jsonb(p)::text) AS revisao,
      s.situacao, s.version, s.dentista, s.finalidade, s.movimentado_em
    FROM public.labs_externos_pedidos p
    LEFT JOIN labgest_private.external_reception_state s ON s.pedido_id = p.id
    WHERE p.situacao IN ('Enviado', 'Provando', 'Pronto')
    ORDER BY p.prazo ASC NULLS LAST, p.id
  `
  return { disponivel: true, itens: rows.filter(p => !archived.has(Number(p.id))) }
}
export async function movimentarCustodiaExterna(db: ArchiveDatabase, input: ComandoCustodiaExterna, actor: { id: number; nome: string }) {
  if (!input || input.origem !== 'externo' || !Number.isSafeInteger(input.id) || input.id <= 0
      || typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{32}$/.test(input.expectedRevision)
      || !Number.isSafeInteger(actor.id) || actor.id <= 0) throw new Error('Comando externo inválido.')
  return db.$transaction(async tx => {
    if (!await capacidadeRecepcaoExterna(tx)) throw new Error('Recepção externa indisponível.')
    // Same parent row lock as external order edits/archive. No writes to that row.
    const [order] = await tx.$queryRaw<Array<{ situacao: string; revisao: string }>>`
      SELECT p.situacao, md5(to_jsonb(p)::text) AS revisao
      FROM public.labs_externos_pedidos p WHERE p.id = ${input.id} FOR UPDATE
    `
    if (!order) throw new Error('Pedido não encontrado.')
    if (order.revisao !== input.expectedRevision) throw new Error('O pedido foi alterado. Atualize a página.')
    if (order.situacao === 'Entregue') throw new Error('Pedido encerrado.')
    const archive = await estadosArquivamento(tx)
    if (!estadoInicialExterno(order.situacao, archive.states.some(s => Number(s.pedido_id) === input.id && s.archived))) throw new Error('Pedido encerrado ou arquivado.')
    const [previous] = await tx.$queryRaw<CustodiaExterna[]>`
      SELECT situacao, version, dentista, finalidade FROM labgest_private.external_reception_state WHERE pedido_id = ${input.id}
    `
    const next = transicionarExterno(previous ?? null, input)
    await tx.$executeRaw`
      INSERT INTO labgest_private.external_reception_state (pedido_id, situacao, version, dentista, finalidade, movimentado_em)
      VALUES (${input.id}, ${next.situacao}, ${next.version}, ${next.dentista}, ${next.finalidade}, clock_timestamp())
      ON CONFLICT (pedido_id) DO UPDATE SET situacao = EXCLUDED.situacao, version = EXCLUDED.version,
        dentista = EXCLUDED.dentista, finalidade = EXCLUDED.finalidade, movimentado_em = EXCLUDED.movimentado_em
    `
    await tx.$executeRaw`
      INSERT INTO labgest_private.external_reception_event
        (pedido_id, version, acao, actor_id, actor_name, anterior, seguinte, motivo)
      VALUES (${input.id}, ${next.version}, ${input.acao}, ${actor.id}, ${actor.nome},
        ${JSON.stringify(previous ?? null)}::jsonb, ${JSON.stringify(next)}::jsonb, ${input.motivo?.trim() || null})
    `
    return { success: true as const }
  })
}
