import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { mountLLMManagement } from '../src/index.js';

const headers = {
  Authorization: 'Basic ' + Buffer.from('admin:retry-after-password').toString('base64'),
  'Content-Type': 'application/json',
  'X-LLM-CSRF': '1'
};

async function host(t, options = {}) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'llm-express-retry-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  const app = express();
  mountLLMManagement(app, {
    dataDir,
    adminPassword: 'retry-after-password',
    rateLimit: { chatPerMinute: 1, testPerMinute: 1 },
    logger: { info() {}, warn() {} },
    ...options
  });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  });
  return route =>
    fetch(`http://127.0.0.1:${server.address().port}/api/llm/${route}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'invalid' })
    });
}

for (const route of ['chat', 'profiles/a/test']) {
  test(`Express ${route} kota 429 yanıtı Retry-After başlığı taşır`, async t => {
    const call = await host(t);
    assert.notEqual((await call(route)).status, 429);
    const limited = await call(route);
    assert.equal(limited.status, 429);
    const body = await limited.json();
    assert.ok(body.retryAfterSec > 0);
    assert.equal(limited.headers.get('retry-after'), String(body.retryAfterSec));
  });
}
