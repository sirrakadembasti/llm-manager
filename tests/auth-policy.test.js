import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLMManager } from '../src/core.js';

const store = { getActive: async () => null, list: async () => ({ activeId: null, profiles: [] }) };
const basic = 'Basic ' + Buffer.from('admin:correct-password').toString('base64');
const request = (pathname, authorization) =>
  new Request(`http://localhost${pathname}`, {
    headers: authorization ? { authorization } : {}
  });

test('Web management fails closed without auth configuration and protects page and script', async () => {
  const manager = createLLMManager({ store, adminPassword: '', logger: { warn() {} } });
  for (const pathname of ['/llm', '/llm/llm-ui.js', '/api/llm/profiles']) {
    const response = await manager.fetch(request(pathname));
    assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'AUTH_NOT_CONFIGURED');
  }
});

test('Web Basic auth protects management and fetch options override credentials', async () => {
  const manager = createLLMManager({ store, adminPassword: 'correct-password' });
  assert.equal((await manager.fetch(request('/llm'))).status, 401);
  assert.equal((await manager.fetch(request('/llm', basic))).status, 200);
  assert.equal((await manager.fetch(request('/api/llm/profiles', basic))).status, 200);
  assert.equal((await manager.fetch(request('/llm', basic), { adminPassword: 'different' })).status, 401);
});

test('Web bearer principal has chat access only and authorize callback is awaited', async () => {
  const manager = createLLMManager({ store, chatTokens: ['client-secret'], adminPassword: 'correct-password' });
  assert.equal((await manager.fetch(request('/api/llm/profiles', 'Bearer client-secret'))).status, 403);
  const chat = () =>
    new Request('http://localhost/api/llm/chat', {
      method: 'POST',
      headers: { authorization: 'Bearer client-secret', 'X-LLM-CSRF': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello' })
    });
  assert.equal((await manager.fetch(chat())).status, 409);
  const adminOnly = createLLMManager({ store, chatTokens: ['client-secret'], chatAccess: 'admin' });
  assert.equal((await adminOnly.fetch(chat())).status, 403);
  assert.equal((await manager.fetch(request('/llm', basic), { authorize: async () => null })).status, 401);
  assert.equal((await manager.fetch(request('/llm'), { authorize: async () => ({ isAdmin: true }) })).status, 200);
});

test('Web health remains public and explicit insecureNoAuth is an opt-in', async () => {
  const manager = createLLMManager({ store, adminPassword: '' });
  assert.equal((await manager.fetch(request('/api/llm/health'))).status, 200);
  assert.equal((await manager.fetch(request('/llm'), { insecureNoAuth: true })).status, 200);
});

test('Express accepts chat-only Bearer and parses JSON without host middleware', async () => {
  const { default: express } = await import('express');
  const { mountLLMManagement } = await import('../src/index.js');
  const app = express();
  mountLLMManagement(app, {
    store: { ...store, save: async body => ({ id: 'saved', name: body.name }) },
    adminPassword: 'correct-password',
    chatTokens: ['client-secret'],
    rateLimit: false
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/llm`;
  try {
    const saved = await fetch(`${base}/profiles`, {
      method: 'POST',
      headers: { authorization: basic, 'X-LLM-CSRF': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'parsed-name' })
    });
    assert.equal(saved.status, 201);
    assert.equal((await saved.json()).name, 'parsed-name');
    const denied = await fetch(`${base}/profiles`, { headers: { authorization: 'Bearer client-secret' } });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).requestId, denied.headers.get('x-request-id'));
    const chat = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: { authorization: 'Bearer client-secret', 'X-LLM-CSRF': '1', 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi' })
    });
    assert.equal(chat.status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('Web auth failure limit uses client identity and can be disabled', async () => {
  const manager = createLLMManager({
    store,
    adminPassword: 'secret',
    getClientId: () => 'one-client',
    rateLimit: { authFailuresPerMinute: 2 }
  });
  assert.equal((await manager.fetch(request('/llm'))).status, 401);
  assert.equal((await manager.fetch(request('/llm'))).status, 401);
  const limited = await manager.fetch(request('/llm'));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  const disabled = createLLMManager({ store, adminPassword: 'secret', rateLimit: false });
  for (let i = 0; i < 12; i++) assert.equal((await disabled.fetch(request('/llm'))).status, 401);
});

test('init probe starts with generated chat token and explicit development origin', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { initLLMProject, probeAndOpenBrowser } = await import('../src/init.js');
  const { readEnv } = await import('../src/envFile.js');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-auth-'));
  let probe;
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ devDependencies: { vite: '^7' } }));
    initLLMProject({ cwd, type: 'spa', password: 'probe-password' });
    const env = readEnv(path.join(cwd, '.env'));
    probe = await probeAndOpenBrowser({ cwd, port: 0, password: 'probe-password', openBrowser: false });
    const endpoint = probe.url.replace('/llm', '/api/llm/chat');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + env.LLM_CHAT_TOKENS,
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1',
        Origin: 'http://localhost:5173'
      },
      body: JSON.stringify({ prompt: 'hi' })
    });
    assert.equal(response.status, 409);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  } finally {
    if (probe?.server) await new Promise(resolve => probe.server.close(resolve));
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
