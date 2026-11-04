# External laboratory orders: local safety fix and gated archive

Base: `5c410d07a4d0cbd8e09d4537e77c2dbaba2045b6`. No production changes, migrations, duplicate cleanup, external laboratory calls, push or deploy. No finance action/page/view files changed. No repository AGENTS.md or .agents/skills was present; README.md and TESTES_WORKFLOW.md were reviewed.

## Findings

`ModalPedido.enviar` → `LabsExternosView.salvarPedido` → `criarPedido` → unconditional parameterized INSERT. A disabled button depends on a later React render; two callbacks before that render reached the server action twice. The regression reproduced this. A synchronous ref now allows one in-flight save and unlocks on success/validation failure/exception. **This is client protection only, not server idempotency; cross-tab or ambiguous network retries are not deduplicated.**

Parent read-only evidence: seven exact business-field groups, 21 rows/14 excess copies, inserts 0.4–2.8 seconds apart, all delivered. A separate candidate pair differs in dentist/service/deadline. Do not deduplicate automatically by patient/date or even identical clinical fields: legitimate repeated pieces may exist.

The unused `excluirPedido` server endpoint previously permanently deleted rows without audit/reconciliation checks. It now authenticates and refuses without writes. Existing anonymous CRUD grants on the original tables remain a separate security issue; disabling this endpoint does not revoke them.

External-order actions only mutate their registry; they do not invoke finance or stock actions. Prisma and parent live evidence show only the laboratory FK, no inbound links, no finance/stock triggers. Internal `Ordem` IDs are a different namespace; never join an external ID to internal stock/receivable `ordemId`. Payables include manual free text, so lack of matching descriptions is not proof of no obligations.

The current situation constraint has four values; no Cancelado exists. Archival therefore uses private side-table state and preserves all clinical fields, including Entregue. Parent supplied exact definitions of the three existing views; the prepared SQL preserves output column order/types, includes delivered rework records as before, and preserves zero-count active labs with a predicate in the dashboard LEFT JOIN.

## Implemented, fail-closed controls

- Card action **Arquivar registro duplicado**, for all clinical situations including delivered. Modal identifies exact ID, patient, laboratory, dentist, service, send date and deadline.
- Requires explicit confirmation, reason (5–2000 characters) and three reviews: financial, stock, external production. Each defaults to unknown. Unknown/pending blocks in both UI and server. The administrator's review and reason are recorded; this is manual reconciliation evidence, not an automatic discovery of obligations.
- Copy explains that archiving the registry does not cancel production commitments, payments or stock movements.
- Archived list preserves original data. **Restaurar registro** requires the same confirmation/review and appends an event; it restores the prior clinical state because that state was never overwritten. **Histórico de arquivamento** shows actor, time, reason, version and original record snapshot.
- Both mutation and history server actions require administrator access; actor identity comes from auth, never browser input. Normal authenticated users retain read access to the registry. Archived entries cannot be edited in the UI.
- Controls/mutations require exactly one valid schema-version-1 capability marker, enabled capability, required server-role write/read/sequence privileges and complete runtime-role visibility. Installed storage with an absent/invalid marker is rejected, not treated as merely disabled. The prepared migration inserts enabled=false. Missing migration returns false; partial installation or lost private read privileges throws rather than silently treating archived entries as active. There is no UI/action that enables the capability.
- Disabling the capability later hides mutation/history controls but archived rows remain filtered and visible in the archived list. History remains available through its authenticated administrator server action.
- The legacy deletion endpoint remains disabled regardless of capability.

## Transaction and concurrency

`alterarArquivamento` locks the original row FOR UPDATE, compares its exact PostgreSQL `md5(to_jsonb(p)::text)` revision and archive version, and writes private state plus an immutable audit event in one transaction. The revision contains original timestamp microseconds; no JavaScript millisecond timestamp round-trip is used. Missing/stale records and malformed inputs refuse before writing. Database failures roll back both changes.

A replay of the latest successful archive/restore is a no-op; old intents cannot overwrite a later state transition. The server revalidates only after successful completion. This limited archive-operation replay behavior is unrelated to order-creation idempotency.

The SQL installs a private trigger on original rows to reject UPDATE/DELETE while archived, including writes from older app versions. It is a private SECURITY DEFINER trigger with fixed pg_catalog search_path, no public execution privileges, and no public RPC endpoint. The original row lock serializes original edits with archive/restore. Audit event UPDATE/DELETE is rejected by an append-only trigger. These database behaviors require real PostgreSQL validation before activation.

All active app lists, overdue/rework queries, dashboard counts and laboratory summaries use the same archive-state filter. The prepared SQL filters all three existing views. No finance/stock records are modified.

## Prepared migration and permission boundary

`external-lab-order-archive.sql` is an additive, review-only SQL transaction outside automatic Prisma migrations. It has **not been executed**. It prepares private state, events, capability, least-privilege grants/RLS policies for CURRENT_USER, append-only/archived-row triggers and the exact three view replacements. It leaves capability disabled.

The migration owner must be the existing reviewed trusted server DB role. Runtime visibility is checked with PostgreSQL row_security_active for capability, state and event tables. This conservative implementation refuses all roles subject to RLS filtering, even if their policies appear permissive. Because the prepared tables use FORCE RLS, an ordinary non-BYPASSRLS owner is refused too. A differing runtime role subject to RLS is therefore unsupported and activation remains blocked pending a PostgreSQL-tested visibility design. Do not grant BYPASSRLS, broaden grants or create a new credential to work around this check. Anonymous and ordinary Supabase authenticated roles receive no private-schema/table/sequence/function grants. No existing table grants are broadened. Existing original-table anonymous CRUD exposure is not remediated here.

Before any future activation: explicitly authorize migration; verify owner/role mapping and view access; test on disposable local PostgreSQL with synthetic fixtures; deploy matching code; then separately authorize enabled=true. Do not execute production queries to work around missing local tooling. Do not undo archival by dropping state/history tables; restore through audited actions.

Required real-DB checks: original timestamp microseconds, concurrent edit/archive/restore locking, event insert rollback, duplicate operation replay, immutable audit, anonymous/RLS denial, trigger-owner permissions, view output compatibility and zero-count labs. No local PostgreSQL binary or cached PostgreSQL Docker image was available; these checks were **not run**.

## Verification

- `node --test web/tests/*.test.cjs`: mocked UI/action/transaction regressions. Includes missing/disabled schema, delivered archive/restore, audit failure rollback, repeats, stale revision/version, unknown/pending review, auth rejection, server-action revalidation, filtering while disabled and fail-closed read permissions. These are not real DB/RLS or browser tests.
- `./node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts` in sanitized `/tmp/labgest-check`: existing pure/mocked suites.
- Focused ESLint covers every changed TS/TSX and CJS test. Standalone `tsc --noEmit --skipLibCheck --target es2020 --module commonjs web/src/lib/labs-externos-arquivo.ts` validates the transaction module.
- Full application typecheck remains blocked by missing generated PrismaClient/Prisma exports and cascading errors. Prisma engine download returned HTTP 403; no network retry/bypass was attempted in the continuation.
- Prior sanitized Next build failed before compilation on missing SWC/cache; complete build/browser verification is not claimed.
- Original tracked node_modules were restored after dependency setup. Linux verification dependencies are isolated under `/tmp/labgest-check`.

Operational caveat from the first pass: one Prisma generation command inadvertently ran from the original checkout with explicit dummy DATABASE_URL/DIRECT_URL. It failed downloading the engine and emitted no dotenv-loaded/generation-success message; internal dotenv access is not conclusively established by that output. No credential contents were displayed/copied, and no database query occurred. All subsequent checks use the sanitized tree; no dotenv/package scripts ran in the original checkout during this continuation.

Final local results for this continuation: 20/20 focused mocked UI/action/transaction tests and 30/30 existing tests pass; focused lint and standalone transaction-module typecheck pass; diff whitespace check passes. Whole-app typecheck exits 2 because the generated Prisma client is unavailable. No actual PostgreSQL/RLS/locking/view migration or browser test ran, and no network retries were made to unblock them.

Independent-review correction: fail-first mocked tests reproduced silent success for an absent installed marker, wrong schema version and ACL-permitted/RLS-invisible role. Those paths now throw before archive state can be interpreted as empty. A valid disabled marker with established full visibility still reads existing archived state. These are mocked checks; actual PostgreSQL role/RLS behavior and activation remain unverified and blocked as described above.
Review-correction verification: 24/24 focused mocked tests pass (three new rejection tests failed before the production change); focused lint of the changed helper/test and standalone helper typecheck pass; git diff --check passes. No full app/network/database verification was retried.
