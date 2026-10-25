import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { mountLLMManagement } from '../src/index.js';

const headers = {
  Authorization: 'Basic ' + Buffer.from('admin:parser-test-password').toString('base64'),
  'Content-Type': 'application/json',
  'X-LLM-CSRF': '1'
};
const profile = {
  name: 'Parser acceptance',
  provider: 'openai',
  model: 'gpt-4o',
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-parser-test-key'
};

async function host(t, { beforeMount, ...options } = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'llm-express-body-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const app = express();
  beforeMount?.(app);
  mountLLMManagement(app, {
    dataDir,
    adminPassword: 'parser-test-password',
    rateLimit: false,
    logger: { info() {}, warn() {} },
    ...options
  });
  // Deliberately mounted after the plugin, as in the integration acceptance scenario.
  app.use(express.json());
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  return (body, requestHeaders = headers) =>
    fetch(`http://127.0.0.1:${server.address().port}/api/llm/profiles`, {
      method: 'POST',
      headers: requestHeaders,
      body
    });
}

test('Express plugin saves JSON profiles before a later host parser', async t => {
  const post = await host(t);
  const response = await post(JSON.stringify({ ...profile, padding: 'x'.repeat(150 * 1024) }));
  assert.equal(response.status, 201);
  const saved = await response.json();
  assert.equal(saved.name, 'Parser acceptance');
  assert.equal(saved.hasApiKey, true);
  assert.ok(saved.id);
});

test('Express plugin preserves the body already parsed and normalized by the host', async t => {
  const post = await host(t, {
    beforeMount(app) {
      app.use(express.json());
      app.use((req, _res, next) => {
        req.body.name = 'Host normalized';
        next();
      });
    }
  });
  const response = await post(JSON.stringify(profile));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).name, 'Host normalized');
});

for (const [name, body, status, code] of [
  ['malformed JSON', '{', 400, 'BODY_INVALID'],
  ['a 300 KB body at the default limit', JSON.stringify({ padding: 'x'.repeat(300 * 1024) }), 413, 'BODY_TOO_LARGE']
]) {
  test(`Express plugin returns a structured error for ${name}`, async t => {
    const post = await host(t);
    const response = await post(body);
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const error = await response.json();
    assert.equal(error.code, code);
    assert.ok(error.requestId);
    assert.equal(error.requestId, response.headers.get('x-request-id'));
  });
}

test('Express plugin authenticates before parsing malformed or oversized JSON', async t => {
  const post = await host(t);
  for (const body of ['{', JSON.stringify({ padding: 'x'.repeat(300 * 1024) })]) {
    const response = await post(body, { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'UNAUTHORIZED');
  }
});

test('Express plugin honors the explicit bodyLimit option', async t => {
  const post = await host(t, { bodyLimit: '1kb' });
  assert.equal((await post(JSON.stringify(profile))).status, 201);
  const response = await post(JSON.stringify({ ...profile, padding: 'x'.repeat(2048) }));
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, 'BODY_TOO_LARGE');
});
