import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLLMManager } from '../src/core.js';
import { createBasicAuth } from '../src/index.js';
import { createRateLimiter } from '../src/rateLimit.js';
import { redact, sanitizeRequestId, createStructuredLogger } from '../src/logger.js';
import { ErrorCodes } from '../src/errors.js';

function createTempDir(prefix = 'llm-runtime-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('YH1-C1: message count, total chars, single message chars and role whitelist validation', async () => {
  const tempDir = createTempDir();
  const manager = createLLMManager({
    dataDir: tempDir,
    limits: {
      maxMessages: 3,
      maxChars: 50,
      maxSingleMessageChars: 30
    },
    chatAccess: 'authenticated',
    generate: async () => 'test response'
  });

  const saveRes = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Default Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-proj-test12345678'
    }
  });
  assert.equal(saveRes.status, 201);
  await manager.handle({
    method: 'POST',
    path: `/profiles/${saveRes.body.id}/activate`,
    body: { revision: saveRes.body.revision }
  });

  // 1. Role whitelist: unknown role 'tool'
  const roleRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: {
      messages: [{ role: 'tool', content: 'test' }]
    }
  });
  assert.equal(roleRes.status, 400);
  assert.equal(roleRes.body.code, ErrorCodes.MESSAGES_INVALID || 'MESSAGES_INVALID');

  // 2. At least one user message required
  const noUserRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: {
      messages: [{ role: 'system', content: 'You are helpful' }]
    }
  });
  assert.equal(noUserRes.status, 400);
  assert.equal(noUserRes.body.code, 'MESSAGES_INVALID');

  // 3. Max messages exceeded (limit is 3)
  const maxMsgRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: {
      messages: [
        { role: 'user', content: '1' },
        { role: 'assistant', content: '2' },
        { role: 'user', content: '3' },
        { role: 'assistant', content: '4' }
      ]
    }
  });
  assert.equal(maxMsgRes.status, 400);
  assert.equal(maxMsgRes.body.code, 'MESSAGES_INVALID');

  // 4. Single message chars exceeded (limit is 30)
  const singleCharRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: {
      messages: [{ role: 'user', content: 'A'.repeat(35) }]
    }
  });
  assert.equal(singleCharRes.status, 400);
  assert.equal(singleCharRes.body.code, 'MESSAGES_INVALID');

  // 5. Total chars exceeded (limit is 50)
  const totalCharRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    body: {
      messages: [
        { role: 'user', content: 'A'.repeat(28) },
        { role: 'assistant', content: 'B'.repeat(28) }
      ]
    }
  });
  assert.equal(totalCharRes.status, 400);
  assert.equal(totalCharRes.body.code, 'MESSAGES_INVALID');
});

test('YH1-C1 & D1: llm.fetch enforces body size limits, invalid JSON, and propagates x-request-id', async () => {
  const tempDir = createTempDir();
  const manager = createLLMManager({
    dataDir: tempDir,
    limits: {
      maxBodyBytes: 100
    }
  });

  // 1. Invalid JSON body
  const invalidJsonReq = new Request('http://localhost/api/llm/profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      'x-request-id': 'custom-req-id-12345'
    },
    body: '{"invalid-json: '
  });
  const invalidJsonRes = await manager.fetch(invalidJsonReq);
  assert.equal(invalidJsonRes.status, 400);
  const invalidData = await invalidJsonRes.json();
  assert.equal(invalidData.code, 'BODY_INVALID');
  assert.equal(invalidData.requestId, 'custom-req-id-12345');
  assert.equal(invalidJsonRes.headers.get('x-request-id'), 'custom-req-id-12345');

  // 2. Body size exceeded (maxBodyBytes = 100)
  const largeReq = new Request('http://localhost/api/llm/profiles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ name: 'x'.repeat(200) })
  });
  const largeRes = await manager.fetch(largeReq);
  assert.equal(largeRes.status, 413);
  const largeData = await largeRes.json();
  assert.equal(largeData.code, 'BODY_TOO_LARGE');
  assert.ok(largeRes.headers.get('x-request-id'));
});

test('YH1-C2: chatOverrides permissions - non-admin cannot override profileId, timeoutMs or maxOutputTokens', async () => {
  const tempDir = createTempDir();
  let invokedProfileId = null;
  let invokedOptions = null;

  const manager = createLLMManager({
    dataDir: tempDir,
    chatOverrides: 'admin', // default
    generate: async (messages, options) => {
      invokedProfileId = options.id;
      invokedOptions = options;
      return 'ok';
    }
  });

  const p1 = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Default Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-proj-test12345678'
    }
  });
  assert.equal(p1.status, 201);
  const p2 = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Expensive Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-proj-test12345678'
    }
  });
  assert.equal(p2.status, 201);

  const actRes = await manager.handle({
    method: 'POST',
    path: `/profiles/${p1.body.id}/activate`,
    body: { revision: p1.body.revision }
  });
  assert.equal(actRes.status, 200);

  // Non-admin request tries to override profileId to p2 and set maxOutputTokens
  const nonAdminRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    principal: { isAdmin: false },
    body: {
      prompt: 'Hello',
      profileId: p2.body.id,
      maxOutputTokens: 99999
    }
  });
  assert.equal(nonAdminRes.status, 200);
  assert.equal(invokedProfileId, p1.body.id, 'Non-admin override must be ignored; falls back to active profile');
  assert.notEqual(invokedOptions?.maxOutputTokens, 99999, 'Non-admin maxOutputTokens override must be ignored');

  // Admin request CAN override profileId
  const adminRes = await manager.handle({
    method: 'POST',
    path: '/chat',
    principal: { isAdmin: true },
    body: {
      prompt: 'Hello',
      profileId: p2.body.id,
      maxOutputTokens: 4096
    }
  });
  assert.equal(adminRes.status, 200);
  assert.equal(invokedProfileId, p2.body.id, 'Admin can override profileId');
  assert.equal(invokedOptions?.maxOutputTokens, 4096, 'Admin can override maxOutputTokens');
});

test('YH1-C3: rate limiting on /chat and Basic Auth brute-force', async () => {
  // 1. Rate limiter unit test
  const limiter = createRateLimiter({ capacity: 3, refillPerSec: 1 });
  assert.equal(limiter.take('ip-1').ok, true);
  assert.equal(limiter.take('ip-1').ok, true);
  assert.equal(limiter.take('ip-1').ok, true);
  const limited = limiter.take('ip-1');
  assert.equal(limited.ok, false);
  assert.ok(limited.retryAfterSec >= 1);

  // Different key has its own bucket
  assert.equal(limiter.take('ip-2').ok, true);

  // 2. Core rate limiting on /chat
  const tempDir = createTempDir();
  const manager = createLLMManager({
    dataDir: tempDir,
    rateLimit: {
      chatPerMinute: 2,
      testPerMinute: 2
    },
    generate: async () => 'pong'
  });
  const saveRes = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Default Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-proj-test12345678'
    }
  });
  assert.equal(saveRes.status, 201);
  const actRes = await manager.handle({
    method: 'POST',
    path: `/profiles/${saveRes.body.id}/activate`,
    body: { revision: saveRes.body.revision }
  });
  assert.equal(actRes.status, 200);

  const res1 = await manager.handle({ method: 'POST', path: '/chat', clientKey: 'client-A', body: { prompt: '1' } });
  assert.equal(res1.status, 200);
  const res2 = await manager.handle({ method: 'POST', path: '/chat', clientKey: 'client-A', body: { prompt: '2' } });
  assert.equal(res2.status, 200);
  const res3 = await manager.handle({ method: 'POST', path: '/chat', clientKey: 'client-A', body: { prompt: '3' } });
  assert.equal(res3.status, 429);
  assert.equal(res3.body.code, 'RATE_LIMITED');
  assert.ok(res3.body.retryAfterSec >= 1);

  // 3. Basic Auth brute force limiter
  const authMiddleware = createBasicAuth({ password: 'correct-secret-password-123' });
  const mockReq = {
    get: () => 'Basic ' + Buffer.from('admin:wrong-password').toString('base64'),
    ip: '192.168.1.100',
    socket: {}
  };
  let lastStatus = 0;
  const mockRes = {
    set: () => {},
    sendStatus: status => {
      lastStatus = status;
    },
    status: status => {
      lastStatus = status;
      return {
        json: () => {}
      };
    }
  };

  for (let i = 0; i < 10; i++) {
    authMiddleware(mockReq, mockRes, () => {});
    assert.equal(lastStatus, 401);
  }
  // 11th attempt should trigger 429 RATE_LIMITED
  authMiddleware(mockReq, mockRes, () => {});
  assert.equal(lastStatus, 429);
});

test('YH1-D1: structured logger and sensitive data redaction', () => {
  // 1. Redact object keys
  const sensitiveObj = {
    apiKey: 'sk-1234567890',
    password: 'super-secret-password',
    token: 'jwt.token.here',
    nested: {
      authorization: 'Bearer token-abc',
      safeField: 'hello world'
    }
  };
  const redacted = redact(sensitiveObj);
  assert.equal(redacted.apiKey, '[REDACTED]');
  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.token, '[REDACTED]');
  assert.equal(redacted.nested.authorization, '[REDACTED]');
  assert.equal(redacted.nested.safeField, 'hello world');

  // 2. Request ID sanitization
  assert.equal(sanitizeRequestId('valid-id_12345.67'), 'valid-id_12345.67');
  // Invalid chars or too short -> auto-generated UUID
  const sanitized = sanitizeRequestId('short');
  assert.match(sanitized, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  // 3. Structured logger wraps methods
  const loggedEvents = [];
  const mockLogger = {
    info: (event, meta) => loggedEvents.push({ level: 'info', event, meta })
  };
  const logger = createStructuredLogger(mockLogger);
  logger.info('test.event', { apiKey: 'secret', ok: true });
  assert.equal(loggedEvents.length, 1);
  assert.equal(loggedEvents[0].meta.apiKey, '[REDACTED]');
  assert.equal(loggedEvents[0].meta.ok, true);
});
