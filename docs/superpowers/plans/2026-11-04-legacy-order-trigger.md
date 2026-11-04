# Legacy order trigger compatibility plan

**Goal:** preserve monotonic order revisions with the exact legacy trigger installed, without changing the shared clientes function.
**Architecture:** replace only the order trigger with a dedicated invoker function. Compare the incoming timestamp, the previous JavaScript-visible millisecond plus one, and UTC clock_timestamp at execution. Fail closed on unexpected trigger configuration and nonfinite revisions.
**Tech Stack:** PostgreSQL16, PL/pgSQL, Node24, actual TypeScript application helpers via pg adapter.
**Spec:** docs/security/order-revision-trigger-rollout.md and delegated exact-trigger compatibility requirements.

**Constraints:** local synthetic PostgreSQL only; no push, validation-branch edit, live migration, grants or account mappings. Preserve aee9fa19 and its green evidence.

- [x] Install exact legacy function/triggers in a fresh disposable database; reproduce revision rollback and repeated CURRENT_TIMESTAMP in one transaction.
- [x] Add narrow transactional migration with catalog preconditions and dedicated order function.
- [x] Test explicit/fallback revisions, nulls, fractional precision, multiwrite transactions, exact app helper, old-start lock wait, rollback and unchanged clientes behavior.
- [x] Independently review the diff; document rollout/rollback restrictions, commit and record hash locally.
