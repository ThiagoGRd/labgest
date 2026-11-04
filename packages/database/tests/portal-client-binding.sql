-- Run only against a disposable database after applying the binding migration.
-- All fixtures roll back. No auth.users dependency and no real identity is used.
BEGIN;
DO $$
DECLARE
  client_id integer;
  other_client_id integer;
  rejected boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM labgest_private.portal_client_binding) THEN
    RAISE EXCEPTION 'Expected empty disposable binding table; refusing existing data';
  END IF;
  INSERT INTO public.clientes(nome, telefone, cro, ativo)
    VALUES ('Synthetic binding test', '000', 'TEST', true) RETURNING id INTO client_id;
  INSERT INTO labgest_private.portal_client_binding(auth_user_id, cliente_id, authorized_by)
    VALUES ('11111111-1111-4111-8111-111111111111', client_id, 'synthetic reviewer');
  -- Multiple explicitly approved identities may share a clinic.
  INSERT INTO labgest_private.portal_client_binding(auth_user_id, cliente_id, authorized_by)
    VALUES ('22222222-2222-4222-8222-222222222222', client_id, 'synthetic reviewer');
  INSERT INTO public.clientes(nome, telefone, cro, ativo)
    VALUES ('Other synthetic clinic', '000', 'TEST2', true) RETURNING id INTO other_client_id;
  rejected := false;
  BEGIN
    INSERT INTO labgest_private.portal_client_binding(auth_user_id, cliente_id, authorized_by)
      VALUES ('11111111-1111-4111-8111-111111111111', other_client_id, 'conflicting reviewer');
  EXCEPTION WHEN unique_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'UUID must have one binding'; END IF;
  IF (SELECT cliente_id FROM labgest_private.portal_client_binding WHERE auth_user_id = '11111111-1111-4111-8111-111111111111') <> client_id THEN
    RAISE EXCEPTION 'Conflicting assignment replaced the approved binding';
  END IF;
  rejected := false;
  BEGIN
    INSERT INTO labgest_private.portal_client_binding(auth_user_id, cliente_id, authorized_by)
      VALUES ('33333333-3333-4333-8333-333333333333', client_id, ' ');
  EXCEPTION WHEN check_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Reviewer required'; END IF;
  rejected := false;
  BEGIN
    DELETE FROM public.clientes WHERE id = client_id;
  EXCEPTION WHEN foreign_key_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'Bound clinic deletion must be restricted'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'labgest_private.portal_client_binding'::regclass) THEN
    RAISE EXCEPTION 'RLS must be enabled';
  END IF;
END $$;
ROLLBACK;
