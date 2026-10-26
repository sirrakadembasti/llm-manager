import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LLMError, ErrorCodes, isLLMError } from '../src/errors.js';
import { normalizeRuntimeOptions, classifyLLMError, generateProfileResponse } from '../src/runtime.js';
import { providerFetch, createPublicLookup } from '../src/providerTransport.js';
import { createLLMProfileStore } from '../src/profileStore.js';
import { createLLMManager } from '../src/core.js';

test('YH1-A4: LLMError constructor assigns code, status, retryable, upstreamStatus and preserves cause', () => {
  const cause = new Error('root cause');
  const err = new LLMError(ErrorCodes.LLM_NETWORK, 'Bağlantı hatası', {
    status: 502,
    retryable: true,
    upstreamStatus: 502,
    cause
  });

  assert.ok(err instanceof Error);
  assert.ok(err instanceof LLMError);
  assert.equal(err.name, 'LLMError');
  assert.equal(err.code, 'LLM_NETWORK');
  assert.equal(err.message, 'Bağlantı hatası');
  assert.equal(err.status, 502);
  assert.equal(err.retryable, true);
  assert.equal(err.upstreamStatus, 502);
  assert.equal(err.cause, cause);

  assert.equal(isLLMError(err), true);
  assert.equal(isLLMError(err, ErrorCodes.LLM_NETWORK), true);
  assert.equal(isLLMError(err, ErrorCodes.LLM_TIMEOUT), false);
  assert.equal(isLLMError(new Error('plain')), false);
  assert.equal(isLLMError(null), false);
});

test('YH1-A4: ErrorCodes is frozen and contains all required error codes', () => {
  assert.ok(Object.isFrozen(ErrorCodes));
  const expectedCodes = [
    'RUNTIME_OPTIONS_INVALID',
    'PROFILE_INVALID',
    'PROFILE_NOT_FOUND',
    'PROFILE_CONFLICT',
    'MESSAGES_INVALID',
    'PURPOSE_INVALID',
    'TEST_MODE_INVALID',
    'TEST_IN_PROGRESS',
    'ACTIVE_PROFILE_MISSING',
    'LLM_NETWORK',
    'LLM_DNS_BLOCKED',
    'LLM_RESPONSE_TOO_LARGE',
    'LLM_TIMEOUT',
    'LLM_ABORTED',
    'LLM_PROVIDER_ERROR',
    'LLM_RATE_LIMIT',
    'LLM_BILLING',
    'LLM_FORBIDDEN',
    'LLM_AUTH',
    'LLM_REQUEST_REJECTED',
    'LLM_EMPTY_RESPONSE',
    'LLM_TRUNCATED',
    'LLM_CONTENT_FILTERED',
    'LLM_UPSTREAM_UNAVAILABLE',
    'AI_CREDENTIAL_ENDPOINT_MISMATCH'
  ];
  for (const code of expectedCodes) {
    assert.equal(ErrorCodes[code], code, `ErrorCodes must contain ${code}`);
  }
});

test('YH1-A4: normalizeRuntimeOptions throws LLMError with code RUNTIME_OPTIONS_INVALID', () => {
  assert.throws(
    () => normalizeRuntimeOptions({ timeoutMs: 1000 }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID && err.status === 400
  );
  assert.throws(
    () => normalizeRuntimeOptions({ maxOutputTokens: 10 }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID && err.status === 400
  );
  assert.throws(
    () => normalizeRuntimeOptions({ thinking: 'invalid' }),
    err => err instanceof LLMError && err.code === ErrorCodes.RUNTIME_OPTIONS_INVALID && err.status === 400
  );
});

test('YH1-A4: providerFetch throws LLM_RESPONSE_TOO_LARGE on payload > 2 MiB', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('a'.repeat(2 * 1024 * 1024 + 10));
  try {
    await assert.rejects(
      () => providerFetch('https://example.com/api'),
      err => err instanceof LLMError && err.code === ErrorCodes.LLM_RESPONSE_TOO_LARGE && err.status === 502
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('YH1-A4: providerFetch and createPublicLookup throw LLM_DNS_BLOCKED on forbidden destinations', async () => {
  // 1. Insecure HTTP or IP without allowLocalHttp
  await assert.rejects(
    () => providerFetch('http://192.168.1.1/api'),
    err => err instanceof LLMError && err.code === ErrorCodes.LLM_DNS_BLOCKED
  );

  // 2. Private IP returned from DNS lookup
  const lookup = createPublicLookup({
    resolver: (hostname, opts, cb) => cb(null, [{ address: '10.0.0.1', family: 4 }])
  });
  await new Promise(resolve => {
    lookup('private.example.com', {}, err => {
      assert.ok(err instanceof LLMError);
      assert.equal(err.code, ErrorCodes.LLM_DNS_BLOCKED);
      resolve();
    });
  });
});

test('YH1-A4: generateProfileResponse distinguishes user abort (LLM_ABORTED) from timeout (LLM_TIMEOUT)', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // 1. User abort
    const controller = new AbortController();
    globalThis.fetch = async (_url, { signal } = {}) => {
      if (signal?.aborted) {
        throw signal.reason || new DOMException('This operation was aborted', 'AbortError');
      }
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          reject(signal.reason || new DOMException('This operation was aborted', 'AbortError'));
        });
      });
    };

    controller.abort(new DOMException('User cancelled', 'AbortError'));
    await assert.rejects(
      () =>
        generateProfileResponse(
          [{ role: 'user', content: 'hi' }],
          { provider: 'openai', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1', apiKey: 'k' },
          { signal: controller.signal }
        ),
      err => err instanceof LLMError && err.code === ErrorCodes.LLM_ABORTED && err.status === 499
    );

    // 2. Timeout
    globalThis.fetch = async () => {
      const err = new Error('Operation timed out');
      err.name = 'TimeoutError';
      throw err;
    };
    await assert.rejects(
      () =>
        generateProfileResponse(
          [{ role: 'user', content: 'hi' }],
          { provider: 'openai', model: 'gpt-4o', baseURL: 'https://api.openai.com/v1', apiKey: 'k' },
          { timeoutMs: 5000 }
        ),
      err => err instanceof LLMError && err.code === ErrorCodes.LLM_TIMEOUT && err.status === 504
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('YH1-A4: generateProfileResponse throws LLM_CONTENT_FILTERED and LLM_UPSTREAM_UNAVAILABLE', async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Content filtered (SAFETY / content_filter)
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ choices: [{ finish_reason: 'content_filter' }] }), { status: 200 });

    await assert.rejects(
      () =>
        generateProfileResponse([{ role: 'user', content: 'hi' }], {
          provider: 'openai',
          model: 'gpt-4o',
          baseURL: 'https://api.openai.com/v1',
          apiKey: 'k'
        }),
      err => err instanceof LLMError && err.code === ErrorCodes.LLM_CONTENT_FILTERED && err.status === 422
    );

    // Upstream 503 -> LLM_UPSTREAM_UNAVAILABLE (retryable: true)
    globalThis.fetch = async () => new Response('Service Unavailable', { status: 503 });
    await assert.rejects(
      () =>
        generateProfileResponse([{ role: 'user', content: 'hi' }], {
          provider: 'openai',
          model: 'gpt-4o',
          baseURL: 'https://api.openai.com/v1',
          apiKey: 'k'
        }),
      err =>
        err instanceof LLMError &&
        err.code === ErrorCodes.LLM_UPSTREAM_UNAVAILABLE &&
        err.status === 503 &&
        err.retryable === true
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('YH1-A4: classifyLLMError resolves codes directly from error.code table and sanitizes output', () => {
  const testCodes = [
    [ErrorCodes.LLM_ABORTED, 499, false],
    [ErrorCodes.LLM_TIMEOUT, 504, true],
    [ErrorCodes.LLM_RATE_LIMIT, 502, true],
    [ErrorCodes.LLM_BILLING, 502, false],
    [ErrorCodes.LLM_FORBIDDEN, 502, false],
    [ErrorCodes.LLM_AUTH, 502, false],
    [ErrorCodes.LLM_UPSTREAM_UNAVAILABLE, 503, true],
    [ErrorCodes.LLM_DNS_BLOCKED, 502, false],
    [ErrorCodes.LLM_RESPONSE_TOO_LARGE, 502, false],
    [ErrorCodes.LLM_CONTENT_FILTERED, 422, false],
    [ErrorCodes.LLM_TRUNCATED, 422, false],
    [ErrorCodes.LLM_EMPTY_RESPONSE, 502, true],
    [ErrorCodes.LLM_NETWORK, 502, true]
  ];

  for (const [code, status, retryable] of testCodes) {
    const error = new LLMError(code, 'secret-message-should-not-leak');
    const result = classifyLLMError(error);
    assert.equal(result.code, code);
    assert.equal(result.status, status);
    assert.equal(result.retryable, retryable);
    assert.ok(!result.error.includes('secret-message-should-not-leak'));
  }
});

test('YH1-A4: profileStore operations throw typed LLMError instances', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-errors-store-'));
  try {
    const store = createLLMProfileStore({
      filePath: path.join(root, 'profiles.json'),
      encryptionKey: '11'.repeat(32)
    });

    // 1. Missing required fields -> PROFILE_INVALID
    await assert.rejects(
      () => store.save({ name: '' }),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_INVALID && err.status === 400
    );

    // 2. Valid save
    const profile = await store.save({
      name: 'Test Profile',
      provider: 'custom',
      model: 'test-model',
      baseURL: 'https://test.example/v1',
      apiKey: 'secret-key-123'
    });
    assert.ok(profile.id);

    // 3. Stale revision mutation -> PROFILE_CONFLICT
    await assert.rejects(
      () => store.save({ ...profile, revision: 'stale-rev', name: 'Updated' }),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_CONFLICT && err.status === 409
    );

    // 4. Non-existent profile -> PROFILE_NOT_FOUND
    await assert.rejects(
      () => store.save({ ...profile, id: 'non-existent-id' }),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_NOT_FOUND && err.status === 404
    );

    await assert.rejects(
      () => store.activate('non-existent-id'),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_NOT_FOUND && err.status === 404
    );

    await assert.rejects(
      () => store.remove('non-existent-id'),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_NOT_FOUND && err.status === 404
    );

    // 5. Changed endpoint without new key -> PROFILE_INVALID
    await assert.rejects(
      () => store.save({ ...profile, baseURL: 'https://different.example/v1' }),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_INVALID && err.status === 400
    );

    // 6. Invalid recordTest status -> PROFILE_INVALID
    await assert.rejects(
      () => store.recordTest(profile.id, 'unknown_status'),
      err => err instanceof LLMError && err.code === ErrorCodes.PROFILE_INVALID && err.status === 400
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-A4: core chatCompletion returns 400 with RUNTIME_OPTIONS_INVALID when runtime options are invalid', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-core-errors-'));
  try {
    const store = createLLMProfileStore({
      filePath: path.join(root, 'profiles.json'),
      encryptionKey: '22'.repeat(32)
    });
    const profile = await store.save({
      name: 'Active',
      provider: 'custom',
      model: 'model',
      baseURL: 'https://example.com/v1',
      apiKey: 'k'
    });
    await store.activate(profile.id, profile.revision);

    const manager = createLLMManager({ store });
    const response = await manager.handle({
      method: 'POST',
      path: '/chat',
      body: {
        prompt: 'Hello',
        timeoutMs: 99999999 // invalid timeout
      }
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.code, ErrorCodes.RUNTIME_OPTIONS_INVALID);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-A4: legacy adapter option errors classify as nonretryable client errors', () => {
  for (const message of ['Yanıt süresi geçersiz', 'Token bütçesi geçersiz', 'Geçersiz düşünme ayarı']) {
    const result = classifyLLMError(new Error(message));
    assert.equal(result.code, ErrorCodes.RUNTIME_OPTIONS_INVALID);
    assert.equal(result.status, 400);
    assert.equal(result.retryable, false);
  }
  assert.equal(classifyLLMError(new LLMError(ErrorCodes.LLM_NETWORK, 'Token bütçesi')).code, ErrorCodes.LLM_NETWORK);
  assert.equal(
    classifyLLMError(Object.assign(new Error('Token bütçesi'), { upstreamStatus: 500 })).code,
    ErrorCodes.LLM_UPSTREAM_UNAVAILABLE
  );
});

test('YH1-A4: core preserves typed and legacy adapter option errors', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-adapter-errors-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: '33'.repeat(32) });
    const profile = await store.save({
      name: 'Active',
      provider: 'custom',
      model: 'model',
      baseURL: 'https://example.com/v1',
      apiKey: 'k'
    });
    await store.activate(profile.id, profile.revision);
    for (const error of [
      new Error('Token bütçesi geçersiz'),
      new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Changed adapter wording')
    ]) {
      let calls = 0;
      const manager = createLLMManager({
        store,
        generate: async () => {
          calls++;
          throw error;
        }
      });
      const response = await manager.handle({ method: 'POST', path: '/chat', body: { prompt: 'Hello' } });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, ErrorCodes.RUNTIME_OPTIONS_INVALID);
      assert.equal(response.body.error, error.message);
      assert.equal(calls, 1);
    }
    const manager = createLLMManager({ store });
    const invalidPurpose = await manager.handle({
      method: 'POST',
      path: '/chat',
      body: { prompt: 'Hi', purpose: 'invalid' }
    });
    assert.equal(invalidPurpose.status, 400);
    assert.equal(invalidPurpose.body.code, ErrorCodes.PURPOSE_INVALID);
    const invalidMode = await manager.handle({
      method: 'POST',
      path: `/profiles/${profile.id}/test`,
      body: { mode: 'invalid' }
    });
    assert.equal(invalidMode.status, 400);
    assert.equal(invalidMode.body.code, ErrorCodes.TEST_MODE_INVALID);
    let release;
    let entered;
    const started = new Promise(resolve => {
      entered = resolve;
    });
    const waiting = new Promise(resolve => {
      release = resolve;
    });
    const testing = createLLMManager({
      store,
      generate: async () => {
        entered();
        await waiting;
        return 'OK';
      }
    });
    const request = { method: 'POST', path: `/profiles/${profile.id}/test`, body: {} };
    const first = testing.handle(request);
    await started;
    try {
      const duplicate = await testing.handle(request);
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.code, ErrorCodes.TEST_IN_PROGRESS);
    } finally {
      release();
      await first;
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-A4: Google SAFETY and upstream request rejection retain typed behavior', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }), { status: 200 });
    await assert.rejects(
      () =>
        generateProfileResponse([{ role: 'user', content: 'Hi' }], {
          provider: 'google',
          model: 'gemini-2.0-flash',
          baseURL: 'https://generativelanguage.googleapis.com/v1beta',
          apiKey: 'k'
        }),
      error => error instanceof LLMError && error.code === ErrorCodes.LLM_CONTENT_FILTERED && error.status === 422
    );
    for (const upstreamStatus of [400, 404]) {
      const result = classifyLLMError(Object.assign(new Error('Rejected'), { upstreamStatus }));
      assert.equal(result.code, ErrorCodes.LLM_REQUEST_REJECTED);
      assert.equal(result.retryable, false);
      assert.equal(result.upstreamStatus, upstreamStatus);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
