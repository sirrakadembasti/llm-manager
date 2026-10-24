import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import {
  createLLMManager,
  createLLMProfileStore,
  PROVIDERS,
  CATALOG_VERSION,
  CATALOG_UPDATED_AT
} from '../src/core.js';
import { resolveApiKey, checkProvider, runCatalogCheck } from '../scripts/check-catalog.js';

test('YH1-C10: catalog data structure and immutability', () => {
  assert.ok(Array.isArray(PROVIDERS));
  assert.ok(PROVIDERS.length >= 20);
  assert.equal(typeof CATALOG_VERSION, 'string');
  assert.equal(typeof CATALOG_UPDATED_AT, 'string');

  assert.ok(Object.isFrozen(PROVIDERS));
  for (const p of PROVIDERS) {
    assert.ok(Object.isFrozen(p));
    assert.ok(p.id && typeof p.id === 'string');
    assert.ok(p.name && typeof p.name === 'string');
    if (p.models) {
      assert.ok(Object.isFrozen(p.models));
    }
  }

  // Attempting mutation should fail
  assert.throws(() => {
    PROVIDERS.push({ id: 'bad' });
  }, TypeError);
});

test('YH1-C10: GET /catalog returns catalogVersion and updatedAt', async () => {
  const dir = `tests/.tmp-catalog-${Date.now()}`;
  try {
    const store = createLLMProfileStore({
      dataDir: dir,
      allowLocalHttp: true
    });
    const manager = createLLMManager({ store, allowLocalHttp: true });

    const res = await manager.handle({
      method: 'GET',
      path: '/catalog',
      principal: { isAdmin: true }
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.catalogVersion, CATALOG_VERSION);
    assert.equal(res.body.updatedAt, CATALOG_UPDATED_AT);
    assert.ok(Array.isArray(res.body.providers));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-C10: POST /models/preview permissions, validation and secret protection', async () => {
  const dir = `tests/.tmp-preview-${Date.now()}`;
  try {
    const store = createLLMProfileStore({
      dataDir: dir,
      allowLocalHttp: true
    });
    const manager = createLLMManager({ store, allowLocalHttp: true });

    // 1. Non-admin forbidden
    const forbidden = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: false },
      body: { provider: 'openai', baseURL: 'https://api.openai.com/v1', apiKey: 'sk-123' }
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    // 2. Missing params
    const missing = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: true },
      body: {}
    });
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, 'PARAMS_INVALID');

    // 3. Missing API key without existing profile
    const noKey = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: true },
      body: { provider: 'openai', baseURL: 'https://api.openai.com/v1' }
    });
    assert.equal(noKey.status, 400);
    assert.equal(noKey.body.code, 'API_KEY_REQUIRED');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-C10: POST /models/preview live fetch against mock upstream', async () => {
  let receivedAuth = null;
  const mockServer = createServer((req, res) => {
    receivedAuth = req.headers.authorization;
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mock-gpt-4o' }, { id: 'mock-gpt-4o-mini' }] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;
  const baseURL = `http://127.0.0.1:${port}/v1`;
  const dir = `tests/.tmp-preview-mock-${Date.now()}`;

  try {
    const store = createLLMProfileStore({
      dataDir: dir,
      allowLocalHttp: true
    });
    const manager = createLLMManager({ store, allowLocalHttp: true });

    // Direct preview with explicit key
    const res = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: true },
      body: {
        provider: 'openai',
        baseURL,
        apiKey: 'sk-preview-key'
      }
    });

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.models, ['mock-gpt-4o', 'mock-gpt-4o-mini']);
    assert.equal(receivedAuth, 'Bearer sk-preview-key');
    // Ensure apiKey is never in response body
    assert.equal(res.body.apiKey, undefined);

    // Save a profile with apiKey
    const saved = await store.save({
      name: 'Existing Profile',
      provider: 'openai',
      model: 'mock-gpt-4o',
      baseURL,
      apiKey: 'sk-saved-key'
    });

    // Preview without apiKey but with profileId should reuse saved key
    const resReuse = await manager.handle({
      method: 'POST',
      path: '/models/preview',
      principal: { isAdmin: true },
      body: {
        provider: 'openai',
        baseURL,
        profileId: saved.id
      }
    });

    assert.equal(resReuse.status, 200);
    assert.deepEqual(resReuse.body.models, ['mock-gpt-4o', 'mock-gpt-4o-mini']);
    assert.equal(receivedAuth, 'Bearer sk-saved-key');
    assert.equal(resReuse.body.apiKey, undefined);
  } finally {
    mockServer.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-C10: scripts/check-catalog.js key resolution and check logic', async () => {
  // Test resolveApiKey
  assert.equal(resolveApiKey('openai', 'direct-key'), 'direct-key');
  process.env.PROVIDER_KEY_TEST_PROV = 'env-key-1';
  assert.equal(resolveApiKey('test_prov'), 'env-key-1');
  delete process.env.PROVIDER_KEY_TEST_PROV;

  // Test checkProvider with mock server
  const mockServer = createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'model-a' }, { id: 'model-b' }, { id: 'model-new' }] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;
  const baseURL = `http://127.0.0.1:${port}/v1`;

  try {
    const provider = {
      id: 'mock',
      name: 'Mock Provider',
      transport: 'openai',
      baseURL,
      models: ['model-a', 'model-obsolete']
    };

    const result = await checkProvider(provider, 'sk-test', { allowLocalHttp: true });
    assert.equal(result.remoteCount, 3);
    assert.deepEqual(result.verified, ['model-a']);
    assert.deepEqual(result.missingInRemote, ['model-obsolete']);

    // Test CLI runner help
    const helpCode = await runCatalogCheck(['--help']);
    assert.equal(helpCode, 0);
  } finally {
    mockServer.close();
  }
});
