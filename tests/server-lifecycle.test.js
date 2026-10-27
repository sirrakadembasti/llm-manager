import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { createStandaloneServer } from '../src/server.js';
import { probeAndOpenBrowser } from '../src/init.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixture = fileURLToPath(new URL('./fixtures/server-lifecycle-child.js', import.meta.url));
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-lifecycle-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function host(dir, packageRoot = root) {
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    '{"type":"module","dependencies":{"@sirrakadembasti/llm-manager":"2.0.0"}}'
  );
  const installed = path.join(dir, 'node_modules/@sirrakadembasti/llm-manager');
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.symlinkSync(packageRoot, installed, process.platform === 'win32' ? 'junction' : 'dir');
}
function child(t, mode, dir, entry = '', args = []) {
  const startedAt = Date.now();
  const phases = [{ phase: 'fork requested', elapsedMs: 0 }];
  const mark = phase => phases.push({ phase, elapsedMs: Date.now() - startedAt });
  let watchdogFired = false;
  const proc = fork(fixture, [mode, entry, dir, ...args], {
    cwd: dir,
    silent: true,
    execArgv: ['--disable-warning=ExperimentalWarning'],
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', LLM_ADMIN_PASSWORD: 'lifecycle-password', LLM_DATA_DIR: dir }
  });
  let stdout = '';
  let stderr = '';
  proc.once('spawn', () => mark('spawned'));
  proc.stdout.on('data', data => (stdout += data));
  proc.stderr.on('data', data => (stderr += data));
  const diagnostic = (code, signal) =>
    JSON.stringify({
      mode,
      elapsedMs: Date.now() - startedAt,
      pid: proc.pid,
      code,
      signal,
      watchdogFired,
      phases,
      stdout: stdout.replaceAll('lifecycle-password', '[REDACTED]'),
      stderr: stderr.replaceAll('lifecycle-password', '[REDACTED]')
    });
  const exited = new Promise(resolve =>
    proc.on('close', (code, signal) => {
      mark('closed');
      t.diagnostic(`Lifecycle child: ${diagnostic(code, signal)}`);
      resolve({ code, signal, stdout, stderr });
    })
  );
  const ready = new Promise((resolve, reject) => {
    proc.once('message', message => {
      mark('ready');
      resolve(message);
    });
    proc.once('exit', (code, signal) => reject(new Error(`Child exited before ready: ${diagnostic(code, signal)}`)));
  });
  ready.catch(() => {});
  const timer = setTimeout(() => {
    watchdogFired = true;
    mark('watchdog kill');
    proc.kill('SIGKILL');
  }, 15000);
  t.after(async () => {
    clearTimeout(timer);
    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
    await exited;
  });
  return { proc, ready, exited, mark };
}

test('owned manual/raw close is idempotent and removes only its own signal listeners', async t => {
  const dir = temporary(t);
  const hostHandler = () => {};
  process.on('SIGINT', hostHandler);
  process.on('SIGTERM', hostHandler);
  t.after(() => {
    process.off('SIGINT', hostHandler);
    process.off('SIGTERM', hostHandler);
  });
  const baseline = ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal));
  const options = { port: 0, adminPassword: 'test-password', dataDir: dir, handleSignals: true };
  const first = await createStandaloneServer(options);
  const second = await createStandaloneServer(options);
  t.after(() => first.close());
  t.after(() => second.close());
  assert.equal(process.listenerCount('SIGINT'), baseline[0].length + 2);
  const closed = once(first.server, 'close');
  first.server.close();
  await closed;
  assert.equal(process.listenerCount('SIGINT'), baseline[0].length + 1);
  assert.equal(process.listenerCount('SIGTERM'), baseline[1].length + 1);
  await first.close();
  const closing = second.close();
  assert.equal(second.close(), closing);
  await closing;
  assert.deepEqual(
    ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal)),
    baseline
  );
});

test('probe raw auto-close releases opted-in signal ownership', async t => {
  const dir = temporary(t);
  const baseline = ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal));
  const result = await probeAndOpenBrowser({
    cwd: dir,
    port: 0,
    openBrowser: false,
    autoCloseStartedServer: true,
    handleSignals: true
  });
  assert.equal(result.ok, true);
  assert.equal(result.server.listening, false);
  assert.deepEqual(
    ['SIGINT', 'SIGTERM'].map(signal => process.listeners(signal)),
    baseline
  );
});

test('factory, probe and interactive init defaults preserve host signal ownership in a real child', async t => {
  const dir = temporary(t);
  host(dir);
  const run = child(t, 'host-default', dir);
  const result = await run.exited;
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /HOST_OWNS_SIGNALS/);
});

for (const mode of ['factory', 'probe-owner', 'cli', 'cli-init', 'example']) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`${mode} gracefully closes on ${signal} (${process.platform === 'win32' ? 'Node callback delivery via IPC' : 'OS signal'})`, async t => {
      const dir = temporary(t);
      if (mode === 'cli-init') host(dir);
      const entry = mode === 'example' ? path.join(root, 'examples/server.js') : path.join(root, 'bin/llm-manager.js');
      const args = mode === 'cli-init' ? ['init', '--type', 'spa', '--yes', '--no-open'] : [];
      const run = child(t, mode, dir, entry, args);
      const { url } = await run.ready;
      run.mark('HTTP request started');
      const response = await fetch(url, {
        headers: { Authorization: 'Basic ' + Buffer.from('admin:lifecycle-password').toString('base64') }
      });
      assert.equal(response.status, 200);
      run.mark('HTTP headers received');
      await response.text();
      run.mark('HTTP body consumed');
      run.mark(`sending ${signal}`);
      if (process.platform === 'win32') run.proc.send(signal);
      else run.proc.kill(signal);
      const result = await run.exited;
      assert.equal(result.code, 0, result.stderr);
      assert.equal(result.signal, null);
      assert.match(result.stdout, /SERVER_CLOSED/);
    });
  }
}

test('owner exits 1 at ten seconds with a pending HTTP request and repeated signals do not extend deadline', async t => {
  const run = child(t, 'deadline', temporary(t));
  const result = await run.exited;
  assert.equal(result.code, 1, result.stderr);
  assert.equal(result.stderr, '');
  assert.match(result.stdout, /ALIVE_AT_9999/);
  assert.doesNotMatch(result.stdout, /SERVER_CLOSED/);
});

test('successful signal close cancels deadline and releases its own listeners', async t => {
  const run = child(t, 'timer-cleanup', temporary(t));
  const result = await run.exited;
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /TIMER_CLEANED/);
});

test('close waits for active requests when raw server.close was already called', async t => {
  const result = await child(t, 'raw-pending', temporary(t)).exited;
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /RAW_CLOSE_DRAINED/);
});

test('CLI package without examples serves HTTP and honors host, data-dir and chat-token flags', async t => {
  const dir = temporary(t);
  for (const name of ['bin', 'src', 'public', 'types'])
    fs.cpSync(path.join(root, name), path.join(dir, name), { recursive: true });
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  pkg.files = pkg.files.filter(name => name !== 'examples');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(dir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  assert.equal(fs.existsSync(path.join(dir, 'examples')), false);
  const dataDir = path.join(dir, 'custom-data');
  const run = child(t, 'cli', dir, path.join(dir, 'bin/llm-manager.js'), [
    '--host',
    '0.0.0.0',
    '--data-dir',
    dataDir,
    '--chat-token',
    'cli-client-token'
  ]);
  const { url, address } = await run.ready;
  assert.equal(address, '0.0.0.0');
  const origin = new URL(url).origin;
  const adminHeaders = {
    Authorization: 'Basic ' + Buffer.from('admin:lifecycle-password').toString('base64'),
    'Content-Type': 'application/json',
    'X-LLM-CSRF': '1'
  };
  const page = await fetch(url, { headers: adminHeaders });
  assert.equal(page.status, 200);
  await page.text();
  for (const [token, status] of [
    ['wrong-token', 401],
    ['cli-client-token', 409]
  ]) {
    const response = await fetch(`${origin}/api/llm/chat`, {
      method: 'POST',
      headers: { ...adminHeaders, Authorization: 'Bearer ' + token },
      body: JSON.stringify({ prompt: 'hello' })
    });
    assert.equal(response.status, status);
    await response.text();
  }
  const saved = await fetch(`${origin}/api/llm/profiles`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'CLI fixture',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'fixture-secret',
      baseURL: 'https://api.openai.com/v1'
    })
  });
  assert.equal(saved.status, 201);
  await saved.text();
  assert.equal(fs.existsSync(path.join(dataDir, 'llm-profiles.json')), true);
  assert.equal(fs.existsSync(path.join(dataDir, 'llm-encryption.key')), true);
  if (process.platform === 'win32') run.proc.send('SIGTERM');
  else run.proc.kill('SIGTERM');
  const result = await run.exited;
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /SERVER_CLOSED/);
});
