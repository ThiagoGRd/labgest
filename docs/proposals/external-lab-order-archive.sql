-- DRAFT ONLY. Not in prisma/migrations; not applied by this task.
-- Deliberately fail closed: review the accompanying design and supply the three
-- exact live view definitions/role grants before producing a deployable migration.
BEGIN;
DO $$ BEGIN
  RAISE EXCEPTION 'Draft only: view filtering, writer permissions and reconciliation workflow require review';
END $$;

-- Separate state preserves the four existing clinical situations, including Entregue.
CREATE SCHEMA IF NOT EXISTS labgest_private;
REVOKE ALL ON SCHEMA labgest_private FROM PUBLIC, anon, authenticated;
CREATE TABLE labgest_private.external_order_archive (
  pedido_id integer PRIMARY KEY REFERENCES public.labs_externos_pedidos(id) ON DELETE RESTRICT,
  archived boolean NOT NULL,
  version bigint NOT NULL CHECK (version > 0),
  changed_at timestamptz NOT NULL DEFAULT now(),
  actor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 2000),
  reconciliation_review jsonb NOT NULL CHECK (
    jsonb_typeof(reconciliation_review) = 'object'
    AND reconciliation_review @> '{"financial":"clear","stock":"clear","externalCommitment":"clear"}'::jsonb
  )
);
CREATE TABLE labgest_private.external_order_archive_event (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pedido_id integer NOT NULL REFERENCES public.labs_externos_pedidos(id) ON DELETE RESTRICT,
  version bigint NOT NULL CHECK (version > 0),
  action text NOT NULL CHECK (action IN ('archive', 'restore')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  actor_name text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 2000),
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  reconciliation_review jsonb NOT NULL CHECK (
    jsonb_typeof(reconciliation_review) = 'object'
    AND reconciliation_review @> '{"financial":"clear","stock":"clear","externalCommitment":"clear"}'::jsonb
  ),
  UNIQUE (pedido_id, version)
);
REVOKE ALL ON ALL TABLES IN SCHEMA labgest_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA labgest_private FROM PUBLIC, anon, authenticated;
ALTER TABLE labgest_private.external_order_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive FORCE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive_event FORCE ROW LEVEL SECURITY;
-- Intentionally no policies/grants yet: use a verified restricted server role.
-- State: SELECT/INSERT/UPDATE only; events: SELECT/INSERT only, never UPDATE/DELETE.
-- No public SECURITY DEFINER RPC. Server and DB permissions both required.

CREATE FUNCTION labgest_private.reject_archive_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'External order archive history is append-only';
END $$;
CREATE TRIGGER external_order_archive_event_immutable
BEFORE UPDATE OR DELETE ON labgest_private.external_order_archive_event
FOR EACH ROW EXECUTE FUNCTION labgest_private.reject_archive_event_mutation();
REVOKE ALL ON FUNCTION labgest_private.reject_archive_event_mutation() FROM PUBLIC, anon, authenticated;

-- REQUIRED BEFORE RELEASE (not guessable from a Prisma schema):
-- 1. Replace all three live views with the exact original output columns/order:
--    labs_externos_atrasados, labs_externos_retrabalhos, labs_externos_dashboard.
--    Filter NOT EXISTS (SELECT 1 FROM labgest_private.external_order_archive a
--      WHERE a.pedido_id = p.id AND a.archived).
--    For dashboard put the predicate in LEFT JOIN ... ON, never WHERE, so active
--    labs with no remaining orders retain zero counts. Preserve retrabalho semantics.
-- 2. Verify view-owner/consumer permissions do not expose private audit contents.
-- 3. Every app query uses the same predicate, archived list is separate/read-only.
-- 4. Guard edits/status/rework changes of archived rows at the DB and app layers.
-- 5. Add restricted server-role grants/policies; deny anonymous archive operations.
-- 6. Apply and exercise on a disposable local PostgreSQL DB with synthetic data.
ROLLBACK;
