import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountLLMManagement } from '../src/index.js';

test('G01/G24: Express chat token cannot authenticate the management page or script', async () => {
  const app = express();
  mountLLMManagement(app, {
    store: {},
    adminPassword: 'admin-password',
    chatTokens: ['chat-token'],
    rateLimit: false
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const route of ['/llm', '/llm/llm-ui.js', '/api/llm/profiles']) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
        headers: { Authorization: 'Bearer chat-token' }
      });
      assert.equal(response.status, 403, route);
      assert.equal((await response.json()).code, 'FORBIDDEN');
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
