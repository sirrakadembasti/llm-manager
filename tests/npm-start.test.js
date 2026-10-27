import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('npm start serves health and the authenticated management page', async t => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-npm-start-'));
  const password = 'npm-start-fixture-password';
  const args = ['start'];
  const proc = spawn(
    process.platform === 'win32' ? process.execPath : 'npm',
    process.platform === 'win32'
      ? [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args]
      : args,
    {
      cwd,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        PORT: '0',
        LLM_ADMIN_PASSWORD: password,
        LLM_CONFIG_PATH: path.join(dir, 'profiles.json'),
        LLM_CONFIG_KEY_PATH: path.join(dir, 'key'),
        LLM_CONFIG_ENCRYPTION_KEY: 'a'.repeat(64)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  let output = '';
  const exited = new Promise(resolve => proc.once('close', resolve));
  t.after(async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      if (process.platform === 'win32') {
        execFileSync(
          path.join(process.env.SystemRoot, 'System32', 'taskkill.exe'),
          ['/PID', String(proc.pid), '/T', '/F'],
          {
            stdio: 'pipe'
          }
        );
      } else process.kill(-proc.pid, 'SIGTERM');
    }
    await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`npm start did not become ready: ${output}`)), 15000);
    const fail = error => {
      clearTimeout(timer);
      reject(error);
    };
    proc.once('error', fail);
    proc.once('exit', code => fail(new Error(`npm start exited ${code}: ${output}`)));
    proc.stderr.on('data', data => (output += data));
    proc.stdout.on('data', data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+\/llm/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
  });
  const health = await fetch(new URL('/api/llm/health', url));
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  const denied = await fetch(url);
  assert.equal(denied.status, 401);
  await denied.text();
  const page = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}` }
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/);
});
