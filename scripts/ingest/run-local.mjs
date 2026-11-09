#!/usr/bin/env node
// Manual ingest from your own machine: pull main, fetch, commit, push.
// Usage: npm run ingest   (see docs/INGEST.md)
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
const out = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim();
const fail = (msg) => { console.error(`\n✖ ${msg}`); process.exit(1); };

const branch = out('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'main') fail(`You are on "${branch}". Switch to main first: git switch main`);
if (out('git', ['status', '--porcelain', '--untracked-files=no'])) fail('You have uncommitted changes. Commit or stash them first.');

run('git', ['pull', '-q', '--rebase', 'origin', 'main']);
run(process.execPath, ['scripts/ingest/ingest.mjs']);

run('git', ['add', '-A', 'data/articles', 'data/ingest']);
try { execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT }); console.log('\nNothing new.'); process.exit(0); } catch {}
const stamp = new Date().toISOString().slice(0, 16) + 'Z';
run('git', ['commit', '-q', '-m', `data: headlines ${stamp} [skip ci]`]);
for (let i = 1; i <= 3; i++) {
  try { run('git', ['pull', '-q', '--rebase', 'origin', 'main']); run('git', ['push', '-q', 'origin', 'HEAD:main']); console.log('\n✔ Pushed to main.'); process.exit(0); } catch {}
}
fail('Push failed after 3 attempts. Your commit is saved locally; run: git pull --rebase && git push');
