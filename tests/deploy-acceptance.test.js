import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createServer } from 'node:net';

const root = join(import.meta.dirname, '..');
const checkScript = join(root, 'scripts', 'acceptance', 'deploy-check.mjs');
const run = promisify(execFile);
const password = 'kabul-test-parolasi';

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

async function startServer(port, dataDir, extra = []) {
  const child = spawn(
    process.execPath,
    [join(root, 'bin', 'llm-manager.js'), '--port', String(port), '--data-dir', dataDir, ...extra],
    { cwd: dataDir, env: { ...process.env, LLM_ADMIN_PASSWORD: password }, stdio: 'ignore' }
  );
  return child;
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill();
  await exited;
}

const check = (base, phase, extra = []) =>
  run(process.execPath, [checkScript, '--base', base, '--phase', phase, '--wait', '20', ...extra], {
    env: { ...process.env, LLM_ADMIN_PASSWORD: password }
  });

test('deploy check script verifies access, CSRF and profile persistence across restarts', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'llm-deploy-check-'));
  const port = await freePort();
  let server = await startServer(port, dataDir);
  try {
    const created = await check(`http://127.0.0.1:${port}`, 'create');
    assert.match(created.stdout, /KABUL TAMAM \(create\)/);
    await stopServer(server);
    server = await startServer(port, dataDir);
    const verified = await check(`http://127.0.0.1:${port}`, 'verify');
    assert.match(verified.stdout, /KABUL TAMAM \(verify\)/);
    assert.doesNotMatch(created.stdout + verified.stdout, new RegExp(password));
  } finally {
    await stopServer(server);
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('deploy check script follows custom page and API paths behind a prefix', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'llm-deploy-prefix-'));
  const port = await freePort();
  const server = await startServer(port, dataDir, ['--page-path', '/stok/llm', '--api-path', '/stok/api/llm']);
  try {
    const result = await check(`http://127.0.0.1:${port}`, 'create', [
      '--page-path',
      '/stok/llm',
      '--api-path',
      '/stok/api/llm'
    ]);
    assert.match(result.stdout, /KABUL TAMAM \(create\)/);
  } finally {
    await stopServer(server);
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('deploy check script fails when the profile did not survive a restart', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'llm-deploy-empty-'));
  const port = await freePort();
  const server = await startServer(port, dataDir);
  try {
    await assert.rejects(check(`http://127.0.0.1:${port}`, 'verify'), error => {
      assert.match(error.stdout + error.stderr, /kabul profili bulunamadı/);
      return true;
    });
  } finally {
    await stopServer(server);
    rmSync(dataDir, { recursive: true, force: true });
  }
});

test('deployment acceptance workflow covers Docker, Nginx HTTPS with systemd and IIS', () => {
  const workflow = readFileSync(join(root, '.github', 'workflows', 'deploy-acceptance.yml'), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:\s*\n\s*- cron:/);
  assert.match(workflow, /tags:\s*\[\s*['"]?v\*/);
  for (const job of ['docker:', 'linux-service:', 'windows-iis:']) assert.match(workflow, new RegExp(`^  ${job}`, 'm'));
  assert.match(workflow, /docker build/);
  assert.match(workflow, /systemctl restart/);
  assert.match(workflow, /Restart=on-failure/);
  assert.match(workflow, /listen 443 ssl/);
  assert.match(workflow, /Install-WindowsFeature/);
  assert.match(workflow, /deploy-check\.mjs[^\n]*--phase verify/);
  assert.match(workflow, /::add-mask::/);
});
