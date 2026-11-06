import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectAssistant } from '../src/project/index.js';

const alice = { isAdmin: true, kind: 'admin', id: 'alice' };
const bob = { isAdmin: true, kind: 'admin', id: 'bob' };

async function fixture(t, { ask, graphifyDelayMs } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-concurrency-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'server.js'), "app.get('/orders', handler);\n");
  let graphify;
  if (graphifyDelayMs) {
    const sleeper = path.join(root, '..', `${path.basename(root)}-sleep.cjs`);
    t.after(() => fs.rm(sleeper, { force: true }));
    await fs.writeFile(sleeper, `setTimeout(() => process.exit(1), ${graphifyDelayMs});`);
    graphify = { command: process.execPath, args: [sleeper] };
  }
  const assistant = createProjectAssistant({
    options: { root, ...(graphify ? { graphify } : {}) },
    getActiveProfile: () => ({ id: 'p', name: 'P', provider: 'custom', model: 'm' }),
    ask: ask || (async () => ({ content: 'Yanıt' }))
  });
  t.after(() => assistant.close());
  const call = (route, body = {}, principal = alice, signal) =>
    assistant.handle({ method: 'POST', path: route, body, principal, signal });
  return { assistant, call };
}

const chatBody = { prompt: 'orders', shareSources: true };

function deferredAsk(expected) {
  const started = [];
  let release;
  const gate = new Promise(resolve => (release = resolve));
  let allStarted;
  const ready = new Promise(resolve => (allStarted = resolve));
  const ask = async (_messages, { signal }) => {
    started.push(signal);
    if (started.length === expected) allStarted();
    await Promise.race([
      gate,
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      )
    ]);
    return { content: 'Yanıt' };
  };
  return { ask, ready, release, started };
}

test('sourced chats run concurrently instead of returning PROJECT_BUSY', async t => {
  const { ask, ready, release } = deferredAsk(2);
  const { call } = await fixture(t, { ask });
  const first = call('/project/chat', chatBody, alice);
  const second = call('/project/chat', chatBody, bob);
  await ready;
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(
    results.map(r => r.status),
    [200, 200]
  );
});

test('a running chat does not block scans and cannot be cancelled by the project cancel endpoint', async t => {
  const { ask, ready, release, started } = deferredAsk(1);
  const { call } = await fixture(t, { ask });
  const chat = call('/project/chat', chatBody, alice);
  await ready;
  const scanned = await call('/project/scan', {}, bob);
  assert.equal(scanned.status, 200);
  const cancel = await call('/project/cancel', {}, alice);
  assert.equal(cancel.body.cancelled, false);
  assert.equal(started[0].aborted, false);
  release();
  assert.equal((await chat).status, 200);
});

test('a chat is cancelled by its own request signal', async t => {
  const { ask, ready } = deferredAsk(1);
  const { call } = await fixture(t, { ask });
  const controller = new AbortController();
  const chat = call('/project/chat', chatBody, alice, controller.signal);
  await ready;
  controller.abort();
  const result = await chat;
  assert.equal(result.status, 499);
  assert.equal(result.body.code, 'LLM_ABORTED');
});

test('exclusive operations stay serialized, allow chats, and are cancelled only by their owner', async t => {
  const { call } = await fixture(t, { graphifyDelayMs: 20000 });
  const scan = call('/project/scan', { graphify: true }, alice);
  await new Promise(resolve => setTimeout(resolve, 100));
  const busy = await call('/project/scan', {}, bob);
  assert.equal(busy.status, 409);
  assert.equal(busy.body.code, 'PROJECT_BUSY');
  assert.equal((await call('/project/chat', chatBody, bob)).status, 200);
  assert.equal((await call('/project/cancel', {}, bob)).body.cancelled, false);
  assert.equal((await call('/project/cancel', {}, alice)).body.cancelled, true);
  const result = await scan;
  assert.equal(result.status, 499);
});

test('closing the assistant aborts pending chats', async t => {
  const { ask, ready } = deferredAsk(1);
  const { assistant, call } = await fixture(t, { ask });
  const chat = call('/project/chat', chatBody, alice);
  await ready;
  await assistant.close();
  assert.equal((await chat).status, 499);
  assert.equal((await call('/project/chat', chatBody, alice)).body.code, 'PROJECT_CLOSED');
});
