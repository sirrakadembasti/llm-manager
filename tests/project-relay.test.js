import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
const { createProjectRelay } = await import('../src/project/relay.js').catch(() => ({}));

async function setup(t, provider = 'custom', extra = {}) {
  assert.equal(typeof createProjectRelay, 'function');
  const requests = [];
  const upstream = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ url: req.url, headers: req.headers, body: JSON.parse(body) });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"fixture":true}');
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  t.after(() => {
    upstream.closeAllConnections();
    return new Promise(resolve => upstream.close(resolve));
  });
  const profile = {
    provider,
    model: 'fixture-model',
    apiKey: 'original-fixture-key-must-stay-private',
    baseURL: `http://127.0.0.1:${upstream.address().port}/v1`,
    timeoutMs: 10000,
    maxOutputTokens: 512
  };
  const relay = await createProjectRelay({ profile, networkOptions: { allowLocalHttp: true, proxyUrl: '' }, ...extra });
  t.after(() => relay.close());
  return { relay, requests, profile };
}

test('project relay authenticates local requests and refuses unrelated paths and models', async t => {
  const { relay, requests } = await setup(t);
  const send = (route, body, headers = {}) =>
    fetch(relay.baseURL + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    });
  assert.equal((await send('/chat/completions', { model: 'fixture-model' })).status, 401);
  const headers = { Authorization: `Bearer ${relay.token}` };
  assert.equal((await send('/chat/completions', { model: 'wrong' }, headers)).status, 403);
  assert.equal((await send('/../v1/models', {}, headers)).status, 404);
  assert.equal(requests.length, 0);
});

test('project relay preserves tool calls and profile limits without exposing the real provider key', async t => {
  const { relay, requests, profile } = await setup(t);
  const tools = [{ type: 'function', function: { name: 'read', parameters: { type: 'object', properties: {} } } }];
  const response = await fetch(relay.baseURL + '/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${relay.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: profile.model,
      messages: [{ role: 'user', content: 'synthetic source question' }],
      tools,
      max_tokens: 99999
    })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(requests[0].body.tools, tools);
  assert.equal(requests[0].body.max_tokens, 512);
  assert.equal(requests[0].headers.authorization, `Bearer ${profile.apiKey}`);
  assert.ok(
    !JSON.stringify({ baseURL: relay.baseURL, token: relay.token, provider: relay.provider }).includes(profile.apiKey)
  );
});

test('project relay supports native Google and Anthropic protocols', async t => {
  for (const provider of ['google', 'anthropic']) {
    const { relay, requests, profile } = await setup(t, provider);
    const google = provider === 'google';
    const route = google ? '/models/fixture-model:generateContent' : '/messages';
    const headers = google ? { 'x-goog-api-key': relay.token } : { 'x-api-key': relay.token };
    const body = google
      ? { contents: [{ role: 'user', parts: [{ text: 'fixture' }] }], tools: [{ functionDeclarations: [] }] }
      : { model: profile.model, messages: [{ role: 'user', content: 'fixture' }], tools: [] };
    const response = await fetch(relay.baseURL + route, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 200);
    assert.deepEqual(requests[0].body.tools, body.tools);
    assert.ok(requests[0].url.includes(google ? ':generateContent' : '/messages'));
  }
});

test('project relay applies a per-session request budget', async t => {
  const { relay } = await setup(t, 'custom', { maxRequests: 1 });
  const send = () =>
    fetch(relay.baseURL + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${relay.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'fixture-model', messages: [] })
    });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
});

async function streamSetup(t, handler) {
  const upstream = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => handler(req, res));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  t.after(() => {
    upstream.closeAllConnections();
    return new Promise(resolve => upstream.close(resolve));
  });
  const profile = {
    provider: 'custom',
    model: 'fixture-model',
    apiKey: 'original-fixture-key-must-stay-private',
    baseURL: `http://127.0.0.1:${upstream.address().port}/v1`,
    timeoutMs: 10000,
    maxOutputTokens: 512
  };
  const relay = await createProjectRelay({ profile, networkOptions: { allowLocalHttp: true, proxyUrl: '' } });
  t.after(() => relay.close());
  const post = () =>
    fetch(relay.baseURL + '/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${relay.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: profile.model, messages: [{ role: 'user', content: 'x' }] })
    });
  return { post };
}

test('project relay forwards a 3 MiB provider response completely', async t => {
  const payload = Buffer.alloc(3 * 1024 * 1024, 'a');
  const { post } = await streamSetup(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    res.end(payload);
  });
  const response = await post();
  assert.equal(response.status, 200);
  assert.equal((await response.arrayBuffer()).byteLength, payload.length);
});

test('project relay cuts the connection when the response exceeds 8 MiB', async t => {
  const chunk = Buffer.alloc(1024 * 1024, 'a');
  const { post } = await streamSetup(t, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    for (let i = 0; i < 9; i++) res.write(chunk);
    res.end();
  });
  const response = await post();
  await assert.rejects(() => response.arrayBuffer());
});

test('project relay delivers the first chunk before the provider finishes', async t => {
  let finish;
  const done = new Promise(resolve => (finish = resolve));
  t.after(() => finish());
  const { post } = await streamSetup(t, async (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: first\n\n');
    await done;
    res.end('data: second\n\n');
  });
  const response = await post();
  const reader = response.body.getReader();
  const first = await Promise.race([reader.read(), new Promise(resolve => setTimeout(() => resolve('timeout'), 3000))]);
  assert.notEqual(first, 'timeout');
  assert.match(Buffer.from(first.value).toString(), /first/);
  finish();
  await reader.cancel();
});
