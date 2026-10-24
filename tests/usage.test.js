import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createLLMManager, createLLMProfileStore, createUsageTracker } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';

test('YH1-D4: createUsageTracker records entries and calculates monthly summaries without storing content', () => {
  const dir = `tests/.tmp-usage-tracker-${Date.now()}`;
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const tracker = createUsageTracker({ dataDir: dir, enabled: true });

    tracker.record({
      profileId: 'prof-openai',
      model: 'gpt-4o',
      durationMs: 450,
      inputTokens: 120,
      outputTokens: 80,
      code: 'OK'
    });

    tracker.record({
      profileId: 'prof-openai',
      model: 'gpt-4o',
      durationMs: 320,
      inputTokens: 50,
      outputTokens: 50,
      code: 'OK'
    });

    tracker.record({
      profileId: 'prof-anthropic',
      model: 'claude-3-7-sonnet',
      durationMs: 600,
      inputTokens: 200,
      outputTokens: 300,
      code: 'OK'
    });

    // Verify file exists
    const logFile = path.join(dir, `usage-${currentMonth}.jsonl`);
    assert.ok(fs.existsSync(logFile));
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
    assert.equal(lines.length, 3);

    // Verify NO prompt or response content or secret is saved
    for (const line of lines) {
      const parsed = JSON.parse(line);
      assert.equal(parsed.prompt, undefined);
      assert.equal(parsed.content, undefined);
      assert.equal(parsed.messages, undefined);
      assert.equal(parsed.apiKey, undefined);
      assert.ok(parsed.at && parsed.profileId && parsed.model && parsed.durationMs !== undefined);
    }

    // Verify summary
    const summary = tracker.getSummary(currentMonth);
    assert.equal(summary.month, currentMonth);
    assert.equal(summary.totalRequests, 3);
    assert.equal(summary.totalInputTokens, 370);
    assert.equal(summary.totalOutputTokens, 430);
    assert.equal(summary.totalTokens, 800);

    assert.equal(summary.byProfile['prof-openai'].requests, 2);
    assert.equal(summary.byProfile['prof-openai'].totalTokens, 300);

    assert.equal(summary.byProfile['prof-anthropic'].requests, 1);
    assert.equal(summary.byProfile['prof-anthropic'].totalTokens, 500);

    // Empty summary for non-existent month
    const emptySummary = tracker.getSummary('1999-01');
    assert.equal(emptySummary.totalRequests, 0);
    assert.equal(emptySummary.totalTokens, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-D4: chatCompletion appends usage logs when usageLog is enabled', async () => {
  const dir = `tests/.tmp-usage-chat-${Date.now()}`;
  try {
    const store = createLLMProfileStore({ dataDir: dir, allowLocalHttp: true });
    const saved = await store.save({
      name: 'Test Profile',
      provider: 'openai',
      model: 'mock-model',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test'
    });
    await store.activate(saved.id, saved.revision);

    const mockGenerate = async () => 'Harika bir yanıt!';
    const manager = createLLMManager({
      store,
      dataDir: dir,
      usageLog: true,
      allowLocalHttp: true,
      generate: mockGenerate
    });

    // 1. Successful ask
    await manager.ask('Merhaba!');

    // 2. Query GET /usage via handle
    const usageRes = await manager.handle({
      method: 'GET',
      path: '/usage',
      principal: { isAdmin: true }
    });

    assert.equal(usageRes.status, 200);
    assert.equal(usageRes.body.ok, true);
    assert.equal(usageRes.body.totalRequests, 1);
    assert.ok(usageRes.body.byProfile[saved.id]);
    assert.equal(usageRes.body.byProfile[saved.id].requests, 1);

    // 3. Permission check: non-admin forbidden
    const forbidden = await manager.handle({
      method: 'GET',
      path: '/usage',
      principal: { isAdmin: false }
    });
    assert.equal(forbidden.status, 403);
    assert.equal(forbidden.body.code, 'FORBIDDEN');

    // 4. Invalid month validation
    const invalidMonth = await manager.handle({
      method: 'GET',
      path: '/usage?month=2026-bad',
      principal: { isAdmin: true }
    });
    assert.equal(invalidMonth.status, 400);
    assert.equal(invalidMonth.body.code, 'PARAMS_INVALID');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('YH1-D4: Express mountLLMManagement provides authenticated GET /api/llm/usage', async () => {
  const dir = `tests/.tmp-usage-express-${Date.now()}`;
  try {
    const app = express();
    app.use(express.json());

    const store = createLLMProfileStore({ dataDir: dir, allowLocalHttp: true });
    const saved = await store.save({
      name: 'Express Profile',
      provider: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test'
    });
    await store.activate(saved.id, saved.revision);

    mountLLMManagement(app, {
      store,
      dataDir: dir,
      usageLog: true,
      adminPassword: 'SuperSecretAdmin123!',
      generate: async () => 'Express cevabı',
      allowLocalHttp: true
    });

    const server = await new Promise(resolve => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const port = server.address().port;
    const authHeader = 'Basic ' + Buffer.from('admin:SuperSecretAdmin123!').toString('base64');

    try {
      // 1. Without credentials -> 401
      const unauth = await fetch(`http://127.0.0.1:${port}/api/llm/usage`);
      assert.equal(unauth.status, 401);

      // 2. Perform chat call with CSRF and auth
      const chatRes = await fetch(`http://127.0.0.1:${port}/api/llm/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LLM-CSRF': '1',
          Authorization: authHeader
        },
        body: JSON.stringify({ prompt: 'Hello via Express!' })
      });
      assert.equal(chatRes.status, 200);

      // 3. Authenticated GET /api/llm/usage -> 200 with recorded request
      const usageRes = await fetch(`http://127.0.0.1:${port}/api/llm/usage`, {
        headers: { Authorization: authHeader }
      });
      assert.equal(usageRes.status, 200);
      const data = await usageRes.json();
      assert.equal(data.ok, true);
      assert.equal(data.totalRequests, 1);
      assert.ok(data.byProfile[saved.id]);
      assert.equal(data.byProfile[saved.id].requests, 1);
    } finally {
      server.close();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
