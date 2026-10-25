import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMProfileStore } from '../src/profileStore.js';
import { generateProfileResponse, executeWithRetry } from '../src/runtime.js';
import { createLLMManager } from '../src/core.js';
const profile = {
  id: 'p',
  revision: 'r',
  provider: 'custom',
  transport: 'openai',
  model: 'model',
  baseURL: 'https://provider.example/v1',
  apiKey: 'fixture'
};

// Removing either acceptTruncated branch must fail its independent fixture.
for (const fixture of [
  {
    name: 'length with empty content and no reasoning',
    finish: 'length',
    reasoning: undefined,
    code: 'LLM_TRUNCATED',
    status: 422
  },
  {
    name: 'stop with reasoning only',
    finish: 'stop',
    reasoning: 'PRIVATE_REASONING_SENTINEL',
    code: 'LLM_EMPTY_RESPONSE',
    status: 502
  }
]) {
  test(`quick diagnostics persist passed for ${fixture.name} without exposing reasoning`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-quick-'));
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            finish_reason: fixture.finish,
            message: { content: '', ...(fixture.reasoning ? { reasoning_content: fixture.reasoning } : {}) }
          }
        ],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
      });
    try {
      const options = { filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) };
      const store = createLLMProfileStore(options);
      const saved = await store.save({ ...profile, id: undefined, revision: undefined, name: 'Reasoning fixture' });
      const raw = await generateProfileResponse([], saved, { acceptTruncated: true, raw: true });
      assert.equal(raw.truncated, true);
      assert.equal(raw.content, '');
      assert.equal(raw.finishReason, fixture.finish);
      assert.equal(raw.usage.totalTokens, 5);
      assert.equal('reasoning' in raw, false);
      assert.equal(await generateProfileResponse([], saved, { acceptTruncated: true }), '');
      await assert.rejects(
        () => generateProfileResponse([], saved),
        error => error.code === fixture.code
      );

      const manager = createLLMManager({ store, rateLimit: false, retry: false });
      const quick = await manager.handle({
        method: 'POST',
        path: `/profiles/${saved.id}/test`,
        body: { mode: 'quick' }
      });
      assert.equal(quick.status, 200);
      assert.equal(quick.body.ok, true);
      assert.equal(quick.body.truncated, true);
      assert.equal(
        quick.body.message,
        'Bağlantı ve kimlik doğrulandı (model düşünme nedeniyle yanıtı kısa kesti; sohbet testini çalıştırın).'
      );
      const reloaded = createLLMProfileStore(options);
      assert.equal((await reloaded.get(saved.id)).lastTests.quick.status, 'passed');

      const conversation = await manager.handle({
        method: 'POST',
        path: `/profiles/${saved.id}/test`,
        body: { mode: 'conversation' }
      });
      assert.equal(conversation.status, fixture.status);
      assert.equal(conversation.body.code, fixture.code);
      const persisted = await reloaded.get(saved.id);
      assert.equal(persisted.lastTests.quick.status, 'passed');
      assert.equal(persisted.lastTests.conversation.status, 'failed');
      assert.equal(persisted.lastTests.conversation.code, fixture.code);
      for (const value of [raw, quick.body, conversation.body, fs.readFileSync(options.filePath, 'utf8')]) {
        assert.equal(JSON.stringify(value).includes('PRIVATE_REASONING_SENTINEL'), false);
      }
    } finally {
      globalThis.fetch = original;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test('provider Retry-After header reaches retry policy', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 429, headers: { 'Retry-After': '120' } });
  try {
    await assert.rejects(
      () => generateProfileResponse([], profile),
      error => error.retryAfterSec === 120 && error.retryable === true
    );
  } finally {
    globalThis.fetch = original;
  }
});

test('retry deadline bounds operations even if custom generator ignores signal', { timeout: 2000 }, async () => {
  await assert.rejects(
    () => executeWithRetry(() => new Promise(() => {}), { deadlineMs: 20, attempts: 0 }),
    error => error.code === 'LLM_TIMEOUT'
  );
});

test('diagnostic/default purposes replace domain-specific legacy options', async () => {
  let captured;
  const manager = createLLMManager({
    store: { get: async () => profile, getActive: async () => profile, recordTest: async () => profile },
    generate: async (messages, options) => {
      captured = { messages, options };
      return 'ok';
    }
  });
  const diagnostic = await manager.handle({ method: 'POST', path: '/profiles/p/test', body: { mode: 'conversation' } });
  assert.equal(diagnostic.status, 200);
  assert.equal(captured.options.purpose, 'diagnostic');
  assert.equal('useManagedProfile' in captured.options, false);
  assert.equal('allowMockFallback' in captured.options, false);
  assert.ok(!/otel|ajan/i.test(JSON.stringify(captured.messages)));
  assert.equal(
    (await manager.handle({ method: 'POST', path: '/chat', body: { prompt: 'hi', purpose: 'default' } })).status,
    200
  );
});

test('SSE parser handles final frames and cumulative usage without double counting', async () => {
  const { parseSseStream } = await import('../src/runtime.js');
  const { default: google } = await import('../src/transports/google.js');
  const frames = [
    {
      candidates: [{ content: { parts: [{ text: 'hello' }] } }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 }
    },
    {
      candidates: [{ finishReason: 'STOP', content: { parts: [{ text: ' world' }] } }],
      usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 9 }
    }
  ];
  const bytes = new TextEncoder().encode(frames.map(frame => 'data: ' + JSON.stringify(frame)).join('\n\n'));
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
  const chunks = [];
  for await (const chunk of parseSseStream(stream, google)) chunks.push(chunk);
  assert.deepEqual(
    chunks.filter(chunk => chunk.type === 'delta').map(chunk => chunk.text),
    ['hello', ' world']
  );
  assert.equal(chunks.at(-1).usage.outputTokens, 9);
  assert.equal(chunks.at(-1).usage.totalTokens, 11);
});

test('model preview does not send saved credentials to a changed endpoint', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ data: [{ id: 'model' }] });
  };
  try {
    const manager = createLLMManager({ store: { get: async () => profile }, rateLimit: false });
    const response = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: true },
      body: { profileId: 'p', provider: 'custom', baseURL: 'https://different.example/v1' }
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.code, 'PROFILE_INVALID');
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});
