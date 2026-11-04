import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, inspectText } from '../check-release-secrets.mjs';

test('rejects credentials regardless of nesting without reading contents', () => {
  for (const p of ['.env', 'packages/database/.env', 'web/.env.production', 'private.key', 'credentials.pem']) assert.equal(classifyPath(p), 'forbidden');
  assert.equal(classifyPath('web/src/app.tsx'), 'source');
  assert.equal(classifyPath('node_modules/package/index.js'), 'dependency');
});
test('reports secret types, never values', () => {
  const secret=['postgresql:', '//account:real-password@db.example.com/database'].join('');
  const issues=inspectText(`const url = '${secret}'`);
  assert.deepEqual(issues, ['credential-bearing database URL']);
  assert.ok(!JSON.stringify(issues).includes('real-password'));
});
test('allows only explicit disposable loopback database URLs', () => {
  assert.deepEqual(inspectText('postgresql://synthetic:synthetic@127.0.0.1:1/labgest_release_test'), []);
  assert.deepEqual(inspectText('postgresql://synthetic:synthetic@localhost:5432/labgest_archive_test'), []);
  assert.notDeepEqual(inspectText(['postgresql:', '//x:y@127.0.0.1/production'].join('')), []);
});
test('detects private-key and long token assignments without reporting contents', () => {
  assert.deepEqual(inspectText(['-----BEGIN ', 'PRIVATE KEY-----'].join('')), ['private key']);
  assert.deepEqual(inspectText('SUPABASE_SERVICE_ROLE_KEY="eyJ'+ 'a'.repeat(60)+'"'), ['hard-coded service credential']);
});

test('checks staged content even when working copy was sanitized afterward', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { checkRelease } = await import('../check-release-secrets.mjs');
  const root = mkdtempSync(join(tmpdir(), 'labgest-secret-check-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(root, 'config.ts'), `export const url = '${['postgresql:', '//synthetic:synthetic@db.example.invalid/test'].join('')}'`);
    execFileSync('git', ['add', 'config.ts'], { cwd: root });
    writeFileSync(join(root, 'config.ts'), 'export const url = process.env.DATABASE_URL');
    assert.equal(checkRelease(root).violations.length, 1);
    rmSync(join(root, 'config.ts'));
    assert.equal(checkRelease(root).violations.length, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('rejects source and ancestor symlinks without dereferencing their contents', async () => {
  const { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { checkRelease } = await import('../check-release-secrets.mjs');
  const root = mkdtempSync(join(tmpdir(), 'labgest-secret-link-'));
  const outside = mkdtempSync(join(tmpdir(), 'labgest-synthetic-private-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    writeFileSync(join(outside, '.env'), 'SYNTHETIC_ONLY=do-not-read');
    symlinkSync(join(outside, '.env'), join(root, 'config.ts'));
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'safe.ts'), 'export const safe = true');
    execFileSync('git', ['add', 'config.ts', 'src/safe.ts'], { cwd: root });
    rmSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(outside, 'safe.ts'), 'SYNTHETIC_ONLY=do-not-read');
    symlinkSync(outside, join(root, 'src'));
    const result = checkRelease(root);
    assert.equal(result.violations.length, 2);
    assert.ok(result.violations.every(v => v.reasons[0] === 'source symlink; contents not read'));
  } finally { rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); }
});
