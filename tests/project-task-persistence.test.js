import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createLLMManager } from '../src/core.js';
import { rotateEncryptionKey } from '../src/setup.js';
import { createProjectFiles } from '../src/project/files.js';
import { createProjectChanges } from '../src/project/changes.js';

const admin = {
  Authorization: 'Basic ' + Buffer.from('admin:fixture-admin-password').toString('base64'),
  'Content-Type': 'application/json',
  'X-LLM-CSRF': '1'
};
const base = 'http://host/api/llm/project';
const call = (manager, url, method = 'GET', body) =>
  manager.fetch(new Request(url, { method, headers: admin, ...(body ? { body: JSON.stringify(body) } : {}) }));
const ORIGINAL = "app.get('/orders', handler);\n";

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-persist-root-'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-persist-data-'));
  const engineDir = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-persist-engine-'));
  await fs.writeFile(path.join(root, 'package.json'), '{"dependencies":{"express":"4.21.2"}}');
  await fs.writeFile(path.join(root, 'server.js'), ORIGINAL);
  const engine = path.join(engineDir, 'fake-engine.cjs');
  await fs.writeFile(
    engine,
    `
    const http=require('node:http'),fs=require('node:fs');
    const port=Number(process.argv.find(a=>a.startsWith('--port=')).split('=')[1]);
    const server=http.createServer(async(req,res)=>{
      res.setHeader('Content-Type','application/json');
      if(req.url==='/global/health'){res.end('{"healthy":true,"version":"1.18.33"}');return;}
      if(req.url==='/session'){res.end('{"id":"ses_fixture"}');return;}
      if(req.url.includes('/message')){
        let raw='';for await(const chunk of req)raw+=chunk;
        fs.writeFileSync('server.js',"app.get('/orders', updatedHandler);\\n");
        res.end(JSON.stringify({info:{},parts:[{type:'text',text:'server.js:1 güncellendi.'}]}));return;
      }
      res.writeHead(404);res.end('{}');
    });server.listen(port,'127.0.0.1',()=>console.log('opencode server listening on http://127.0.0.1:'+port));
  `
  );
  const managers = [];
  const open = () => {
    const manager = createLLMManager({
      dataDir,
      allowLocalHttp: true,
      adminPassword: 'fixture-admin-password',
      rateLimit: false,
      retry: false,
      project: { root, opencode: { command: process.execPath, args: [engine] } }
    });
    managers.push(manager);
    return manager;
  };
  t.after(async () => {
    for (const manager of managers) await manager.close().catch(() => {});
    for (const dir of [root, dataDir, engineDir]) await fs.rm(dir, { recursive: true, force: true });
  });
  // Etkin profil bir kez kaydedilir; sonraki yöneticiler aynı veri klasöründen okur.
  const first = open();
  const saved = await first.handle({
    method: 'POST',
    path: '/profiles',
    body: {
      name: 'Görev',
      provider: 'openai',
      baseURL: 'https://provider.example/v1',
      model: 'gpt-4o',
      apiKey: 'sk-fixture'
    }
  });
  await first.handle({
    method: 'POST',
    path: `/profiles/${saved.body.id}/activate`,
    body: { revision: saved.body.revision }
  });
  return { root, dataDir, open, first };
}

async function applyOne(manager) {
  const prepared = await call(manager, `${base}/tasks`, 'POST', {
    mode: 'change',
    prompt: 'Handler güncelle',
    shareSources: true
  });
  assert.equal(prepared.status, 200);
  const task = await prepared.json();
  const applied = await call(manager, `${base}/tasks/${task.id}/apply`, 'POST', {
    approved: true,
    revision: task.revision
  });
  assert.equal(applied.status, 200);
  return { task, applied: await applied.json() };
}

const listTasks = async manager => (await (await call(manager, `${base}/tasks`)).json()).tasks;

test('K15: uygulanmış görev yeniden başlatmadan sonra geri yüklenir ve geri alınabilir', async t => {
  const { root, open, first } = await setup(t);
  const { task, applied } = await applyOne(first);
  assert.equal(applied.persisted, undefined);
  assert.match(await fs.readFile(path.join(root, 'server.js'), 'utf8'), /updatedHandler/);
  await first.close();

  const second = open();
  const listed = await listTasks(second);
  assert.deepEqual(
    listed.map(item => [item.id, item.state, item.mode]),
    [[task.id, 'applied', 'change']]
  );
  const restored = await (await call(second, `${base}/tasks/${task.id}`)).json();
  assert.equal(restored.restored, true);
  assert.equal(restored.revision, applied.revision);
  assert.equal(restored.files[0].path, 'server.js');
  const reverted = await call(second, `${base}/tasks/${task.id}/revert`, 'POST', {
    approved: true,
    revision: restored.revision
  });
  assert.equal(reverted.status, 200);
  assert.equal(await fs.readFile(path.join(root, 'server.js'), 'utf8'), ORIGINAL);
  await second.close();

  // Geri alınan görev kayıttan silinir.
  assert.deepEqual(await listTasks(open()), []);
});

test('K15: yeniden başlatmadan sonra dosya elle değiştiyse geri alma PROJECT_CONFLICT verir ve kayıt korunur', async t => {
  const { root, open, first } = await setup(t);
  const { task } = await applyOne(first);
  await first.close();
  await fs.appendFile(path.join(root, 'server.js'), '// kullanıcı düzenlemesi\n');
  const second = open();
  const restored = await (await call(second, `${base}/tasks/${task.id}`)).json();
  const reverted = await call(second, `${base}/tasks/${task.id}/revert`, 'POST', {
    approved: true,
    revision: restored.revision
  });
  assert.equal(reverted.status, 409);
  assert.equal((await reverted.json()).code, 'PROJECT_CONFLICT');
  assert.match(await fs.readFile(path.join(root, 'server.js'), 'utf8'), /kullanıcı düzenlemesi/);
  await second.close();
  assert.equal((await listTasks(open())).length, 1);
});

test('K15: kayıt dosyası şifrelidir ve anahtar döndürmeden sonra okunur', async t => {
  const { root, dataDir, open, first } = await setup(t);
  const { task } = await applyOne(first);
  await first.close();
  const archive = path.join(dataDir, 'llm-profiles.json.tasks.enc');
  const raw = await fs.readFile(archive, 'utf8');
  assert.ok(raw.length > 0);
  assert.ok(!raw.includes('updatedHandler') && !raw.includes('server.js') && !raw.includes(root));

  const previous = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  try {
    const result = rotateEncryptionKey({ dataDir });
    assert.equal(result.ok, true);
    assert.notEqual(await fs.readFile(archive, 'utf8'), raw);
    const second = open();
    const restored = await (await call(second, `${base}/tasks/${task.id}`)).json();
    assert.equal(restored.restored, true);
    const reverted = await call(second, `${base}/tasks/${task.id}/revert`, 'POST', {
      approved: true,
      revision: restored.revision
    });
    assert.equal(reverted.status, 200);
    assert.equal(await fs.readFile(path.join(root, 'server.js'), 'utf8'), ORIGINAL);
  } finally {
    if (previous === undefined) delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    else process.env.LLM_CONFIG_ENCRYPTION_KEY = previous;
  }
});

test('K15: kullanıcı kaydı kapatınca arşivden de silinir; yalnız bellek temizliği silmez', async t => {
  const { open, first } = await setup(t);
  const { task, applied } = await applyOne(first);
  // Bellek temizliği (close) kaydı korur.
  await first.close();
  const second = open();
  assert.equal((await listTasks(second)).length, 1);
  const discarded = await call(second, `${base}/tasks/${task.id}/discard`, 'POST', { approved: true });
  assert.equal(discarded.status, 200);
  assert.equal(applied.state, 'applied');
  await second.close();
  assert.deepEqual(await listTasks(open()), []);
});

test('K15: arşiv yazılamazsa uygulama başarılıdır ve persisted:false uyarısı döner', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-persist-unit-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'app.js'), 'export const total = 100;\n');
  const reader = createProjectFiles({ root });
  const archive = {
    read: async () => [],
    update: async () => {
      throw new Error('disk dolu');
    }
  };
  const changes = createProjectChanges({ reader, archive });
  const before = (await reader.scan()).files;
  const proposal = await changes.prepare(before, [{ ...before[0], content: 'export const total = 120;\n' }]);
  const applied = await changes.apply(proposal.id, { approved: true, revision: proposal.revision });
  assert.equal(applied.persisted, false);
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), 'export const total = 120;\n');
  // Bellekte geri alma yine çalışır.
  await changes.revert(proposal.id, { approved: true, revision: applied.revision });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), 'export const total = 100;\n');
});

test('K15: bozuk veya başka kök için yazılmış kayıtlar yok sayılır, arşivsiz kullanım değişmez', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-persist-bad-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'app.js'), 'export const total = 120;\n');
  const reader = createProjectFiles({ root });
  const realRoot = await fs.realpath(root);
  const valid = {
    id: crypto.randomUUID(),
    revision: crypto.randomUUID(),
    root: realRoot,
    appliedAt: new Date().toISOString(),
    files: [
      { path: 'app.js', before: 'export const total = 100;\n', after: 'export const total = 120;\n', kind: 'update' }
    ]
  };
  const records = [
    null,
    { id: 'x' },
    { ...valid, id: crypto.randomUUID(), root: path.join(realRoot, 'baska') },
    { ...valid, id: crypto.randomUUID(), files: [{ path: '../disari.js', before: null, after: 'x', kind: 'create' }] },
    { ...valid, id: crypto.randomUUID(), files: [{ path: '.env', before: null, after: 'A=1', kind: 'create' }] },
    valid
  ];
  const changes = createProjectChanges({ reader, archive: { read: async () => records, update: async () => {} } });
  const restored = await changes.restore();
  assert.deepEqual(
    restored.map(item => item.id),
    [valid.id]
  );
  assert.equal(changes.get(valid.id).restored, true);
  const plain = createProjectChanges({ reader });
  assert.deepEqual(await plain.restore(), []);
});

test('okunamayan görev arşivi yeni görevleri engellemez ve bir kez uyarı günlüğü yazar', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-task-warn-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const reader = createProjectFiles({ root });
  const warnings = [];
  const failure = Object.assign(new Error('gizli-ayrinti-sk-123'), { code: 'ARCHIVE_UNREADABLE' });
  const changes = createProjectChanges({
    reader,
    archive: {
      read: async () => {
        throw failure;
      },
      update: async () => {}
    },
    onWarning: (event, fields) => warnings.push([event, fields])
  });
  assert.deepEqual(await changes.restore(), []);
  assert.deepEqual(await changes.restore(), []);
  assert.deepEqual(warnings, [['project.archive.unreadable', { reason: 'ARCHIVE_UNREADABLE' }]]);
  assert.ok(!JSON.stringify(warnings).includes('gizli-ayrinti'));
});

test('bozuk şifreli görev arşivi yönetici günlüğüne uyarı düşer ve proje durumu yine açılır', async t => {
  const { root, dataDir } = await setup(t);
  await fs.writeFile(path.join(dataDir, 'llm-profiles.json.tasks.enc'), 'bozuk-icerik');
  const events = [];
  const manager = createLLMManager({
    dataDir,
    allowLocalHttp: true,
    adminPassword: 'fixture-admin-password',
    rateLimit: false,
    retry: false,
    logger: { info() {}, error() {}, warn: (event, fields) => events.push([event, fields]) },
    project: { root }
  });
  t.after(() => manager.close().catch(() => {}));
  const response = await call(manager, `${base}/tasks`);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).tasks, []);
  const warned = events.filter(([event]) => event === 'project.archive.unreadable');
  assert.equal(warned.length, 1);
  assert.deepEqual(Object.keys(warned[0][1]), ['reason']);
});
