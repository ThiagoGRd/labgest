# Isolated external-order validation

Never use a production URL or load project dotenv files. The PostgreSQL runner
accepts only loopback plus the exact synthetic username/database below, and
refuses any database that already contains public/private tables.

## Real PostgreSQL concurrency and rollback

Use a fresh official PostgreSQL 16 container, no repository mounts:

```sh
docker run --detach --rm --name labgest-archive-validation \
  -e POSTGRES_USER=labgest_archive_test \
  -e POSTGRES_PASSWORD=synthetic-only \
  -e POSTGRES_DB=labgest_archive_test \
  -p 127.0.0.1:55439:5432 \
  postgres:16-bookworm@sha256:e8a07d2c7579b038938cdba6c539e580e5001caf9ea203d397b5cc83e76bd938
npm install --prefix /tmp/labgest-db-validation --ignore-scripts --no-audit --no-fund pg@8.16.3
NODE_PATH=/tmp/labgest-db-validation/node_modules \
LABGEST_TEST_DATABASE_URL=postgresql://labgest_archive_test:synthetic-only@127.0.0.1:55439/labgest_archive_test \
node web/tests/labs-externos-archive-postgres.integration.cjs
docker stop labgest-archive-validation
```

Use the managed local Docker socket/proxy guidance for this environment. Do not
redirect to another daemon. The fixture creates synthetic predecessor tables,
roles and views; the runner applies the prepared SQL and activates it only in
that new fixture. It tests the actual TypeScript helper through a pg adapter.
Five checks cover duplicate archive calls, archive-first/legacy-edit races,
edit-first/stale-archive races, stale restore racing archive, and audit INSERT
rollback. Lock contention is observed through pg_stat_activity, not inferred
from a sleep. This does not verify the production role or production configuration.

## Real Chromium components, synthetic server actions

In a sanitized checkout with platform-correct installed dependencies, Playwright
available on NODE_PATH and Chromium installed, run:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
node web/tests/labs-externos-archive-browser.integration.cjs
```

The runner bundles actual LabsExternosView, PedidoCard, ModalArquivo, Radix UI
and the application's Tailwind/global CSS using esbuild/PostCSS. Only server
actions and the dashboard layout/header shell are substituted. Requests outside
the ephemeral loopback server are blocked. It tests unavailable capabilities,
confirmation/reconciliation gates, cancel/close, stale/error feedback, repeated
submit, list navigation, archived edit protection, history, restore and a 390px
mobile dialog. Screenshots are written to the printed temporary directory.

A reproduced Radix dropdown/dialog interaction left body pointerEvents=none
after closing the archive dialog. The card menu now uses modal=false; the dialog
itself remains modal. The browser suite asserts the page remains interactive.

These standalone integration runners are intentionally separate from *.test.cjs
so unit tests never start Docker, a browser or an external database implicitly.
Do not add production credentials to CI. Full Next build and authenticated live
verification remain separate release checks.
