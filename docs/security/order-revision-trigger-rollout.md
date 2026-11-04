# Order revision trigger compatibility — local preparation

Baseline: pure `aee9fa1989f00d9628de5d1bdf83e46ca4c43eec`, previously validated by CI41876411981. This follow-up has **no remote publication, production migration, grants, or identity assignments**.

## Problem and contract

The legacy `update_ordens_updated_at` BEFORE UPDATE trigger executes the shared `public.update_updated_at_column()` body `BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;`. It overrides explicit application revisions. Transaction-start timestamps can repeat within one transaction or move backward after an older transaction waits for a newer lock holder.

The new dedicated invoker function only replaces the order trigger target. It chooses the greatest of the supplied revision, `date_trunc('milliseconds', OLD.updated_at) + interval '1 millisecond'`, and execution-time UTC clock truncated to milliseconds. Thus distinctness survives JavaScript/Prisma millisecond conversion even when the old SQL value has microseconds. NULL prior revisions initialize at the execution clock; nonfinite revisions fail without mutation. Newer explicit/future revisions remain valid. Automatic timestamps remain available to non-Prisma UPDATE writers. INSERT/default behavior and existing rows are not rewritten.

`ordens.updated_at` remains nullable `timestamp(6) without time zone`; the new UPDATE function treats it as a UTC carrier independent of session TimeZone. No historical timezone interpretation or backfill is attempted. The original shared function, `clientes` trigger and existing AFTER INSERT/UPDATE/DELETE aggregate trigger are untouched.

## Exact local test

```bash
NODE_PATH=<clean-pg-and-typescript-module-paths> node web/tests/order-revision-trigger-postgres.integration.cjs \
  postgresql://labgest_archive_test:synthetic-only@127.0.0.1:55433/labgest_order_trigger_test --legacy
# Expected exit 1: exact legacy trigger destroys the application's future revision.

NODE_PATH=<clean-pg-and-typescript-module-paths> node web/tests/order-revision-trigger-postgres.integration.cjs \
  postgresql://labgest_archive_test:synthetic-only@127.0.0.1:55433/labgest_order_trigger_test
# Expected exit 0 and result PASS. Each invocation creates/drops a fresh database;
# it refuses an existing database, remote host, unexpected user/password or URL override.
```

Executed with PostgreSQL16 from the pinned official image used in earlier validation, loopback only, synthetic data. Tests cover exact old-trigger red, migration preconditions/atomic rollback/no row rewrite, actual application message/revision helpers through a native SQL adapter, no-op xmin, multiwrite transactions, future and submillisecond revisions, NULL prior/incoming values, rejected infinities, UTC/Auckland sessions, and an earlier-started transaction observed waiting on its exact holder PID. Its final revision exceeds the holder after JS millisecond conversion, and rollback retains the committed holder value.

The shared clientes function/trigger definitions are compared before/after and their old behavior is executed. A synthetic AFTER aggregate trigger checks preserved trigger identity and effect counts, including no effect on no-op messages. **This does not reproduce or validate the internal production aggregate function.** This is actual PostgreSQL plus actual source helpers/pg adapter, **not generated Prisma runtime**. A generated-Prisma rerun with the legacy trigger fixture and this migration remains a later isolated validation gate. No new CI was run or validation branch changed for this follow-up.

## Approval-gated rollout

1. Obtain separate authorization and review the exact migration hash. Recheck catalog metadata for column type/precision, original enabled unconditional row trigger and function body, other BEFORE UPDATE triggers, and preserved AFTER triggers. Unexpected metadata must be reviewed, not bypassed.
2. Rehearse in disposable/staging PostgreSQL with the actual legacy triggers and generated Prisma client. Exercise all application order writers, old forms, no-op reads and concurrent transitions. Inspect the real aggregate function separately in the authorized environment if needed; no data belongs in this repository.
3. Only with production authorization, choose a quiet write window and apply the migration transaction. It requests an ACCESS EXCLUSIVE order-table lock with a five-second lock timeout and 30-second statement timeout; timeout/failure aborts the transaction. Do not increase limits or kill sessions without approval.
4. Verify new trigger target/enabled state, unchanged shared function/AFTER-trigger definitions and unchanged historical row values. Refresh open forms before enabling the candidate's mutations. No account mapping, privilege workaround or historical update is part of this migration.

## Rollback

Before commit, normal transaction rollback restores the old trigger atomically (tested). **Do not resume revision-dependent application mutations if the old trigger remains.** After successful activation, prefer a reviewed forward fix and retain the monotonic database boundary when rolling application code back to aee9fa19: that version also depends on monotonic revisions. Blindly restoring the legacy CURRENT_TIMESTAMP trigger reintroduces the confirmed replay defect. Any database rollback requires separately authorized quiescence of order writers, a compatible application/portal state, verification and refresh of outstanding forms. No automatic destructive rollback script or production execution is provided.

Existing security/grant exposure, identity provisioning and migration approval gates from the prior report remain unresolved and separate.
