import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initLLMProject } from '../src/init.js';

for (const scenario of [
  'express',
  'express-cjs',
  'spa',
  'nextjs',
  'nuxt',
  'sveltekit',
  'electron',
  'dotnet',
  'python',
  'tauri'
]) {
  const type = scenario === 'express-cjs' ? 'express' : scenario;
  test(`init ${scenario} keeps admin password exclusively in ignored env file`, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'init-secrets-'));
    try {
      fs.writeFileSync(
        path.join(cwd, 'package.json'),
        JSON.stringify({ type: scenario === 'express-cjs' ? 'commonjs' : 'module' })
      );
      const password = 'test-only-StrongSecret-123';
      initLLMProject({ cwd, type, password });
      assert.ok(fs.readFileSync(path.join(cwd, '.env'), 'utf8').includes(`LLM_ADMIN_PASSWORD=${password}`));
      for (const file of fs.readdirSync(cwd, { recursive: true })) {
        const full = path.join(cwd, file);
        if (!fs.statSync(full).isFile() || file === '.env') continue;
        assert.ok(!fs.readFileSync(full, 'utf8').includes(password), `Secret leaked in ${file}`);
      }
      const ignored = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
      for (const entry of ['data/', '.env', '.env.local', '*.key']) assert.ok(ignored.split(/\r?\n/).includes(entry));
      assert.equal(JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'))).scripts.llm, 'llm-manager');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('repeat init preserves generated credentials', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'init-repeat-'));
  try {
    initLLMProject({ cwd, type: 'spa' });
    const before = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
    initLLMProject({ cwd, type: 'spa' });
    assert.equal(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), before);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('environment updates preserve CRLF and comments and reject injected lines', async () => {
  const { upsertEnv, ensureGitignore } = await import('../src/envFile.js');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'env-preserve-'));
  try {
    const env = path.join(cwd, '.env');
    fs.writeFileSync(env, '# keep\r\nKEY=old\r\nOTHER=value\r\n');
    upsertEnv(env, { KEY: 'new' });
    assert.equal(fs.readFileSync(env, 'utf8'), '# keep\r\nKEY=new\r\nOTHER=value\r\n');
    assert.throws(() => upsertEnv(env, { KEY: 'line\nEVIL=true' }));
    ensureGitignore(cwd);
    const once = fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8');
    ensureGitignore(cwd);
    assert.equal(fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8'), once);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
