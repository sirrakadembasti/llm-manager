import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createStandaloneServer } from '../src/server.js';
import { stopProjectProcess } from '../src/project/process.js';

test('CLI project-root option exposes the configured source without scanning automatically', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-cli-'));
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/^LLM_|^PORT$/.test(k)) delete env[k];
  env.LLM_ADMIN_PASSWORD = 'project-cli-password';
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL('../bin/llm-manager.js', import.meta.url)), '--project-root', dir, '--port', String(port)],
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
  const response = await fetch(`http://127.0.0.1:${port}/api/llm/project`, {
    headers: { Authorization: 'Basic ' + Buffer.from('admin:project-cli-password').toString('base64') }
  });
  assert.equal(response.status, 200);
  const status = await response.json();
  assert.equal(status.enabled, true);
  assert.equal(status.inventory, null);
});

test('standalone close cancels a pending project model request before draining HTTP', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-close-'));
  await fs.writeFile(path.join(dir, 'app.js'), 'export const app = 1;');
  let entered;
  const started = new Promise(resolve => {
    entered = resolve;
  });
  const server = await createStandaloneServer({
    port: 0,
    adminPassword: 'project-close-password',
    project: { root: dir },
    rateLimit: false,
    store: {
      getActive: () => ({
        id: 'a',
        provider: 'custom',
        model: 'fixture',
        apiKey: 'synthetic',
        baseURL: 'https://example.com/v1'
      }),
      get: () => null
    },
    generate: async (_messages, options) => {
      entered();
      return await new Promise((_, reject) =>
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      );
    }
  });
  t.after(async () => {
    await server.close();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const response = fetch(`http://127.0.0.1:${server.port}/api/llm/project/chat`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from('admin:project-close-password').toString('base64'),
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ prompt: 'Açıkla', shareSources: true })
  });
  await started;
  const timeout = setTimeout(() => server.server.closeAllConnections(), 1500);
  t.after(() => clearTimeout(timeout));
  await server.close();
  const result = await response;
  assert.equal(result.status, 499);
  assert.equal(server.server.listening, false);
});
