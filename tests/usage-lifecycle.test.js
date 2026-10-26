import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createLLMManager } from '../src/core.js';
import { LLMError } from '../src/errors.js';

const primary = {
  id: 'primary',
  model: 'primary-model',
  provider: 'openai',
  timeoutMs: 10000,
  fallbackProfileIds: ['fallback']
};
const fallback = { ...primary, id: 'fallback', model: 'fallback-model', fallbackProfileIds: [] };
const observedUsage = { inputTokens: 2, outputTokens: 3, content: 'private-usage', totalTokens: Infinity };
function fixture(t, generateStream, { generate, enabled = true } = {}) {
  const records = [];
  t.mock.method(fs, 'mkdir', async () => {});
  t.mock.method(fs, 'appendFile', async (_, line) => records.push(JSON.parse(line)));
  const manager = createLLMManager({
    store: { getActive: async () => primary, get: async () => fallback },
    usageLog: enabled,
    retry: false,
    rateLimit: false,
    generateStream,
    generate
  });
  return {
    records,
    call: (stream = true, signal) =>
      manager.handle({
        method: 'POST',
        path: '/chat',
        principal: { isAdmin: true },
        body: { prompt: 'private-prompt', stream, signal }
      })
  };
}
function record(records, profileId, model, code, inputTokens = 0, outputTokens = 0) {
  assert.equal(records.length, 1, 'one persisted entry per logical request');
  assert.deepEqual(records[0], {
    at: records[0].at,
    profileId,
    model,
    durationMs: records[0].durationMs,
    inputTokens,
    outputTokens,
    code
  });
  assert.ok(Number.isFinite(Date.parse(records[0].at)));
  assert.ok(records[0].durationMs >= 0);
  assert.doesNotMatch(JSON.stringify(records), /private-/);
}
async function drain(response) {
  for await (const chunk of response.stream) assert.ok(chunk.type);
}
for (const afterDelta of [false, true])
  test(`failed fallback stream persists actual candidate afterDelta=${afterDelta}`, async t => {
    const { records, call } = fixture(t, async function* (_, options) {
      if (options.id === 'primary') throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
      if (afterDelta) yield { type: 'delta', text: 'private-delta' };
      throw new LLMError('LLM_AUTH', 'private-error');
    });
    await assert.rejects(async () => drain(await call()), { code: 'LLM_AUTH' });
    record(records, 'fallback', 'fallback-model', 'LLM_AUTH');
  });
for (const mode of ['success', 'return', 'error'])
  test(`observed usage survives done then ${mode} exactly once`, async t => {
    const { records, call } = fixture(t, async function* () {
      yield { type: 'done', usage: observedUsage };
      if (mode === 'error') throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
    });
    const response = await call();
    if (mode === 'return') {
      await response.stream.next();
      await response.stream.return();
      await response.stream.return();
    } else if (mode === 'error') await assert.rejects(() => drain(response), { code: 'LLM_NETWORK' });
    else await drain(response);
    record(records, 'primary', 'primary-model', mode === 'error' ? 'LLM_NETWORK' : 'OK', 2, 3);
  });
for (const mode of ['return', 'silent-abort', 'timeout', 'abort-error'])
  test(`stream ${mode} persists cancellation without invented usage`, async t => {
    const controller = new AbortController();
    const { records, call } = fixture(t, async function* () {
      yield { type: 'delta', text: 'private-delta' };
      if (mode !== 'return')
        controller.abort(new DOMException('private-error', mode === 'timeout' ? 'TimeoutError' : 'AbortError'));
      if (mode === 'abort-error') throw new DOMException('private-error', 'AbortError');
    });
    const response = await call(true, controller.signal);
    if (mode === 'return') {
      await response.stream.next();
      await response.stream.return();
    } else await assert.rejects(() => drain(response));
    record(records, 'primary', 'primary-model', mode === 'timeout' ? 'LLM_TIMEOUT' : 'LLM_ABORTED');
  });
test('successful fallback persists one final candidate without counting failed attempts', async t => {
  const { records, call } = fixture(t, async function* (_, options) {
    if (options.id === 'primary') throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
    yield { type: 'done', usage: observedUsage };
  });
  await drain(await call());
  record(records, 'fallback', 'fallback-model', 'OK', 2, 3);
});
test('ordinary all-failed fallback persists the failing profile identity', async t => {
  const { records, call } = fixture(t, undefined, {
    generate: async () => {
      throw new LLMError('LLM_NETWORK', 'private-error', { retryable: true });
    }
  });
  assert.equal((await call(false)).status, 502);
  record(records, 'fallback', 'fallback-model', 'LLM_NETWORK');
});
test('unstarted stream never invokes provider or persists usage', async t => {
  let invoked = false;
  const { records, call } = fixture(t, async function* () {
    invoked = true;
    yield { type: 'done' };
  });
  await (await call()).stream.return();
  assert.equal(invoked, false);
  assert.equal(records.length, 0);
});
test('disabled usage logging stays disabled unless environment opts in', async t => {
  const previous = process.env.LLM_USAGE_LOG;
  try {
    delete process.env.LLM_USAGE_LOG;
    const { records, call } = fixture(
      t,
      async function* () {
        yield { type: 'done' };
      },
      { enabled: false }
    );
    await drain(await call());
    assert.equal(records.length, 0);
    process.env.LLM_USAGE_LOG = 'true';
    const optedIn = fixture(
      t,
      async function* () {
        yield { type: 'done' };
      },
      { enabled: false }
    );
    await drain(await optedIn.call());
    record(optedIn.records, 'primary', 'primary-model', 'OK');
  } finally {
    if (previous === undefined) delete process.env.LLM_USAGE_LOG;
    else process.env.LLM_USAGE_LOG = previous;
  }
});

test('abort after done overrides success while retaining only observed safe token counts', async t => {
  const controller = new AbortController();
  const { records, call } = fixture(t, async function* () {
    yield { type: 'done', usage: { inputTokens: NaN, outputTokens: 4, prompt: 'private-prompt' } };
  });
  const response = await call(true, controller.signal);
  await response.stream.next();
  controller.abort();
  await response.stream.return();
  record(records, 'primary', 'primary-model', 'LLM_ABORTED', 0, 4);
});
