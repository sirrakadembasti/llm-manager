import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createLLMManager } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';
import { LLMError } from '../src/errors.js';

// Adaptör eşdeğerliği (K19): Express ve Web (`fetch`) adaptörüne aynı istek tablosu gönderilir;
// durum kodu, başlıklar ve gövde karşılaştırılır. Bilinen farklar ayrıca ve açıkça sabitlenir.

const ADMIN = 'Basic ' + Buffer.from('admin:parity-password').toString('base64');
const WRONG = 'Basic ' + Buffer.from('admin:wrong-password').toString('base64');
const TOKEN = 'parity-chat-token-0123456789abcdef';
const profile = { id: 'p1', name: 'P', provider: 'openai', model: 'm', timeoutMs: 10000, fallbackProfileIds: [] };
const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };
const silent = { info() {}, warn() {}, error() {} };

function baseOptions(extra = {}) {
  return {
    adminPassword: 'parity-password',
    chatTokens: TOKEN,
    store: { getActive: async () => profile, get: async () => profile, list: async () => [] },
    retry: false,
    rateLimit: false,
    logger: silent,
    generate: async () => ({ content: 'merhaba', finishReason: 'stop', usage }),
    async *generateStream() {
      yield { type: 'delta', text: 'mer' };
      yield { type: 'delta', text: 'haba' };
      yield { type: 'done', usage, finishReason: 'stop' };
    },
    ...extra
  };
}

async function pair(t, extra = {}) {
  const options = baseOptions(extra);
  const app = express();
  const mounted = mountLLMManagement(app, { ...options });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const web = createLLMManager({ ...options, getClientId: () => '127.0.0.1' });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await mounted.close();
    await web.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const send = ({ method = 'GET', path, headers = {}, body }) => {
    const init = {
      method,
      headers: { 'x-request-id': 'parity-req', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body)
    };
    return Promise.all([
      fetch(origin + '/api/llm' + path, init),
      web.fetch(new Request('http://host/api/llm' + path, init))
    ]);
  };
  return { send };
}

const withoutTiming = ({ durationMs: _durationMs, ...rest }) => rest;

async function normalize(response) {
  const type = response.headers.get('content-type') || '';
  const text = await response.text();
  return {
    status: response.status,
    type: type.split(';')[0],
    retryAfter: response.headers.get('retry-after'),
    authenticate: response.headers.get('www-authenticate'),
    requestId: response.headers.get('x-request-id'),
    body: type.includes('json') && text ? withoutTiming(JSON.parse(text)) : text
  };
}

async function same(call, label) {
  const [express, web] = (await call).map(normalize);
  const [a, b] = await Promise.all([express, web]);
  assert.deepEqual(a, b, label);
  return a;
}

const csrf = { 'X-LLM-CSRF': '1', 'Content-Type': 'application/json' };

test('adapters agree on authentication outcomes', async t => {
  const { send } = await pair(t);
  assert.equal((await same(send({ path: '/profiles' }), 'no credentials')).status, 401);
  assert.equal(
    (await same(send({ path: '/profiles', headers: { Authorization: WRONG } }), 'wrong password')).status,
    401
  );
  assert.equal((await same(send({ path: '/profiles', headers: { Authorization: ADMIN } }), 'admin')).status, 200);
  assert.equal((await same(send({ path: '/health' }), 'health without credentials')).status, 200);
});

test('adapters agree on chat token and chat access rules', async t => {
  const bearer = { Authorization: `Bearer ${TOKEN}`, ...csrf };
  const { send } = await pair(t);
  const chat = await same(
    send({ method: 'POST', path: '/chat', headers: bearer, body: { prompt: 'x' } }),
    'bearer chat'
  );
  assert.equal(chat.status, 200);
  // Bilinen fark (K19 kararı: davranış korunur): sohbet jetonuyla yönetici yoluna gidildiğinde durum ve kod aynı
  // (403 FORBIDDEN), ileti metni farklıdır.
  const [expressDenied, webDenied] = await Promise.all(
    (await send({ path: '/profiles', headers: bearer })).map(normalize)
  );
  assert.equal(expressDenied.status, 403);
  assert.equal(webDenied.status, 403);
  assert.equal(expressDenied.body.code, 'FORBIDDEN');
  assert.equal(webDenied.body.code, 'FORBIDDEN');
  assert.equal(expressDenied.body.error, 'Yalnız sohbet yetkisi var.');
  assert.equal(webDenied.body.error, 'Yönetici yetkisi gerekli.');
  assert.equal(
    (
      await same(
        send({ method: 'POST', path: '/chat', headers: { Authorization: ADMIN, ...csrf }, body: { prompt: '' } }),
        'invalid prompt'
      )
    ).status,
    400
  );
  const adminOnly = await pair(t, { chatAccess: 'admin' });
  // Bilinen fark (K19 kararı: davranış korunur): yalnız yöneticiye açık sohbette Express yanıtı `code` taşımaz,
  // Web adaptörü `FORBIDDEN` kodunu ekler.
  const [expressAdminOnly, webAdminOnly] = await Promise.all(
    (await adminOnly.send({ method: 'POST', path: '/chat', headers: bearer, body: { prompt: 'x' } })).map(normalize)
  );
  assert.equal(expressAdminOnly.status, 403);
  assert.equal(webAdminOnly.status, 403);
  assert.equal(expressAdminOnly.body.code, undefined);
  assert.equal(webAdminOnly.body.code, 'FORBIDDEN');
  assert.equal(expressAdminOnly.body.error, webAdminOnly.body.error);
  const closed = await pair(t, { chatAccess: false });
  assert.equal(
    (
      await same(
        closed.send({
          method: 'POST',
          path: '/chat',
          headers: { Authorization: ADMIN, ...csrf },
          body: { prompt: 'x' }
        }),
        'chat closed'
      )
    ).status,
    404
  );
});

test('adapters agree on CSRF and the known ordering difference is pinned', async t => {
  const { send } = await pair(t);
  const withoutCsrf = await same(
    send({ method: 'POST', path: '/chat', headers: { Authorization: ADMIN }, body: { prompt: 'x' } }),
    'missing CSRF header'
  );
  assert.equal(withoutCsrf.status, 403);
  assert.equal(withoutCsrf.body.code, 'CSRF_REQUIRED');

  // Bilinen fark (K19 kararı: davranış korunur): sohbet kapalıyken Express CSRF'ye bakmadan 404 döner,
  // Web adaptörü önce CSRF denetler.
  const closed = await pair(t, { chatAccess: false });
  const [express, web] = await closed.send({
    method: 'POST',
    path: '/chat',
    headers: { Authorization: ADMIN },
    body: { prompt: 'x' }
  });
  assert.equal(express.status, 404);
  assert.equal(web.status, 403);
});

test('adapters agree on quota and failed-login limits with Retry-After', async t => {
  const quota = await pair(t, { rateLimit: { chatPerMinute: 1 } });
  const request = { method: 'POST', path: '/chat', headers: { Authorization: ADMIN, ...csrf }, body: { prompt: 'x' } };
  assert.equal((await same(quota.send(request), 'first chat')).status, 200);
  const limited = await quota.send(request);
  const [a, b] = await Promise.all(limited.map(normalize));
  assert.equal(a.status, 429);
  assert.equal(b.status, 429);
  assert.ok(Number(a.retryAfter) > 0 && Number(b.retryAfter) > 0);
  assert.equal(a.retryAfter, String(a.body.retryAfterSec));
  assert.equal(b.retryAfter, String(b.body.retryAfterSec));

  const lockout = await pair(t, { rateLimit: { authFailuresPerMinute: 2 } });
  const wrong = { path: '/profiles', headers: { Authorization: WRONG } };
  assert.equal((await same(lockout.send(wrong), 'failure 1')).status, 401);
  assert.equal((await same(lockout.send(wrong), 'failure 2')).status, 401);
  const blocked = await lockout.send({ path: '/profiles', headers: { Authorization: ADMIN } });
  const [c, d] = await Promise.all(blocked.map(normalize));
  assert.equal(c.status, 429);
  assert.equal(d.status, 429);
  assert.equal(c.body.code, 'RATE_LIMITED');
  assert.equal(c.retryAfter !== null, d.retryAfter !== null);
});

test('adapters write identical SSE bytes for success and for errors, hiding providerMessage from non-admins', async t => {
  const headers = { Authorization: ADMIN, ...csrf };
  const { send } = await pair(t);
  const ok = await same(send({ method: 'POST', path: '/chat', headers, body: { prompt: 'x', stream: true } }), 'sse');
  assert.equal(ok.type, 'text/event-stream');
  assert.match(ok.body, /event: meta|event: delta/);
  assert.match(ok.body, /event: done\ndata: \{"usage":/);

  const failing = {
    // eslint-disable-next-line require-yield
    async *generateStream() {
      throw new LLMError('LLM_PROVIDER_ERROR', 'ham ayrıntı', { status: 502, retryable: false });
    }
  };
  const errors = await pair(t, failing);
  const asAdmin = await same(
    errors.send({ method: 'POST', path: '/chat', headers, body: { prompt: 'x', stream: true } }),
    'sse error admin'
  );
  assert.match(asAdmin.body, /event: error/);
  const bearer = { Authorization: `Bearer ${TOKEN}`, ...csrf };
  const asChat = await same(
    errors.send({ method: 'POST', path: '/chat', headers: bearer, body: { prompt: 'x', stream: true } }),
    'sse error chat client'
  );
  assert.match(asChat.body, /event: error/);
  assert.ok(!asChat.body.includes('providerMessage'));
});
