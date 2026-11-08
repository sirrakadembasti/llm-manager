import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initLLMProject, createChangeJournal } from '../src/init.js';
import { readEnv } from '../src/envFile.js';

function tempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writePackage(dir, dependencies = { express: '^4.19.2' }) {
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module', dependencies }));
}

test('init, git kökü olmayan uygulama kökünde LLM_PROJECT_ROOT=. yazar', t => {
  const cwd = tempDir('llm-root-plain-');
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  writePackage(cwd);
  initLLMProject({ cwd, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(cwd, '.env')).LLM_PROJECT_ROOT, '.');
});

test('init, Next.js hostunda uygulama kökü için LLM_PROJECT_ROOT=. yazar', t => {
  const cwd = tempDir('llm-root-next-');
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  writePackage(cwd, { next: '^16.0.0', react: '^19.0.0' });
  fs.mkdirSync(path.join(cwd, '.git'));
  initLLMProject({ cwd, type: 'nextjs', password: 'test-password-123' });
  assert.equal(readEnv(path.join(cwd, '.env')).LLM_PROJECT_ROOT, '.');
});

test('init, git deposunun alt klasöründeki helper için göreli kökü (..) yazar', t => {
  const repo = tempDir('llm-root-repo-');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.git'));
  const backend = path.join(repo, 'backend');
  fs.mkdirSync(backend);
  writePackage(backend);
  initLLMProject({ cwd: backend, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(backend, '.env')).LLM_PROJECT_ROOT, '..');

  const nested = path.join(repo, 'apps', 'api');
  fs.mkdirSync(nested, { recursive: true });
  writePackage(nested);
  initLLMProject({ cwd: nested, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(nested, '.env')).LLM_PROJECT_ROOT, '../..');
});

test('init, git worktree (.git dosyası) kökünü de tanır', t => {
  const repo = tempDir('llm-root-worktree-');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repo, '.git'), 'gitdir: /elsewhere/.git/worktrees/x\n');
  const backend = path.join(repo, 'backend');
  fs.mkdirSync(backend);
  writePackage(backend);
  initLLMProject({ cwd: backend, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(backend, '.env')).LLM_PROJECT_ROOT, '..');
});

test('init, mevcut LLM_PROJECT_ROOT değerini (boş olsa da) ezmez', t => {
  const repo = tempDir('llm-root-keep-');
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.mkdirSync(path.join(repo, '.git'));
  const backend = path.join(repo, 'backend');
  fs.mkdirSync(backend);
  writePackage(backend);
  fs.writeFileSync(path.join(backend, '.env'), 'LLM_PROJECT_ROOT=../src\n');
  initLLMProject({ cwd: backend, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(backend, '.env')).LLM_PROJECT_ROOT, '../src');

  const disabled = path.join(repo, 'disabled');
  fs.mkdirSync(disabled);
  writePackage(disabled);
  fs.writeFileSync(path.join(disabled, '.env'), 'LLM_PROJECT_ROOT=\n');
  initLLMProject({ cwd: disabled, type: 'express', password: 'test-password-123' });
  assert.equal(readEnv(path.join(disabled, '.env')).LLM_PROJECT_ROOT, '');
});

test('kurulum geri alma LLM_PROJECT_ROOT satırını kaldırır', t => {
  const cwd = tempDir('llm-root-rollback-');
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  writePackage(cwd);
  const before = 'PORT=3000\n';
  fs.writeFileSync(path.join(cwd, '.env'), before);
  const journal = createChangeJournal(cwd);
  initLLMProject({ cwd, type: 'express', password: 'test-password-123', journal });
  assert.equal(readEnv(path.join(cwd, '.env')).LLM_PROJECT_ROOT, '.');
  journal.rollback();
  const after = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.equal(after, before);
  assert.doesNotMatch(after, /LLM_PROJECT_ROOT/);
});

test('CLI init, .env içindeki LLM_PROJECT_ROOT değerini --project-root bayrağı saymaz', t => {
  const cwd = tempDir('llm-root-cli-');
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, '.env'), 'LLM_PROJECT_ROOT=.\n');
  const bin = fileURLToPath(new URL('../bin/llm-manager.js', import.meta.url));
  const env = { ...process.env };
  delete env.LLM_PROJECT_ROOT;
  // Desteklenmeyen tip, sihirbaz dosya yazmadan hemen çıksın diye seçildi.
  const result = spawnSync(process.execPath, [bin, 'init', '--type', 'yok-boyle-tip', '--yes'], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.doesNotMatch(result.stderr + result.stdout, /--project-root sunucu seçeneğidir/);

  const explicit = spawnSync(process.execPath, [bin, 'init', '--project-root', '.'], {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 30000
  });
  assert.equal(explicit.status, 1);
  assert.match(explicit.stderr, /--project-root sunucu seçeneğidir/);
});
