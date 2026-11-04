# External laboratory orders: investigation and local safety fix

Base: `5c410d07a4d0cbd8e09d4537e77c2dbaba2045b6`.
No AGENTS.md or repository .agents/skills were present; README.md and TESTES_WORKFLOW.md reviewed.
No production calls, migrations, credential reads, existing-record cleanup, push or deploy.

## Trace and evidence

`ModalPedido.enviar` → `LabsExternosView.salvarPedido` → server `criarPedido` → unconditional parameterized INSERT into `labs_externos_pedidos`.
The disabled submit button depends on a later React render. Two callbacks before that render reached the action twice. The local regression executes the real view with mocked React/server boundaries and reproduces two calls before the fix. A synchronous ref now permits one in-flight save, unlocking on success, validation failure or exception. This is a UI race fix, not cross-tab/network retry idempotency; it does not prove the route that produced historical copies.

The parent provided read-only findings: seven exact business-field groups (21 rows / 14 excess copies), inserts 0.4–2.8 seconds apart, all delivered. Another potential pair differs in dentist/service/deadline: patient/date matching must never imply identity. No rows are altered by this work.

`excluirPedido` previously authenticated then executed a permanent DELETE without audit or reconciliation checks. It had no UI caller. It now authenticates and returns an explicit refusal without database writes. No new delete button is exposed.

External creation/status/rework actions only mutate the external table; they call no finance/stock actions. Prisma has only its laboratory FK. Internal `Ordem` is a different identity namespace: receivables link to it, stock `ordemId` refers to internal work, and payables have free-text supplier/description fields. Do not join external IDs to internal `ordemId` or infer absence of obligations from a text search.

Parent live-schema findings: only updated_at and rework-keyword triggers; no finance/stock trigger effects, no inbound external-order FKs, four-value situation check. No archive/cancel metadata or audit mechanism exists. Live views also feed overdue/rework/dashboard; all must be considered. Existing tables have RLS disabled and anonymous CRUD permissions: disabling this server endpoint does not remediate those independent grants. No permissions on existing production tables are changed here.

## Prepared archival design — not active

The companion SQL is deliberately non-deployable, outside automatic migrations, with an exception and final ROLLBACK. It prepares private state plus append-only events and least-privilege defaults. It must not be promoted until exact live view definitions and restricted server role are reviewed and local PostgreSQL tests pass. No Prisma schema change or runtime archival UI has been activated.

Concrete proposed UI:

- Card menu: **Arquivar registro duplicado**, including delivered entries. Show order ID, patient, lab, service, dates and existing situation; never select a duplicate automatically.
- Confirmation title: **Arquivar o registro #ID?** Text: **O registro ficará no histórico e poderá ser restaurado. Isso não cancela produção no laboratório, pagamentos ou movimentações de estoque.**
- Required reason (5–2000 characters). Separate required review of financial, stock and external-production commitments, each with **Conferido, sem pendências**, **Requer conciliação**, **Não sei**. Default unknown; any pending/unknown blocks. Record actor, time and review evidence in the event. Administrative review is necessary because the database cannot establish these relationships automatically; checkbox consent must not be represented as automatic verification.
- Confirmation button **Confirmar arquivamento**, disabled while saving and protected synchronously against repeated submit.
- **Arquivados** list with read-only original data and **Histórico / Restaurar registro**. Restoration requires confirmation and reason; it appends another event and sets state false, never deletes the state/history or changes the clinical situation. Do not reject solely because Entregue.

Server protocol to implement after design validation:

1. Default-off server feature flag plus verified schema/version/readiness. UI stays hidden and direct actions refuse while disabled or schema/permissions are absent. Never trust a client readiness flag.
2. Require an administrator, validate exact ID, reason, explicit confirmation and clear reviewed dependencies. Known reconciliation requirements block archive/restore. If explicit relational links are later added, check them transactionally too.
3. In a transaction lock the original row FOR UPDATE, compare expected updated_at and archive version, and refuse stale requests. Derive actor from authenticated identity, snapshot from the locked row. Use consistent row locking for all external-order writes.
4. Write state and immutable audit event atomically; failure rolls both back. Same desired state is idempotent; conflicting archive/restore versions require refresh. Preserve full previous data and clinical situation.
5. Exclude archived entries from all active app queries and the three SQL views; zero-count labs must remain in dashboard. Block editing archived entries. Revalidate after commit only. Never alter finance/stock or notify an external lab.
6. Feature activation needs local integration/browser coverage for rollback, duplicate requests, concurrent edits, restore, stale versions, unauthorized roles, RLS denial and view counts. Existing broad anonymous grants need their own reviewed remediation; do not claim database security from app auth alone.

Durable creation idempotency is also a follow-up migration: a random request UUID per form intent, unique server-side with payload hash and stored result, reused for ambiguous retries. Never deduplicate by patient, date or identical clinical fields: legitimate repeated pieces exist.

## Verification commands

Focused regression: `node --test web/tests/labs-externos-safety.test.cjs`.
Existing local mocked/pure suites: `./node_modules/.bin/tsx --test web/src/lib/*.test.ts packages/shared/test/*.test.ts`.
Typecheck: `./node_modules/.bin/tsc --noEmit --incremental false -p web/tsconfig.json`.
Lint from web: `../node_modules/.bin/eslint src/actions/labs-externos.ts 'src/app/(dashboard)/labs-externos/labs-externos-view.tsx' tests/labs-externos-safety.test.cjs`.

Do not run the stock build script in the source tree: its Prisma command can load the forbidden tracked database .env. Use a sanitized local build workspace with only explicitly selected source/config files and dummy URLs; never copy any .env file.

## Observed verification results (2026-11-04)

- Focused regression: 4/4 pass. Before fix: duplicate-save test failed with 2 calls instead of 1; legacy-delete test failed with 1 write instead of 0. Retry tests pass for validation and exceptions.
- Existing suites in sanitized `/tmp/labgest-check`: 30/30 pass, no skipped tests. Initial checkout run failed for all eight files because tracked esbuild was macOS ARM64; installing platform dependencies with scripts disabled fixed the test environment.
- Focused ESLint: pass after marking the explicitly CommonJS test harness accordingly. No production lint suppression.
- Typecheck: exit 2; missing generated PrismaClient/Prisma exports and cascading implicit-any errors. Complete app typecheck is not verified.
- Prisma generation in sanitized workspace with dummy loopback URLs: exit 1, engine checksum download HTTP 403 from binaries.prisma.sh. No retry bypass or migration attempted.
- Next build in sanitized workspace with dummy database URLs and telemetry off: exit 1 before compilation; missing SWC binary attempts an unwritable `/home/agent/.cache/next-swc`. Build is not verified.
- `git diff --check`: pass. No financial action/page/view edits. Tracked node_modules restored after dependency setup; installed Linux dependencies are isolated under `/tmp/labgest-check`.

Operational detail: one initial Prisma generation command was inadvertently launched from the source checkout with explicit dummy DATABASE_URL/DIRECT_URL. It failed during engine download, emitted no dotenv-loaded or generation-success message, and made no database query. No credential contents were displayed or copied; automatic internal dotenv reading is not established by that output. Subsequent generation/build attempts used the sanitized tree only. Do not repeat generation from the source checkout.

Remaining work is pending design/schema validation, not an approval denial: archival controls are not implemented/activated, SQL draft is not deployable, no live views changed. Exact live view definitions, restricted writer permissions, reconciliation-review workflow and local transaction/RLS tests are required before activation. No existing duplicate was changed.
