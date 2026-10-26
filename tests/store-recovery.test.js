import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createLLMManager, createLLMProfileStore } from '../src/core.js';
import { LLMError } from '../src/errors.js';
import { encrypt } from '../src/profileStore.js';
import { recoveryFixture, assertRepairResponse, assertUiRepair } from './helpers/storeRecovery.js';

const auth = 'Basic ' + Buffer.from('admin:recovery-password').toString('base64');

test('B3 Web returns corrupt-file repair instructions and displays them through UI request/message', async t => {
  const fixture = await recoveryFixture(t);
  const manager = createLLMManager(fixture.options);
  const fetchRequest = (url, options = {}) =>
    manager.fetch(
      new Request(`http://localhost${url}`, {
        ...options,
        headers: { ...options.headers, Authorization: auth }
      })
    );
  await t.test('profiles response', async () => assertRepairResponse(await fetchRequest('/api/llm/profiles')));
  await t.test('visible UI repair message', async () => assertUiRepair(fetchRequest));
  for (const profileId of [undefined, 'chosen']) {
    await t.test('chat ' + (profileId || 'active'), async () =>
      assertRepairResponse(
        await fetchRequest('/api/llm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
          body: JSON.stringify({ prompt: 'hello', profileId })
        })
      )
    );
  }
  for (const [route, method, body] of [
    ['/profiles/chosen/test', 'POST', { mode: 'quick' }],
    ['/profiles/chosen/models', 'GET'],
    ['/models/preview', 'POST', { provider: 'openai', baseURL: 'https://api.openai.com/v1', profileId: 'chosen' }]
  ]) {
    await t.test(route, async () =>
      assertRepairResponse(
        await fetchRequest(`/api/llm${route}`, {
          method,
          headers: { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
          ...(body ? { body: JSON.stringify(body) } : {})
        })
      )
    );
  }
  await fixture.unchanged();
});

test('B3 future-version read/write errors never overwrite profiles or backup', async t => {
  const fixture = await recoveryFixture(t, '{"version":99,"activeId":null,"profiles":[]}');
  const manager = createLLMManager(fixture.options);
  for (const input of [
    { method: 'GET', path: '/profiles' },
    {
      method: 'POST',
      path: '/profiles',
      body: { name: 'A', provider: 'openai', model: 'gpt-4o', apiKey: 'key', baseURL: 'https://api.openai.com/v1' }
    }
  ]) {
    const result = await manager.handle(input);
    assert.equal(result.status, 500);
    assert.equal(result.body.code, 'STORE_VERSION_UNSUPPORTED');
  }
  await fixture.unchanged();
});

test('B3 corruption between active selection and fallback read preserves repair instructions', async t => {
  const fixture = await recoveryFixture(t);
  const corruptBytes = await fs.readFile(fixture.file, 'utf8');
  fixture.options.encryptionKey = 'ab'.repeat(32);
  await fs.writeFile(
    fixture.file,
    JSON.stringify({
      version: 1,
      activeId: 'primary',
      profiles: [
        {
          id: 'primary',
          provider: 'openai',
          model: 'gpt-4o',
          baseURL: 'https://api.openai.com/v1',
          secret: encrypt('secret-primary-key', Buffer.from(fixture.options.encryptionKey, 'hex')),
          fallbackProfileIds: ['fallback']
        }
      ]
    })
  );
  const fileStore = createLLMProfileStore(fixture.options);
  let selectedPrimary = false;
  const manager = createLLMManager({
    ...fixture.options,
    store: {
      ...fileStore,
      async getActive() {
        const profile = await fileStore.getActive();
        selectedPrimary = profile.id === 'primary';
        await fs.writeFile(fixture.file, corruptBytes);
        return profile;
      }
    },
    generate() {
      assert.fail('provider must not run after corrupt fallback read');
    }
  });
  await assertRepairResponse(
    await manager.fetch(
      new Request('http://localhost/api/llm/chat', {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
        body: JSON.stringify({ prompt: 'hello' })
      })
    )
  );
  assert.equal(selectedPrimary, true);
  await fixture.unchanged();
});

test('B3 public health maps known store errors without exposing their message', async t => {
  const fixture = await recoveryFixture(t);
  const response = await createLLMManager(fixture.options).fetch(new Request('http://localhost/api/llm/health'));
  assert.equal(response.status, 500);
  assert.equal((await response.json()).code, 'STORE_CORRUPT');
  const manager = createLLMManager({
    store: {
      getActive() {
        throw new LLMError('STORE_CORRUPT', 'host-secret-path-and-key', { status: 500 });
      }
    }
  });
  const result = await manager.handle({ method: 'GET', path: '/health' });
  assert.equal(result.status, 500);
  assert.equal(result.body.code, 'STORE_CORRUPT');
  assert.equal(JSON.stringify(result).includes('host-secret'), false);
  const defaultMethod = await manager.handle({ path: '/health' });
  assert.equal(JSON.stringify(defaultMethod).includes('host-secret'), false);
  await fixture.unchanged();
});

test('B3 unknown host store errors retain rejection semantics', async () => {
  const error = new Error('private-host-failure');
  const fail = () => {
    throw error;
  };
  const manager = createLLMManager({
    insecureNoAuth: true,
    rateLimit: false,
    store: { list: fail, get: fail, getActive: fail }
  });
  for (const [method, route, body] of [
    ['GET', 'profiles'],
    ['GET', 'health'],
    ['POST', 'chat', { prompt: 'hello' }]
  ]) {
    await assert.rejects(manager.handle({ method, path: `/${route}`, body }), caught => caught === error);
  }
  await assert.rejects(manager.fetch(new Request('http://localhost/api/llm/profiles')), caught => caught === error);
});
