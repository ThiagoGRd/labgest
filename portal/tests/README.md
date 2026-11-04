# Portal upload regressions

Run from the repository root:

```sh
node portal/tests/upload-regressions.cjs
```

The runner bundles the current portal source using the installed esbuild, then uses Chromium and Playwright. `LABGEST_TEST_TOOLS` can override the node_modules directory; `PLAYWRIGHT_MODULE` can override the Playwright module path. Defaults match the managed review environment (`/opt/codex/cua_node/lib/node_modules/playwright`, `/usr/bin/chromium`).

The tests exercise the real upload, chat, proof, and new-order components plus react-dropzone. Server actions, Supabase storage, FileReader, Next navigation/image, icons, layout, and unrelated UI shells are isolated. All network requests outside the local fixture server are blocked. Tests use synthetic patient and file values and controlled promises; they neither require credentials nor contact production.

Coverage includes failure visibility and retry/discard, stale upload completion after removal/replacement, retained chat drafts on rejected/thrown sends, duplicate submit suppression, proof photo encoding and read errors, order attachment payload removal and pending gating, and asynchronous photo persistence. This is a behavioral component suite, not an end-to-end database/storage or visual-layout test.
