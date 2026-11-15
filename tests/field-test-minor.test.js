// pdf-to-onlinequiz saha testinde (2026-11-15 yeniden sınama) çalışma zamanında yeniden üretilen küçük kusurlar.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMManager } from '../src/core.js';
import { createLLMProfileStore } from '../src/profileStore.js';
import { createProjectAssistant } from '../src/project/index.js';
import { createProjectFiles } from '../src/project/files.js';
import { createProjectChanges } from '../src/project/changes.js';
import { projectOptionsFromEnv } from '../src/project/options.js';
import { ensureGitignore, readEnv } from '../src/envFile.js';

const tempDir = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const profileInput = extra => ({
  name: 'P',
  provider: 'openai',
  model: 'gpt-test',
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'sk-test-key-0000000000',
  ...extra
});

test('profil kaydı var olmayan yedek profil kimliğini reddeder, var olanı kabul eder', async t => {
  const store = createLLMProfileStore({ dataDir: tempDir(t, 'llm-fb-') });
  const first = await store.save(profileInput({ name: 'Birinci' }));
  await assert.rejects(store.save(profileInput({ name: 'İkinci', fallbackProfileIds: ['olmayan-profil'] })), {
    code: 'PROFILE_INVALID'
  });
  const second = await store.save(profileInput({ name: 'İkinci', fallbackProfileIds: [first.id] }));
  assert.deepEqual(second.fallbackProfileIds, [first.id]);
  await assert.rejects(
    store.save(
      profileInput({ id: second.id, revision: second.revision, name: 'İkinci', fallbackProfileIds: [second.id] })
    ),
    { code: 'PROFILE_INVALID' },
    'profil kendini yedek gösteremez'
  );
  // Silinen profil başka profillerin yedek listesinde asılı kalmaz.
  await store.remove(first.id, first.revision);
  assert.deepEqual((await store.get(second.id)).fallbackProfileIds, []);
});

test('yalnız API adresi değişip anahtar girilmezse hata adresi anar', async t => {
  const store = createLLMProfileStore({ dataDir: tempDir(t, 'llm-url-') });
  const saved = await store.save(profileInput({ provider: 'custom', baseURL: 'https://a.example/v1' }));
  await assert.rejects(
    store.save({
      ...profileInput({ provider: 'custom', baseURL: 'https://b.example/v1', apiKey: '' }),
      id: saved.id,
      revision: saved.revision
    }),
    err => err.code === 'PROFILE_INVALID' && /adres/i.test(err.message) && !/Sağlayıcı değişince/.test(err.message)
  );
});

const store = { getActive: async () => null, list: async () => ({ activeId: null, profiles: [] }) };
const basic = password => 'Basic ' + Buffer.from(`admin:${password}`).toString('base64');

test('/usage ay değerini 01–12 aralığında denetler', async () => {
  const manager = createLLMManager({ store, adminPassword: 'pw-123456' });
  const usage = month =>
    manager.fetch(
      new Request(`http://localhost/api/llm/usage?month=${month}`, { headers: { authorization: basic('pw-123456') } })
    );
  for (const bad of ['2026-13', '2026-00']) assert.equal((await usage(bad)).status, 400, bad);
  assert.equal((await usage('2026-12')).status, 200);
});

test('Proje Asistanı yanıtları requestId taşır', async t => {
  const root = tempDir(t, 'llm-project-reqid-');
  fs.writeFileSync(path.join(root, 'server.js'), 'export const a = 1;\n');
  const manager = createLLMManager({ store, adminPassword: 'pw-123456', project: { root }, rateLimit: false });
  t.after(() => manager.close?.());
  const response = await manager.fetch(
    new Request('http://localhost/api/llm/project', {
      headers: { authorization: basic('pw-123456'), 'x-request-id': 'istek-kimligi-1' }
    })
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).requestId, 'istek-kimligi-1');
});

test('kimliği olmayan istemcilerde başarılı istek ortak giriş sayacını sıfırlamaz', async () => {
  const manager = createLLMManager({
    store,
    adminPassword: 'pw-123456',
    chatTokens: ['chat-token'],
    rateLimit: { authFailuresPerMinute: 3 }
  });
  const attempt = authorization =>
    manager.fetch(new Request('http://localhost/api/llm/profiles', { headers: { authorization } }));
  for (let i = 0; i < 3; i++) assert.equal((await attempt(basic('yanlis'))).status, 401);
  // Bearer istemcisi (ör. sohbet) başarılı kimlik doğrular; saldırganın sayacını sıfırlamamalı.
  await attempt('Bearer chat-token');
  assert.equal((await attempt(basic('yanlis'))).status, 429);
  // Doğru parola sınır dolu olsa da girer.
  assert.equal((await attempt(basic('pw-123456'))).status, 200);
});

test('boş farklı değişiklik onaylansa da uygulanmış sayılmaz', async t => {
  const root = tempDir(t, 'llm-empty-diff-');
  fs.writeFileSync(path.join(root, 'app.js'), 'export const a = 1;\n');
  const reader = createProjectFiles({ root });
  const before = (await reader.scan()).files;
  const changes = createProjectChanges({ reader });
  const proposal = await changes.prepare(before, before);
  assert.equal(proposal.files.length, 0);
  await assert.rejects(changes.apply(proposal.id, { revision: proposal.revision, approved: true }), {
    code: 'PROJECT_NO_CHANGES'
  });
});

test('LLM_OPENCODE_TIMEOUT_MS ortamdan okunur; geçersiz değer yok sayılır', () => {
  const base = { LLM_PROJECT_ROOT: '.' };
  assert.equal(projectOptionsFromEnv({ ...base, LLM_OPENCODE_TIMEOUT_MS: '900000' }, '/x').opencodeTimeoutMs, 900000);
  for (const bad of ['abc', '0', '999', '3600001'])
    assert.equal(
      projectOptionsFromEnv({ ...base, LLM_OPENCODE_TIMEOUT_MS: bad }, '/x').opencodeTimeoutMs,
      undefined,
      bad
    );
});

test('OpenCode görev süresi profil yanıt süresinden bağımsızdır', async t => {
  const root = tempDir(t, 'llm-oc-timeout-');
  fs.writeFileSync(path.join(root, 'server.js'), "app.get('/orders', handler);\n");
  const engine = path.join(root, '..', `slow-engine-${path.basename(root)}.cjs`);
  t.after(() => fs.rmSync(engine, { force: true }));
  fs.writeFileSync(
    engine,
    `const http=require('node:http');const port=Number(process.argv.find(a=>a.startsWith('--port=')).split('=')[1]);http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/global/health')return res.end('{"healthy":true,"version":"1.18.33"}');if(req.url==='/session')return res.end('{"id":"ses_fixture"}');if(req.url.includes('/message')){for await(const c of req);return setTimeout(()=>res.end(JSON.stringify({info:{},parts:[{type:'text',text:'yavaş-plan'}]})),6500);}res.writeHead(404);res.end('{}');}).listen(port,'127.0.0.1',()=>console.log('opencode server listening on http://127.0.0.1:'+port));`
  );
  const active = {
    id: 'p',
    name: 'P',
    provider: 'custom',
    model: 'fixture',
    apiKey: 'fixture-key',
    baseURL: 'https://provider.example/v1',
    timeoutMs: 5000
  };
  const make = extra => {
    const assistant = createProjectAssistant({
      options: { root, opencode: { command: process.execPath, args: [engine] }, ...extra },
      getActiveProfile: () => active,
      ask: async () => ({ text: 'unused' })
    });
    t.after(() => assistant.close());
    return assistant;
  };
  const plan = assistant =>
    assistant
      .handle({ method: 'POST', path: '/project/scan', body: {} })
      .then(() =>
        assistant.handle({
          method: 'POST',
          path: '/project/tasks',
          body: { mode: 'plan', prompt: 'orders', shareSources: true }
        })
      );
  const ok = await plan(make({}));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.content, 'yavaş-plan');
  const limited = await plan(make({ opencodeTimeoutMs: 2000 }));
  assert.equal(limited.status, 504);
  assert.equal(limited.body.code, 'PROJECT_TOOL_TIMEOUT');
});

test('LLM_RETRY=false sağlayıcı tekrarını kapatır', async t => {
  const previous = process.env.LLM_RETRY;
  t.after(() => (previous === undefined ? delete process.env.LLM_RETRY : (process.env.LLM_RETRY = previous)));
  const profile = {
    id: 'p',
    name: 'P',
    provider: 'custom',
    model: 'm',
    baseURL: 'https://provider.example/v1',
    apiKey: 'k'
  };
  const countCalls = async () => {
    let calls = 0;
    const manager = createLLMManager({
      store: {
        getActive: async () => profile,
        get: async () => profile,
        list: async () => ({ activeId: 'p', profiles: [profile] })
      },
      adminPassword: 'pw-123456',
      retry: undefined,
      generate: async () => {
        calls++;
        const error = new Error('geçici');
        error.status = 503;
        throw error;
      }
    });
    await manager.ask('merhaba').catch(() => {});
    return calls;
  };
  delete process.env.LLM_RETRY;
  assert.ok((await countCalls()) > 1, 'varsayılan tekrar açık olmalı');
  process.env.LLM_RETRY = 'false';
  assert.equal(await countCalls(), 1);
});

test('init doğrulama sunucusu LLM_DATA_DIR klasörünü kullanır', async t => {
  const { initLLMProject, probeAndOpenBrowser } = await import('../src/init.js');
  const cwd = tempDir(t, 'llm-probe-datadir-');
  const dataDir = path.join(tempDir(t, 'llm-probe-data-'), 'veri');
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ devDependencies: { vite: '^7' } }));
  initLLMProject({ cwd, type: 'spa', password: 'probe-password' });
  fs.appendFileSync(path.join(cwd, '.env'), `LLM_DATA_DIR=${dataDir}\n`);
  const probe = await probeAndOpenBrowser({ cwd, port: 0, password: 'probe-password', openBrowser: false });
  t.after(() => probe?.server && new Promise(resolve => probe.server.close(resolve)));
  const response = await fetch(probe.url.replace('/llm', '/api/llm/profiles'), {
    method: 'POST',
    headers: {
      Authorization: basic('probe-password'),
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1'
    },
    body: JSON.stringify(profileInput())
  });
  assert.equal(response.status, 201);
  assert.ok(fs.existsSync(path.join(dataDir, 'llm-profiles.json')), 'profil LLM_DATA_DIR altına yazılmalı');
  assert.equal(fs.existsSync(path.join(cwd, 'data', 'llm-profiles.json')), false);
  assert.ok(readEnv(path.join(cwd, '.env')).LLM_DATA_DIR);
});

test('.gitignore zaten kapsanan sır desenlerini tekrar eklemez', t => {
  const cwd = tempDir(t, 'llm-gitignore-');
  const original = 'node_modules/\ndata/\n.env*\n!.env.example\n*.key\n';
  fs.writeFileSync(path.join(cwd, '.gitignore'), original);
  ensureGitignore(cwd);
  assert.equal(fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8'), original);

  const partial = tempDir(t, 'llm-gitignore-partial-');
  fs.writeFileSync(path.join(partial, '.gitignore'), '/data/\n.env\n');
  ensureGitignore(partial);
  const added = fs.readFileSync(path.join(partial, '.gitignore'), 'utf8');
  assert.match(added, /^\.env\.local$/m);
  assert.match(added, /^\*\.key$/m);
  assert.equal(added.match(/^\.env$/gm).length, 1);
  assert.doesNotMatch(added, /^data\/$/m);

  // Geri getirme kuralı bir girdiyi yeniden açıyorsa kapsanmış sayılmaz.
  const negated = tempDir(t, 'llm-gitignore-neg-');
  fs.writeFileSync(path.join(negated, '.gitignore'), '.env*\n!.env.local\n');
  ensureGitignore(negated);
  assert.match(fs.readFileSync(path.join(negated, '.gitignore'), 'utf8'), /# llm-manager\n(?:.*\n)*\.env\.local\n/);
});
