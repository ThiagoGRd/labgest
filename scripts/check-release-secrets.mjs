import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function classifyPath(path) {
  if (path.split('/').some((part) => part === 'node_modules' || part === '.next')) return 'dependency';
  if (/(^|\/)\.env(?:\.[^/]*)?$|\.(?:pem|key|p12|pfx)$|(^|\/)(?:credentials|service-account)\.json$/i.test(path)) return 'forbidden';
  return 'source';
}

export function inspectText(text) {
  const issues = new Set();
  for (const match of text.matchAll(/postgres(?:ql)?:\/\/[^\s'"`<>]+/gi)) {
    try {
      const url = new URL(match[0]);
      const disposable = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && /^\/labgest_[a-z_]*test$/.test(url.pathname);
      if (url.password && !disposable) issues.add('credential-bearing database URL');
    } catch { /* Nonliteral documentation/template URL. */ }
  }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) issues.add('private key');
  if (/(?:SUPABASE_SERVICE_ROLE_KEY|DATABASE_PASSWORD|SERVICE_ROLE_KEY)\s*[:=]\s*['"][a-zA-Z0-9_.\-+/=]{40,}['"]/.test(text)) issues.add('hard-coded service credential');
  return [...issues];
}

function sourceHasSymlink(root, path) {
  let current = resolve(root);
  if (lstatSync(current).isSymbolicLink()) return true;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    try { if (lstatSync(current).isSymbolicLink()) return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw new Error('Unable to inspect source path safely'); }
  }
  return false;
}

export function checkRelease(root = process.cwd()) {
  let entries;
  try {
    entries = execFileSync('git', ['ls-files', '--stage', '-z', '--', '.', ':(exclude)**/node_modules/**', ':(exclude)node_modules/**'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean);
  } catch { throw new Error('Unable to inspect index metadata; command output suppressed'); }
  const violations = [];
  let inspected = 0;
  for (const entry of entries) {
    const separator = entry.indexOf('\t');
    const metadata = entry.slice(0, separator).split(' ');
    const path = entry.slice(separator + 1);
    const kind = classifyPath(path);
    if (kind === 'dependency') continue;
    if (kind === 'forbidden') { violations.push({ path, reasons: ['tracked credential artifact; contents not read'] }); continue; }
    try {
      if (metadata[0] === '120000' || sourceHasSymlink(root, path)) {
        violations.push({ path, reasons: ['source symlink; contents not read'] }); continue;
      }
      if (!/\.(?:[cm]?[jt]sx?|json|ya?ml|sql|md|sh|toml|prisma)$/.test(path)) continue;
      const staged = execFileSync('git', ['show', `:${path}`], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
      const reasons = [...new Set([...inspectText(staged), ...inspectText(existsSync(resolve(root, path)) ? readFileSync(resolve(root, path), 'utf8') : '')])];
      inspected++;
      if (reasons.length) violations.push({ path, reasons });
    } catch { violations.push({ path, reasons: ['unable to inspect source safely; command output suppressed'] }); }
  }
  return { inspected, violations };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try { result = checkRelease(); }
  catch { console.error('Secret prevention failed to inspect index safely; output suppressed.'); process.exit(1); }
  // Deliberately print only paths and classifications, never secret text or excerpts.
  for (const issue of result.violations) console.error(`${issue.path}: ${issue.reasons.join(', ')}`);
  console.log(`Secret prevention: ${result.inspected} source files inspected; ${result.violations.length} violations.`);
  if (result.violations.length) process.exitCode = 1;
}
