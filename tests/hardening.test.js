import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createLLMProfileStore } from '../src/profileStore.js';
import { createLLMManager } from '../src/core.js';
import { ensureLLMEncryptionKey } from '../src/setup.js';
import { classifyLLMError, buildProviderRequest } from '../src/runtime.js';
import { createPublicLookup } from '../src/providerTransport.js';

test('402 and 403 have actionable separate codes', () => {
  assert.equal(classifyLLMError({ upstreamStatus: 402 }).code, 'LLM_BILLING');
  assert.equal(classifyLLMError({ upstreamStatus: 403 }).code, 'LLM_FORBIDDEN');
});

test('mutations require revisions and a changed endpoint requires a fresh key', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hardening-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const p = await store.save({
      name: 'Fixture',
      provider: 'custom',
      model: 'm',
      baseURL: 'https://first.example/v1',
      apiKey: 'fixture-secret'
    });
    await assert.rejects(
      () => store.save({ ...p, revision: undefined }),
      e => e.code === 'PROFILE_CONFLICT'
    );
    await assert.rejects(() => store.save({ ...p, baseURL: 'https://second.example/v1' }), /anahtar/);
    await assert.rejects(
      () => store.remove(p.id),
      e => e.code === 'PROFILE_CONFLICT'
    );
    await assert.rejects(
      () => store.activate(p.id),
      e => e.code === 'PROFILE_CONFLICT'
    );
    await store.activate(p.id, p.revision);
    assert.equal((await store.getActive()).apiKey, 'fixture-secret');
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

test('legacy profiles with explicit null revision can be upgraded without losing their key', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-legacy-'));
  try {
    const file = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath: file, encryptionKey: 'ab'.repeat(32) });
    const p = await store.save({
      name: 'Legacy',
      provider: 'custom',
      model: 'm',
      baseURL: 'https://first.example/v1',
      apiKey: 'fixture-secret'
    });
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete data.profiles[0].revision;
    fs.writeFileSync(file, JSON.stringify(data));
    const legacy = (await store.list()).profiles[0];
    assert.equal(legacy.revision, null);
    await assert.rejects(
      () => store.activate(p.id),
      e => e.code === 'PROFILE_CONFLICT'
    );
    await store.activate(p.id, null);
    const next = await store.save({ ...legacy, name: 'Upgraded' });
    assert.ok(next.revision);
    assert.equal((await store.get(next.id)).apiKey, 'fixture-secret');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('decrypt rejects malformed secrets or truncated GCM auth tags', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-gcm-'));
  try {
    const file = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath: file, encryptionKey: 'ab'.repeat(32) });
    const p = await store.save({
      name: 'GCM',
      provider: 'custom',
      model: 'm',
      baseURL: 'https://first.example/v1',
      apiKey: 'fixture-secret'
    });
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const [ivB64, tagB64, dataB64] = raw.profiles[0].secret.split('.');

    // Truncated 4-byte tag
    const shortTag = Buffer.from(tagB64, 'base64').subarray(0, 4).toString('base64');
    raw.profiles[0].secret = `${ivB64}.${shortTag}.${dataB64}`;
    fs.writeFileSync(file, JSON.stringify(raw));
    await assert.rejects(() => store.get(p.id), /Şifreli profil verisi geçersiz veya bozuk/);

    // Missing part
    raw.profiles[0].secret = `${ivB64}.${tagB64}`;
    fs.writeFileSync(file, JSON.stringify(raw));
    await assert.rejects(() => store.get(p.id), /Şifreli profil verisi geçersiz veya bozuk/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('save preserves lastTests and lastTest on non-credential edits and resets on model or apiKey change', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-lasttests-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const p = await store.save({
      name: 'TestProfile',
      provider: 'custom',
      model: 'm1',
      baseURL: 'https://first.example/v1',
      apiKey: 'secret-1'
    });
    const tested = await store.recordTest(p.id, 'passed', p.revision, { mode: 'quick', durationMs: 42 });
    assert.equal(tested.lastTest.status, 'passed');
    assert.equal(tested.lastTests.quick.status, 'passed');

    const renamed = await store.save({ ...tested, name: 'Renamed', timeoutMs: 45000, apiKey: '' });
    assert.equal(renamed.lastTest?.status, 'passed');
    assert.equal(renamed.lastTests?.quick?.status, 'passed');

    const modelChanged = await store.save({ ...renamed, model: 'm2', apiKey: '' });
    assert.equal(modelChanged.lastTest, null);
    assert.deepEqual(modelChanged.lastTests, {});

    const retested = await store.recordTest(modelChanged.id, 'passed', modelChanged.revision, {
      mode: 'conversation',
      durationMs: 55
    });
    assert.equal(retested.lastTests.conversation.status, 'passed');

    const keyChanged = await store.save({ ...retested, apiKey: 'secret-2' });
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
      body: {
        name: 'A',
        provider: 'custom',
        model: 'm',
        baseURL: 'https://first.example/v1',
        apiKey: 'k',
        revision: 'r1'
      }
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
    // 1. Explicit legacy opt-in creates .env without copying .env.example
    const devDir = path.join(root, 'dev');
    fs.mkdirSync(devDir, { recursive: true });
    fs.writeFileSync(path.join(devDir, '.env.example'), 'SHOULD_NOT_BE_COPIED=1\nLLM_CONFIG_ENCRYPTION_KEY=\n');
    const devEnv = {};
    const devKey = ensureLLMEncryptionKey({
      envPath: path.join(devDir, '.env'),
      profilePath: path.join(devDir, 'profiles.json'),
      environment: devEnv,
      writeEnv: true
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
      environment: emptyLineEnv,
      writeEnv: true
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
      () =>
        ensureLLMEncryptionKey({
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

test('allowLocalHttp option propagates through store, buildProviderRequest, listModels, and testProfile without env var', async () => {
  const prevEnv = process.env.LLM_ALLOW_LOCAL_HTTP;
  delete process.env.LLM_ALLOW_LOCAL_HTTP;
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-local-http-'));
  try {
    const fetchCalls = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      if (String(url).endsWith('/models')) {
        return new Response(JSON.stringify({ data: [{ id: 'local-model-1' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'OK' } }] }), {
        status: 200
      });
    };

    const store = createLLMProfileStore({
      filePath: path.join(root, 'profiles.json'),
      encryptionKey: 'ab'.repeat(32),
      allowLocalHttp: true
    });
    const saved = await store.save({
      name: 'LocalHTTP',
      provider: 'custom',
      model: 'local-model-1',
      baseURL: 'http://127.0.0.1:11434/v1',
      apiKey: 'local-secret'
    });
    const fullProfile = await store.get(saved.id);

    const built = buildProviderRequest(fullProfile, [{ role: 'user', content: 'Hi' }], { allowLocalHttp: true });
    assert.equal(built.url, 'http://127.0.0.1:11434/v1/chat/completions');

    const manager = createLLMManager({ store, allowLocalHttp: true });
    const modelsRes = await manager.handle({ method: 'GET', path: `/profiles/${saved.id}/models` });
    assert.equal(modelsRes.status, 200);
    assert.deepEqual(modelsRes.body.models, ['local-model-1']);

    const testRes = await manager.handle({
      method: 'POST',
      path: `/profiles/${saved.id}/test`,
      body: { mode: 'quick' }
    });
    assert.equal(testRes.status, 200);
    assert.equal(testRes.body.ok, true);
    assert.equal(fetchCalls.length, 2);
    assert.equal(fetchCalls[0].init.allowLocalHttp, undefined);
    assert.equal(fetchCalls[1].init.allowLocalHttp, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    if (prevEnv === undefined) delete process.env.LLM_ALLOW_LOCAL_HTTP;
    else process.env.LLM_ALLOW_LOCAL_HTTP = prevEnv;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('custom generate adapter receives thinking disabled for Xiaomi MiMo auto profile on conversation test', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-mimo-adapter-'));
  try {
    const store = createLLMProfileStore({ filePath: path.join(root, 'profiles.json'), encryptionKey: 'ab'.repeat(32) });
    const saved = await store.save({
      name: 'MiMoAuto',
      provider: 'xiaomi_mimo',
      model: 'mimo-v2.6-flash',
      baseURL: 'https://api.xiaomimimo.com/v1',
      apiKey: 'sk-synthetic',
      thinking: 'auto'
    });
    let capturedOptions;
    const manager = createLLMManager({
      store,
      generate: async (_messages, options) => {
        capturedOptions = options;
        return 'Mimari plan hazır.';
      }
    });
    const res = await manager.handle({
      method: 'POST',
      path: `/profiles/${saved.id}/test`,
      body: { mode: 'conversation' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(capturedOptions?.purpose, 'diagnostic');
    assert.equal(capturedOptions?.thinking, 'disabled');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Anthropic omits empty system field and Google strips leading models/ prefix', () => {
  const anthropicProfile = {
    provider: 'anthropic',
    transport: 'anthropic',
    model: 'claude-3-5-sonnet-latest',
    baseURL: 'https://api.anthropic.com/v1',
    apiKey: 'sk-ant-test'
  };
  const noSystemReq = buildProviderRequest(anthropicProfile, [{ role: 'user', content: 'Merhaba' }]);
  assert.equal('system' in noSystemReq.body, false);

  const withSystemReq = buildProviderRequest(anthropicProfile, [
    { role: 'system', content: 'Sistem yönergesi' },
    { role: 'user', content: 'Merhaba' }
  ]);
  assert.equal(withSystemReq.body.system, 'Sistem yönergesi');

  const googleProfile = {
    provider: 'google',
    transport: 'google',
    model: 'models/gemini-2.5-pro',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiKey: 'goog-test'
  };
  const googleReq = buildProviderRequest(googleProfile, [{ role: 'user', content: 'Merhaba' }]);
  assert.equal(googleReq.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent');
});

test('createPublicLookup filters private/loopback IPv4/IPv6, accepts public addresses, and scopes allowLoopback', async () => {
  const resolveWith = entries => (_hostname, _opts, cb) => cb(null, entries);
  const runLookup = (lookup, hostname, options = {}) =>
    new Promise((resolve, reject) => {
      lookup(hostname, options, (err, address, family) => (err ? reject(err) : resolve({ address, family })));
    });

  for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1']) {
    const lookup = createPublicLookup({ resolver: resolveWith([{ address: ip, family: 4 }]) });
    await assert.rejects(() => runLookup(lookup, 'provider.example'), /private networks are forbidden/);
  }

  for (const ip6 of ['::1', 'fe80::1', 'fc00::1']) {
    const lookup = createPublicLookup({ resolver: resolveWith([{ address: ip6, family: 6 }]) });
    await assert.rejects(() => runLookup(lookup, 'provider.example'), /private networks are forbidden/);
  }

  const publicV4Lookup = createPublicLookup({ resolver: resolveWith([{ address: '93.184.216.34', family: 4 }]) });
  assert.deepEqual(await runLookup(publicV4Lookup, 'example.com'), { address: '93.184.216.34', family: 4 });

  const publicV6Lookup = createPublicLookup({
    resolver: resolveWith([{ address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 }])
  });
  assert.deepEqual(await runLookup(publicV6Lookup, 'example.com'), {
    address: '2606:2800:220:1:248:1893:25c8:1946',
    family: 6
  });

  const loopbackV4Lookup = createPublicLookup({
    allowLoopback: true,
    resolver: resolveWith([{ address: '127.0.0.1', family: 4 }])
  });
  assert.deepEqual(await runLookup(loopbackV4Lookup, 'localhost'), { address: '127.0.0.1', family: 4 });
  assert.deepEqual(await runLookup(loopbackV4Lookup, '127.0.0.1'), { address: '127.0.0.1', family: 4 });
  await assert.rejects(() => runLookup(loopbackV4Lookup, 'evil.example'), /private networks are forbidden/);

  const loopbackV6Lookup = createPublicLookup({
    allowLoopback: true,
    resolver: resolveWith([{ address: '::1', family: 6 }])
  });
  assert.deepEqual(await runLookup(loopbackV6Lookup, '::1'), { address: '::1', family: 6 });
});

test('GET /profiles/:id/models parses OpenAI and Google model lists and returns 400 on Xiaomi MiMo credential mismatch', async () => {
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-models-'));
  try {
    const filePath = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath, encryptionKey: 'ab'.repeat(32) });
    const openaiProfile = await store.save({
      name: 'OpenAI',
      provider: 'openai',
      model: 'gpt-4.1-mini',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-openai-test'
    });
    const googleProfile = await store.save({
      name: 'Google',
      provider: 'google',
      model: 'gemini-2.5-flash',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: 'goog-test-key'
    });
    const mimoProfile = await store.save({
      name: 'MiMo',
      provider: 'xiaomi_mimo',
      model: 'mimo-v2-flash',
      baseURL: 'https://api.xiaomimimo.com/v1',
      apiKey: 'sk-payg-secret'
    });

    // Mutate stored MiMo baseURL to a Token Plan host so stored PAYG sk- key mismatches endpoint
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    raw.profiles.find(p => p.id === mimoProfile.id).baseURL = 'https://token-plan-sgp.xiaomimimo.com/v1';
    fs.writeFileSync(filePath, JSON.stringify(raw));

    globalThis.fetch = async url => {
      if (String(url).includes('api.openai.com')) {
        return new Response(JSON.stringify({ data: [{ id: 'gpt-4.1' }, { id: 'gpt-4o' }] }), { status: 200 });
      }
      if (String(url).includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] }
            ]
          }),
          { status: 200 }
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const manager = createLLMManager({ store });

    const openaiRes = await manager.handle({ method: 'GET', path: `/profiles/${openaiProfile.id}/models` });
    assert.equal(openaiRes.status, 200);
    assert.deepEqual(openaiRes.body.models, ['gpt-4.1', 'gpt-4o']);

    const googleRes = await manager.handle({ method: 'GET', path: `/profiles/${googleProfile.id}/models` });
    assert.equal(googleRes.status, 200);
    assert.deepEqual(googleRes.body.models, ['gemini-2.5-pro']);

    const mimoRes = await manager.handle({ method: 'GET', path: `/profiles/${mimoProfile.id}/models` });
    assert.equal(mimoRes.status, 400);
    assert.equal(mimoRes.body.code, 'AI_CREDENTIAL_ENDPOINT_MISMATCH');
  } finally {
    globalThis.fetch = originalFetch;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('UI Modelleri getir action preserves in-progress form edits and keeps existing model options when response is empty', async () => {
  const elements = new Map();
  const makeElement = (tag = 'div', id = '') => {
    const listeners = new Map();
    const el = {
      tagName: String(tag).toUpperCase(),
      id,
      value: '',
      textContent: '',
      className: '',
      placeholder: '',
      required: false,
      disabled: false,
      hidden: false,
      children: [],
      attributes: new Map(),
      get options() {
        return this.children.filter(c => c.tagName === 'OPTION');
      },
      append(...nodes) {
        for (const n of nodes) {
          if (n && typeof n === 'object') {
            if (n.id) elements.set(n.id, n);
            this.children.push(n);
          }
        }
      },
      replaceChildren(...nodes) {
        this.children = [];
        this.append(...nodes);
      },
      before(node) {
        if (node?.id) elements.set(node.id, node);
      },
      setAttribute(k, v) {
        this.attributes.set(k, v);
      },
      getAttribute(k) {
        return this.attributes.get(k);
      },
      removeAttribute(k) {
        this.attributes.delete(k);
      },
      addEventListener(type, fn) {
        listeners.set(type, fn);
      },
      trigger(type, event = { preventDefault() {} }) {
        return listeners.get(type)?.(event);
      },
      focus() {},
      reset() {}
    };
    if (id) elements.set(id, el);
    return el;
  };

  for (const [id, tag] of [
    ['message', 'p'],
    ['notification', 'div'],
    ['notification-title', 'strong'],
    ['notification-icon', 'span'],
    ['notification-meta', 'div'],
    ['notification-close', 'button'],
    ['profile-form', 'form'],
    ['model-select', 'select'],
    ['model', 'input'],
    ['known-models', 'datalist'],
    ['thinking-field', 'div'],
    ['thinking-hint', 'p'],
    ['provider', 'select'],
    ['api-key', 'input'],
    ['api-key-badge', 'span'],
    ['api-key-status', 'div'],
    ['base-url', 'input'],
    ['profile-id', 'input'],
    ['form-title', 'h2'],
    ['name', 'input'],
    ['timeout-ms', 'input'],
    ['max-output-tokens', 'input'],
    ['thinking', 'select'],
    ['profile-count', 'strong'],
    ['active-name', 'strong'],
    ['active-summary', 'section'],
    ['profiles', 'div'],
    ['home-link', 'a'],
    ['clear-form', 'button']
  ]) {
    makeElement(tag, id);
  }

  let modelsPayload = ['gpt-4.1', 'gpt-4o'];
  const profileFixture = {
    id: 'prof-1',
    name: 'Kayıtlı Ad',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    baseURL: 'https://api.openai.com/v1',
    hasApiKey: true,
    revision: 'rev-1',
    timeoutMs: 120000,
    maxOutputTokens: 8192,
    thinking: 'auto',
    lastTests: {},
    lastTest: null
  };

  const fakeFetch = async url => {
    const u = String(url);
    let data;
    if (u.endsWith('/catalog')) {
      data = {
        providers: [{ id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', models: ['gpt-4.1-mini'] }]
      };
    } else if (u.endsWith('/profiles')) {
      data = { activeId: 'prof-1', profiles: [profileFixture] };
    } else if (u.endsWith('/profiles/prof-1/models')) {
      data = { models: modelsPayload };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => data
    };
  };

  const findButtons = root => {
    const out = [];
    for (const child of root.children || []) {
      if (child.tagName === 'BUTTON') out.push(child);
      out.push(...findButtons(child));
    }
    return out;
  };

  const context = {
    document: {
      body: { dataset: { apiBase: '/api/llm', homeUrl: '/' } },
      getElementById: id => elements.get(id) || null,
      createElement: tag => makeElement(tag),
      querySelectorAll: () => [...elements.values()].filter(el => ['BUTTON', 'INPUT', 'SELECT'].includes(el.tagName))
    },
    window: { scrollTo() {}, confirm: () => true },
    fetch: fakeFetch,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {}
  };

  const scriptCode = fs.readFileSync(path.resolve('public/llm-ui.js'), 'utf8');
  vm.runInNewContext(scriptCode, context);

  // Wait for init() async completion
  await new Promise(resolve => setTimeout(resolve, 20));

  const cardButtons = findButtons(elements.get('profiles'));
  const fetchModelsBtn = cardButtons.find(b => b.textContent === 'Modelleri getir');
  assert.ok(fetchModelsBtn, 'Modelleri getir button should be rendered');

  // 1. When form is NOT editing prof-1, clicking 'Modelleri getir' loads prof-1 into form
  assert.equal(elements.get('profile-id').value, '');
  fetchModelsBtn.trigger('click');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(elements.get('profile-id').value, 'prof-1');
  assert.equal(elements.get('name').value, 'Kayıtlı Ad');
  assert.deepEqual(
    elements.get('known-models').options.map(o => o.value),
    ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o']
  );

  // 2. While editing prof-1, user modifies form fields and sets a custom model id
  elements.get('name').value = 'Düzenlenen Ad';
  elements.get('api-key').value = 'sk-yeni-anahtar';
  elements.get('timeout-ms').value = '45000';
  elements.get('model').value = 'ozel-model-v1';

  modelsPayload = ['gpt-4.1', 'gpt-4o'];
  fetchModelsBtn.trigger('click');
  await new Promise(resolve => setTimeout(resolve, 20));

  // Unsaved form edits must be preserved
  assert.equal(elements.get('name').value, 'Düzenlenen Ad');
  assert.equal(elements.get('api-key').value, 'sk-yeni-anahtar');
  assert.equal(elements.get('timeout-ms').value, '45000');
  assert.equal(elements.get('model').value, 'ozel-model-v1');
  assert.deepEqual(
    elements.get('known-models').options.map(o => o.value),
    ['ozel-model-v1', 'gpt-4.1', 'gpt-4o']
  );

  // 3. When provider returns an empty model list, existing model options must NOT be cleared
  modelsPayload = [];
  fetchModelsBtn.trigger('click');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(
    elements.get('known-models').options.map(o => o.value),
    ['ozel-model-v1', 'gpt-4.1', 'gpt-4o']
  );
});
