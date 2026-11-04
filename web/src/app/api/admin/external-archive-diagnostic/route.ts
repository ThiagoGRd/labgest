import { prisma } from '@labgest/database'
import { requireAdmin } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
}

type TableDiagnostic = {
  name: string; exists: boolean; schema_usage: boolean | null
  owner: string | null; select: boolean | null; insert: boolean | null
  update: boolean | null; rls_active: boolean | null; rls_enabled: boolean | null
  rls_forced: boolean | null; sequence_usage: boolean | null
}

// Fixed metadata queries only. No request parameters, clinical rows, environment
// values, connection strings or raw database errors are included in the response.
// This reports evidence; it never approves or enables the archive capability.
export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: 'Acesso não autorizado.' }, { status: 403, headers })
  }
  try {
    const diagnostic = await prisma.$transaction(async tx => {
      // A transaction pins every query to the same actual runtime connection.
      const [identity] = await tx.$queryRaw<Array<{
        current_user: string; session_user: string; role_setting: string
        superuser: boolean; bypass_rls: boolean
      }>>`
        SELECT current_user::text AS current_user, session_user::text AS session_user,
          current_setting('role') AS role_setting,
          r.rolsuper AS superuser, r.rolbypassrls AS bypass_rls
        FROM pg_catalog.pg_roles r WHERE r.rolname = current_user
      `
      const tables = await tx.$queryRaw<TableDiagnostic[]>`
        SELECT wanted.name, c.oid IS NOT NULL AS exists,
          has_schema_privilege(current_user, n.oid, 'USAGE') AS schema_usage,
          pg_get_userbyid(c.relowner) AS owner,
          has_table_privilege(current_user, c.oid, 'SELECT') AS select,
          has_table_privilege(current_user, c.oid, 'INSERT') AS insert,
          has_table_privilege(current_user, c.oid, 'UPDATE') AS update,
          CASE WHEN c.oid IS NOT NULL THEN pg_catalog.row_security_active(c.oid) END AS rls_active,
          c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
          has_sequence_privilege(current_user, seq.oid, 'USAGE') AS sequence_usage
        FROM (VALUES ('external_order_archive'), ('external_order_archive_event'),
          ('external_order_archive_capability')) AS wanted(name)
        LEFT JOIN pg_catalog.pg_namespace n ON n.nspname = 'labgest_private'
        LEFT JOIN pg_catalog.pg_class c ON c.relnamespace = n.oid AND c.relname = wanted.name AND c.relkind = 'r'
        LEFT JOIN pg_catalog.pg_class seq ON seq.relnamespace = n.oid
          AND seq.relname = 'external_order_archive_event_id_seq' AND seq.relkind = 'S'
        ORDER BY wanted.name
      `
      const views = await tx.$queryRaw<Array<{
        name: string; exists: boolean; owner: string | null; security_invoker: boolean
        owner_superuser: boolean | null; owner_bypass_rls: boolean | null
        owner_state_select: boolean | null; owner_schema_usage: boolean | null
        owner_state_rls_applies: boolean | null
      }>>`
        SELECT wanted.name, v.oid IS NOT NULL AS exists, r.rolname::text AS owner,
          COALESCE('security_invoker=true' = ANY(v.reloptions), false) AS security_invoker,
          r.rolsuper AS owner_superuser, r.rolbypassrls AS owner_bypass_rls,
          has_table_privilege(r.oid, a.oid, 'SELECT') AS owner_state_select,
          has_schema_privilege(r.oid, private.oid, 'USAGE') AS owner_schema_usage,
          CASE WHEN a.oid IS NULL OR r.oid IS NULL THEN NULL
            ELSE a.relrowsecurity AND NOT (r.rolsuper OR r.rolbypassrls)
              AND (a.relforcerowsecurity OR NOT pg_has_role(r.oid, a.relowner, 'USAGE'))
          END AS owner_state_rls_applies
        FROM (VALUES ('labs_externos_atrasados'), ('labs_externos_retrabalhos'),
          ('labs_externos_dashboard')) AS wanted(name)
        LEFT JOIN pg_catalog.pg_namespace public_ns ON public_ns.nspname = 'public'
        LEFT JOIN pg_catalog.pg_class v ON v.relnamespace = public_ns.oid AND v.relname = wanted.name AND v.relkind = 'v'
        LEFT JOIN pg_catalog.pg_roles r ON r.oid = v.relowner
        LEFT JOIN pg_catalog.pg_namespace private ON private.nspname = 'labgest_private'
        LEFT JOIN pg_catalog.pg_class a ON a.relnamespace = private.oid AND a.relname = 'external_order_archive' AND a.relkind = 'r'
        ORDER BY wanted.name
      `
      const count = tables.filter(t => t.exists).length
      const schema = count === 0 ? 'absent' : count === 3 ? 'installed' : 'partial'
      const capability = tables.find(t => t.name === 'external_order_archive_capability')
      // Missing or inaccessible storage is reported, never queried speculatively.
      const markers = capability?.exists && capability.schema_usage && capability.select
        ? await tx.$queryRaw<Array<{ schema_version: number; enabled: boolean }>>`
            SELECT schema_version, enabled FROM labgest_private.external_order_archive_capability
            WHERE id = 1 LIMIT 1
          `
        : []
      const state = tables.find(t => t.name === 'external_order_archive')
      const event = tables.find(t => t.name === 'external_order_archive_event')
      // Matches the capability helper's ACL expression, independently of enabled.
      const permitted = state?.select === true && state.insert === true && state.update === true
        && event?.select === true && event.insert === true && event.sequence_usage === true
      const full_visibility = tables.length === 3 && tables.every(t => t.exists && t.rls_active === false)
      const marker = markers[0] ?? null
      const marker_valid = marker?.schema_version === 1 && typeof marker.enabled === 'boolean'
      return { runtime: identity, schema, tables, views, marker, marker_valid, permitted, full_visibility }
    })
    return Response.json(diagnostic, { headers })
  } catch {
    return Response.json({ error: 'Diagnóstico indisponível.' }, { status: 503, headers })
  }
}
