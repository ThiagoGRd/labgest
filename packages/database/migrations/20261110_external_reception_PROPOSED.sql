-- PROPOSTA NÃO APLICADA. Revisar privilégios e testar em PostgreSQL descartável antes de ativar.
-- Não altera pedidos existentes, financeiro, estoque ou ordens. Sem backfill de custódia.
BEGIN;
CREATE SCHEMA IF NOT EXISTS labgest_private;
CREATE TABLE IF NOT EXISTS labgest_private.external_reception_capability (
  id integer PRIMARY KEY CHECK (id = 1),
  schema_version integer NOT NULL CHECK (schema_version = 1),
  enabled boolean NOT NULL DEFAULT false
);
INSERT INTO labgest_private.external_reception_capability(id, schema_version, enabled)
VALUES (1, 1, false) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS labgest_private.external_reception_state (
  pedido_id bigint PRIMARY KEY REFERENCES public.labs_externos_pedidos(id) ON DELETE RESTRICT,
  situacao text NOT NULL CHECK (situacao IN ('aguardando_distribuicao','com_dentista','aguardando_envio_laboratorio','em_transito_laboratorio')),
  version integer NOT NULL CHECK (version > 0),
  dentista varchar(255),
  finalidade text CHECK (finalidade IN ('prova','instalacao','entrega')),
  movimentado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (situacao <> 'com_dentista' OR (dentista IS NOT NULL AND btrim(dentista) <> '' AND finalidade IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS labgest_private.external_reception_event (
  id bigserial PRIMARY KEY,
  pedido_id bigint NOT NULL REFERENCES public.labs_externos_pedidos(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  acao text NOT NULL CHECK (acao IN ('receber','distribuir','receber_retorno','enviar_retorno')),
  actor_id integer NOT NULL,
  actor_name text NOT NULL,
  anterior jsonb,
  seguinte jsonb NOT NULL,
  motivo varchar(500),
  ocorrido_em timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(pedido_id, version)
);
REVOKE ALL ON labgest_private.external_reception_capability, labgest_private.external_reception_state, labgest_private.external_reception_event FROM PUBLIC;
REVOKE ALL ON SEQUENCE labgest_private.external_reception_event_id_seq FROM PUBLIC;
-- Remove any inherited default grants to web-facing roles, only on these new objects.
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON labgest_private.external_reception_capability, labgest_private.external_reception_state, labgest_private.external_reception_event FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE labgest_private.external_reception_event_id_seq FROM %I', r);
    END IF;
  END LOOP;
END $$;
ALTER TABLE labgest_private.external_reception_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_reception_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE labgest_private.external_reception_event ENABLE ROW LEVEL SECURITY;
-- No policies, no public grants, no activation. Review the actual server-side runtime role
-- and grant only its required access under separately authorized deployment procedure.
COMMIT;
