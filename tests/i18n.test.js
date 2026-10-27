import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createUiAssets, createLLMManager, MESSAGES, getErrorMessage, ErrorCodes } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';

test('getErrorMessage returns only Turkish messages and ignores the legacy language argument', () => {
  assert.ok(MESSAGES.tr);
  assert.equal(MESSAGES.en, undefined);
  assert.equal(
    getErrorMessage(ErrorCodes.STORE_CORRUPT, 'tr'),
    'Profil veri dosyası bozuk veya geçersiz JSON içeriyor.'
  );
  assert.equal(
    getErrorMessage(ErrorCodes.STORE_CORRUPT, 'en'),
    'Profil veri dosyası bozuk veya geçersiz JSON içeriyor.'
  );
  assert.equal(getErrorMessage(ErrorCodes.RATE_LIMITED, 'en'), 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.');

  // Default is Turkish
  assert.equal(getErrorMessage(ErrorCodes.RATE_LIMITED), 'Çok fazla istek yapıldı. Lütfen biraz bekleyin.');

  // Fallback behavior
  assert.equal(getErrorMessage('NON_EXISTENT_CODE', 'en', 'Custom fallback'), 'Custom fallback');
  assert.equal(getErrorMessage('NON_EXISTENT_CODE', 'fr'), 'Bir hata oluştu.');
});

test('createUiAssets pre-renders Turkish by default', () => {
  const assets = createUiAssets({ apiPath: '/api/llm', pagePath: '/llm' });
  assert.equal(assets.locale, 'tr');
  assert.match(assets.html, /<html lang="tr"/);
  assert.match(assets.html, /data-locale="tr"/);
  assert.match(assets.html, /<script id="llm-i18n" type="application\/json">/);
  assert.match(assets.html, /data-i18n="app\.title">LLM Profil Yönetimi</);
  assert.match(assets.html, /data-i18n="playground\.title">Deneme sohbeti \(Playground\)</);
});

test('legacy English option cannot switch the Turkish interface', () => {
  const assets = createUiAssets({ apiPath: '/api/llm', pagePath: '/llm', locale: 'en' });
  assert.equal(assets.locale, 'tr');
  assert.match(assets.html, /<html lang="tr"/);
  assert.match(assets.html, /data-locale="tr"/);
  assert.match(assets.html, /<script id="llm-i18n" type="application\/json">/);
  assert.match(assets.html, /data-i18n="app\.title">LLM Profil Yönetimi</);
  assert.match(assets.html, /data-i18n="playground\.title">Deneme sohbeti \(Playground\)</);
  assert.match(assets.html, /data-i18n="profiles\.title">Kayıtlı profiller</);
  assert.match(assets.html, /data-i18n-placeholder="form\.name_placeholder" placeholder="Örn\. Üretim modeli"/);
});

test('mountLLMManagement serves localized page for express', async () => {
  const app = express();
  const tmpDir = `tests/.tmp-i18n-${Date.now()}`;
  mountLLMManagement(app, {
    dataDir: tmpDir,
    adminPassword: 'test-password',
    locale: 'en'
  });

  const server = app.listen(0);
  const { port } = server.address();
  try {
    const creds = Buffer.from('admin:test-password').toString('base64');
    const res = await fetch(`http://127.0.0.1:${port}/llm`, {
      headers: { Authorization: `Basic ${creds}` }
    });
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /<html lang="tr"/);
    assert.match(body, /data-locale="tr"/);
    assert.match(body, /data-i18n="playground\.title">Deneme sohbeti \(Playground\)</);
  } finally {
    server.close();
  }
});

test('fetchHandler serves localized page for Web standard request', async () => {
  const tmpDir = `tests/.tmp-i18n-web-${Date.now()}`;
  const llm = createLLMManager({ insecureNoAuth: true, dataDir: tmpDir, locale: 'en' });

  const res = await llm.fetch(new Request('http://127.0.0.1:8010/llm'));
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<html lang="tr"/);
  assert.match(body, /data-locale="tr"/);
  assert.match(body, /data-i18n="playground\.title">Deneme sohbeti \(Playground\)</);
});
