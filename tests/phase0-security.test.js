import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createLLMManager, mountLLMManagement } from '../src/index.js';
import { initLLMProject, runInteractiveInit } from '../src/init.js';
import { readEnv } from '../src/envFile.js';
import { createStandaloneServer } from '../src/server.js';
function installHostFixture(cwd) {
  const target = path.join(cwd, 'node_modules/@sirrakadembasti/llm-manager');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(path.resolve('.'), target, process.platform === 'win32' ? 'junction' : 'dir');
}

test('G02: Web profile writes require configured admin authentication and warn only once', async () => {
  let writes = 0;
  const warnings = [];
  const store = {
    save: async input => {
      writes++;
      return { id: 'saved', name: input.name };
    }
  };
  const post = authorization =>
    new Request('http://localhost/api/llm/profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1',
        ...(authorization ? { Authorization: authorization } : {})
      },
      body: JSON.stringify({ name: 'profile' })
    });
  const unconfigured = createLLMManager({
    store,
    adminPassword: '',
    logger: { warn: (...args) => warnings.push(args) }
  });
  for (let i = 0; i < 2; i++) {
    const response = await unconfigured.fetch(post());
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'AUTH_NOT_CONFIGURED');
  }
  assert.equal(warnings.length, 1);
  assert.equal(writes, 0);
  const manager = createLLMManager({ store, adminPassword: 'admin-password', rateLimit: false });
  const denied = await manager.fetch(post());
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get('www-authenticate'), 'Basic realm="LLM Yonetimi"');
  assert.equal(writes, 0);
  const accepted = await manager.fetch(post('Basic ' + Buffer.from('admin:admin-password').toString('base64')));
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).id, 'saved');
  assert.equal(writes, 1);
});

test('G01/G24: Express chat token cannot authenticate the management page or script', async () => {
  const app = express();
  mountLLMManagement(app, {
    store: {},
    adminPassword: 'admin-password',
    chatTokens: ['chat-token'],
    rateLimit: false
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const route of ['/llm', '/llm/llm-ui.js', '/api/llm/profiles']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        headers: { Authorization: 'Bearer chat-token' }
      });
      assert.equal(response.status, 403, route);
      assert.equal((await response.json()).code, 'FORBIDDEN');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

for (const type of ['spa', 'tauri']) {
  test(`G06: ${type} init selects the Vite origin only for a detected Vite project`, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-origin-'));
    try {
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
      initLLMProject({ cwd, type });
      assert.equal(readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS, undefined);
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ devDependencies: { vite: '^7' } }));
      initLLMProject({ cwd, type });
      assert.equal(readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS, 'http://localhost:5173');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('G06: non-Vite interactive init asks for the actual origin and persists it', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-origin-prompt-'));
  const questions = [];
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
    installHostFixture(cwd);
    const result = await runInteractiveInit({
      installRunner() {
        assert.fail('Unexpected network installer');
      },
      cwd,
      type: 'spa',
      port: 0,
      openBrowser: false,
      autoCloseServer: true,
      logger() {},
      askQuestion: prompt => {
        questions.push(prompt);
        return /origin/i.test(prompt) ? 'https://app.example' : 'e';
      }
    });
    assert.equal(result.ok, true);
    assert.ok(questions.some(prompt => /origin/i.test(prompt)));
    assert.equal(readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS, 'https://app.example');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('G03/G02/G24: Web chat policy blocks generation and restricts Bearer overrides', async () => {
  let calls = 0;
  const store = { getActive: async () => ({ id: 'active', provider: 'openai', model: 'test-model' }) };
  const generate = async () => {
    calls++;
    return 'safe-answer';
  };
  const chat = () =>
    new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer chat-token', 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
      body: JSON.stringify({ prompt: 'hello', profileId: 'forbidden-profile', timeoutMs: 1, maxOutputTokens: 1 })
    });
  for (const [chatAccess, status, code] of [
    [false, 404, 'CHAT_DISABLED'],
    ['admin', 403, 'FORBIDDEN']
  ]) {
    const manager = createLLMManager({ store, generate, chatAccess, chatTokens: ['chat-token'], rateLimit: false });
    const response = await manager.fetch(chat());
    assert.equal(response.status, status);
    assert.equal((await response.json()).code, code);
    assert.equal(calls, 0);
  }
  const manager = createLLMManager({ store, generate, chatTokens: ['chat-token'], rateLimit: false });
  const response = await manager.fetch(chat());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content, 'safe-answer');
  assert.equal(calls, 1);
});

test('G06: wildcard CORS follows the configured API chat route and excludes management', async () => {
  const server = await createStandaloneServer({
    port: 0,
    adminPassword: 'admin-password',
    allowedOrigins: '*',
    apiPath: '/chat',
    store: {},
    logger: { info() {}, warn() {} }
  });
  try {
    for (const [route, expected] of [
      ['/chat', null],
      ['/chat/profiles', null],
      ['/chat/chat', '*'],
      ['/chat/chat/', '*']
    ]) {
      const response = await fetch(`http://127.0.0.1:${server.port}${route}`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' }
      });
      assert.equal(response.headers.get('access-control-allow-origin'), expected, route);
      assert.equal(response.headers.get('access-control-allow-credentials'), null);
    }
  } finally {
    await server.close();
  }
});

test('G06: invalid or wildcard scaffold origins are rejected before creating secret files', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-invalid-origin-'));
  try {
    for (const allowedOrigins of [
      '*',
      'null',
      'https://app.example/path',
      'file://',
      'https://user:pass@app.example'
    ]) {
      assert.throws(() => initLLMProject({ cwd, type: 'spa', allowedOrigins }), /Geçersiz CORS origin/);
      assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
    }
    initLLMProject({ cwd, type: 'spa', allowedOrigins: ['https://app.example', 'http://localhost:3000'] });
    assert.equal(readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS, 'https://app.example,http://localhost:3000');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('G06: explicit empty origins disable a previously configured CORS allowlist', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-disable-origin-'));
  try {
    for (const allowedOrigins of ['', []]) {
      fs.writeFileSync(path.join(cwd, '.env'), 'LLM_ALLOWED_ORIGINS=https://old.example\n');
      initLLMProject({ cwd, type: 'spa', allowedOrigins });
      assert.equal(readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS, '');
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('G04/G05: init -y generates ignored random credentials without logging them or enabling unknown origins', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'phase0-yes-'));
  const logs = [];
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
    installHostFixture(cwd);
    const result = await runInteractiveInit({
      installRunner() {
        assert.fail('Unexpected network installer');
      },
      cwd,
      type: 'spa',
      yes: true,
      port: 0,
      openBrowser: false,
      autoCloseServer: true,
      logger: message => logs.push(message)
    });
    assert.equal(result.ok, true);
    const env = readEnv(path.join(cwd, '.env'));
    assert.match(env.LLM_ADMIN_PASSWORD, /^[A-Za-z0-9_-]{24}$/);
    assert.match(env.LLM_CHAT_TOKENS, /^[A-Za-z0-9_-]{32}$/);
    assert.equal(env.LLM_ALLOWED_ORIGINS, '');
    assert.equal(readEnv(path.join(cwd, '.env.local')).VITE_LLM_CHAT_TOKEN, env.LLM_CHAT_TOKENS);
    const output = logs.join('\n');
    assert.ok(!output.includes(env.LLM_ADMIN_PASSWORD));
    assert.ok(!output.includes(env.LLM_CHAT_TOKENS));
    assert.ok(!fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8').includes(env.LLM_ADMIN_PASSWORD));
    assert.equal(JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'))).scripts.llm, 'llm-manager');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
