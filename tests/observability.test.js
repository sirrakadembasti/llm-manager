import test from 'node:test';
import assert from 'node:assert/strict';
import { redact, createStructuredLogger } from '../src/logger.js';

test('redaction terminates deep and cyclic inputs without exposing original objects', () => {
  const input = { apiKey: 'root-secret' };
  input.self = input;
  let tail = input;
  for (let i = 0; i < 15; i++) tail = tail.child = {};
  tail.apiKey = 'deep-secret';
  const output = redact(input);
  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /root-secret|deep-secret/);
  assert.notEqual(output.self, input);
});

test('all logger levels redact credentials and message content without mutating input', () => {
  const calls = [];
  const logger = createStructuredLogger({ log: (...args) => calls.push(args) });
  const input = {
    api_key: 'key-secret',
    accessToken: 'access-secret',
    refresh_token: 'refresh-secret',
    headers: { Authorization: 'Basic YWRtaW46c2VjcmV0' },
    prompt: 'prompt-secret',
    messages: [{ content: 'message-secret' }],
    response: 'response-secret',
    usage: { inputTokens: 4, outputTokens: 5, content: 'usage-secret' }
  };
  for (const level of ['debug', 'info', 'warn', 'error']) {
    logger[level]('event', input, 'Bearer token-secret');
  }
  assert.equal(calls.length, 4);
  assert.doesNotMatch(
    JSON.stringify(calls),
    /key-secret|access-secret|refresh-secret|YWRtaW46c2VjcmV0|prompt-secret|message-secret|response-secret|usage-secret|token-secret/
  );
  assert.equal(calls[0][1].usage.inputTokens, 4);
  assert.equal(input.prompt, 'prompt-secret');
});

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLLMManager, createLLMProfileStore } from '../src/core.js';

test('chat hooks retain correlation and numeric usage while excluding provider content', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-observability-'));
  const events = [];
  const logger = { info: (...args) => events.push(args), warn: (...args) => events.push(args) };
  try {
    const store = createLLMProfileStore({ dataDir: dir });
    const fallback = await store.save({
      name: 'Fallback',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'fallback-secret',
      baseURL: 'https://api.openai.com/v1'
    });
    const primary = await store.save({
      name: 'Primary',
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'primary-secret',
      baseURL: 'https://api.openai.com/v1',
      fallbackProfileIds: [fallback.id]
    });
    await store.activate(primary.id, primary.revision);
    const manager = createLLMManager({
      store,
      logger,
      generate: async (_messages, options) => {
        if (options.id === primary.id) throw new Error('network failed private-prompt primary-secret');
        return {
          content: 'private-response',
          usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5, providerMetadata: 'private-provider-payload' }
        };
      },
      generateStream: async function* (_messages, options) {
        if (options.id === primary.id) throw new Error('network failed private-prompt primary-secret');
        yield { type: 'delta', text: 'private-stream' };
        yield { type: 'done', usage: { inputTokens: 2, outputTokens: 3 } };
      }
    });
    const result = await manager.handle({
      method: 'POST',
      path: '/chat',
      principal: { isAdmin: true },
      requestId: 'hook-request-123',
      body: { prompt: 'private-prompt' }
    });
    assert.equal(result.status, 200);
    const completed = events.find(([event]) => event === 'chat.completed');
    assert.equal(completed[1].requestId, 'hook-request-123');
    assert.equal(completed[1].usage.inputTokens, 2);
    assert.ok(
      events.some(
        ([event, data]) =>
          event === 'chat.fallback' && data.failedProfileId === primary.id && data.nextProfileId === fallback.id
      )
    );
    const streamed = await manager.handle({
      method: 'POST',
      path: '/chat',
      principal: { isAdmin: true },
      requestId: 'stream-request-123',
      body: { prompt: 'private-prompt', stream: true }
    });
    for await (const chunk of streamed.stream) assert.ok(chunk.type);
    assert.ok(
      events.some(([event, data]) => event === 'chat.stream.completed' && data.requestId === 'stream-request-123')
    );
    assert.doesNotMatch(
      JSON.stringify(events),
      /primary-secret|fallback-secret|private-prompt|private-response|private-stream|private-provider-payload/
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
