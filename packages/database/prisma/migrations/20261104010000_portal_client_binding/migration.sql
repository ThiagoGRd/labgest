-- No email-based backfill. Every assignment requires separately reviewed authorization.
CREATE SCHEMA IF NOT EXISTS labgest_private;
REVOKE ALL ON SCHEMA labgest_private FROM PUBLIC;
CREATE TABLE labgest_private.portal_client_binding (
  auth_user_id uuid PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  authorized_by text NOT NULL CHECK (length(btrim(authorized_by)) > 0),
  authorized_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX portal_client_binding_cliente_idx ON labgest_private.portal_client_binding(cliente_id);
REVOKE ALL ON TABLE labgest_private.portal_client_binding FROM PUBLIC;
ALTER TABLE labgest_private.portal_client_binding ENABLE ROW LEVEL SECURITY;
-- No public policies. The private server DB role needs SELECT (and RLS access);
-- the distinct provisioning role alone receives INSERT/DELETE/UPDATE privileges.
