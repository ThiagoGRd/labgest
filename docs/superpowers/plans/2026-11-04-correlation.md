# Cross-tab correlation Implementation Plan

> For agentic workers: execute test-first in isolated task scopes; independent review before final integration.

**Goal:** Correct audited identity, state, financial, messaging and stock/lab correlations while preserving records and production isolation.
**Architecture:** Explicit identity resolution and fail-closed access, shared order-row serialization for mutations, authoritative cash/residual and civil-date rules. Optional exact-ID external linkage never infers historical associations; standalone records remain valid.
**Tech Stack:** Next/React, TypeScript, Prisma6.19.2, PostgreSQL16, Chromium synthetic harnesses.
**Spec:** Authorized audit C1–C5, F1–F5, O1–O5, M1–M3, SL01–SL05, with immutable predecessor2608c194.

## Global Constraints
- No production operations, credential access, activation of archive, main changes, PR or deploy.
- Existing candidate and green validation evidence preserved; separate pure product and validation commits.
- Schema changes only reviewed SQL and synthetic disposable integration; no automatic historic association/date inference.
- Test red before implementation; record exact mocked/DB/browser coverage; explicit tsc required despite build configuration.

## Review Focus
- Unverified/ambiguous identity and suspended clients must never acquire another client's records.
- Stale actions after pause/cancel/delivery must preserve original dates/audit, including concurrent calls.
- Two app writers and read receipts must preserve all messages and prevent cross-customer access.
- Civil-date boundaries, partial receipts, reversals, homonyms must agree across consumers.
- Linked/standalone external orders and changed service prices must preserve history and avoid duplicate financial/stock effects.

## Tasks
- [ ] Identity C1–C4: source-action red tests; safe auth resolver, signup/profile/client guards; no silent migration or bulk matching.
- [ ] Financial F1–F5: red tests; common residual/cash periods, ID-only reports, ranking labels, civil dates.
- [ ] Workflow O1–O5: red tests; serialized terminal/paused guards and detailed-flow edit protection; explicit portal counts/history dates.
- [ ] Messaging M1–M3/C5: red tests; order-lock append/receipts and scoped reads; polling/refresh preserving drafts; shared badge.
- [ ] Stock SL01/03/04/05: red tests; current cost consistently derived, month server query/export, return deadline semantics, zero inventory adjustment.
- [ ] Optional lab linkage SL02: design exact-ID association and standalone preservation, reviewed migration + disposable tests, source/UI integration.
- [ ] Integrate all scopes, run existing/new regressions, independent review and resolve findings.
- [ ] Before remote update: redacted tree scan, source/validation diff, three exact-branch no-deploy guards, workflow/no-secret checks; report checkpoint.
- [ ] CI exact final source: generated Prisma, explicit tsc both, lint/build both, unit/date/browser and disposable finance/stock/archive/correlation tests; inspect raw gate outcomes.
- [ ] Per-ID implemented/tested/deferred matrix, migration review and remaining security/deploy approval gates.
