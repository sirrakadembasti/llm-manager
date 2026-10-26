import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLMManager } from '../src/core.js';
import { LLMError } from '../src/errors.js';

const primary = {
  id: 'primary',
  provider: 'openai',
  model: 'primary-model',
  timeoutMs: 10000,
  fallbackProfileIds: ['fallback']
};
const fallback = { ...primary, id: 'fallback', model: 'fallback-model', fallbackProfileIds: [] };
const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };
function fixture(generateStream, generate) {
  const events = [];
  const manager = createLLMManager({
    store: { getActive: async () => primary, get: async () => fallback },
    retry: false,
    rateLimit: false,
    logger: { info: (...args) => events.push(args), warn: (...args) => events.push(args) },
    generateStream,
    generate
  });
  return {
    events,
    call: (stream = true, signal) =>
      manager.handle({
        method: 'POST',
        path: '/chat',
        principal: { isAdmin: true },
        requestId: 'lifecycle-request',
        body: { prompt: 'private-prompt', stream, signal }
      })
  };
}
function completion(events, profile, code, expectedUsage = null) {
  const records = events.filter(([name]) => name === 'chat.completed');
  assert.equal(records.length, 1, 'one common completion per logical chat');
  assert.deepEqual(records[0][1], {
    requestId: 'lifecycle-request',
    profileId: profile.id,
    provider: profile.provider,
    model: profile.model,
    durationMs: records[0][1].durationMs,
    usage: expectedUsage,
    code,
    fallbackUsed: profile.id === 'fallback'
  });
  assert.ok(records[0][1].durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(events), /private-prompt|private-delta|private-error|private-metadata/);
}

test('stream success and fallback produce one common completion and preserve legacy success', async () => {
  const { events, call } = fixture(async function* (_, options) {
    if (options.id === primary.id) throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
    yield { type: 'delta', text: 'private-delta' };
    yield { type: 'done', usage: { ...usage, metadata: 'private-metadata' } };
  });
  for await (const chunk of (await call()).stream) assert.ok(chunk.type);
  completion(events, fallback, 'OK', usage);
  assert.equal(events.filter(([name]) => name === 'chat.stream.completed').length, 1);
});

for (const afterDelta of [false, true])
  test(`stream terminal failure afterDelta=${afterDelta} logs failing candidate`, async () => {
    const { events, call } = fixture(async function* (_, options) {
      if (options.id === primary.id) throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
      if (afterDelta) yield { type: 'delta', text: 'private-delta' };
      throw new LLMError('LLM_AUTH', 'private-error', { retryable: false });
    });
    await assert.rejects(
      async () => {
        for await (const chunk of (await call()).stream) assert.ok(chunk);
      },
      { code: 'LLM_AUTH' }
    );
    completion(events, fallback, 'LLM_AUTH');
    assert.equal(events.filter(([name]) => name === 'chat.stream.completed').length, 0);
  });

for (const abort of [false, true])
  test(`stream early return abort=${abort} logs once without legacy success`, async () => {
    const controller = new AbortController();
    let closed = false;
    const { events, call } = fixture(async function* () {
      try {
        yield { type: 'delta', text: 'private-delta' };
      } finally {
        closed = true;
      }
    });
    const stream = (await call(true, controller.signal)).stream;
    await stream.next();
    if (abort) controller.abort();
    await stream.return();
    await stream.return();
    assert.equal(closed, true);
    completion(events, primary, 'LLM_ABORTED');
    assert.equal(events.filter(([name]) => name === 'chat.stream.completed').length, 0);
  });

test('ordinary failed fallback completion carries null usage and actual failing candidate', async () => {
  const { events, call } = fixture(undefined, async () => {
    throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
  });
  assert.equal((await call(false)).status, 502);
  completion(events, fallback, 'LLM_NETWORK');
});

test('aborted provider exception stops fallback and completes once', async () => {
  const controller = new AbortController();
  const { events, call } = fixture(async function* () {
    yield* [];
    controller.abort();
    throw new DOMException('private-error', 'AbortError');
  });
  await assert.rejects(async () => {
    for await (const chunk of (await call(true, controller.signal)).stream) assert.ok(chunk);
  });
  completion(events, primary, 'LLM_ABORTED');
  assert.equal(events.filter(([name]) => name === 'chat.fallback').length, 0);
});

test('stream error retains sanitized usage already observed', async () => {
  const { events, call } = fixture(async function* () {
    yield { type: 'done', usage: { ...usage, content: 'private-metadata' } };
    throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
  });
  await assert.rejects(async () => {
    for await (const chunk of (await call()).stream) assert.ok(chunk);
  });
  completion(events, primary, 'LLM_NETWORK', usage);
});

test('ordinary primary success shares the completion metadata contract', async () => {
  const { events, call } = fixture(undefined, async () => ({ content: 'private-delta', usage }));
  assert.equal((await call(false)).status, 200);
  completion(events, primary, 'OK', usage);
});

import { sanitizeRequestId } from '../src/logger.js';
test('request id accepts exact valid boundaries and replaces invalid ids with UUIDs', () => {
  for (const id of ['A._-1234', 'a'.repeat(64)]) assert.equal(sanitizeRequestId(id), id);
  for (const id of ['a'.repeat(7), 'a'.repeat(65), 'invalid/id', 'invalid id', 'invalidéid']) {
    assert.match(sanitizeRequestId(id), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  }
});

test('return immediately after done logs successful completion without double logging', async () => {
  const { events, call } = fixture(async function* () {
    yield { type: 'done', usage };
  });
  const stream = (await call()).stream;
  assert.equal((await stream.next()).value.type, 'done');
  await stream.return();
  await stream.return();
  completion(events, primary, 'OK', usage);
});

test('provider silently returning after abort logs cancellation', async () => {
  const controller = new AbortController();
  const { events, call } = fixture(async function* () {
    yield { type: 'delta', text: 'private-delta' };
    controller.abort();
  });
  await assert.rejects(
    async () => {
      for await (const chunk of (await call(true, controller.signal)).stream) assert.ok(chunk);
    },
    { code: 'LLM_ABORTED' }
  );
  completion(events, primary, 'LLM_ABORTED');
});

test('timeout cancellation retains timeout completion code', async () => {
  const controller = new AbortController();
  const { events, call } = fixture(async function* () {
    yield { type: 'delta', text: 'private-delta' };
    controller.abort(new DOMException('private-error', 'TimeoutError'));
  });
  await assert.rejects(
    async () => {
      for await (const chunk of (await call(true, controller.signal)).stream) assert.ok(chunk);
    },
    { code: 'LLM_TIMEOUT' }
  );
  completion(events, primary, 'LLM_TIMEOUT');
});
