import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function client(fetchImpl) {
  const context = vm.createContext({ AbortSignal, TextDecoder, Date });
  vm.runInContext(
    fs.existsSync('public/chat-client.js') ? fs.readFileSync('public/chat-client.js', 'utf8') : '',
    context
  );
  assert.equal(typeof context.createLLMChatClient, 'function');
  return context.createLLMChatClient({ baseURL: '/custom/api', fetchImpl });
}
const input = { profileId: 'a', messages: [{ role: 'user', content: 'Merhaba' }] };

test('unified chat sends JSON with CSRF and preserves response usage', async () => {
  let observed;
  const chat = client(async (url, options) => {
    observed = { url, options };
    return Response.json({ content: 'Selam', usage: { totalTokens: 4 } });
  });
  const reply = await chat.send({ ...input, stream: false });
  assert.equal(reply.content, 'Selam');
  assert.equal(reply.usage.totalTokens, 4);
  assert.equal(observed.url, '/custom/api/chat');
  assert.equal(observed.options.headers['X-LLM-CSRF'], '1');
  assert.equal(JSON.parse(observed.options.body).profileId, 'a');
});

test('unified streaming decodes split UTF-8 and the final event without a trailing newline', async () => {
  const bytes = new TextEncoder().encode(
    'event: delta\r\ndata: {"text":"İş"}\r\n\r\nevent: done\ndata: {"usage":{"totalTokens":7},"finishReason":"stop"}'
  );
  const stream = new ReadableStream({
    start(controller) {
      for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      controller.close();
    }
  });
  const chunks = [];
  const chat = client(async () => new Response(stream, { headers: { 'content-type': 'text/event-stream' } }));
  const reply = await chat.send({ ...input, stream: true, onDelta: text => chunks.push(text) });
  assert.equal(reply.content, 'İş');
  assert.equal(chunks.join(''), 'İş');
  assert.equal(reply.usage.totalTokens, 7);
});

test('unified streaming rejects provider error events and silently truncated responses', async () => {
  for (const body of [
    'event: error\ndata: {"error":"Kota doldu","code":"LLM_RATE_LIMIT"}\n\n',
    'event: delta\ndata: {"text":"Yarım"}\n\n'
  ]) {
    const chat = client(async () => new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
    await assert.rejects(chat.send({ ...input, stream: true }), /Kota doldu|kesildi/);
  }
});

test('unified chat forwards cancellation and preserves HTTP error metadata', async () => {
  const controller = new AbortController();
  let signal;
  const chat = client(async (_url, options) => {
    signal = options.signal;
    return Response.json({ error: 'Yetki gerekli', code: 'FORBIDDEN', requestId: 'support-one' }, { status: 403 });
  });
  await assert.rejects(
    chat.send({ ...input, signal: controller.signal }),
    error => error.code === 'FORBIDDEN' && error.supportId === 'support-one'
  );
  controller.abort();
  assert.equal(signal.aborted, true);
});

test('the SSE done event completes a response even when finishReason is omitted', async () => {
  const chat = client(
    async () =>
      new Response('event: delta\ndata: {"text":"Tamam"}\n\nevent: done\ndata: {"usage":{"totalTokens":0}}\n\n', {
        headers: { 'content-type': 'text/event-stream' }
      })
  );
  const reply = await chat.send({ ...input, stream: true });
  assert.equal(reply.content, 'Tamam');
  assert.equal(reply.usage.totalTokens, 0);
});

test('invalid JSON and native network/timeout errors have Turkish user messages', async () => {
  const cases = [
    [async () => new Response('broken JSON'), /geçersiz/],
    [
      async () => {
        throw new DOMException('Deadline exceeded', 'TimeoutError');
      },
      /zaman sınırını/
    ],
    [
      async () => {
        throw new TypeError('Failed to fetch');
      },
      /ulaşılamadı/
    ]
  ];
  for (const [fetcher, message] of cases) await assert.rejects(client(fetcher).send(input), message);
});
