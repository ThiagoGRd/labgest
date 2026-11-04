# Portal identity deployment gate

**Deployment is blocked until the private binding migration, role permissions and individually approved account bindings have been validated in the test environment.** Existing accounts have no automatic entitlement: without a reviewed UUID binding they cannot access any clinic's historical orders, messages or finances, even with a confirmed email matching a unique commercial record. No email-based seed or reconciliation is permitted.

The migration is `packages/database/prisma/migrations/20261104010000_portal_client_binding/migration.sql`. It creates a private table outside the Prisma schema; do not let a future schema-push process drop this separately managed table. The application uses a parameterized raw read. No public action writes bindings. An Auth UUID maps to one Cliente ID; multiple individually approved UUIDs can map to one clinic. This supports multiple authorized dentists in the same clinic without granting any of them access to a different clinic. Ordinary commercial/profile edits and public signup cannot create or modify these associations. Inactive clients remain denied. A recreated Auth account receives a new UUID and must undergo a new approval even if its email is identical.

## Reviewed assignment procedure

1. An authorized laboratory administrator establishes the person's authority to access the specific clinic's historical orders, messages and financial data. Email possession alone is insufficient. Record the reviewer, evidence and approval reference through the laboratory's existing administrative process.
2. Retrieve the exact immutable Supabase Auth UUID from the authorized Auth administration interface. Verify the confirmed account and the person separately; never derive the UUID from form input or guess from an email match. Retrieve the exact commercial Cliente ID and verify the clinic and active status independently.
3. A database provisioning administrator reviews the exact UUID/Cliente ID pair against the approval and checks for an existing binding. New assignments use an ordinary INSERT, **never UPSERT or an email join**. Any conflicting assignment requires a separate reviewed revocation/reassignment decision; do not silently replace it.
4. In a transaction, insert the reviewed pair and an `authorized_by` value identifying the reviewer and approval reference. `authorized_at` records the operation timestamp. Verify the exact inserted pair before commit. Preserve the approval record separately. No assignment has been prepared for a real account in this change.
5. Test login with the approved account, verify its expected clinic and ownership, and verify an unbound account with the same email cannot gain access. Suspending the clinic must deny even mapped accounts. Roll back a mistaken grant by deleting its exact UUID binding through the provisioning administrator, and record that revocation.

## Database roles and API exposure

Do not expose `labgest_private` through PostgREST or client Supabase SDKs. The migration revokes PUBLIC privileges and enables RLS with no public policies. Audit schema/table default privileges and explicitly remove any inherited browser-role grants before rollout. Browser `anon` and `authenticated` roles must have neither schema access nor table privileges.

The server runtime role must receive schema USAGE, table SELECT and a SELECT-only RLS policy for that exact role (unless it is the existing table owner/BYPASSRLS role). It must not receive binding write privileges. Use a separate provisioning administrator for approved writes. Review actual role names and existing owner/BYPASSRLS privileges in the test deployment; do not guess names or paste wildcard grants. Missing privileges or a missing migration deliberately produce the same explicit unavailable-access response.

## Safe rollback

Never roll back to an application version that resolves ownership by email. A rollback must retain this UUID authorization boundary, or disable portal access until a corrected version is available. Removing the binding table or its read privileges must leave the resolver failing closed; it must not trigger email matching. Preserve reviewed grants and approval records during a code rollback. Do not automatically recreate bindings from contact information. Revoke an incorrect individual grant by exact UUID through the provisioning role and retain its review record; do not transfer it to a new UUID as a side effect of a contact edit or account recreation.

## Validation prepared

Run `packages/database/tests/portal-client-binding.sql` using `psql -v ON_ERROR_STOP=1 -f ...` only on a disposable migrated database. It validates atomic rejection of a conflicting UUID-to-different-clinic assignment while preserving the original grant, UUID uniqueness, multiple approved users per clinic, required reviewer, FK deletion restriction and RLS, then rolls back. It refuses a nonempty binding table. Also verify browser-role reads/writes are denied and server-role SELECT works in the test role configuration. These database checks have not been run against a live database by the implementation agent.

`NODE_PATH=/tmp/labgest-release-tooling/node_modules node --test scripts/tests/identity.cjs` exercises the real transpiled resolver/actions with synthetic DB/Auth adapters. A verified new UUID sharing an existing clinic email is denied; an approved UUID keeps its clinic when emails change or duplicate; missing mapping storage, unverified users and suspended clinics fail closed. This is not a substitute for the role/database checks above.
