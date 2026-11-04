-- PREPARED MIGRATION FOR REVIEW ONLY. NOT EXECUTED BY THIS TASK.
-- Run only after explicit future migration authorization and local PostgreSQL tests.
-- Uses the existing trusted server DB role; CURRENT_USER is the migration owner.
-- If the application's existing DB role differs, explicitly grant/policy that
-- verified role before activation. Do not substitute PUBLIC/anon/authenticated.
BEGIN;

-- Separate state preserves the four existing clinical situations, including Entregue.
CREATE SCHEMA IF NOT EXISTS labgest_private;
REVOKE ALL ON SCHEMA labgest_private FROM PUBLIC, anon, authenticated;
CREATE TABLE labgest_private.external_order_archive (
  pedido_id integer PRIMARY KEY REFERENCES public.labs_externos_pedidos(id) ON DELETE RESTRICT,
  archived boolean NOT NULL,
  version integer NOT NULL CHECK (version > 0),
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
  version integer NOT NULL CHECK (version > 0),
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
REVOKE ALL ON TABLE labgest_private.external_order_archive, labgest_private.external_order_archive_event FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE labgest_private.external_order_archive_event_id_seq FROM PUBLIC, anon, authenticated;
ALTER TABLE labgest_private.external_order_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive FORCE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive_event FORCE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA labgest_private TO CURRENT_USER;
GRANT SELECT, INSERT, UPDATE ON labgest_private.external_order_archive TO CURRENT_USER;
GRANT SELECT, INSERT ON labgest_private.external_order_archive_event TO CURRENT_USER;
GRANT USAGE ON SEQUENCE labgest_private.external_order_archive_event_id_seq TO CURRENT_USER;
CREATE POLICY archive_owner ON labgest_private.external_order_archive TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY archive_event_read ON labgest_private.external_order_archive_event FOR SELECT TO CURRENT_USER USING (true);
CREATE POLICY archive_event_append ON labgest_private.external_order_archive_event FOR INSERT TO CURRENT_USER WITH CHECK (true);
-- No new public RPC or anonymous privileges. Audit mutations are prohibited below.

CREATE FUNCTION labgest_private.reject_archive_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'External order archive history is append-only';
END $$;
CREATE TRIGGER external_order_archive_event_immutable
BEFORE UPDATE OR DELETE ON labgest_private.external_order_archive_event
FOR EACH ROW EXECUTE FUNCTION labgest_private.reject_archive_event_mutation();
CREATE TRIGGER external_order_archive_event_no_truncate
BEFORE TRUNCATE ON labgest_private.external_order_archive_event
FOR EACH STATEMENT EXECUTE FUNCTION labgest_private.reject_archive_event_mutation();
REVOKE ALL ON FUNCTION labgest_private.reject_archive_event_mutation() FROM PUBLIC, anon, authenticated;


-- Protect an archived business row even from older application versions. This is
-- a private trigger function, not a public callable SECURITY DEFINER endpoint.
-- It runs under the reviewed migration owner's access, with a fixed search_path.
CREATE FUNCTION labgest_private.guard_archived_external_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM labgest_private.external_order_archive a WHERE a.pedido_id = OLD.id AND a.archived) THEN
    RAISE EXCEPTION 'Registro arquivado: restaure antes de editar' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION labgest_private.guard_archived_external_order() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_archived_external_order
BEFORE UPDATE OR DELETE ON public.labs_externos_pedidos
FOR EACH ROW EXECUTE FUNCTION labgest_private.guard_archived_external_order();

-- Exact original output columns/order/types retained from read-only pg_views.
CREATE OR REPLACE VIEW public.labs_externos_atrasados AS
SELECT p.id, p.lab_id, p.lab_nome, p.paciente, p.dentista, p.data_envio, p.prazo,
       p.data_retorno, p.situacao, p.servico, p.is_retrabalho, p.motivo_retrabalho,
       p.created_at, p.updated_at, (CURRENT_DATE - p.prazo) AS dias_atraso
FROM public.labs_externos_pedidos p
WHERE p.prazo IS NOT NULL AND p.prazo < CURRENT_DATE AND p.situacao::text <> 'Entregue'::text
  AND NOT EXISTS (SELECT 1 FROM labgest_private.external_order_archive a WHERE a.pedido_id = p.id AND a.archived);

CREATE OR REPLACE VIEW public.labs_externos_retrabalhos AS
SELECT p.id, p.lab_id, p.lab_nome, p.paciente, p.dentista, p.data_envio, p.prazo,
       p.data_retorno, p.situacao, p.servico, p.is_retrabalho, p.motivo_retrabalho,
       p.created_at, p.updated_at
FROM public.labs_externos_pedidos p
WHERE p.is_retrabalho = true
  AND NOT EXISTS (SELECT 1 FROM labgest_private.external_order_archive a WHERE a.pedido_id = p.id AND a.archived);

CREATE OR REPLACE VIEW public.labs_externos_dashboard AS
SELECT l.id AS lab_id, l.nome AS lab_nome,
 count(p.id) FILTER (WHERE p.situacao::text = 'Enviado'::text) AS total_enviados,
 count(p.id) FILTER (WHERE p.situacao::text = 'Provando'::text) AS total_provando,
 count(p.id) FILTER (WHERE p.situacao::text = 'Pronto'::text) AS total_prontos,
 count(p.id) FILTER (WHERE p.situacao::text = 'Entregue'::text) AS total_entregues,
 count(p.id) FILTER (WHERE p.prazo < CURRENT_DATE AND p.situacao::text <> 'Entregue'::text) AS total_atrasados,
 count(p.id) FILTER (WHERE p.is_retrabalho = true AND p.situacao::text <> 'Entregue'::text) AS total_retrabalhos
FROM public.labs_externos l
LEFT JOIN public.labs_externos_pedidos p ON p.lab_id = l.id
 AND NOT EXISTS (SELECT 1 FROM labgest_private.external_order_archive a WHERE a.pedido_id = p.id AND a.archived)
WHERE l.ativo = true GROUP BY l.id, l.nome;

-- Default-off capability. No application action may enable it.
CREATE TABLE labgest_private.external_order_archive_capability (
 id integer PRIMARY KEY CHECK (id = 1),
 schema_version integer NOT NULL CHECK (schema_version = 1),
 enabled boolean NOT NULL DEFAULT false
);
REVOKE ALL ON TABLE labgest_private.external_order_archive_capability FROM PUBLIC, anon, authenticated;
ALTER TABLE labgest_private.external_order_archive_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_order_archive_capability FORCE ROW LEVEL SECURITY;
CREATE POLICY archive_capability_owner ON labgest_private.external_order_archive_capability TO CURRENT_USER USING (true) WITH CHECK (true);
GRANT SELECT ON labgest_private.external_order_archive_capability TO CURRENT_USER;
INSERT INTO labgest_private.external_order_archive_capability VALUES (1, 1, false);
COMMIT;

-- Separate, explicitly authorized activation after reviewing role permissions,
-- testing RLS/views/rollback/concurrency on synthetic local data, and deploying
-- matching code. Not performed here:
-- UPDATE labgest_private.external_order_archive_capability SET enabled = true WHERE id = 1;
-- Disable by setting false; existing archived rows remain filtered/read-only.
-- Recovery restores records through audited server transactions; do not delete
-- audit/state tables or reverse this migration to unarchive records.
