import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUiAssets, createLLMManager } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';

test('createUiAssets embeds homeUrl and data-home-url attribute', () => {
  const assets = createUiAssets({ homeUrl: '/app/dashboard' });
  assert.match(assets.html, /data-home-url="\/app\/dashboard"/);
});

test('public/llm.html includes aria-describedby accessibility links and hints', () => {
  const { html } = createUiAssets();
  assert.match(html, /<input id="name"[^>]*aria-describedby="message"/);
  assert.match(html, /<input id="base-url"[^>]*aria-describedby="provider-note message"/);
  assert.match(html, /<input id="api-key"[^>]*aria-describedby="api-key-status message"/);
  assert.match(html, /<input id="timeout-ms"[^>]*aria-describedby="timeout-hint message"/);
  assert.match(html, /<span id="timeout-hint"[^>]*data-i18n="form\.timeout_hint"/);
  assert.match(html, /<input id="max-output-tokens"[^>]*aria-describedby="max-tokens-hint message"/);
  assert.match(html, /<span id="max-tokens-hint"[^>]*data-i18n="form\.max_tokens_hint"/);
});

test('public/llm.html includes accessible confirm dialog', () => {
  const { html } = createUiAssets();
  assert.match(html, /<dialog id="confirm-dialog" class="confirm-dialog" aria-labelledby="confirm-dialog-msg">/);
  assert.match(html, /<button type="button" id="confirm-dialog-cancel"/);
  assert.match(html, /<button type="submit" id="confirm-dialog-confirm"/);
});

test('mountLLMManagement serves custom homeUrl in Express', async () => {
  const app = express();
  const tmpDir = `tests/.tmp-home-${Date.now()}`;
  mountLLMManagement(app, {
    dataDir: tmpDir,
    adminPassword: 'test-pass',
    homeUrl: '/admin/home'
  });

  const server = app.listen(0);
  const { port } = server.address();
  try {
    const creds = Buffer.from('admin:test-pass').toString('base64');
    const res = await fetch(`http://127.0.0.1:${port}/llm`, {
      headers: { Authorization: `Basic ${creds}` }
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /data-home-url="\/admin\/home"/);
  } finally {
    server.close();
  }
});

test('fetchHandler serves custom homeUrl for Web standard request', async () => {
  const tmpDir = `tests/.tmp-homeweb-${Date.now()}`;
  const llm = createLLMManager({ insecureNoAuth: true, dataDir: tmpDir, homeUrl: '/portal' });

  const res = await llm.fetch(new Request('http://127.0.0.1:8010/llm'));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /data-home-url="\/portal"/);
});
