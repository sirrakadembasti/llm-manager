import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMProfileStore } from '../src/profileStore.js';
import { createLLMManager } from '../src/core.js';
import { ensureLLMEncryptionKey } from '../src/setup.js';
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

test('decrypt rejects malformed secrets or truncated GCM auth tags', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-gcm-'));
  try {
    const file = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath: file, encryptionKey: 'ab'.repeat(32) });
    const p = store.save({ name: 'GCM', provider: 'custom', model: 'm', baseURL: 'https://first.example/v1', apiKey: 'fixture-secret' });
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const [ivB64, tagB64, dataB64] = raw.profiles[0].secret.split('.');

    // Truncated 4-byte tag
    const shortTag = Buffer.from(tagB64, 'base64').subarray(0, 4).toString('base64');
    raw.profiles[0].secret = `${ivB64}.${shortTag}.${dataB64}`;
    fs.writeFileSync(file, JSON.stringify(raw));
    assert.throws(() => store.get(p.id), /Şifreli profil verisi geçersiz veya bozuk/);

    // Missing part
    raw.profiles[0].secret = `${ivB64}.${tagB64}`;
    fs.writeFileSync(file, JSON.stringify(raw));
    assert.throws(() => store.get(p.id), /Şifreli profil verisi geçersiz veya bozuk/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('save preserves lastTests and lastTest on non-credential edits and resets on model or apiKey change', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-lasttests-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const p = store.save({ name: 'TestProfile', provider: 'custom', model: 'm1', baseURL: 'https://first.example/v1', apiKey: 'secret-1' });
    const tested = store.recordTest(p.id, 'passed', p.revision, { mode: 'quick', durationMs: 42 });
    assert.equal(tested.lastTest.status, 'passed');
    assert.equal(tested.lastTests.quick.status, 'passed');

    const renamed = store.save({ ...tested, name: 'Renamed', timeoutMs: 45000, apiKey: '' });
    assert.equal(renamed.lastTest?.status, 'passed');
    assert.equal(renamed.lastTests?.quick?.status, 'passed');

    const modelChanged = store.save({ ...renamed, model: 'm2', apiKey: '' });
    assert.equal(modelChanged.lastTest, null);
    assert.deepEqual(modelChanged.lastTests, {});

    const retested = store.recordTest(modelChanged.id, 'passed', modelChanged.revision, { mode: 'conversation', durationMs: 55 });
    assert.equal(retested.lastTests.conversation.status, 'passed');

    const keyChanged = store.save({ ...retested, apiKey: 'secret-2' });
    assert.equal(keyChanged.lastTest, null);
    assert.deepEqual(keyChanged.lastTests, {});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unknown profile id returns 404 PROFILE_NOT_FOUND for PUT, DELETE, and POST /activate', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-404-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const manager = createLLMManager({ store });

    const putRes = await manager.handle({
      method: 'PUT',
      path: '/profiles/missing-id',
      body: { name: 'A', provider: 'custom', model: 'm', baseURL: 'https://first.example/v1', apiKey: 'k', revision: 'r1' }
    });
    assert.equal(putRes.status, 404);
    assert.equal(putRes.body.code, 'PROFILE_NOT_FOUND');

    const delRes = await manager.handle({
      method: 'DELETE',
      path: '/profiles/missing-id',
      body: { revision: 'r1' }
    });
    assert.equal(delRes.status, 404);
    assert.equal(delRes.body.code, 'PROFILE_NOT_FOUND');

    const actRes = await manager.handle({
      method: 'POST',
      path: '/profiles/missing-id/activate',
      body: { revision: 'r1' }
    });
    assert.equal(actRes.status, 404);
    assert.equal(actRes.body.code, 'PROFILE_NOT_FOUND');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ensureLLMEncryptionKey handles production keyPath, dev .env without copying .env.example, empty key replacement, and existing secret protection', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-setup-'));
  try {
    // 1. Development: creates .env without copying .env.example
    const devDir = path.join(root, 'dev');
    fs.mkdirSync(devDir, { recursive: true });
    fs.writeFileSync(path.join(devDir, '.env.example'), 'SHOULD_NOT_BE_COPIED=1\nLLM_CONFIG_ENCRYPTION_KEY=\n');
    const devEnv = {};
    const devKey = ensureLLMEncryptionKey({
      envPath: path.join(devDir, '.env'),
      profilePath: path.join(devDir, 'profiles.json'),
      environment: devEnv
    });
    assert.equal(devKey.length, 64);
    assert.equal(devEnv.LLM_CONFIG_ENCRYPTION_KEY, devKey);
    const createdEnvContent = fs.readFileSync(path.join(devDir, '.env'), 'utf8');
    assert.ok(!createdEnvContent.includes('SHOULD_NOT_BE_COPIED'));
    assert.equal(createdEnvContent, `LLM_CONFIG_ENCRYPTION_KEY=${devKey}\n`);

    // 2. Development: replaces empty LLM_CONFIG_ENCRYPTION_KEY= line in existing .env
    const emptyLineEnvPath = path.join(devDir, '.env.empty');
    fs.writeFileSync(emptyLineEnvPath, 'PORT=3000\nLLM_CONFIG_ENCRYPTION_KEY=   \nOTHER=1\n');
    const emptyLineEnv = {};
    const replacedKey = ensureLLMEncryptionKey({
      envPath: emptyLineEnvPath,
      profilePath: path.join(devDir, 'profiles.json'),
      environment: emptyLineEnv
    });
    const replacedContent = fs.readFileSync(emptyLineEnvPath, 'utf8');
    assert.equal(replacedContent.match(/LLM_CONFIG_ENCRYPTION_KEY=/g)?.length, 1);
    assert.ok(replacedContent.includes(`LLM_CONFIG_ENCRYPTION_KEY=${replacedKey}`));
    assert.ok(replacedContent.includes('PORT=3000'));
    assert.ok(replacedContent.includes('OTHER=1'));

    // 3. Production: writes to keyPath
    const prodDir = path.join(root, 'prod');
    const prodKeyPath = path.join(prodDir, 'data', 'llm-encryption.key');
    const prodEnv = { NODE_ENV: 'production' };
    const prodKey = ensureLLMEncryptionKey({
      envPath: path.join(prodDir, '.env'),
      profilePath: path.join(prodDir, 'data', 'profiles.json'),
      keyPath: prodKeyPath,
      environment: prodEnv
    });
    assert.equal(prodKey.length, 64);
    assert.equal(fs.readFileSync(prodKeyPath, 'utf8').trim(), prodKey);
    assert.ok(!fs.existsSync(path.join(prodDir, '.env')));

    // 4. Existing encrypted profiles without key throws error
    const guardedProfilePath = path.join(root, 'guarded', 'profiles.json');
    fs.mkdirSync(path.dirname(guardedProfilePath), { recursive: true });
    fs.writeFileSync(guardedProfilePath, JSON.stringify({ profiles: [{ id: '1', secret: 'abc.def.ghi' }] }));
    assert.throws(
      () => ensureLLMEncryptionKey({
        envPath: path.join(root, 'guarded', '.env'),
        profilePath: guardedProfilePath,
        environment: {}
      }),
      /Kayıtlı LLM profilleri var fakat şifreleme anahtarı yok/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

