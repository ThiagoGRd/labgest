# LabGest 5 correlation candidate

Predecessor pure2608c194, previous green validation483956ce/run41826708048 preserved. Local candidate release/labgest-5.0-correlation-2026-11-04. This document describes bounded behavior, not deployment approval.

## Implemented / tested / limits by audit ID

| IDs | Implementation | Verification | Limits |
|---|---|---|---|
| C1-C4 | Explicit private Auth UUID->Cliente binding; verified session required; no email auto-claim; signup never modifies Cliente; immutable assigned commercial email; no metadata authority | 11 source-action identity tests; legacy5; real PostgreSQL migration constraints/RLS | No live binding or Supabase E2E. ALL unbound accounts fail closed; approved reconciliation required before rollout |
| C5/M2 | One labeled global badge, displayed-ID read receipts | Source actions + actual chats; PG receipt/append | Global per-clinic recipient receipt, not separate per-dentist read ledger |
| M1 | Order lock append + stable UUID idempotency bound to actor/role/payload | PG sender combinations, retry and receipt races with observed waits | Native SQL adapter, not generated Prisma runtime in that suite |
| M3 | Authenticated route refresh30s/focus; chats poll10s, merge without dropping draft, keyed order identity | Actual Chromium chats and existing upload17/admin tests | Mock auth/network actions; no full authenticated two-deployment E2E |
| F1-F5 | Active residual balance, actual ledger cash, strict ID report selection, mismatch redaction, labeled monthly valid sales, civil dates | source-action tests UTC/Maceio/UTC+14 including installments and due-today; portal identity2; genuine Prisma reports runner | Final generated Prisma/type/build results recorded separately after CI |
| O1-O5 | Shared row serialization, terminal/paused guards, expected-step/revision checks with monotonic revisions, active-cycle protection, immutable first proof decision, delivery audit/date retention, explicit counts/null dates | 80 workflow source/handler cases; monotonic revision/shared tests; existing PG finance23 adapted to revision contract; new PostgreSQL transition races with exact blocker PIDs | Four actual Chromium modal scenarios verify atomic checklist, cross-order draft isolation, stale feedback and close/reopen; actions mocked, full authenticated E2E pending. Manual reposition retains revision conflict check |
| SL01 | Current estimate from current recipe prices; no-recipe manual cost preserved; missing/inactive materials explicit | Cost, archived/missing/zero and price-change tests | Historical order prices/ledger unit prices unchanged; no historical recipe backfill |
| SL03/05 | Server monthly history, full filtered CSV/PDF, timestamp bounds Maceio03UTC; zero physical adjustment valid | >1000 oldmonth rows, bounds, all3 export callbacks/error suppression, stock locks7 PG | Print layout reviewed by code/callback harness, not physical printer |
| SL04 | Return deadline independent of final delivery; first return retained | Utility and action tests | A rework needs a new linked supplier trip, not overwriting old return |
| SL02 | Optional exact order/lab IDs; standalone records preserved; one open linked trip/order, multiple completed trips; archive guards on every write | External source tests and real PG migration/helper6, retrabalho6, supplier flow3 | Vendor Pronto does not automatically advance OS; Production explicitly confirms receipt. Its actual confirmation instant determines lateness, while the first vendor return civil day stays separate (a later confirmation may therefore require a reason). No automatic financial/stock effects |

## Schema / rollout blockers

Two reviewed migrations: optional external order FK+confirmed-cycle timestamp/partial active index; private UUID binding table. Neither applied to production. Only disposable local PostgreSQL tests were used. Historical external rows stay unlinked. Restrictive FK prevents deleting linked OS. Existing archive snapshots are unchanged; full-row md5 changes invalidate stale forms normally.

Binding cardinality: one Auth UUID -> one Cliente; many independently approved UUIDs may map to the same Cliente, retaining clinic-scoped access. No name/email backfill. Recreated Auth user receives no old access. Ordinary profile/client APIs cannot write binding fields. Provisioning uses separately authorized exact IDs and reviewer evidence; conflicts fail rather than overwrite. See docs/security/portal-client-binding.md. Runtime least-privilege/RLS verification and approved assignments are required, not bypassed. Rollback must retain UUID authorization or disable portal; NEVER return to email authorization.

Historical credential exposure and public/anon grants remain separate unresolved security gates. No credential read/rotation, grants change, archive enablement, historical invoice recovery or production mutations. No deploy/PR/main merge authorized.

## Verification discipline

Red-before-green evidence lives outside product tree in /tmp/labgest-correlation-implementation. Source mocks, actual PostgreSQL adapters, generated Prisma integration and mocked Chromium are reported separately. Counts overlap. Local explicit tsc cannot complete without generated Prisma engine/client; authoritative CI must run both tsc and full builds, not rely on ignoreBuildErrors. CI mandatory gate checks outcomes, not continue-on-error conclusions.

Independent review found stale reception send, duplicate active cycles, stale manual reposition; each received regression+fix. Final review found retrabalho archive bypass, repeated supplier trip blockage and invoice-description leak on mismatched owner; each received regression+fix. Re-review and final CI status are recorded in external release report.

## Follow-up adversarial validation

The first correlation CI41868079299 correctly failed its mandatory gate on two type errors and a stale timezone assertion; its successful builds were not accepted as typecheck success. Follow-up changes repair those checks, deterministic chat lock observation, workflow same-step/pause ABA replay and proof/editor conflicts, supplier date/instant separation, and financial civil dates. Final CI evidence is maintained in the external release report. Native transition tests use real PostgreSQL transactions/locks and a SQL JSON-field adapter, not generated Prisma. They assert cancellation/pause/feedback conflicts and rollback of order/audit/stock/invoice on an injected SQL constraint failure.

The final revision protocol covers all 34 application order writers. Checklist/photo mutations now acquire the same order lock, finalization carries its intermediate revision forward, and changed messages/receipts advance monotonically; unchanged receipts/retries perform no UPDATE. A generated-Prisma regression runner checks the ordinary wall-clock update control, the corrected helper and unchanged xmin on no-ops; its executed result is recorded separately in final CI evidence. Default Financeiro and monthly-statement periods use the laboratory calendar; explicit selected months are unchanged. Final CI outcomes remain in the external report.
