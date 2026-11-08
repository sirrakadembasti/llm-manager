import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import express from 'express';
import { mountLLMManagement } from '../src/index.js';
import { LLMError } from '../src/errors.js';
import { createLLMManager } from '../src/core.js';
import { getTransport } from '../src/transports/index.js';
import { generateProfileStream, parseSseStream } from '../src/runtime.js';

const profile = {
  id: 'primary',
  provider: 'openai',
  transport: 'openai',
  baseURL: 'http://localhost:11434/v1',
  model: 'test',
  apiKey: 'test',
  timeoutMs: 10000
};
const frame = payload => `data: ${JSON.stringify(payload)}\n\n`;
const success = () =>
  new Response(
    frame({
      choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 2, completion_tokens: 3 }
    }) + 'data: [DONE]\n\n'
  );
async function collect(iterable) {
  const chunks = [];
  for await (const chunk of iterable) chunks.push(chunk);
  return chunks;
}
function managerFixture(t, options = {}) {
  const records = [],
    events = [];
  t.mock.method(fs, 'mkdir', async () => {});
  t.mock.method(fs, 'appendFile', async (_, line) => records.push(JSON.parse(line)));
  const manager = createLLMManager({
    insecureNoAuth: true,
    store: {
      getActive: async () => profile,
      get: async () => ({ ...profile, id: 'fallback', fallbackProfileIds: [] })
    },
    allowLocalHttp: true,
    proxyUrl: null,
    rateLimit: false,
    usageLog: true,
    retry: { attempts: 2, baseMs: 0, maxMs: 0 },
    logger: { info: (...args) => events.push(args), warn: (...args) => events.push(args) },
    ...options
  });
  return { manager, records, events };
}

test('answer extraction excludes reasoning-only and mixed thought fields', async () => {
  const openai = getTransport('openai');
  assert.equal(
    openai.parseStreamEvent(JSON.stringify({ choices: [{ delta: { reasoning_content: 'secret' } }] })).text,
    ''
  );
  const google = getTransport('google');
  for (const parts of [[{ text: 'secret', thought: true }], [{ text: 'secret', thought: true }, { text: 'answer' }]]) {
    const payload = { candidates: [{ content: { parts } }] };
    const expected = parts.length === 1 ? '' : 'answer';
    assert.equal(google.parseResponse(payload).content, expected);
    assert.equal(google.parseStreamEvent(JSON.stringify(payload)).text, expected);
  }
});

for (const [transport, reason, code] of [
  ['openai', 'content_filter', 'LLM_CONTENT_FILTERED'],
  ['google', 'SAFETY', 'LLM_CONTENT_FILTERED'],
  ['openai', 'length', 'LLM_TRUNCATED'],
  ['google', 'MAX_TOKENS', 'LLM_TRUNCATED'],
  ['anthropic', 'max_tokens', 'LLM_TRUNCATED']
]) {
  test(`stream terminal ${reason} fails with observed usage`, async () => {
    const payload =
      transport === 'google'
        ? { candidates: [{ finishReason: reason }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } }
        : transport === 'anthropic'
          ? { type: 'message_delta', delta: { stop_reason: reason }, usage: { output_tokens: 3 } }
          : { choices: [{ delta: {}, finish_reason: reason }], usage: { prompt_tokens: 2, completion_tokens: 3 } };
    await assert.rejects(
      () => collect(parseSseStream(new Response(frame(payload)).body, getTransport(transport))),
      error => error.code === code && error.status === 422 && error.usage.outputTokens === 3
    );
  });
}

for (const afterDelta of [false, true])
  for (const timeout of [false, true]) {
    test(`composed signal timeout=${timeout} afterDelta=${afterDelta} preserves classification and cause`, async t => {
      const controller = new AbortController();
      const reason = new DOMException('test cancellation', timeout ? 'TimeoutError' : 'AbortError');
      t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
        if (!afterDelta) {
          controller.abort(reason);
          throw signal.reason;
        }
        return new Response(
          new ReadableStream({
            start(c) {
              c.enqueue(new TextEncoder().encode(frame({ choices: [{ delta: { content: 'answer' } }] })));
              signal.addEventListener('abort', () => c.error(signal.reason), { once: true });
            }
          })
        );
      });
      const stream = generateProfileStream([], profile, {
        allowLocalHttp: true,
        proxyUrl: null,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)])
      });
      if (afterDelta) {
        assert.equal((await stream.next()).value.text, 'answer');
        controller.abort(reason);
      }
      await assert.rejects(
        () => stream.next(),
        error =>
          error.code === (timeout ? 'LLM_TIMEOUT' : 'LLM_ABORTED') &&
          error.status === (timeout ? 504 : 499) &&
          !!error.cause
      );
    });
  }

test('stream retries 503 twice then succeeds once with identity and accounting', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => (++calls < 3 ? new Response('{}', { status: 503 }) : success()));
  const { manager, records, events } = managerFixture(t);
  const chunks = await collect(manager.stream('hello'));
  assert.equal(calls, 3);
  assert.equal(chunks.at(-1).profileId, 'primary');
  assert.equal(chunks.at(-1).fallbackUsed, false);
  assert.equal(records.length, 1);
  assert.equal(records[0].code, 'OK');
  assert.equal(events.filter(([name]) => name === 'chat.completed').length, 1);
});

for (const status of [401, 429])
  test(`stream ${status} does not retry disallowed attempts`, async t => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      return new Response('{}', { status, headers: { 'retry-after': '60' } });
    });
    const { manager } = managerFixture(t);
    await assert.rejects(() => collect(manager.stream('hello')));
    assert.equal(calls, 1);
  });

test('fallback metadata reaches Web SSE and logical record', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => (++calls === 1 ? new Response('{}', { status: 503 }) : success()));
  const { manager, records } = managerFixture(t, {
    retry: false,
    store: {
      getActive: async () => ({ ...profile, fallbackProfileIds: ['fallback'] }),
      get: async () => ({ ...profile, id: 'fallback' })
    }
  });
  const response = await manager.fetch(
    new Request('http://host/api/llm/chat', {
      method: 'POST',
      headers: { 'X-LLM-CSRF': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello', stream: true })
    })
  );
  const text = await response.text();
  assert.match(text, /"profileId":"fallback"/);
  assert.match(text, /"fallbackUsed":true/);
  assert.equal(records.length, 1);
  assert.equal(records[0].profileId, 'fallback');
});

test('bounded Retry-After permits stream retry', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () =>
    ++calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '0.01' } }) : success()
  );
  const { manager } = managerFixture(t, { retry: { attempts: 2, baseMs: 0, maxMs: 20 } });
  assert.equal((await collect(manager.stream('hello'))).at(-1).type, 'done');
  assert.equal(calls, 2);
});

test('failure after delta never retries or falls back and disposes iterator', async t => {
  let calls = 0,
    closed = 0;
  const { manager, records } = managerFixture(t, {
    store: {
      getActive: async () => ({ ...profile, fallbackProfileIds: ['fallback'] }),
      get: async () => ({ ...profile, id: 'fallback' })
    },
    generateStream: async function* () {
      calls++;
      try {
        yield { type: 'delta', text: 'partial' };
        throw new LLMError('LLM_NETWORK', 'private', { retryable: true });
      } finally {
        closed++;
      }
    }
  });
  await assert.rejects(() => collect(manager.stream('hello')), { code: 'LLM_NETWORK' });
  assert.equal(calls, 1);
  assert.equal(closed, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].code, 'LLM_NETWORK');
});

for (const transport of ['openai', 'google'])
  test(`${transport} filtered Web SSE agrees with one usage and completion record`, async t => {
    const payload =
      transport === 'google'
        ? { candidates: [{ finishReason: 'SAFETY' }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } }
        : {
            choices: [{ delta: {}, finish_reason: 'content_filter' }],
            usage: { prompt_tokens: 2, completion_tokens: 3 }
          };
    t.mock.method(globalThis, 'fetch', async () => new Response(frame(payload)));
    const { manager, records, events } = managerFixture(t, {
      store: { getActive: async () => ({ ...profile, transport }) }
    });
    const response = await manager.fetch(
      new Request('http://host/api/llm/chat', {
        method: 'POST',
        headers: { 'X-LLM-CSRF': '1' },
        body: JSON.stringify({ prompt: 'hello', stream: true })
      })
    );
    const text = await response.text();
    assert.match(text, /"code":"LLM_CONTENT_FILTERED"/);
    assert.match(text, /"status":422/);
    assert.doesNotMatch(text, /event: done/);
    assert.equal(records.length, 1);
    assert.equal(records[0].code, 'LLM_CONTENT_FILTERED');
    assert.equal(records[0].outputTokens, 3);
    const completions = events.filter(([name]) => name === 'chat.completed');
    assert.equal(completions.length, 1);
    assert.equal(completions[0][1].code, 'LLM_CONTENT_FILTERED');
  });

test('single timeout budget spans retry and fallback before first output', async t => {
  let calls = 0;
  const signals = [];
  // Model a delayed outer timeout notification. The retry helper's own deadline
  // must cancel the pending provider before returning, independently of it.
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  t.mock.method(AbortSignal, 'timeout', ms => timeout(ms + 1000));
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => {
    calls++;
    signals.push(signal);
    if (calls <= 2) return new Response('{}', { status: 503 });
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const { manager, records, events } = managerFixture(t, {
    retry: { attempts: 1, baseMs: 0, maxMs: 0 },
    store: {
      getActive: async () => ({ ...profile, timeoutMs: 5000, fallbackProfileIds: ['fallback'] }),
      get: async () => ({ ...profile, id: 'fallback', timeoutMs: 10000 })
    }
  });
  const start = Date.now();
  // Keep the process alive while AbortSignal.timeout's unref'd timer runs.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(() => collect(manager.stream('hello')), { code: 'LLM_TIMEOUT', status: 504 });
  } finally {
    clearInterval(keepAlive);
  }
  assert.equal(calls, 3);
  assert.ok(Date.now() - start < 8000, 'fallback must retain the primary five-second budget');
  assert.equal(signals.at(-1).aborted, true, 'the active upstream must be cancelled before timeout returns');
  assert.equal(records.length, 1);
  assert.equal(records[0].code, 'LLM_TIMEOUT');
  assert.equal(events.filter(([name]) => name === 'chat.completed')[0][1].code, 'LLM_TIMEOUT');
});

test('stream retry disposes failed attempts and consumer return disposes the active iterator', async t => {
  let calls = 0;
  const closed = [];
  const { manager, records } = managerFixture(t, {
    generateStream: async function* () {
      const attempt = ++calls;
      assert.deepEqual(
        closed,
        Array.from({ length: attempt - 1 }, (_, index) => index + 1)
      );
      try {
        if (attempt < 3) throw new LLMError('LLM_NETWORK', 'unavailable', { retryable: true });
        yield { type: 'delta', text: 'partial' };
      } finally {
        closed.push(attempt);
      }
    }
  });
  const stream = manager.stream('hello');
  assert.equal((await stream.next()).value.text, 'partial');
  assert.deepEqual(closed, [1, 2]);
  await stream.return();
  assert.deepEqual(closed, [1, 2, 3]);
  assert.equal(calls, 3);
  assert.equal(records.length, 1);
  assert.equal(records[0].code, 'LLM_ABORTED');
});

test('Express SSE reports actual fallback identity', async t => {
  const app = express();
  app.use(express.json());
  mountLLMManagement(app, {
    adminPassword: 'test-password',
    rateLimit: false,
    retry: false,
    store: {
      getActive: async () => ({ ...profile, fallbackProfileIds: ['fallback'] }),
      get: async () => ({ ...profile, id: 'fallback' })
    },
    generateStream: async function* (_, options) {
      if (options.id === 'primary') throw new LLMError('LLM_NETWORK', 'unavailable', { retryable: true });
      yield { type: 'done', finishReason: 'stop' };
    }
  });
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/llm/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      Authorization: `Basic ${Buffer.from('admin:test-password').toString('base64')}`
    },
    body: JSON.stringify({ prompt: 'hello', stream: true })
  });
  const text = await response.text();
  assert.match(text, /"profileId":"fallback"/);
  assert.match(text, /"fallbackUsed":true/);
});

for (const [name, body] of [
  [
    'empty content stream',
    frame({ choices: [{ delta: { content: '' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'
  ],
  ['malformed JSON stream', 'data: {bozuk\n\n'],
  ['no event stream', '']
])
  test(`${name} fails as LLM_EMPTY_RESPONSE instead of done`, async () => {
    await assert.rejects(
      () => collect(parseSseStream(new Response(body).body, getTransport('openai'))),
      error => error.code === 'LLM_EMPTY_RESPONSE' && error.status === 502 && error.retryable === true
    );
  });

test('accepted truncation without text still yields done', async () => {
  const body = frame({ choices: [{ delta: {}, finish_reason: 'length' }] });
  const chunks = await collect(
    parseSseStream(new Response(body).body, getTransport('openai'), { acceptTruncated: true })
  );
  assert.equal(chunks.at(-1).type, 'done');
  assert.equal(chunks.at(-1).truncated, true);
});

test('malformed stream from primary continues the fallback chain', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => (++calls === 1 ? new Response('data: {bozuk\n\n') : success()));
  const { manager, records } = managerFixture(t, {
    retry: false,
    store: {
      getActive: async () => ({ ...profile, fallbackProfileIds: ['fallback'] }),
      get: async () => ({ ...profile, id: 'fallback' })
    }
  });
  const chunks = await collect(manager.stream('hello'));
  assert.equal(calls, 2);
  assert.deepEqual(
    chunks.filter(chunk => chunk.type === 'delta').map(chunk => chunk.text),
    ['answer']
  );
  assert.equal(chunks.at(-1).profileId, 'fallback');
  assert.equal(chunks.at(-1).fallbackUsed, true);
  assert.equal(records.at(-1).code, 'OK');
});
