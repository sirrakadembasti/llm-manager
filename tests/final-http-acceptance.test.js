import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createLLMManager } from '../src/core.js';

const headers = {
  'X-LLM-CSRF': '1',
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from('admin:test-password').toString('base64')}`
};
test('default store saves authenticated allowlisted profile, reloads and calls permitted local provider', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-final-lan-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = http.createServer((_, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: 'local answer' }, finish_reason: 'stop' }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;
  const options = {
    dataDir: dir,
    encryptionKey: 'a'.repeat(64),
    adminPassword: 'test-password',
    allowedPrivateHosts: [`127.0.0.1:${port}`],
    proxyUrl: null,
    rateLimit: false,
    retry: false
  };
  const manager = createLLMManager(options);
  const save = baseURL =>
    manager.fetch(
      new Request('http://host/api/llm/profiles', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'LAN',
          provider: 'ollama',
          baseURL,
          model: 'test-model',
          apiKey: 'local-placeholder'
        })
      })
    );
  const response = await save(`http://127.0.0.1:${port}/v1`);
  assert.equal(response.status, 201, await response.clone().text());
  const saved = await response.json();
  for (const baseURL of [`http://127.0.0.1:${port + 1}/v1`, `http://127.0.0.2:${port}/v1`])
    assert.equal((await save(baseURL)).status, 400);
  const reloaded = createLLMManager(options);
  const result = await reloaded.handle({
    method: 'POST',
    path: '/chat',
    body: { prompt: 'hello', profileId: saved.id }
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.content, 'local answer');
});

test('default 256KiB limit rejects actual 300KB body', async () => {
  const manager = createLLMManager({ insecureNoAuth: true, store: {}, rateLimit: false });
  const response = await manager.fetch(
    new Request('http://host/api/llm/chat', { method: 'POST', headers, body: 'x'.repeat(300 * 1024) })
  );
  assert.equal(response.status, 413);
  assert.equal((await response.json()).code, 'BODY_TOO_LARGE');
});

for (const declared of [false, true])
  test(`default body limit declared=${declared} rejects before excess consumption`, async () => {
    let reads = 0,
      cancelled = false;
    const body = new ReadableStream(
      {
        pull(controller) {
          reads++;
          controller.enqueue(new Uint8Array(100 * 1024));
        },
        cancel() {
          cancelled = true;
        }
      },
      { highWaterMark: 0 }
    );
    const manager = createLLMManager({ insecureNoAuth: true, store: {}, rateLimit: false });
    const response = await manager.fetch(
      new Request('http://host/api/llm/chat', {
        method: 'POST',
        headers: { ...headers, ...(declared ? { 'Content-Length': String(300 * 1024) } : {}) },
        body,
        duplex: 'half'
      })
    );
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, 'BODY_TOO_LARGE');
    assert.equal(reads, declared ? 0 : 3);
    if (!declared) assert.equal(cancelled, true);
    else await body.cancel();
  });
