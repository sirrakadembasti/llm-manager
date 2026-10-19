import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createLLMProfileStore, mountLLMManagement } from '../src/index.js';
import { buildProviderRequest, classifyLLMError, generateProfileResponse } from '../src/runtime.js';

test('conversation runtime rejects nonempty truncated answers for every transport', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: 'length', message: { content: 'partial' } }],
    candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }],
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: 'partial' }]
  }));
  try {
    for (const purpose of [undefined, 'manager']) {
      for (const transport of ['openai', 'google', 'anthropic']) {
        await assert.rejects(
          () => generateProfileResponse([], {
            provider: 'custom',
            transport,
            model: 'model',
            baseURL: 'https://provider.example/v1',
            apiKey: 'fixture'
          }, { purpose }),
          error => error.code === 'LLM_TRUNCATED'
        );
      }
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('runtime controls, credentials and revision fencing survive reload', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-plugin-'));
  try {
    const options = { filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) };
    const store = createLLMProfileStore(options);
    const profile = store.save({
      name: 'MiMo',
      provider: 'xiaomi_mimo',
      model: 'model',
      baseURL: 'https://token-plan-sgp.xiaomimimo.com/v1',
      apiKey: 'private-key',
      timeoutMs: 90000,
      maxOutputTokens: 2048
    });
    store.activate(profile.id, profile.revision);
    assert.equal(createLLMProfileStore(options).getActive().timeoutMs, 90000);
    assert.ok(!JSON.stringify(store.list()).includes('private-key'));
    assert.ok(!fs.readFileSync(options.filePath, 'utf8').includes('private-key'));
    assert.throws(() => store.save({ ...profile, revision: 'stale', apiKey: '' }), /değiştirildi/);
    const edited = store.save({ ...profile, name: 'Changed', apiKey: '' });
    assert.equal(store.recordTest(profile.id, 'passed', profile.revision), null);
    store.recordTest(profile.id, 'passed', edited.revision, { mode: 'quick', durationMs: 10 });
    store.recordTest(profile.id, 'failed', edited.revision, { mode: 'conversation', durationMs: 90000, code: 'LLM_TIMEOUT' });
    const latest = store.list().profiles[0];
    assert.equal(latest.lastTests.quick.status, 'passed');
    assert.equal(latest.lastTests.conversation.code, 'LLM_TIMEOUT');
    assert.equal(store.getActive().apiKey, 'private-key');
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
  const manager = buildProviderRequest(profile, [{ role: 'user', content: 'Planla' }], { purpose: 'manager' });
  assert.deepEqual(manager.body.thinking, { type: 'disabled' });
  assert.equal(manager.body.max_completion_tokens, 8192);
  assert.equal(buildProviderRequest(profile, [], {}).body.thinking, undefined);
  assert.deepEqual(buildProviderRequest({ ...profile, thinking: 'enabled' }, [], { purpose: 'manager' }).body.thinking, { type: 'enabled' });
  assert.equal(buildProviderRequest({ ...profile, provider: 'custom' }, [], { purpose: 'manager' }).body.thinking, undefined);
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
  const profile = store.save({ name: 'Test', provider: 'custom', model: 'test', baseURL: 'https://provider.example/v1', apiKey: 'secret' });
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
    assert.equal(calls[0].options.purpose, 'manager');
    assert.equal(calls[0].messages[0].role, 'system');
    assert.equal(store.list().profiles[0].lastTest.mode, 'conversation');
    const html = await (await fetch(`${base}/admin-models`, { headers })).text();
    assert.ok(html.includes('/admin-models/llm-ui.js'));
    assert.ok(html.includes('data-api-base="/admin-api/models"'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
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
      body: { name: 'Core', provider: 'custom', model: 'm1', baseURL: 'https://provider.example/v1', apiKey: 'secret-key' }
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

