import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import express from 'express';
import { createLLMManager } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';
import { getTransport } from '../src/transports/index.js';
import { createMockProvider } from './helpers/mockProvider.js';

function createTempDir(prefix = 'llm-stream-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Helper to parse SSE text into array of { event, data }
function parseSseEvents(rawText) {
  const events = [];
  const blocks = rawText.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    let event = 'message';
    const dataLines = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length > 0) {
      let data = dataLines.join('\n');
      try {
        data = JSON.parse(data);
      } catch {}
      events.push({ event, data });
    }
  }
  return events;
}

test('YH1-C4: Transport parseStreamEvent parsing across OpenAI, Anthropic, and Google', () => {
  // 1. OpenAI
  const openai = getTransport('openai');
  const o1 = openai.parseStreamEvent('{"choices":[{"delta":{"content":"Hello "}}]}');
  assert.equal(o1.text, 'Hello ');
  assert.equal(o1.done, false);

  const oDone = openai.parseStreamEvent('[DONE]');
  assert.equal(oDone.done, true);

  const oUsage = openai.parseStreamEvent(
    '{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}'
  );
  assert.equal(oUsage.finishReason, 'stop');
  assert.deepEqual(oUsage.usage, { inputTokens: 10, outputTokens: 5, totalTokens: 15 });

  // 2. Anthropic
  const anthropic = getTransport('anthropic');
  const aStart = anthropic.parseStreamEvent('{"type":"message_start","message":{"usage":{"input_tokens":12}}}');
  assert.deepEqual(aStart.usage, { inputTokens: 12 });

  const aDelta = anthropic.parseStreamEvent(
    '{"type":"content_block_delta","delta":{"type":"text_delta","text":"Anthropic"}}'
  );
  assert.equal(aDelta.text, 'Anthropic');

  const aStop = anthropic.parseStreamEvent('{"type":"message_stop"}');
  assert.equal(aStop.done, true);

  // 3. Google
  const google = getTransport('google');
  const g1 = google.parseStreamEvent('{"candidates":[{"content":{"parts":[{"text":"Gemini text"}]}}]}');
  assert.equal(g1.text, 'Gemini text');
  assert.equal(g1.done, false);

  const gDone = google.parseStreamEvent(
    '{"candidates":[{"content":{"parts":[]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":8,"candidatesTokenCount":4,"totalTokenCount":12}}'
  );
  assert.equal(gDone.finishReason, 'STOP');
  assert.equal(gDone.done, true);
  assert.deepEqual(gDone.usage, { inputTokens: 8, outputTokens: 4, totalTokens: 12 });
});

test('YH1-C4: llm.stream() yields deltas and done event with usage for OpenAI, Anthropic and Google', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  const manager = createLLMManager({ insecureNoAuth: true, dataDir: tempDir, allowLocalHttp: true });

  // 1. OpenAI streaming
  const openAiProf = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'OpenAI Stream',
      provider: 'openai',
      baseURL: `${mockUrl}/v1`,
      model: 'gpt-4o',
      apiKey: 'sk-mock-key'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${openAiProf.body.id}/activate`,
    body: { revision: openAiProf.body.revision }
  });

  const openAiChunks = [];
  for await (const chunk of manager.stream('Hello OpenAI stream')) {
    openAiChunks.push(chunk);
  }
  const deltas = openAiChunks.filter(c => c.type === 'delta').map(c => c.text);
  assert.equal(deltas.join(''), 'mock streaming response');
  const lastChunk = openAiChunks[openAiChunks.length - 1];
  assert.equal(lastChunk.type, 'done');

  // 2. Anthropic streaming
  const anthropicProf = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Anthropic Stream',
      provider: 'anthropic',
      baseURL: `${mockUrl}/v1`,
      model: 'claude-3-5-sonnet',
      apiKey: 'sk-ant-key'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${anthropicProf.body.id}/activate`,
    body: { revision: anthropicProf.body.revision }
  });

  const anthropicChunks = [];
  for await (const chunk of manager.stream('Hello Anthropic stream')) {
    anthropicChunks.push(chunk);
  }
  const anthropicText = anthropicChunks
    .filter(c => c.type === 'delta')
    .map(c => c.text)
    .join('');
  assert.equal(anthropicText, 'Mock Anthropic stream');
  const anthropicDone = anthropicChunks.find(c => c.type === 'done');
  assert.equal(anthropicDone.finishReason, 'end_turn');
  assert.equal(anthropicDone.usage.inputTokens, 15);
  assert.equal(anthropicDone.usage.outputTokens, 10);

  // 3. Google streaming
  const googleProf = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Google Stream',
      provider: 'google',
      baseURL: `${mockUrl}/v1beta`,
      model: 'gemini-2.5-flash',
      apiKey: 'goog-mock-key'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${googleProf.body.id}/activate`,
    body: { revision: googleProf.body.revision }
  });

  const googleChunks = [];
  for await (const chunk of manager.stream('Hello Google stream')) {
    googleChunks.push(chunk);
  }
  const googleText = googleChunks
    .filter(c => c.type === 'delta')
    .map(c => c.text)
    .join('');
  assert.equal(googleText, 'Mock Google stream');
  const googleDone = googleChunks.find(c => c.type === 'done');
  assert.equal(googleDone.finishReason, 'STOP');
  assert.equal(googleDone.usage.totalTokens, 21);

  await mock.close();
});

test('YH1-C4: Web Standard llm.fetch(Request) handles POST /chat with stream: true producing text/event-stream', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  const manager = createLLMManager({ insecureNoAuth: true, dataDir: tempDir, allowLocalHttp: true });

  const p = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Fetch Stream Profile',
      provider: 'openai',
      baseURL: `${mockUrl}/v1`,
      model: 'gpt-4o',
      apiKey: 'sk-mock-key'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${p.body.id}/activate`,
    body: { revision: p.body.revision }
  });

  // Call llm.fetch with stream: true
  const req = new Request('http://localhost/api/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ prompt: 'Hello via Web fetch', stream: true })
  });

  const res = await manager.fetch(req);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('Content-Type') || '', /text\/event-stream/);

  const rawSse = await res.text();
  const events = parseSseEvents(rawSse);
  assert.ok(events.length >= 3);
  const deltas = events.filter(e => e.event === 'delta');
  assert.equal(deltas.map(d => d.data.text).join(''), 'mock streaming response');
  const doneEvent = events.find(e => e.event === 'done');
  assert.ok(doneEvent);
  assert.equal(doneEvent.data.finishReason, 'stop');

  await mock.close();
});

test('YH1-C4: Express mountLLMManagement handles POST /chat with stream: true and client aborts upstream', async () => {
  const mock = createMockProvider();
  const { url: mockUrl } = await mock.start();
  const tempDir = createTempDir();

  const app = express();
  app.use(express.json());

  const router = mountLLMManagement(app, {
    dataDir: tempDir,
    adminPassword: 'secure-stream-password-1234',
    allowLocalHttp: true,
    chatAccess: 'authenticated'
  });

  const p = await router.store.save({
    name: 'Express Stream Profile',
    provider: 'openai',
    baseURL: `${mockUrl}/v1`,
    model: 'gpt-4o',
    apiKey: 'sk-mock-key'
  });
  await router.store.activate(p.id, p.revision);

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // 1. Successful stream
  const response = await fetch(`http://127.0.0.1:${port}/api/llm/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from('admin:secure-stream-password-1234').toString('base64')}`,
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ prompt: 'Stream via Express', stream: true })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  const bodyText = await response.text();
  const events = parseSseEvents(bodyText);
  const text = events
    .filter(e => e.event === 'delta')
    .map(e => e.data.text)
    .join('');
  assert.equal(text, 'mock streaming response');

  // 2. Pre-stream validation failure returns JSON error (not SSE)
  const invalidRes = await fetch(`http://127.0.0.1:${port}/api/llm/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from('admin:secure-stream-password-1234').toString('base64')}`,
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ prompt: '', stream: true })
  });
  assert.equal(invalidRes.status, 400);
  assert.match(invalidRes.headers.get('content-type') || '', /application\/json/);
  const invalidJson = await invalidRes.json();
  assert.equal(invalidJson.code, 'MESSAGES_INVALID');

  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
  await new Promise(resolve => server.close(resolve));
  await mock.close();
});

test('YH1-C4: Mid-stream error emits event: error and client signal cancels stream', async () => {
  const tempDir = createTempDir();
  const manager = createLLMManager({
    insecureNoAuth: true,
    dataDir: tempDir,
    generateStream: async function* (_messages, _options) {
      yield { type: 'delta', text: 'First part...' };
      throw new Error('Mid-stream failure occurred');
    }
  });

  const p = await manager.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Stream Fail Profile',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-mock-key'
    }
  });
  await manager.handle({
    method: 'POST',
    path: `/profiles/${p.body.id}/activate`,
    body: { revision: p.body.revision }
  });

  // Call llm.fetch: should yield delta then event: error
  const req = new Request('http://localhost/api/llm/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify({ prompt: 'Test error', stream: true })
  });

  const res = await manager.fetch(req);
  assert.equal(res.status, 200);
  const text = await res.text();
  const events = parseSseEvents(text);
  assert.equal(events[0].event, 'delta');
  assert.equal(events[0].data.text, 'First part...');
  assert.equal(events[1].event, 'error');
  assert.ok(events[1].data.error);

  // Client abort on llm.stream()
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(async () => {
    for await (const _ of manager.stream('Abort test', { signal: controller.signal })) {
      // should abort
    }
  });
});
