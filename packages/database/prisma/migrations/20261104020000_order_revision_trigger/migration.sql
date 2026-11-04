-- Local preparation only. Requires separately authorized production rollout.
-- Do not replace public.update_updated_at_column(): clientes also uses it.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.ordens IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE legacy_function oid;
BEGIN
  SELECT tgfoid INTO legacy_function FROM pg_catalog.pg_trigger
  WHERE tgrelid = 'public.ordens'::regclass
    AND tgname = 'update_ordens_updated_at' AND NOT tgisinternal
    AND tgtype = 19 AND tgenabled = 'O' AND tgqual IS NULL
    AND tgnargs = 0 AND tgattr::text = '';
  IF legacy_function IS NULL OR legacy_function IS DISTINCT FROM pg_catalog.to_regprocedure('public.update_updated_at_column()') THEN
    RAISE EXCEPTION 'Unexpected legacy order trigger; inspect before migration';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid = p.prolang
    WHERE p.oid = legacy_function AND l.lanname = 'plpgsql'
      AND pg_catalog.lower(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g')) = 'beginnew.updated_at=current_timestamp;returnnew;end;'
  ) THEN
    RAISE EXCEPTION 'Unexpected legacy order trigger function body; inspect before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid = 'public.ordens'::regclass
      AND NOT tgisinternal AND tgname <> 'update_ordens_updated_at'
      AND (tgtype & 2) = 2 AND (tgtype & 16) = 16
  ) THEN
    RAISE EXCEPTION 'Additional BEFORE UPDATE order trigger requires review';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid = 'public.ordens'::regclass
      AND attname = 'updated_at' AND NOT attisdropped
      AND atttypid = 'timestamp without time zone'::regtype AND atttypmod = 6
  ) THEN
    RAISE EXCEPTION 'Expected ordens.updated_at timestamp(6) without time zone';
  END IF;
END $$;

CREATE FUNCTION public.labgest_ordens_monotonic_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF (OLD.updated_at IS NOT NULL AND NOT pg_catalog.isfinite(OLD.updated_at))
    OR (NEW.updated_at IS NOT NULL AND NOT pg_catalog.isfinite(NEW.updated_at)) THEN
    RAISE EXCEPTION 'Order revision must be finite';
  END IF;
  -- timestamp(6) is an explicit UTC carrier. CURRENT_TIMESTAMP is transaction
  -- start time, and can predate a lock holder's commit. Use the execution clock.
  -- One full millisecond above OLD is distinct after Prisma/JavaScript truncation.
  NEW.updated_at := GREATEST(
    NEW.updated_at,
    pg_catalog.date_trunc('milliseconds', OLD.updated_at) + INTERVAL '1 millisecond',
    pg_catalog.date_trunc('milliseconds', pg_catalog.clock_timestamp() AT TIME ZONE 'UTC')
  );
  RETURN NEW;
END $$;

DROP TRIGGER update_ordens_updated_at ON public.ordens;
CREATE TRIGGER update_ordens_updated_at BEFORE UPDATE ON public.ordens
FOR EACH ROW EXECUTE FUNCTION public.labgest_ordens_monotonic_updated_at();
-- Existing AFTER INSERT/UPDATE/DELETE aggregate triggers are deliberately untouched.
COMMIT;
