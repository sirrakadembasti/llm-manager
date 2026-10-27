import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createLLMProfileStore, createUiAssets, mountLLMManagement } from '../src/index.js';
import { buildProviderRequest, classifyLLMError, generateProfileResponse } from '../src/runtime.js';

test('conversation runtime rejects nonempty truncated answers for every transport', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ finish_reason: 'length', message: { content: 'partial' } }],
        candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }],
        stop_reason: 'max_tokens',
        content: [{ type: 'text', text: 'partial' }]
      })
    );
  try {
    for (const purpose of [undefined, 'diagnostic']) {
      for (const transport of ['openai', 'google', 'anthropic']) {
        await assert.rejects(
          () =>
            generateProfileResponse(
              [],
              {
                provider: 'custom',
                transport,
                model: 'model',
                baseURL: 'https://provider.example/v1',
                apiKey: 'fixture'
              },
              { purpose }
            ),
          error => error.code === 'LLM_TRUNCATED'
        );
      }
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('runtime controls, credentials and revision fencing survive reload', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-plugin-'));
  try {
    const options = { filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) };
    const store = createLLMProfileStore(options);
    const profile = await store.save({
      name: 'MiMo',
      provider: 'xiaomi_mimo',
      model: 'model',
      baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1',
      apiKey: 'private-key',
      timeoutMs: 90000,
      maxOutputTokens: 2048
    });
    await store.activate(profile.id, profile.revision);
    assert.equal((await createLLMProfileStore(options).getActive()).timeoutMs, 90000);
    assert.ok(!JSON.stringify(await store.list()).includes('private-key'));
    assert.ok(!fs.readFileSync(options.filePath, 'utf8').includes('private-key'));
    await assert.rejects(() => store.save({ ...profile, revision: 'stale', apiKey: '' }), /değiştirildi/);
    const edited = await store.save({ ...profile, name: 'Changed', apiKey: '' });
    assert.equal(await store.recordTest(profile.id, 'passed', profile.revision), null);
    await store.recordTest(profile.id, 'passed', edited.revision, { mode: 'quick', durationMs: 10 });
    await store.recordTest(profile.id, 'failed', edited.revision, {
      mode: 'conversation',
      durationMs: 90000,
      code: 'LLM_TIMEOUT'
    });
    const latest = (await store.list()).profiles[0];
    assert.equal(latest.lastTests.quick.status, 'passed');
    assert.equal(latest.lastTests.conversation.code, 'LLM_TIMEOUT');
    assert.equal((await store.getActive()).apiKey, 'private-key');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('MiMo Manager speed policy leaves production reasoning and other providers unchanged', () => {
  const profile = {
    provider: 'xiaomi_mimo',
    transport: 'openai',
    model: 'mimo',
    baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1',
    apiKey: 'key'
  };
  const manager = buildProviderRequest(profile, [{ role: 'user', content: 'Planla' }], { purpose: 'diagnostic' });
  assert.deepEqual(manager.body.thinking, { type: 'disabled' });
  assert.equal(manager.body.max_completion_tokens, 8192);
  assert.equal(buildProviderRequest(profile, [], {}).body.thinking, undefined);
  assert.deepEqual(
    buildProviderRequest({ ...profile, thinking: 'enabled' }, [], { purpose: 'diagnostic' }).body.thinking,
    { type: 'enabled' }
  );
  assert.equal(
    buildProviderRequest({ ...profile, provider: 'custom' }, [], { purpose: 'diagnostic' }).body.thinking,
    undefined
  );
});

test('provider failure classification never returns upstream text or credentials', () => {
  for (const [error, code] of [
    [new DOMException('private-key', 'TimeoutError'), 'LLM_TIMEOUT'],
    [Object.assign(new Error('private-key'), { upstreamStatus: 429 }), 'LLM_RATE_LIMIT'],
    [Object.assign(new Error('private-key'), { upstreamStatus: 401 }), 'LLM_AUTH'],
    [Object.assign(new Error('private-key'), { code: 'LLM_EMPTY_RESPONSE' }), 'LLM_EMPTY_RESPONSE']
  ]) {
    const result = classifyLLMError(error);
    assert.equal(result.code, code);
    assert.ok(!JSON.stringify(result).includes('private-key'));
  }
});

test('custom mounted plugin enforces auth/CSRF and stores actual conversation diagnostics', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-plugin-http-'));
  const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'bc'.repeat(32) });
  const profile = await store.save({
    name: 'Test',
    provider: 'custom',
    model: 'test',
    baseURL: 'https://provider.example/v1',
    apiKey: 'secret'
  });
  const app = express();
  app.use(express.json());
  const calls = [];
  mountLLMManagement(app, {
    store,
    apiPath: '/admin-api/models',
    pagePath: '/admin-models',
    requireAuth: (req, res, next) => {
      if (req.get('Authorization') !== 'fixture') return res.sendStatus(401);
      req.user = { isAdmin: true };
      next();
    },
    generate: async (messages, options) => {
      calls.push({ messages, options });
      return 'Plan';
    }
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/admin-api/models/profiles`)).status, 401);
    const headers = { Authorization: 'fixture', 'content-type': 'application/json' };
    const profilesResp = await fetch(`${base}/admin-api/models/profiles`, { headers });
    assert.equal(profilesResp.status, 200);
    assert.equal(profilesResp.headers.get('cache-control'), 'no-store');
    assert.equal(profilesResp.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(profilesResp.headers.get('x-frame-options'), 'DENY');
    const endpoint = `${base}/admin-api/models/profiles/${profile.id}/test`;
    assert.equal((await fetch(endpoint, { method: 'POST', headers })).status, 403);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'X-LLM-CSRF': '1' },
      body: JSON.stringify({ mode: 'conversation' })
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, 'conversation');
    assert.ok(result.durationMs >= 0);
    assert.equal(calls[0].options.purpose, 'diagnostic');
    assert.equal(calls[0].messages[0].role, 'system');
    assert.equal((await store.list()).profiles[0].lastTest.mode, 'conversation');
    const pageResp = await fetch(`${base}/admin-models`, { headers });
    assert.equal(pageResp.headers.get('cache-control'), 'no-store');
    assert.equal(pageResp.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(pageResp.headers.get('x-frame-options'), 'DENY');
    assert.ok(pageResp.headers.get('content-security-policy')?.includes("default-src 'self'"));
    const html = await pageResp.text();
    assert.ok(html.includes('/admin-models/llm-ui.js'));
    assert.ok(html.includes('data-api-base="/admin-api/models"'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('createUiAssets rejects invalid mount paths and Express 4 forwards async store errors to next(err)', async () => {
  assert.throws(() => createUiAssets({ pagePath: '/llm/' }), /Geçersiz eklenti mount yolu/);
  assert.throws(() => createUiAssets({ apiPath: '/llm"onload="alert(1)' }), /Geçersiz eklenti mount yolu/);
  assert.throws(() => createUiAssets({ pagePath: '/llm//sub' }), /Geçersiz eklenti mount yolu/);

  const app = express();
  mountLLMManagement(app, {
    store: {
      list() {
        throw new Error('corrupted store');
      }
    },
    requireAuth: (req, _res, next) => {
      req.user = { isAdmin: true };
      next();
    }
  });
  app.use((err, _req, res, _next) => {
    res.status(500).json({ caught: err.message });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(`${base}/api/llm/profiles`);
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { caught: 'corrupted store', requestId: res.headers.get('x-request-id') });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('framework-agnostic core handles CRUD, activation, testing and unknown routes without Express', async () => {
  const { createLLMManager } = await import('../src/core.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-core-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'cd'.repeat(32) });
    const manager = createLLMManager({ store, generate: async () => 'OK' });

    assert.equal(await manager.handle({ method: 'GET', path: '/unknown' }), null);

    const created = await manager.handle({
      method: 'POST',
      path: '/profiles',
      body: {
        name: 'Core',
        provider: 'custom',
        model: 'm1',
        baseURL: 'https://provider.example/v1',
        apiKey: 'secret-key'
      }
    });
    assert.equal(created.status, 201);
    assert.ok(!JSON.stringify(created.body).includes('secret-key'));

    const activated = await manager.handle({
      method: 'POST',
      path: `/profiles/${created.body.id}/activate`,
      body: { revision: created.body.revision }
    });
    assert.equal(activated.status, 200);
    assert.equal(activated.body.activeId, created.body.id);

    const tested = await manager.handle({
      method: 'POST',
      path: `/profiles/${created.body.id}/test`,
      body: { mode: 'quick' }
    });
    assert.equal(tested.status, 200);
    assert.equal(tested.body.ok, true);

    const listed = await manager.handle({ method: 'GET', path: '/profiles' });
    const latestRev = listed.body.profiles[0].revision;
    const removed = await manager.handle({
      method: 'DELETE',
      path: `/profiles/${created.body.id}`,
      body: { revision: latestRev }
    });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.profiles.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('POST /chat endpoint supports active and explicit profileId, enforces chatAccess, and never leaks apiKey', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-chat-'));
  const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'de'.repeat(32) });
  const p1 = await store.save({
    name: 'Aktif Model',
    provider: 'openai',
    model: 'gpt-4.1',
    baseURL: 'https://api.openai.com/v1',
    apiKey: 'sk-secret-1'
  });
  const p2 = await store.save({
    name: 'Yedek Model',
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: 'sk-secret-2'
  });

  const app = express();
  app.use(express.json());
  mountLLMManagement(app, {
    store,
    chatAccess: 'authenticated',
    requireAuth: (req, res, next) => {
      const role = req.get('x-role');
      if (!role) return res.sendStatus(401);
      req.user = { isAdmin: role === 'admin' };
      next();
    },
    generate: async (messages, options) => `Yanit:${options.model}:${messages[0].content}`
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/llm`;
  const userHeaders = { 'x-role': 'user', 'content-type': 'application/json', 'X-LLM-CSRF': '1' };
  const adminHeaders = { 'x-role': 'admin', 'content-type': 'application/json', 'X-LLM-CSRF': '1' };

  try {
    // Normal kullanici /profiles erisemez (403), ancak /chat cagirabilir
    assert.equal((await fetch(`${base}/profiles`, { headers: userHeaders })).status, 403);

    // Etkin profil yokken 409 donmeli
    const noActive = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Merhaba' }] })
    });
    assert.equal(noActive.status, 409);
    assert.equal((await noActive.json()).code, 'ACTIVE_PROFILE_MISSING');

    // Gecersiz mesaj listesi 400 donmeli
    const badMsg = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ messages: [] })
    });
    assert.equal(badMsg.status, 400);
    assert.equal((await badMsg.json()).code, 'MESSAGES_INVALID');

    // Etkinlestir ve normal kullanici ile /chat cagir
    await store.activate(p1.id, p1.revision);
    const activeRes = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Selam' }], purpose: 'diagnostic' })
    });
    assert.equal(activeRes.status, 200);
    const activeBody = await activeRes.json();
    assert.equal(activeBody.ok, true);
    assert.equal(activeBody.content, 'Yanit:gpt-4.1:Selam');
    assert.equal(activeBody.model, 'gpt-4.1');
    assert.ok(!JSON.stringify(activeBody).includes('sk-secret'));

    // Belirli profileId ile cagir
    const explicitRes = await fetch(`${base}/chat`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ profileId: p2.id, messages: [{ role: 'user', content: 'Test' }] })
    });
    assert.equal(explicitRes.status, 200);
    const explicitBody = await explicitRes.json();
    assert.equal(explicitBody.content, 'Yanit:claude-sonnet-4-20250514:Test');
    assert.equal(explicitBody.provider, 'anthropic');
    assert.ok(!JSON.stringify(explicitBody).includes('sk-secret'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('zero-config dataDir auto-key, llm.ask(prompt), POST /chat { prompt }, adminPassword, and llm.fetch(Request) work seamlessly', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-zeroconfig-'));
  const savedEnvKey = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
  try {
    const app = express();
    app.use(express.json());
    const llm = mountLLMManagement(app, {
      dataDir: root,
      adminPassword: 'kolay-sifre',
      generate: async (messages, options) => `Cevap:${options.model}:${messages.map(m => m.content).join('|')}`
    });

    // Otomatik anahtar dosyasi olusturarak kaydetmeli
    const saved = await llm.store.save({
      name: 'Hizli Profil',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-auto-key-secret'
    });
    assert.ok(fs.existsSync(path.join(root, 'llm-encryption.key')));
    await llm.store.activate(saved.id, saved.revision);

    // Tek satirlik llm.ask(string, { system }) calismali
    const directReply = await llm.ask('Merhaba', { system: 'Kisa yaz' });
    assert.equal(directReply, 'Cevap:gpt-4.1-mini:Kisa yaz|Merhaba');

    // Web Request -> Response (Next.js / SvelteKit / Hono) adaptoru calismali
    const webPageRes = await llm.fetch(
      new Request('http://localhost/llm', {
        headers: { Authorization: 'Basic ' + Buffer.from('admin:kolay-sifre').toString('base64') }
      })
    );
    assert.equal(webPageRes.status, 200);
    assert.ok((await webPageRes.text()).includes('LLM Profil Yönetimi'));

    const webChatRes = await llm.fetch(
      new Request('http://localhost/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'Web standart cagri' }),
        headers: {
          'content-type': 'application/json',
          'X-LLM-CSRF': '1',
          Authorization: 'Basic ' + Buffer.from('admin:kolay-sifre').toString('base64')
        }
      })
    );
    assert.equal(webChatRes.status, 200);
    assert.equal((await webChatRes.json()).content, 'Cevap:gpt-4.1-mini:Web standart cagri');

    // Express adminPassword Basic Auth ve { prompt } ile HTTP cagri
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    try {
      assert.equal((await fetch(`${base}/api/llm/profiles`)).status, 401);
      const auth = 'Basic ' + Buffer.from('admin:kolay-sifre').toString('base64');
      const chatRes = await fetch(`${base}/api/llm/chat`, {
        method: 'POST',
        headers: { Authorization: auth, 'content-type': 'application/json', 'X-LLM-CSRF': '1' },
        body: JSON.stringify({ prompt: 'Kolay prompt' })
      });
      assert.equal(chatRes.status, 200);
      assert.equal((await chatRes.json()).content, 'Cevap:gpt-4.1-mini:Kolay prompt');
    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  } finally {
    if (savedEnvKey !== undefined) process.env.LLM_CONFIG_ENCRYPTION_KEY = savedEnvKey;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

import { initLLMProject, detectProjectType } from '../src/init.js';

test('initLLMProject auto-detects project type and scaffolds ready-to-use files across all 5 scenarios', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-init-'));
  try {
    // 1. Express (CommonJS)
    const expDir = path.join(root, 'express-app');
    fs.mkdirSync(expDir, { recursive: true });
    fs.writeFileSync(path.join(expDir, 'package.json'), JSON.stringify({ dependencies: { express: '^4.19.2' } }));
    assert.equal(detectProjectType(expDir), 'express');
    const expRes = initLLMProject({ cwd: expDir, password: 'sifre' });
    assert.equal(expRes.type, 'express');
    assert.equal(expRes.esm, false);
    assert.ok(fs.readFileSync(path.join(expDir, 'llm.js'), 'utf8').includes('module.exports = { setupLLM, askLLM }'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(expDir, 'package.json'), 'utf8')).scripts.llm, 'llm-manager');

    // 2. SPA (Vite / React)
    const spaDir = path.join(root, 'spa-app');
    fs.mkdirSync(path.join(spaDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(spaDir, 'package.json'), JSON.stringify({ devDependencies: { vite: '^5.0.0' } }));
    assert.equal(detectProjectType(spaDir), 'spa');
    const spaRes = initLLMProject({ cwd: spaDir });
    assert.deepEqual(spaRes.createdFiles, ['src/llm.js']);

    // 3. Next.js
    const nextDir = path.join(root, 'next-app');
    fs.mkdirSync(path.join(nextDir, 'src', 'app'), { recursive: true });
    fs.writeFileSync(path.join(nextDir, 'package.json'), JSON.stringify({ dependencies: { next: '15.0.0' } }));
    assert.equal(detectProjectType(nextDir), 'nextjs');
    const nextRes = initLLMProject({ cwd: nextDir });
    assert.deepEqual(nextRes.createdFiles, [
      'src/llm.js',
      'src/app/api/llm/[...slug]/route.js',
      'src/app/llm/[[...slug]]/route.js',
      'src/app/actions/llm.js'
    ]);
    assert.ok(fs.existsSync(path.join(nextDir, 'src/llm.js')));
    assert.ok(fs.existsSync(path.join(nextDir, 'src/app/api/llm/[...slug]/route.js')));
    assert.ok(fs.existsSync(path.join(nextDir, 'src/app/llm/[[...slug]]/route.js')));

    // 4. Python
    const pyDir = path.join(root, 'py-app');
    fs.mkdirSync(pyDir, { recursive: true });
    fs.writeFileSync(path.join(pyDir, 'requirements.txt'), 'flask\n');
    assert.equal(detectProjectType(pyDir), 'python');
    const pyRes = initLLMProject({ cwd: pyDir });
    assert.deepEqual(pyRes.createdFiles, ['llm_client.py']);
    assert.ok(fs.readFileSync(path.join(pyDir, 'llm_client.py'), 'utf8').includes('def ask_llm'));

    // 5. Electron
    const elDir = path.join(root, 'electron-app');
    fs.mkdirSync(elDir, { recursive: true });
    fs.writeFileSync(
      path.join(elDir, 'package.json'),
      JSON.stringify({ type: 'module', devDependencies: { electron: '^30.0.0' } })
    );
    assert.equal(detectProjectType(elDir), 'electron');
    const elRes = initLLMProject({ cwd: elDir });
    assert.equal(elRes.esm, true);
    assert.ok(fs.readFileSync(path.join(elDir, 'llm.js'), 'utf8').includes('export function registerLLMIpc'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
