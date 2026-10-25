import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLLMManager, createLLMProfileStore } from '../src/core.js';

const input = {
  name: 'Host',
  provider: 'custom',
  model: 'model',
  baseURL: 'https://example.com/v1',
  apiKey: 'host-secret'
};
// Preserve the receiver and defer both values and rejections across an async boundary.
const wrapAsync = store =>
  Object.fromEntries(
    Object.keys(store).map(key => [
      key,
      async (...args) => {
        await new Promise(resolve => setImmediate(resolve));
        return store[key](...args);
      }
    ])
  );

async function exerciseCrud(store) {
  const logs = [];
  const manager = createLLMManager({
    store,
    rateLimit: false,
    retry: false,
    logger: { info: (...args) => logs.push(args) },
    generate: async (_messages, options) => {
      assert.equal(options.apiKey, 'host-secret');
      return 'OK';
    }
  });
  const call = (method, route, body) => manager.handle({ method, path: route, body });
  const created = await call('POST', '/profiles', input);
  assert.equal(created.status, 201, JSON.stringify(created));
  let profile = created.body;
  assert.equal(profile.hasApiKey, true);
  assert.equal((await call('GET', '/profiles')).body.profiles.length, 1);
  assert.equal((await call('PUT', `/profiles/${profile.id}`, { ...input, revision: 'stale' })).status, 409);
  const updated = await call('PUT', `/profiles/${profile.id}`, { ...profile, name: 'Edited' });
  assert.equal(updated.status, 200);
  assert.notEqual(updated.body.revision, profile.revision);
  profile = updated.body;
  assert.equal((await call('POST', `/profiles/${profile.id}/activate`, { revision: 'stale' })).status, 409);
  const activated = await call('POST', `/profiles/${profile.id}/activate`, { revision: profile.revision });
  assert.equal(activated.status, 200);
  assert.equal(activated.body.activeId, profile.id);
  for (const mode of ['quick', 'conversation']) {
    assert.equal((await call('POST', `/profiles/${profile.id}/test`, { mode })).body.ok, true);
    assert.equal((await store.list()).profiles[0].lastTests[mode].status, 'passed');
  }
  for (const body of [{ prompt: 'Hello' }, { prompt: 'Hello', profileId: profile.id }]) {
    const reply = await call('POST', '/chat', body);
    assert.equal(reply.status, 200);
    assert.equal(reply.body.content, 'OK');
    assert.equal(reply.body.profileId, profile.id);
    assert.equal(JSON.stringify(reply).includes('host-secret'), false);
  }
  assert.equal(JSON.stringify([created, updated, activated, await store.list(), logs]).includes('host-secret'), false);
  assert.equal((await call('DELETE', `/profiles/${profile.id}`, { revision: 'stale' })).status, 409);
  const deleted = await call('DELETE', `/profiles/${profile.id}`, { revision: profile.revision });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.activeId, null);
  assert.deepEqual(deleted.body.profiles, []);
  assert.equal((await call('POST', `/profiles/${profile.id}/activate`, { revision: profile.revision })).status, 404);
}

test('G08 CRUD, test and chat work through a deferred async file-store wrapper', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'host-store-'));
  try {
    await exerciseCrud(wrapAsync(createLLMProfileStore({ dataDir: root, encryptionKey: 'ab'.repeat(32) })));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('G08 async Map example supports CRUD, test and chat without leaking secrets', async () => {
  const { createMemoryStore } = await import('../examples/memory-store.js');
  await exerciseCrud(createMemoryStore());
});

test('G08 async test revision conflicts and failed diagnostics are persisted safely', async () => {
  const { createMemoryStore } = await import('../examples/memory-store.js');
  const store = wrapAsync(createMemoryStore());
  const profile = await store.save(input);
  let changeDuringTest = true;
  const manager = createLLMManager({
    store,
    rateLimit: false,
    retry: false,
    generate: async () => {
      if (changeDuringTest) {
        await store.save({ ...profile, model: 'new-model' });
        return 'OK';
      }
      throw new Error('host-secret');
    }
  });
  const conflict = await manager.handle({ method: 'POST', path: `/profiles/${profile.id}/test`, body: {} });
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.code, 'PROFILE_CONFLICT');
  assert.equal((await store.get(profile.id)).lastTest, null);
  changeDuringTest = false;
  const failed = await manager.handle({ method: 'POST', path: `/profiles/${profile.id}/test`, body: {} });
  assert.equal(failed.status, 502);
  assert.equal((await store.get(profile.id)).lastTests.quick.status, 'failed');
  assert.equal(JSON.stringify(failed).includes('host-secret'), false);
});

test('G08 memory store rejects invalid profiles and prevents mutation of stored state', async () => {
  const { createMemoryStore } = await import('../examples/memory-store.js');
  const store = createMemoryStore();
  await assert.rejects(store.save({ ...input, apiKey: '' }), { code: 'PROFILE_INVALID' });
  await assert.rejects(store.save({ ...input, baseURL: 'http://example.com' }), { code: 'PROFILE_INVALID' });
  const profile = await store.save({ ...input, fallbackProfileIds: ['backup'] });
  await assert.rejects(store.save({ ...profile, baseURL: 'https://other.example/v1' }), { code: 'PROFILE_INVALID' });
  await assert.rejects(store.remove(profile.id), { code: 'PROFILE_CONFLICT' });
  await assert.rejects(store.recordTest(profile.id, 'unknown'), { code: 'PROFILE_INVALID' });
  await assert.rejects(store.recordTest('missing', 'passed'), { code: 'PROFILE_NOT_FOUND' });
  profile.fallbackProfileIds.push('injected');
  const internal = await store.get(profile.id);
  internal.apiKey = 'changed';
  assert.deepEqual((await store.get(profile.id)).fallbackProfileIds, ['backup']);
  assert.equal((await store.get(profile.id)).apiKey, 'host-secret');
  assert.equal(await store.get('missing'), null);
  assert.equal(await store.getActive(), null);
});
