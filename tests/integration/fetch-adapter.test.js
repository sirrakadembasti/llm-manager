import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLLMManager } from '../../src/core.js';
import { createMockProvider } from '../helpers/mockProvider.js';

function createTempDir(prefix = 'llm-fetch-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Convert Node http incoming request to Web standard Request
function nodeReqToWebRequest(req, bodyBuffer) {
  const url = `http://${req.headers.host}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }
  }

  const init = {
    method: req.method,
    headers
  };
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    init.body = bodyBuffer;
    init.duplex = 'half';
  }
  return new Request(url, init);
}

test('YH1-F2: Web standard llm.fetch integration with native Node HTTP server bridge', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  const manager = createLLMManager({
    dataDir: tempDir,
    allowLocalHttp: true
  });

  const server = http.createServer(async (req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const bodyBuffer = Buffer.concat(chunks);
      const webReq = nodeReqToWebRequest(req, bodyBuffer);

      const webRes = await manager.fetch(webReq);
      if (!webRes) {
        res.writeHead(404);
        return res.end();
      }

      const headers = {};
      webRes.headers.forEach((v, k) => {
        headers[k] = v;
      });
      res.writeHead(webRes.status, headers);
      const resBody = await webRes.arrayBuffer();
      res.end(Buffer.from(resBody));
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /llm returns management UI HTML
    const uiRes = await fetch(`${baseUrl}/llm`);
    assert.equal(uiRes.status, 200);
    const html = await uiRes.text();
    assert.ok(html.includes('LLM'));

    // 2. Create profile via POST /api/llm/profiles
    const createRes = await fetch(`${baseUrl}/api/llm/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({
        name: 'Anthropic Test',
        provider: 'anthropic',
        baseURL: `${mockUrl}/v1`,
        model: 'claude-sonnet-4-20250514',
        apiKey: 'sk-ant-test-key-12345678'
      })
    });
    assert.equal(createRes.status, 201);
    const profile = await createRes.json();
    assert.ok(profile.id);

    // 3. Activate profile
    const actRes = await fetch(`${baseUrl}/api/llm/profiles/${profile.id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({ revision: profile.revision })
    });
    assert.equal(actRes.status, 200);

    // 4. Test profile
    const testRes = await fetch(`${baseUrl}/api/llm/profiles/${profile.id}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({ mode: 'quick' })
    });
    assert.equal(testRes.status, 200);

    // 5. Chat via POST /api/llm/chat
    const chatRes = await fetch(`${baseUrl}/api/llm/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LLM-CSRF': '1'
      },
      body: JSON.stringify({
        prompt: 'Hi Claude!'
      })
    });
    assert.equal(chatRes.status, 200);
    const chatData = await chatRes.json();
    assert.equal(chatData.content, 'Mock Anthropic response');

    // 6. Direct ask() helper works seamlessly
    const reply = await manager.ask('What is 2+2?');
    assert.equal(reply, 'Mock Anthropic response');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await mock.close();
  }
});
