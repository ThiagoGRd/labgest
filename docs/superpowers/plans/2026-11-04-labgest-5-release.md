# LabGest 5.0 local release preparation

> **For agentic workers:** Use superpowers:executing-plans for assigned tasks. Execute only in the sanitized worktree; parallel workers own disjoint files.

**Goal:** Correct confirmed interaction defects and prepare local evidence for approval, without any external mutation.
**Architecture:** Preserve server authorization and business rules; repair client state/recovery and navigation. Disable unsupported preferences and unsafe retroactive synchronization honestly. Reuse existing client server actions with validation. Async attachment ownership uses generation tokens so removed/replaced uploads cannot return silently.
**Tech Stack:** Next/React/TypeScript, Node tests, Chromium with synthetic data and mocked actions.
**Spec:** Coordinator delegation of 2026-11-04, base b8ee4012a140079bef32b3c2103479b6576e346f and prior audit /tmp/labgest-audit/REPORT.md.

## Global constraints
- Local only: no push/PR/merge/deploy/workflow triggers, production data, permission changes, archive enablement, invoice recovery or messaging.
- Never read/copy credentials. Sparse worktree excludes all env/node_modules/secret artifacts. Remove tracked env from index without displaying deletion contents.
- Archive remains fail-closed and disabled; preserve date/competence semantics.
- Do not claim builds validate types when ignoreBuildErrors is configured.

## Review focus
- Reject/null action responses preserve drafts, show feedback and release pending state.
- Repeated clicks and removal/replacement while uploads settle cannot duplicate requests or restore hidden attachments.
- Close/Cancel behavior recovers after failure; pending attachments prevent premature submit.
- Mobile/tablet preserve access and permissions; operator cannot manage admin-only resources.
- CSV export covers visible filtered records and neutralizes spreadsheet formulas; no secret artifacts in output.

## Tasks
- [x] Clients: regression for view/edit/export, implement using authorized actions, validate and export filtered visible records; browser test errors/retries.
- [x] Portal uploads/chat/order submit: regression for removal races, failures and pending state, fix components and photo/proof gating; test controlled promises.
- [x] Administrative settings/navigation/orders: honest notification state, toggle locking/errors, required fields, authorized menu and detail fetch feedback, chat recovery.
- [x] Finance/other pending handlers: mobile cancel/OS link, try/catch/finally recovery and repeat protection, disable broad retroactive sync with explanation; preserve backend date rules.
- [x] Portal layout/notifications/login: responsive navigation/logout/history, visible Toaster and error recovery; inspect mobile/tablet/desktop.
- [x] Security tooling: strengthen ignores, secret-prevention check, no secret content in diffs/artifacts, disposable DB only if SQL tests needed.
- [ ] Verification: baseline regression failures where practical, corrected unit/component tests, explicit tsc/lint, web/portal builds, independent final diff review and readiness report.

## Verification status

Unit, component Chromium, lint and independent source review completed locally. Full typecheck/build blocked by Prisma engine checksum download HTTP 403; real PostgreSQL/Prisma concurrency runners prepared for disposable native validation. Release remains approval-gated and not production-ready until these blockers and separate credential/grant exposure remediation are reviewed. Added shared per-account and per-order locking across web/portal automatic invoice creation after coordinator reproduced races.
