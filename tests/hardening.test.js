import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMProfileStore } from '../src/profileStore.js';
import { classifyLLMError, buildProviderRequest } from '../src/runtime.js';

test('402 and 403 have actionable separate codes', () => {
  assert.equal(classifyLLMError({ upstreamStatus: 402 }).code, 'LLM_BILLING');
  assert.equal(classifyLLMError({ upstreamStatus: 403 }).code, 'LLM_FORBIDDEN');
});

test('mutations require revisions and a changed endpoint requires a fresh key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hardening-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const p = store.save({ name: 'Fixture', provider: 'custom', model: 'm', baseURL: 'https://first.example/v1', apiKey: 'fixture-secret' });
    assert.throws(() => store.save({ ...p, revision: undefined }), e => e.code === 'PROFILE_CONFLICT');
    assert.throws(() => store.save({ ...p, baseURL: 'https://second.example/v1' }), /anahtar/);
    assert.throws(() => store.remove(p.id), e => e.code === 'PROFILE_CONFLICT');
    assert.throws(() => store.activate(p.id), e => e.code === 'PROFILE_CONFLICT');
    store.activate(p.id, p.revision);
    assert.equal(store.getActive().apiKey, 'fixture-secret');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('quick MiMo policy is bounded and production auto is preserved', () => {
  const p = {
    provider: 'xiaomi_mimo',
    model: 'mimo-v2.6-flash',
    baseURL: 'https://api.xiaomimimo.com/v1',
    apiKey: 'sk-synthetic',
    timeoutMs: 120000,
    maxOutputTokens: 32000,
    thinking: 'auto'
  };
  const quick = buildProviderRequest(p, [], { purpose: 'quick' });
  assert.equal(quick.timeoutMs, 20000);
  assert.equal(quick.body.max_completion_tokens, 512);
  assert.deepEqual(quick.body.thinking, { type: 'disabled' });
  assert.equal(buildProviderRequest(p, []).body.thinking, undefined);
});

test('transport rejects payloads larger than 2 MiB', async () => {
  const { providerFetch } = await import('../src/providerTransport.js');
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('x'.repeat(2 * 1024 * 1024 + 1));
  try {
    await assert.rejects(() => providerFetch('https://provider.example/v1'), /EXTERNAL_RESPONSE_TOO_LARGE/);
  } finally {
    globalThis.fetch = original;
  }
});

test('legacy profiles with explicit null revision can be upgraded without losing their key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-legacy-'));
  try {
    const file = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath: file, encryptionKey: 'ab'.repeat(32) });
    const p = store.save({ name: 'Legacy', provider: 'custom', model: 'm', baseURL: 'https://first.example/v1', apiKey: 'fixture-secret' });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete data.profiles[0].revision;
    fs.writeFileSync(file, JSON.stringify(data));
    const legacy = store.list().profiles[0];
    assert.equal(legacy.revision, null);
    assert.throws(() => store.activate(p.id), e => e.code === 'PROFILE_CONFLICT');
    store.activate(p.id, null);
    const next = store.save({ ...legacy, name: 'Upgraded' });
    assert.ok(next.revision);
    assert.equal(store.get(next.id).apiKey, 'fixture-secret');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
