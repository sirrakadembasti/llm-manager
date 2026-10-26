import test from 'node:test';
import assert from 'node:assert/strict';
import { createLLMManager } from '../src/core.js';

function fixture(options = {}) {
  const manager = createLLMManager({
    store: { get: async () => null },
    authorize: async request => ({ id: request.headers.get('x-user'), isAdmin: true }),
    rateLimit: { testPerMinute: 1, chatPerMinute: 1 },
    ...options
  });
  return async (path, user = 'alice', body = { mode: 'invalid' }) => {
    const response = await manager.fetch(
      new Request(`http://localhost/api/llm/${path}`, {
        method: body === null ? 'GET' : 'POST',
        headers: { 'x-user': user, 'X-LLM-CSRF': '1', 'content-type': 'application/json' },
        ...(body === null ? {} : { body: JSON.stringify(body) })
      })
    );
    if (response.status === 429) {
      const result = await response.json();
      assert.equal(result.code, 'RATE_LIMITED');
      assert.ok(Number(result.retryAfterSec) > 0);
      assert.ok(Number(response.headers.get('retry-after')) > 0);
    }
    return response.status;
  };
}

test('Web test quota follows principal across profiles and separates principals', async () => {
  const call = fixture();
  assert.equal(await call('profiles/a/test'), 400);
  assert.equal(await call('profiles/a/test'), 429);
  assert.equal(await call('profiles/b/test'), 429);
  assert.equal(await call('profiles/a/test', 'bob'), 400);
});

test('Web models and preview share principal quota without sharing other principals or chat', async () => {
  const call = fixture();
  assert.equal(await call('profiles/a/models', 'alice', null), 404);
  assert.equal(await call('profiles/b/models', 'alice', null), 429);
  assert.equal(await call('models/preview', 'alice', {}), 429);
  assert.equal(await call('models/preview', 'bob', {}), 400);
  assert.equal(await call('chat', 'alice', {}), 400);
  assert.equal(await call('chat', 'alice', {}), 429);
  assert.equal(await call('chat', 'bob', {}), 400);
});

test('Web getClientId takes precedence over principal for every request quota', async () => {
  const call = fixture({ getClientId: () => 'shared-client' });
  assert.equal(await call('profiles/a/test'), 400);
  assert.equal(await call('profiles/b/test', 'bob'), 429);
  assert.equal(await call('models/preview', 'alice', {}), 400);
  assert.equal(await call('profiles/a/models', 'bob', null), 429);
  assert.equal(await call('chat', 'alice', {}), 400);
  assert.equal(await call('chat', 'bob', {}), 429);
});

for (const route of ['chat', 'models/preview']) {
  test(`Web ${route} quota separates admin principal IDs`, async () => {
    const call = fixture();
    assert.equal(await call(route, 'alice', {}), 400);
    assert.equal(await call(route, 'bob', {}), 400);
    assert.equal(await call(route, 'alice', {}), 429);
  });
}

test('Web principals without IDs use a bounded shared fallback and rateLimit false disables quotas', async () => {
  const call = fixture({ authorize: async () => ({ isAdmin: true }) });
  assert.equal(await call('profiles/a/test'), 400);
  assert.equal(await call('profiles/b/test'), 429);
  const unlimited = fixture({ rateLimit: false });
  for (let i = 0; i < 3; i++) assert.equal(await unlimited('profiles/a/test'), 400);
});
