/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const cp = require('node:child_process')
const branch = 'codex/validate-labgest-5-20261104'
assert.equal(process.env.GITHUB_REF, `refs/heads/${branch}`)
const paths = cp.execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
assert.ok(paths.every(p => !p.split('/').some(s => s === 'node_modules' || /^\.env(?:\.|$)/.test(s)) && !/\.(?:pem|key|log|csv|dump|sqlite|db|zip|gz)$/i.test(p)), 'No tracked dependencies, environment files or data dumps')
for (const file of ['vercel.json', 'web/vercel.json', 'portal/vercel.json']) {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.deepEqual(config.git.deploymentEnabled, { [branch]: false })
  assert.match(config.ignoreCommand, /VERCEL_GIT_COMMIT_REF/)
}
const expected = process.argv.includes('--prisma-trigger')
  ? 'postgresql://labgest_archive_test:synthetic-only@127.0.0.1:5432/labgest_order_prisma_test?schema=public'
  : process.argv.includes('--prisma')
  ? 'postgresql://labgest_archive_test:synthetic-only@127.0.0.1:5432/labgest_finance_test?schema=labgest_prisma_test'
  : 'postgresql://synthetic:synthetic@127.0.0.1:1/labgest_unused_test'
assert.equal(process.env.DATABASE_URL, expected)
assert.equal(process.env.DIRECT_URL, expected)
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'http://127.0.0.1:1')
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'synthetic-placeholder-not-a-secret')
for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'VERCEL_TOKEN', 'PRISMA_ENGINES_MIRROR', 'PRISMA_QUERY_ENGINE_BINARY', 'PRISMA_QUERY_ENGINE_LIBRARY', 'PRISMA_SCHEMA_ENGINE_BINARY', 'PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING']) assert.ok(!process.env[key], `Forbidden environment override: ${key}`)
console.log('Validation isolation and all three branch-specific no-deployment guards verified')
