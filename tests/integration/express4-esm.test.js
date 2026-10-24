import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import { mountLLMManagement } from '../../src/index.js';
import { createMockProvider } from '../helpers/mockProvider.js';

function createTempDir(prefix = 'llm-int-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('YH1-F2: Express 4 ESM integration with real HTTP server and mock provider', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  const app = express();
  app.use(express.json());

  mountLLMManagement(app, {
    adminPassword: 'super-secret-password-1234',
    dataDir: tempDir,
    allowLocalHttp: true,
    chatAccess: 'authenticated'
  });

  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  const authHeader = 'Basic ' + Buffer.from('admin:super-secret-password-1234').toString('base64');

  try {
    // 1. Unauthenticated request to /llm or /api/llm/profiles returns 401
    const unauthRes = await fetch(`${baseUrl}/api/llm/profiles`);
    assert.equal(unauthRes.status, 401);

    // 2. Authenticated GET /llm returns HTML page with CSP headers and x-request-id
    const pageRes = await fetch(`${baseUrl}/llm`, {
      headers: { Authorization: authHeader }
    });
    assert.equal(pageRes.status, 200);
    assert.ok(pageRes.headers.get('content-security-policy'));
    assert.ok(pageRes.headers.get('x-request-id'));
    const html = await pageRes.text();
    assert.ok(html.includes('LLM'));

    // 3. POST /api/llm/profiles without CSRF returns 403
    const noCsrfRes = await fetch(`${baseUrl}/api/llm/profiles`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Test' })
    });
    assert.equal(noCsrfRes.status, 403);
    const noCsrfData = await noCsrfRes.json();
    assert.equal(noCsrfData.code, 'CSRF_REQUIRED');

    // 4. Create profile pointing to mock provider
    const createRes = await fetch(`${baseUrl}/api/llm/profiles`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({
        name: 'Mock OpenAI Profile',
        provider: 'openai',
        baseURL: `${mockUrl}/v1`,
        model: 'gpt-4o',
        apiKey: 'sk-mock-key-12345678'
      })
    });
    assert.equal(createRes.status, 201);
    const profile = await createRes.json();
    assert.ok(profile.id);
    assert.ok(profile.revision);
    assert.equal(profile.hasApiKey, true);

    // 5. Activate profile
    const activateRes = await fetch(`${baseUrl}/api/llm/profiles/${profile.id}/activate`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({ revision: profile.revision })
    });
    assert.equal(activateRes.status, 200);

    // 6. Test profile against mock provider
    const testRes = await fetch(`${baseUrl}/api/llm/profiles/${profile.id}/test`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({ mode: 'quick' })
    });
    assert.equal(testRes.status, 200);
    const testData = await testRes.json();
    assert.equal(testData.ok, true);

    // 7. List models from mock provider
    const modelsRes = await fetch(`${baseUrl}/api/llm/profiles/${profile.id}/models`, {
      headers: { Authorization: authHeader }
    });
    assert.equal(modelsRes.status, 200);
    const modelsData = await modelsRes.json();
    assert.ok(Array.isArray(modelsData.models));
    assert.ok(modelsData.models.includes('gpt-4o'));

    // 8. Chat completion via POST /api/llm/chat
    const chatRes = await fetch(`${baseUrl}/api/llm/chat`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1',
        'x-request-id': 'client-custom-req-id-777'
      },
      body: JSON.stringify({
        prompt: 'Hello AI!'
      })
    });
    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.headers.get('x-request-id'), 'client-custom-req-id-777');
    const chatData = await chatRes.json();
    assert.equal(chatData.content, 'Mock OpenAI response');
    assert.equal(chatData.profileId, profile.id);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mock.close();
  }
});
