import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { stopProjectProcess } from '../src/project/process.js';

// CLI: --trust-proxy ve LLM_TRUST_PROXY, ters vekil arkasındaki istemcileri X-Forwarded-For ile ayırır.
async function otherClientStatus(t, { args = [], envExtra = {} }) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-cli-trust-proxy-'));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^LLM_|^PORT$/.test(k)) delete env[k];
  env.LLM_ADMIN_PASSWORD = 'cli-trust-proxy-password';
  Object.assign(env, envExtra);
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../bin/llm-manager.js', import.meta.url)), '--port', String(port), ...args],
    { cwd: dir, env, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const exited = new Promise(resolve => child.once('close', resolve));
  t.after(async () => {
    await stopProjectProcess(child);
    await exited;
    await fs.rm(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('CLI did not start')), 20000);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`CLI exited ${code}`));
    });
    child.stdout.on('data', b => {
      if (b.toString().includes('LLM yönetimi:')) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  const wrong = 'Basic ' + Buffer.from('admin:yanlis-parola').toString('base64');
  const attempt = async client =>
    (
      await fetch(`http://127.0.0.1:${port}/api/llm/profiles`, {
        headers: { Authorization: wrong, 'X-Forwarded-For': client }
      })
    ).status;
  for (let i = 0; i < 10; i++) assert.equal(await attempt('203.0.113.1'), 401);
  assert.equal(await attempt('203.0.113.1'), 429);
  return attempt('203.0.113.2');
}

test('CLI --trust-proxy bayrağı istemcileri X-Forwarded-For ile ayırır', async t => {
  assert.equal(await otherClientStatus(t, { args: ['--trust-proxy', '1'] }), 401);
});

test('CLI LLM_TRUST_PROXY ortam değişkeni aynı etkiyi verir', async t => {
  assert.equal(await otherClientStatus(t, { envExtra: { LLM_TRUST_PROXY: '1' } }), 401);
});

test('CLI varsayılanda X-Forwarded-For başlığını yok sayar', async t => {
  assert.equal(await otherClientStatus(t, {}), 429);
});
