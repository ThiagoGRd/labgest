// Server-side transaction logic. No database client or environment is loaded here.
export interface ArchiveQuery {
  $queryRaw<T = unknown>(sql: TemplateStringsArray, ...values: unknown[]): Promise<T>
  $executeRaw(sql: TemplateStringsArray, ...values: unknown[]): Promise<number>
}
export interface ArchiveDatabase extends ArchiveQuery {
  $transaction<T>(fn: (tx: ArchiveQuery) => Promise<T>): Promise<T>
}
export interface ArchiveState { pedido_id: number; archived: boolean; version: number }
export interface ArchiveInput {
  id: number
  action: 'archive' | 'restore'
  expectedRevision: string
  expectedVersion: number
  reason: string
  confirmed: boolean
  review: { financial: string; stock: string; externalCommitment: string }
}
export interface ArchiveEvent {
  id: string
  action: 'archive' | 'restore'
  version: number
  occurred_at: Date
  actor_name: string
  reason: string
  snapshot: Record<string, unknown>
  reconciliation_review: ArchiveInput['review']
}

export async function capacidadeArquivamento(db: ArchiveQuery) {
  const [schema] = await db.$queryRaw<Array<{ installed: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'labgest_private' AND c.relname IN ('external_order_archive_capability', 'external_order_archive', 'external_order_archive_event')
    ) AS installed
  `
  if (!schema?.installed) return { installed: false, enabled: false }
  // Permission errors/partial migrations propagate: never silently show archived
  // data as active after the storage has been installed.
  const [capability] = await db.$queryRaw<Array<{ schema_version: number; enabled: boolean; permitted: boolean }>>`
    SELECT schema_version, enabled,
      (has_table_privilege(current_user, 'labgest_private.external_order_archive', 'SELECT')
       AND has_table_privilege(current_user, 'labgest_private.external_order_archive', 'INSERT')
       AND has_table_privilege(current_user, 'labgest_private.external_order_archive', 'UPDATE')
       AND has_table_privilege(current_user, 'labgest_private.external_order_archive_event', 'SELECT')
       AND has_table_privilege(current_user, 'labgest_private.external_order_archive_event', 'INSERT')
       AND has_sequence_privilege(current_user, 'labgest_private.external_order_archive_event_id_seq', 'USAGE')) AS permitted
    FROM labgest_private.external_order_archive_capability WHERE id = 1
  `
  return { installed: true, enabled: capability?.schema_version === 1 && capability.enabled && capability.permitted }
}

export async function estadosArquivamento(db: ArchiveQuery) {
  const capability = await capacidadeArquivamento(db)
  const states = capability.installed
    ? await db.$queryRaw<ArchiveState[]>`SELECT pedido_id, archived, version FROM labgest_private.external_order_archive`
    : []
  return { ...capability, states }
}

export async function alterarArquivamento(db: ArchiveDatabase, input: ArchiveInput, actor: { id: number; nome: string }) {
  if (!input || !Number.isSafeInteger(input.id) || input.id <= 0
      || !['archive', 'restore'].includes(input.action)
      || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0
      || typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{32}$/.test(input.expectedRevision)
      || typeof input.reason !== 'string' || input.reason.trim().length < 5 || input.reason.trim().length > 2000
      || input.confirmed !== true) throw new Error('Confirme o registro e informe um motivo de 5 a 2000 caracteres.')
  if (!input.review || input.review.financial !== 'clear' || input.review.stock !== 'clear'
      || input.review.externalCommitment !== 'clear') {
    throw new Error('Conclua a conferência: pendências financeiras, de estoque ou com o laboratório impedem esta ação.')
  }
  return db.$transaction(async tx => {
    if (!(await capacidadeArquivamento(tx)).enabled) throw new Error('Arquivamento seguro indisponível. Nenhum registro foi alterado.')
    // Hash is computed from the full PostgreSQL row, including microseconds.
    // Never compare a timestamp converted through a JavaScript Date.
    const [order] = await tx.$queryRaw<Array<{ snapshot: Record<string, unknown>; revisao: string }>>`
      SELECT to_jsonb(p) AS snapshot, md5(to_jsonb(p)::text) AS revisao
      FROM public.labs_externos_pedidos p WHERE p.id = ${input.id} FOR UPDATE
    `
    if (!order) throw new Error('Pedido não encontrado.')
    const [previous] = await tx.$queryRaw<ArchiveState[]>`
      SELECT pedido_id, archived, version FROM labgest_private.external_order_archive WHERE pedido_id = ${input.id}
    `
    const archived = input.action === 'archive'
    const version = previous?.version ?? 0
    if (order.revisao !== input.expectedRevision) throw new Error('O registro foi alterado. Atualize a página e confira novamente.')
    // A replay of the last successful operation is a no-op. Older intents may
    // not override a subsequent restore/archive, even if their desired state matches.
    if (previous?.archived === archived && (input.expectedVersion === version || input.expectedVersion === version - 1)) {
      return { changed: false }
    }
    if (version !== input.expectedVersion) throw new Error('O arquivamento foi alterado. Atualize a página e confira novamente.')
    if (!previous && !archived) throw new Error('Este registro não está arquivado.')
    const nextVersion = version + 1
    const reason = input.reason.trim()
    const review = JSON.stringify(input.review)
    await tx.$executeRaw`
      INSERT INTO labgest_private.external_order_archive
        (pedido_id, archived, version, actor_id, reason, reconciliation_review)
      VALUES (${input.id}, ${archived}, ${nextVersion}, ${actor.id}, ${reason}, ${review}::jsonb)
      ON CONFLICT (pedido_id) DO UPDATE SET archived = EXCLUDED.archived, version = EXCLUDED.version,
        actor_id = EXCLUDED.actor_id, reason = EXCLUDED.reason,
        reconciliation_review = EXCLUDED.reconciliation_review, changed_at = now()
    `
    await tx.$executeRaw`
      INSERT INTO labgest_private.external_order_archive_event
        (pedido_id, version, action, actor_id, actor_name, reason, snapshot, reconciliation_review)
      VALUES (${input.id}, ${nextVersion}, ${input.action}, ${actor.id}, ${actor.nome}, ${reason},
        ${JSON.stringify(order.snapshot)}::jsonb, ${review}::jsonb)
    `
    return { changed: true }
  })
}
