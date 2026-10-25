import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express5';
import { mountLLMManagement } from '../../src/index.js';

test('Express 5 host authenticates before parsing and preserves structured parser errors', async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'llm-express5-errors-'));
  let server;
  try {
    const app = express();
    mountLLMManagement(app, {
      dataDir,
      adminPassword: 'express5-test-password',
      rateLimit: false,
      bodyLimit: '1kb',
      logger: { info() {}, warn() {} }
    });
    app.use(express.json());
    server = await new Promise((resolve, reject) => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
      listener.once('error', reject);
    });
    const url = `http://127.0.0.1:${server.address().port}/api/llm/profiles`;
    for (const [body, authenticated, status, code] of [
      ['{', false, 401, 'UNAUTHORIZED'],
      [JSON.stringify({ padding: 'x'.repeat(2048) }), false, 401, 'UNAUTHORIZED'],
      ['{', true, 400, 'BODY_INVALID'],
      [JSON.stringify({ padding: 'x'.repeat(2048) }), true, 413, 'BODY_TOO_LARGE']
    ]) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-CSRF': '1',
          'X-Request-Id': 'express5-acceptance',
          ...(authenticated
            ? { Authorization: 'Basic ' + Buffer.from('admin:express5-test-password').toString('base64') }
            : {})
        },
        body
      });
      const payload = await response.json();
      assert.equal(response.status, status);
      assert.equal(payload.code, code);
      assert.equal(payload.requestId, 'express5-acceptance');
      assert.equal(response.headers.get('x-request-id'), payload.requestId);
    }
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
    }
    await rm(dataDir, { recursive: true, force: true });
  }
});
