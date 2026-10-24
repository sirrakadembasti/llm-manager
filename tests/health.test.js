import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import express from 'express';
import { createLLMManager, createLLMProfileStore } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';

test('YH1-D2: core handle GET /health returns status, version and active profile presence without secrets', async () => {
  const dir = `tests/.tmp-health-${Date.now()}`;
  try {
    const store = createLLMProfileStore({ dataDir: dir, allowLocalHttp: true });
    const manager = createLLMManager({ store, allowLocalHttp: true });

    // Initially no active profile
    const res1 = await manager.handle({
      method: 'GET',
      path: '/health'
    });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.ok, true);
    assert.equal(typeof res1.body.version, 'string');
    assert.equal(res1.body.hasActiveProfile, false);
    assert.equal(res1.body.profiles, undefined);
    assert.equal(res1.body.apiKey, undefined);
    assert.equal(res1.body.name, undefined);

    // Add and activate profile
    const saved = await store.save({
      name: 'Prod OpenAI',
      provider: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-prod-secret'
    });
    await store.activate(saved.id, saved.revision);

    const res2 = await manager.handle({
      method: 'GET',
      path: '/health'
    });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.ok, true);
    assert.equal(res2.body.hasActiveProfile, true);
    // Verify no secret leak
    assert.equal(res2.body.apiKey, undefined);
    assert.equal(res2.body.profileId, undefined);
    assert.equal(res2.body.name, undefined);
    assert.equal(JSON.stringify(res2.body).includes('Prod OpenAI'), false);
    assert.equal(JSON.stringify(res2.body).includes('sk-prod-secret'), false);

    // Non-GET methods should return null (404)
    const postRes = await manager.handle({
      method: 'POST',
      path: '/health',
      body: {}
    });
    assert.equal(postRes, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-D2: health: false disables /health endpoint in core and fetchHandler', async () => {
  const dir = `tests/.tmp-health-off-${Date.now()}`;
  try {
    const store = createLLMProfileStore({ dataDir: dir, allowLocalHttp: true });
    const manager = createLLMManager({ store, allowLocalHttp: true, health: false });

    const handleRes = await manager.handle({
      method: 'GET',
      path: '/health'
    });
    assert.equal(handleRes, null);

    const fetchRes = await manager.fetch(new Request('http://localhost/api/llm/health'));
    assert.equal(fetchRes.status, 404);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-D2: Express mountLLMManagement exposes GET /api/llm/health without authentication', async () => {
  const dir = `tests/.tmp-health-express-${Date.now()}`;
  try {
    const app = express();
    app.use(express.json());

    const store = createLLMProfileStore({ dataDir: dir, allowLocalHttp: true });
    mountLLMManagement(app, {
      store,
      adminPassword: 'SecretPassword123!',
      chatAccess: 'authenticated',
      allowLocalHttp: true
    });

    const server = await new Promise(resolve => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const port = server.address().port;

    try {
      // 1. GET /api/llm/health WITHOUT authorization header must return 200
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/llm/health`);
      assert.equal(healthRes.status, 200);
      const data = await healthRes.json();
      assert.equal(data.ok, true);
      assert.equal(data.hasActiveProfile, false);
      assert.equal(typeof data.version, 'string');

      // 2. Protected endpoint without auth still returns 401
      const chatRes = await fetch(`http://127.0.0.1:${port}/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LLM-CSRF': '1' },
        body: JSON.stringify({ prompt: 'hi' })
      });
      assert.equal(chatRes.status, 401);
    } finally {
      server.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
