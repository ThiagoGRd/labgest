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
-- CREATE TABLE can inherit arbitrary non-owner ACLs from ALTER DEFAULT
-- PRIVILEGES. RLS alone cannot stop TRUNCATE. Remove every such grantee,
-- including group roles inherited by browser roles, without changing global
-- defaults or any other table. Preserve only the table owner's privileges.
DO $$
DECLARE
  grant_rec record;
BEGIN
  FOR grant_rec IN
    SELECT DISTINCT acl.grantee
    FROM pg_class relation
    CROSS JOIN LATERAL aclexplode(COALESCE(relation.relacl, acldefault('r', relation.relowner))) acl
    WHERE relation.oid = 'labgest_private.portal_client_binding'::regclass
      AND acl.grantee <> relation.relowner
  LOOP
    IF grant_rec.grantee = 0 THEN
      REVOKE ALL PRIVILEGES ON TABLE labgest_private.portal_client_binding FROM PUBLIC CASCADE;
    ELSE
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE labgest_private.portal_client_binding FROM %I CASCADE',
        pg_get_userbyid(grant_rec.grantee)
      );
    END IF;
  END LOOP;
END $$;
ALTER TABLE labgest_private.portal_client_binding ENABLE ROW LEVEL SECURITY;
-- No public policies. The private server DB role needs SELECT (and RLS access);
-- the distinct provisioning role alone receives INSERT/DELETE/UPDATE privileges.
