import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseSseStream } from '../src/runtime.js';
import { createLLMManager } from '../src/core.js';

test('breaking the SSE iterator cancels its upstream reader', async () => {
  let cancelled = false;
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: token\n\n'));
    },
    cancel() {
      cancelled = true;
    }
  });
  for await (const chunk of parseSseStream(source, { parseStreamEvent: data => ({ text: data }) })) {
    assert.equal(chunk.text, 'token');
    break;
  }
  assert.equal(cancelled, true);
});

test('cancelling the fetch response aborts a pending upstream generator', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-cancel-'));
  let upstreamSignal;
  let notifyAbort;
  const aborted = new Promise(resolve => {
    notifyAbort = resolve;
  });
  const manager = createLLMManager({
    dataDir,
    insecureNoAuth: true,
    chatAccess: 'authenticated',
    async *generateStream(_messages, options) {
      upstreamSignal = options.signal;
      yield { type: 'delta', text: 'first' };
      await new Promise(resolve =>
        options.signal.addEventListener(
          'abort',
          () => {
            notifyAbort();
            resolve();
          },
          { once: true }
        )
      );
    }
  });
  try {
    const profile = await manager.store.save({
      name: 'test',
      provider: 'openai',
      baseURL: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'test'
    });
    await manager.store.activate(profile.id, profile.revision);
    const response = await manager.fetch(
      new Request('http://localhost/api/llm/chat', {
        method: 'POST',
        body: JSON.stringify({ prompt: 'hello', stream: true }),
        headers: { 'Content-Type': 'application/json', 'x-llm-csrf': '1' }
      })
    );
    assert.equal(response.status, 200);
    const reader = response.body.getReader();
    await reader.read();
    await reader.cancel();
    assert.equal(upstreamSignal.aborted, true);
    await aborted;
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
