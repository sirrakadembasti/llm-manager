import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function checkStart(t, { fileEnv, shellEnv = {}, user = 'admin', password = 'npm-start-fixture-password' } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-npm-start-'));
  fs.symlinkSync(path.join(root, 'examples'), path.join(dir, 'examples'), 'junction');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ private: true, scripts: { start: pkg.scripts.start } })
  );
  if (fileEnv) fs.writeFileSync(path.join(dir, '.env'), fileEnv);
  const env = { ...process.env };
  // Keep the fixture independent of developer credentials and Node startup flags.
  for (const key of Object.keys(env)) {
    if (/^(LLM_|PORT$|NODE_OPTIONS$)/i.test(key)) delete env[key];
  }
  const args = ['start'];
  const proc = spawn(
    process.platform === 'win32' ? process.execPath : 'npm',
    process.platform === 'win32'
      ? [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args]
      : args,
    {
      cwd: dir,
      detached: process.platform !== 'win32',
      env: {
        ...env,
        PORT: '0',
        LLM_CONFIG_PATH: path.join(dir, 'profiles.json'),
        LLM_CONFIG_KEY_PATH: path.join(dir, 'key'),
        LLM_CONFIG_ENCRYPTION_KEY: 'a'.repeat(64),
        ...shellEnv
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
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` }
  });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<html/);
  const wrongPassword = await fetch(url, {
    headers: { Authorization: `Basic ${Buffer.from(`${user}:incorrect-password`).toString('base64')}` }
  });
  assert.equal(wrongPassword.status, 401);
  await wrongPassword.text();
}

test('npm start serves health and the authenticated management page without an env file', async t => {
  await checkStart(t, { shellEnv: { LLM_ADMIN_PASSWORD: 'npm-start-fixture-password' } });
});

test('npm start reads the admin user and password from the working directory env file', async t => {
  await checkStart(t, {
    fileEnv: 'LLM_ADMIN_USER=file-admin\nLLM_ADMIN_PASSWORD="file-password # quoted"\n',
    user: 'file-admin',
    password: 'file-password # quoted'
  });
});

test('npm start keeps shell credentials ahead of env file credentials', async t => {
  await checkStart(t, {
    fileEnv: 'LLM_ADMIN_USER=file-admin\nLLM_ADMIN_PASSWORD=file-password\n',
    shellEnv: { LLM_ADMIN_USER: 'shell-admin', LLM_ADMIN_PASSWORD: 'shell-password' },
    user: 'shell-admin',
    password: 'shell-password'
  });
});
