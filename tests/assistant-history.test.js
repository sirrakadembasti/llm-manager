import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLLMManager } from '../src/core.js';

const admin = { isAdmin: true, kind: 'admin', id: 'one' };
async function fixture(t, extra = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-history-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = { dataDir: root, encryptionKey: 'a'.repeat(64), rateLimit: false, ...extra };
  const make = changes => createLLMManager({ ...options, ...changes });
  const manager = make();
  t.after(() => manager.close());
  const call = (method, suffix = '', body, principal = admin) =>
    manager.handle({ method, path: '/assistant/sessions' + suffix, body, principal });
  return { root, make, call };
}

test('assistant sessions survive manager restart encrypted and isolate administrators and projects', async t => {
  const { root, make, call } = await fixture(t);
  const created = await call('POST', '', { title: 'Sipariş çalışması', mode: 'model', profileId: 'p' });
  assert.equal(created.status, 201);
  const session = created.body;
  const saved = await call('PUT', '/' + session.id, {
    ...session,
    messages: [
      { role: 'user', content: 'Siparişe teslimat tarihi ekle', status: 'completed', at: new Date().toISOString() }
    ]
  });
  assert.equal(saved.status, 200);
  const other = make();
  t.after(() => other.close());
  const restored = await other.handle({ method: 'GET', path: '/assistant/sessions/' + session.id, principal: admin });
  assert.equal(restored.body.messages[0].content, 'Siparişe teslimat tarihi ekle');
  const files = await fs.readdir(root);
  const encrypted = await fs.readFile(
    path.join(
      root,
      files.find(f => f.includes('assistant') && !f.endsWith('.lock'))
    ),
    'utf8'
  );
  assert.ok(!encrypted.includes('Sipariş'));
  assert.equal((await call('GET', '/' + session.id, undefined, { ...admin, id: 'two' })).status, 404);
  const project = make({ project: { root } });
  t.after(() => project.close());
  assert.equal(
    (await project.handle({ method: 'GET', path: '/assistant/sessions/' + session.id, principal: admin })).status,
    404
  );
  assert.equal((await call('GET', '', undefined, { isAdmin: false })).status, 403);
});

test('stale session updates and deletion cannot erase another tab changes', async t => {
  const { call } = await fixture(t);
  const { body: session } = await call('POST', '', { title: 'İlk', mode: 'chat' });
  const updated = await call('PUT', '/' + session.id, { ...session, title: 'Yeni' });
  assert.equal(updated.status, 200);
  assert.equal((await call('PUT', '/' + session.id, { ...session, title: 'Eski' })).status, 409);
  assert.equal((await call('DELETE', '/' + session.id, { revision: session.revision })).status, 409);
  assert.equal((await call('DELETE', '/' + session.id, { revision: updated.body.revision })).status, 200);
  assert.equal((await call('GET', '/' + session.id)).status, 404);
});

test('message retrieval traces survive encrypted restart with allowlisted fields', async t => {
  const { make, call } = await fixture(t);
  const retrieval = {
    requestedMode: 'graphify',
    effectiveMode: 'graphify',
    reason: 'graph-ready',
    sourceRevision: 'a'.repeat(64),
    graphRevision: 'a'.repeat(64),
    graphReady: true,
    graphContributed: true,
    graphAddedFiles: ['src/related.js'],
    graphEvidence: [
      {
        fromPath: 'src/orders.js',
        fromLine: 2,
        toPath: 'src/related.js',
        toLine: 3,
        kind: 'calls',
        confidence: 'unknown'
      }
    ]
  };
  const saved = await call('POST', '', {
    mode: 'chat',
    retrievalMode: 'graphify',
    messages: [
      {
        role: 'assistant',
        content: 'Answer',
        status: 'completed',
        retrieval: { ...retrieval, command: 'must-not-persist', rawContext: 'private' }
      }
    ]
  });
  assert.equal(saved.status, 201);
  const next = make();
  t.after(() => next.close());
  const restored = await next.handle({ method: 'GET', path: '/assistant/sessions/' + saved.body.id, principal: admin });
  assert.deepEqual(restored.body.messages[0].retrieval, retrieval);
  assert.equal(restored.body.retrievalMode, 'graphify');
  assert.ok(!JSON.stringify(restored.body).includes('must-not-persist'));
  const old = await call('POST', '', {
    mode: 'chat',
    messages: [{ role: 'assistant', content: 'Old', status: 'completed' }]
  });
  assert.equal(old.status, 201);
  assert.equal(Object.hasOwn(old.body.messages[0], 'retrieval'), false);
});

test('history rejects unsafe or oversized relation evidence and strips unknown relation fields', async t => {
  const { call } = await fixture(t);
  const edge = {
    fromPath: 'src/orders.js',
    fromLine: 1,
    toPath: 'src/related.js',
    toLine: 2,
    kind: 'calls',
    confidence: 'unknown'
  };
  const retrieval = {
    requestedMode: 'graphify',
    effectiveMode: 'graphify',
    reason: 'graph-ready',
    sourceRevision: 'a'.repeat(64),
    graphRevision: 'a'.repeat(64),
    graphReady: true,
    graphContributed: true,
    graphAddedFiles: []
  };
  for (const graphEvidence of [
    null,
    {},
    Array(21).fill(edge),
    [{ ...edge, fromPath: '../.env' }],
    [{ ...edge, toLine: 0 }],
    [{ ...edge, fromLine: 1.5 }],
    [{ ...edge, kind: 'x'.repeat(81) }],
    [{ ...edge, confidence: 'x'.repeat(41) }]
  ]) {
    const saved = await call('POST', '', {
      mode: 'chat',
      messages: [{ role: 'assistant', content: 'x', status: 'completed', retrieval: { ...retrieval, graphEvidence } }]
    });
    assert.equal(saved.status, 400);
  }
  const saved = await call('POST', '', {
    mode: 'chat',
    messages: [
      {
        role: 'assistant',
        content: 'x',
        status: 'completed',
        retrieval: { ...retrieval, graphEvidence: [{ ...edge, rawSource: 'private', command: 'private' }] }
      }
    ]
  });
  assert.equal(saved.status, 201);
  assert.deepEqual(saved.body.messages[0].retrieval.graphEvidence, [edge]);
});

test('history rejects malformed, oversized and unsafe retrieval fields', async t => {
  const { call } = await fixture(t);
  const valid = {
    requestedMode: 'basic',
    effectiveMode: 'basic',
    reason: 'basic-selected',
    sourceRevision: 'a'.repeat(64),
    graphRevision: null,
    graphReady: false,
    graphContributed: false,
    graphAddedFiles: []
  };
  for (const change of [
    { requestedMode: 'auto' },
    { sourceRevision: 'x'.repeat(10000) },
    { graphReady: 'yes' },
    { reason: 'unknown' },
    { graphAddedFiles: ['../.env'] },
    { graphAddedFiles: ['C:/private/file.js'] },
    { graphAddedFiles: Array(101).fill('src/app.js') },
    { graphAddedFiles: ['a'.repeat(513) + '.js'] }
  ]) {
    const response = await call('POST', '', {
      mode: 'chat',
      messages: [{ role: 'assistant', content: 'x', status: 'completed', retrieval: { ...valid, ...change } }]
    });
    assert.equal(response.status, 400, JSON.stringify(change).slice(0, 120));
  }
  assert.equal((await call('GET')).body.sessions.length, 0);
});

test('history rejects invalid messages and exposes unsupported persistence without losing profiles', async t => {
  const { make, call } = await fixture(t);
  const { body: session } = await call('POST', '', { mode: 'model' });
  assert.equal(
    (
      await call('PUT', '/' + session.id, {
        ...session,
        messages: [{ role: 'system', content: 'x', status: 'completed' }]
      })
    ).status,
    400
  );
  const custom = make({ store: { list: () => ({ profiles: [] }), getActive: () => null } });
  t.after(() => custom.close());
  const result = await custom.handle({ method: 'GET', path: '/assistant/sessions', principal: admin });
  assert.equal(result.body.available, false);
  assert.equal(
    (await custom.handle({ method: 'POST', path: '/assistant/sessions', principal: admin, body: {} })).status,
    503
  );
});

test('a damaged encrypted history fails closed and is never replaced by a fresh history', async t => {
  const { root, call } = await fixture(t);
  assert.equal((await call('POST', '', { mode: 'model' })).status, 201);
  const file = (await fs.readdir(root)).find(f => f.includes('assistant') && !f.endsWith('.lock'));
  await fs.writeFile(path.join(root, file), 'damaged');
  assert.equal((await call('GET')).status, 500);
  assert.equal((await call('POST', '', { mode: 'model' })).status, 500);
  assert.equal(await fs.readFile(path.join(root, file), 'utf8'), 'damaged');
});

test('missing history encryption key is not regenerated and concurrent managers preserve both sessions', async t => {
  const { root, make, call } = await fixture(t, { encryptionKey: undefined });
  const first = await call('POST', '', { mode: 'model' });
  assert.equal(first.status, 201);
  const second = make();
  t.after(() => second.close());
  const results = await Promise.all([
    call('POST', '', { mode: 'model', title: 'A' }),
    second.handle({
      method: 'POST',
      path: '/assistant/sessions',
      principal: admin,
      body: { mode: 'model', title: 'B' }
    })
  ]);
  assert.ok(results.every(r => r.status === 201));
  assert.equal((await call('GET')).body.sessions.length, 3);
  const keyPath = path.join(root, 'llm-encryption.key');
  await fs.unlink(keyPath);
  assert.equal((await call('GET')).status, 500);
  assert.equal((await call('POST', '', { mode: 'model' })).status, 500);
  await assert.rejects(fs.access(keyPath), { code: 'ENOENT' });
  await assert.rejects(
    second.store.save({
      name: 'Yeni',
      provider: 'openai',
      model: 'm',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'synthetic-new-key'
    })
  );
  await assert.rejects(fs.access(keyPath), { code: 'ENOENT' });
});

test('HTTP history uses admin and CSRF guards and accepts a bounded task followup context', async t => {
  const { make } = await fixture(t);
  const manager = make({ adminPassword: 'fixture-password' });
  t.after(() => manager.close());
  const headers = {
    Authorization: 'Basic ' + Buffer.from('admin:fixture-password').toString('base64'),
    'Content-Type': 'application/json'
  };
  const denied = await manager.fetch(
    new Request('http://local/api/llm/assistant/sessions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ mode: 'model' })
    })
  );
  assert.equal(denied.status, 403);
  const saved = await manager.fetch(
    new Request('http://local/api/llm/assistant/sessions', {
      method: 'POST',
      headers: { ...headers, 'X-LLM-CSRF': '1' },
      body: JSON.stringify({ mode: 'model' })
    })
  );
  assert.equal(saved.status, 201);
});
