import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLLMManager } from '../src/core.js';
import { normalizeRuntimeOptions } from '../src/runtime.js';
import { LLMError, ErrorCodes } from '../src/errors.js';

function createTempDir(prefix = 'llm-params-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('YH1-C5: normalizeRuntimeOptions validates temperature, topP, stop and responseFormat', () => {
  // Valid params
  const valid = normalizeRuntimeOptions({
    temperature: 0.7,
    topP: 0.95,
    stop: ['STOP', 'END'],
    responseFormat: 'json'
  });
  assert.equal(valid.temperature, 0.7);
  assert.equal(valid.topP, 0.95);
  assert.deepEqual(valid.stop, ['STOP', 'END']);
  assert.equal(valid.responseFormat, 'json');

  // Edge valid values: temperature 0 and 2, topP 0 and 1
  const edge = normalizeRuntimeOptions({
    temperature: 0,
    topP: 1,
    stop: 'SINGLE_STOP',
    responseFormat: 'text'
  });
  assert.equal(edge.temperature, 0);
  assert.equal(edge.topP, 1);
  assert.deepEqual(edge.stop, ['SINGLE_STOP']);
  assert.equal(edge.responseFormat, 'text');

  // Invalid temperature
  assert.throws(
    () => normalizeRuntimeOptions({ temperature: 2.1 }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );
  assert.throws(
    () => normalizeRuntimeOptions({ temperature: -0.1 }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );

  // Invalid topP
  assert.throws(
    () => normalizeRuntimeOptions({ topP: 1.1 }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );

  // Invalid stop (> 4 strings or length > 100)
  assert.throws(
    () => normalizeRuntimeOptions({ stop: ['1', '2', '3', '4', '5'] }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );
  assert.throws(
    () => normalizeRuntimeOptions({ stop: ['A'.repeat(101)] }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );

  // Invalid responseFormat
  assert.throws(
    () => normalizeRuntimeOptions({ responseFormat: 'xml' }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID
  );
});

test('YH1-C5: /chat returns usage and finishReason, and ask(p, { raw: true }) returns full result object', async () => {
  const tempDir = createTempDir();
  let receivedOptions = null;

  const manager = createLLMManager({
    dataDir: tempDir,
    generate: async (messages, options) => {
      receivedOptions = options;
      return {
        content: 'Generated output',
        finishReason: 'stop',
        usage: { inputTokens: 42, outputTokens: 84, totalTokens: 126 }
      };
    }
  });

  const saveRes = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Test Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345678',
      temperature: 0.8,
      topP: 0.9,
      responseFormat: 'json',
      stop: ['END']
    }
  });
  assert.equal(saveRes.status, 201);
  assert.equal(saveRes.body.temperature, 0.8);
  assert.equal(saveRes.body.topP, 0.9);
  assert.equal(saveRes.body.responseFormat, 'json');
  assert.deepEqual(saveRes.body.stop, ['END']);

  await manager.handle({
    method: 'POST',
    path: `/profiles/${saveRes.body.id}/activate`,
    body: { revision: saveRes.body.revision }
  });

  // 1. POST /chat returns usage and finishReason
  const chatRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    principal: { isAdmin: true },
    body: {
      prompt: 'Test prompt',
      temperature: 0.5,
      responseFormat: 'text'
    }
  });
  assert.equal(chatRes.status, 200);
  assert.equal(chatRes.body.content, 'Generated output');
  assert.equal(chatRes.body.finishReason, 'stop');
  assert.deepEqual(chatRes.body.usage, { inputTokens: 42, outputTokens: 84, totalTokens: 126 });
  assert.equal(receivedOptions.temperature, 0.5, 'Admin override for temperature must take effect');
  assert.equal(receivedOptions.responseFormat, 'text', 'Admin override for responseFormat must take effect');

  // 2. ask(prompt) returns string by default
  const stringReply = await manager.ask('What is AI?');
  assert.equal(typeof stringReply, 'string');
  assert.equal(stringReply, 'Generated output');

  // 3. ask(prompt, { raw: true }) returns full result object
  const rawReply = await manager.ask('What is AI?', { raw: true });
  assert.equal(typeof rawReply, 'object');
  assert.equal(rawReply.ok, true);
  assert.equal(rawReply.content, 'Generated output');
  assert.equal(rawReply.finishReason, 'stop');
  assert.deepEqual(rawReply.usage, { inputTokens: 42, outputTokens: 84, totalTokens: 126 });
  assert.equal(rawReply.model, 'gpt-4o');
});
