import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLLMManager } from '../src/core.js';
import { executeWithRetry } from '../src/runtime.js';
import { LLMError, ErrorCodes } from '../src/errors.js';
import { createMockProvider } from './helpers/mockProvider.js';

function createTempDir(prefix = 'llm-retry-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('YH1-C6: executeWithRetry respects retryable flag, attempts count and signal abort', async () => {
  // 1. Success on 3rd attempt (after two retryable 503 errors)
  let calls = 0;
  const result = await executeWithRetry(
    async () => {
      calls++;
      if (calls < 3) {
        throw new LLMError(ErrorCodes.LLM_UPSTREAM_UNAVAILABLE, 'Upstream 503', {
          status: 503,
          retryable: true
        });
      }
      return 'success';
    },
    { attempts: 3, baseMs: 10, maxMs: 100 }
  );
  assert.equal(result, 'success');
  assert.equal(calls, 3);

  // 2. Fails immediately on non-retryable error (e.g. 401)
  let authCalls = 0;
  await assert.rejects(
    async () => {
      await executeWithRetry(
        async () => {
          authCalls++;
          throw new LLMError(ErrorCodes.LLM_AUTH, 'Unauthorized 401', {
            status: 401,
            retryable: false
          });
        },
        { attempts: 3, baseMs: 10, maxMs: 100 }
      );
    },
    err => err instanceof LLMError && err.code === ErrorCodes.LLM_AUTH
  );
  assert.equal(authCalls, 1, 'Non-retryable error must not trigger retry');

  // 3. Signal abort throws LLM_ABORTED
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    async () => {
      await executeWithRetry(async () => 'ok', {
        attempts: 2,
        signal: controller.signal
      });
    },
    err => err instanceof LLMError && err.code === ErrorCodes.LLM_ABORTED
  );
});

test('YH1-C6: Chat retry on mock 503, 503, 200 succeeds and 401 fails without retry', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  let reqCount = 0;
  mock.setResponse((req, res) => {
    reqCount++;
    if (reqCount < 3) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Service Unavailable' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(
      JSON.stringify({
        choices: [{ message: { role: 'assistant', content: 'Recovered after retries' }, finish_reason: 'stop' }]
      })
    );
  });

  const manager = createLLMManager({
    dataDir: tempDir,
    allowLocalHttp: true,
    retry: { attempts: 3, baseMs: 20, maxMs: 100 }
  });

  const p = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Retry Profile',
      provider: 'openai',
      baseURL: `${mockUrl}/v1`,
      model: 'gpt-4o',
      apiKey: 'sk-test-key-12345678'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${p.body.id}/activate`,
    body: { revision: p.body.revision }
  });

  // Request should succeed after 2 retries (total 3 requests)
  const chatRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: { prompt: 'Hello' }
  });
  assert.equal(chatRes.status, 200);
  assert.equal(chatRes.body.content, 'Recovered after retries');
  assert.equal(reqCount, 3);

  // Now test 401: must fail immediately without retrying
  reqCount = 0;
  mock.setResponse((req, res) => {
    reqCount++;
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Invalid API Key' }));
  });

  const unauthRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: { prompt: 'Hello again' }
  });
  assert.equal(unauthRes.status, 502);
  assert.equal(unauthRes.body.code, 'LLM_AUTH');
  assert.equal(reqCount, 1, '401 must not be retried');

  await mock.close();
});

test('YH1-C6: Fallback profiles seamlessly activate when primary profile fails with retryable error', async () => {
  const tempDir = createTempDir();
  let invokedProfileId = null;

  const manager = createLLMManager({
    dataDir: tempDir,
    retry: { attempts: 1, baseMs: 10, maxMs: 50 },
    generate: async (messages, options) => {
      invokedProfileId = options.id;
      if (options.name === 'Primary Failing Profile') {
        throw new LLMError(ErrorCodes.LLM_UPSTREAM_UNAVAILABLE, 'Primary upstream down', {
          status: 503,
          retryable: true
        });
      }
      return 'Fallback response from secondary profile';
    }
  });

  // Create Secondary Profile
  const sec = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Secondary Fallback Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-sec-key-12345678'
    }
  });
  assert.equal(sec.status, 201);

  // Create Primary Profile with fallbackProfileIds pointing to Secondary Profile
  const pri = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Primary Failing Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-pri-key-12345678',
      fallbackProfileIds: [sec.body.id]
    }
  });
  assert.equal(pri.status, 201);
  assert.deepEqual(pri.body.fallbackProfileIds, [sec.body.id]);

  // Activate Primary Profile
  await manager.handle({
    method: 'POST',
    path: `/profiles/${pri.body.id}/activate`,
    body: { revision: pri.body.revision }
  });

  // Call /chat
  const chatRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: { prompt: 'Hello AI' }
  });
  assert.equal(chatRes.status, 200);
  assert.equal(chatRes.body.content, 'Fallback response from secondary profile');
  assert.equal(chatRes.body.fallbackUsed, true);
  assert.equal(chatRes.body.profileId, sec.body.id);
  assert.equal(chatRes.body.primaryProfileId, pri.body.id);
  assert.equal(invokedProfileId, sec.body.id);
});
