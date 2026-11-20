import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createStandaloneServer } from '../src/server.js';

test('standalone server forwards logger and manager options into authenticated requests', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-server-options-'));
  const events = [];
  let server;
  try {
    server = await createStandaloneServer({
      port: 0,
      dataDir: dir,
      adminPassword: 'standalone-admin-secret',
      logger: { info: (...args) => events.push(args), warn: (...args) => events.push(args) },
      generate: async () => ({ content: 'private-response', usage: { inputTokens: 3, outputTokens: 4 } }),
      usageLog: true
    });
    const origin = `http://127.0.0.1:${server.port}`;
    const headers = {
      Authorization: 'Basic ' + Buffer.from('admin:standalone-admin-secret').toString('base64'),
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      'X-Request-ID': 'standalone-request-123'
    };
    assert.equal((await fetch(origin + '/api/llm/usage')).status, 401);
    const savedResponse = await fetch(origin + '/api/llm/profiles', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Standalone',
        provider: 'openai',
        model: 'gpt-4o',
        apiKey: 'sk-profile-secret',
        baseURL: 'https://api.openai.com/v1'
      })
    });
    assert.equal(savedResponse.status, 201);
    const saved = await savedResponse.json();
    const activated = await fetch(origin + `/api/llm/profiles/${saved.id}/activate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ revision: saved.revision })
    });
    assert.equal(activated.status, 200);
    const chat = await fetch(origin + '/api/llm/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: 'private-prompt' })
    });
    assert.equal(chat.status, 200);
    assert.equal((await chat.json()).content, 'private-response');
    const usage = await fetch(origin + '/api/llm/usage', { headers });
    assert.equal((await usage.json()).totalTokens, 7);
    assert.ok(events.some(([event, fields]) => event === 'profile.saved' && fields.profileId === saved.id));
    assert.ok(
      events.some(([event, fields]) => event === 'chat.completed' && fields.requestId === 'standalone-request-123')
    );
    assert.ok(events.some(([event, fields]) => event === 'auth.failed' && fields.ip && fields.requestId));
    assert.doesNotMatch(
      JSON.stringify(events),
      /standalone-admin-secret|sk-profile-secret|private-prompt|private-response/
    );
  } finally {
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('standalone body parsing uses authenticated manager limits and structured errors', async () => {
  const server = await createStandaloneServer({
    port: 0,
    adminPassword: 'test-password',
    logger: { info() {}, warn() {} },
    store: { save: async input => ({ id: 'p', name: input.name }), getActive: async () => null }
  });
  const endpoint = `http://127.0.0.1:${server.port}/api/llm/profiles`;
  const headers = {
    Authorization: 'Basic ' + Buffer.from('admin:test-password').toString('base64'),
    'Content-Type': 'application/json',
    'X-LLM-CSRF': '1'
  };
  try {
    const saved = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'valid', padding: 'x'.repeat(40000) })
    });
    assert.equal(saved.status, 201);
    for (const [body, status, code] of [
      ['{', 400, 'BODY_INVALID'],
      [JSON.stringify({ padding: 'x'.repeat(300000) }), 413, 'BODY_TOO_LARGE']
    ]) {
      const response = await fetch(endpoint, { method: 'POST', headers, body });
      assert.equal(response.status, status);
      const error = await response.json();
      assert.equal(error.code, code);
      assert.equal(error.requestId, response.headers.get('x-request-id'));
    }
  } finally {
    await server.close();
  }
});

async function failedLoginStatuses(trustProxy) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-trust-proxy-'));
  let server;
  try {
    server = await createStandaloneServer({
      port: 0,
      dataDir: dir,
      adminPassword: 'standalone-admin-secret',
      logger: { info() {}, warn() {} },
      rateLimit: { authFailuresPerMinute: 2 },
      ...(trustProxy === undefined ? {} : { trustProxy })
    });
    const wrong = 'Basic ' + Buffer.from('admin:yanlis-parola').toString('base64');
    const attempt = async client =>
      (
        await fetch(`http://127.0.0.1:${server.port}/api/llm/profiles`, {
          headers: { Authorization: wrong, 'X-Forwarded-For': client }
        })
      ).status;
    const first = [await attempt('203.0.113.1'), await attempt('203.0.113.1'), await attempt('203.0.113.1')];
    return { first, other: await attempt('203.0.113.2') };
  } finally {
    await server?.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('K03: trustProxy açıkken X-Forwarded-For başlıklı istemciler ayrı hatalı giriş sayacı kullanır', async () => {
  const result = await failedLoginStatuses(1);
  assert.deepEqual(result.first, [401, 401, 429]);
  assert.equal(result.other, 401);
  // Adres listesi ve metin biçimleri de kabul edilir (CLI/ortam değişkeninden gelir).
  assert.equal((await failedLoginStatuses('1')).other, 401);
  assert.equal((await failedLoginStatuses('127.0.0.1,loopback')).other, 401);
});

test('K03: trustProxy yokken (varsayılan) X-Forwarded-For yok sayılır', async () => {
  for (const value of [undefined, false, 'false', '', 0, '0']) {
    const result = await failedLoginStatuses(value);
    assert.deepEqual(result.first, [401, 401, 429], String(value));
    assert.equal(result.other, 429, String(value));
  }
});

test('K03: geçersiz trustProxy değeri sunucuyu başlatmaz', async () => {
  for (const value of [-1, 1.5, {}, [], 'yok-boyle-ad', '1,,2']) {
    await assert.rejects(
      createStandaloneServer({ port: 0, adminPassword: 'standalone-admin-secret', trustProxy: value }),
      /trustProxy/,
      String(JSON.stringify(value))
    );
  }
});
