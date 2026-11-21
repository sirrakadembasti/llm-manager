import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { once } from 'node:events';
import { createLLMManager } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';
import { createMockProvider } from './helpers/mockProvider.js';

const admin = {
  Authorization: 'Basic ' + Buffer.from('admin:fixture-admin-password').toString('base64'),
  'Content-Type': 'application/json',
  'X-LLM-CSRF': '1'
};

async function fixture(t, extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-stream-'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-stream-data-'));
  const mock = createMockProvider();
  const { url } = await mock.start();
  t.after(async () => {
    await mock.close();
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(root, 'package.json'), '{"dependencies":{"express":"4.21.2"}}');
  await fs.writeFile(path.join(root, 'server.js'), "app.get('/orders', handler);\n");
  const options = {
    project: { root },
    dataDir,
    allowLocalHttp: true,
    adminPassword: 'fixture-admin-password',
    rateLimit: false,
    retry: false,
    ...extra
  };
  const manager = createLLMManager(options);
  const saved = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: { name: 'Akış', provider: 'openai', baseURL: `${url}/v1`, model: 'gpt-4o', apiKey: 'sk-mock-key' }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${saved.body.id}/activate`,
    body: { revision: saved.body.revision }
  });
  return { options, manager, mock, root, dataDir };
}

function parseSse(text) {
  const events = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    if (!block.trim()) continue;
    let event = 'message';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    events.push({ event, data: JSON.parse(data.join('\n')) });
  }
  return events;
}

const chatBody = (extra = {}) => ({ prompt: 'API nedir?', shareSources: true, stream: true, ...extra });
const post = (manager, body) =>
  manager.fetch(
    new Request('http://host/api/llm/project/chat', { method: 'POST', headers: admin, body: JSON.stringify(body) })
  );

function assertOrder(events) {
  assert.equal(events[0].event, 'meta');
  assert.equal(events.at(-1).event, 'done');
  const middle = events.slice(1, -1);
  assert.ok(middle.length > 0 && middle.every(e => e.event === 'delta'), middle.map(e => e.event).join());
  assert.equal(events.filter(e => e.event === 'meta').length, 1);
}

test('K14: Web adaptörü kaynaklı sohbeti meta → delta → done sırasıyla akıtır', async t => {
  const { manager } = await fixture(t);
  const response = await post(manager, chatBody());
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const events = parseSse(await response.text());
  assertOrder(events);
  const meta = events[0].data;
  assert.ok(meta.sources.some(s => s.path === 'server.js'));
  assert.equal(typeof meta.revision, 'string');
  assert.ok(meta.retrieval);
  assert.equal(meta.graphUsed, false);
  assert.equal(
    events
      .filter(e => e.event === 'delta')
      .map(e => e.data.text)
      .join(''),
    'mock streaming response'
  );
  assert.equal(events.at(-1).data.finishReason, 'stop');
});

test('K14: akışsız istek eski JSON biçimiyle çalışır', async t => {
  const { manager } = await fixture(t);
  const response = await post(manager, chatBody({ stream: undefined }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const reply = await response.json();
  assert.equal(typeof reply.content, 'string');
  assert.ok(reply.sources.some(s => s.path === 'server.js'));
  assert.ok(reply.retrieval);
});

test('K14: akıştan önceki doğrulama hataları düz JSON ve doğru durumla döner', async t => {
  const { manager, root } = await fixture(t);
  const unapproved = await post(manager, chatBody({ shareSources: false }));
  assert.equal(unapproved.status, 400);
  assert.match(unapproved.headers.get('content-type'), /application\/json/);
  assert.equal((await unapproved.json()).code, 'PROJECT_SHARING_REQUIRED');
  const invalid = await post(manager, chatBody({ prompt: '' }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, 'PROJECT_PROMPT_INVALID');
  const scan = await (
    await manager.fetch(new Request('http://host/api/llm/project/scan', { method: 'POST', headers: admin, body: '{}' }))
  ).json();
  await fs.appendFile(path.join(root, 'server.js'), "app.post('/orders', handler);\n");
  const stale = await post(manager, chatBody({ revision: scan.inventory.revision }));
  assert.equal(stale.status, 409);
  assert.match(stale.headers.get('content-type'), /application\/json/);
  assert.equal((await stale.json()).code, 'PROJECT_CONFLICT');
});

test('K14: akışlı proje sohbeti de aynı sohbet kotasından bir kez düşer', async t => {
  const { manager } = await fixture(t, { rateLimit: { chatPerMinute: 1 } });
  assert.equal((await post(manager, chatBody())).status, 200);
  const limited = await post(manager, chatBody());
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get('content-type'), /application\/json/);
  assert.equal((await limited.json()).code, 'RATE_LIMITED');
});

test('K14: istemci akışı bırakınca sağlayıcı isteği kesilir', async t => {
  const { manager, mock } = await fixture(t);
  let providerClosed;
  const closed = new Promise(resolve => (providerClosed = resolve));
  mock.setResponse((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"ilk "}}]}\n\n');
    res.on('close', providerClosed);
  });
  const response = await post(manager, chatBody());
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let seen = '';
  while (!seen.includes('event: delta')) {
    const { done, value } = await reader.read();
    assert.equal(done, false);
    seen += decoder.decode(value, { stream: true });
  }
  assert.match(seen, /event: meta/);
  await reader.cancel();
  await Promise.race([
    closed,
    new Promise((_, reject) => setTimeout(() => reject(new Error('sağlayıcı isteği kesilmedi')), 5000))
  ]);
});

test('K14: Express adaptörü aynı olay sırasını yazar ve akışsız istek JSON kalır', async t => {
  const { options } = await fixture(t);
  const app = express();
  const mounted = mountLLMManagement(app, options);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await mounted.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/llm/project/chat`;
  const streamed = await fetch(url, { method: 'POST', headers: admin, body: JSON.stringify(chatBody()) });
  assert.equal(streamed.status, 200);
  assert.match(streamed.headers.get('content-type'), /text\/event-stream/);
  const events = parseSse(await streamed.text());
  assertOrder(events);
  assert.ok(events[0].data.sources.some(s => s.path === 'server.js'));
  const plain = await fetch(url, { method: 'POST', headers: admin, body: JSON.stringify(chatBody({ stream: false })) });
  assert.match(plain.headers.get('content-type'), /application\/json/);
  assert.equal(typeof (await plain.json()).content, 'string');
  const rejected = await fetch(url, {
    method: 'POST',
    headers: admin,
    body: JSON.stringify(chatBody({ shareSources: false }))
  });
  assert.equal(rejected.status, 400);
});
