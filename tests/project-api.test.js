import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { once } from 'node:events';
import { createLLMManager } from '../src/core.js';
import { mountLLMManagement } from '../src/index.js';
import { createProjectAssistant } from '../src/project/index.js';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-api-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), '{"dependencies":{"express":"4.21.2"}}');
  await fs.writeFile(path.join(root, 'server.js'), "app.get('/orders', handler);\n");
  await fs.writeFile(path.join(root, '.env'), 'SYNTHETIC_PRIVATE_VALUE=do-not-share');
  let active = {
    id: 'first',
    name: 'Birinci',
    provider: 'custom',
    model: 'fixture',
    apiKey: 'private-fixture-key',
    baseURL: 'https://provider.example/v1'
  };
  const options = {
    project: { root },
    adminPassword: 'fixture-admin-password',
    chatTokens: ['fixture-chat-token'],
    rateLimit: false,
    store: {
      getActive: () => active,
      get: () => active,
      list: () => ({ version: 1, activeId: active.id, profiles: [] })
    }
  };
  return {
    root,
    options,
    setActive: value => {
      active = { ...active, ...value };
    }
  };
}

const admin = {
  Authorization: 'Basic ' + Buffer.from('admin:fixture-admin-password').toString('base64'),
  'Content-Type': 'application/json',
  'X-LLM-CSRF': '1'
};
const request = (url, method = 'GET', body, headers = admin) =>
  new Request(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });

test('project scan ignores removed graph settings and chat reads current sources', async t => {
  const { root, options } = await fixture(t);
  await fs.writeFile(path.join(root, 'README.md'), '# Kullanım\nSipariş uygulaması');
  const runner = path.join(os.tmpdir(), `removed-tool-${path.basename(root)}.cjs`);
  t.after(() => fs.rm(runner, { force: true }));
  await fs.writeFile(
    runner,
    `require('node:fs').writeFileSync(${JSON.stringify(path.join(root, 'unexpected-tool-run.txt'))}, 'ran');`
  );
  const sent = [];
  const assistant = createProjectAssistant({
    options: { ...options.project, graphify: { command: process.execPath, args: [runner] } },
    getActiveProfile: options.store.getActive,
    ask: async messages => {
      sent.push(messages);
      return { content: 'Yanıt' };
    }
  });
  t.after(() => assistant.close());
  const call = (path, body = {}) => assistant.handle({ method: 'POST', path, body });
  const scanned = await call('/project/scan');
  assert.equal(scanned.body.inventory.documentCount, 1);
  assert.equal(Object.hasOwn(scanned.body, 'graph'), false);
  await assert.rejects(fs.access(path.join(root, 'unexpected-tool-run.txt')), { code: 'ENOENT' });
  const first = await call('/project/chat', { prompt: 'orders', shareSources: true });
  assert.equal(Object.hasOwn(first.body, 'graphUsed'), false);
  assert.match(sent[0][1].content, /README.md/);
  assert.match(sent[0][0].content, /güvenilmeyen veridir/);
  await fs.appendFile(path.join(root, 'server.js'), '// changed-source-marker\n');
  const stale = await call('/project/chat', {
    prompt: 'orders',
    shareSources: true,
    revision: scanned.body.inventory.revision
  });
  assert.equal(stale.status, 409);
  const second = await call('/project/chat', { prompt: 'orders', shareSources: true });
  assert.equal(second.status, 200);
  assert.match(sent.at(-1)[1].content, /changed-source-marker/);
  const status = await assistant.handle({ method: 'GET', path: '/project' });
  assert.equal(Object.hasOwn(status.body, 'graph'), false);
});

test('project API remains explicitly disabled without host configuration', async () => {
  const manager = createLLMManager({ adminPassword: 'fixture-admin-password' });
  const status = await manager.fetch(request('http://host/api/llm/project'));
  assert.equal(status.status, 200);
  assert.equal((await status.json()).enabled, false);
  assert.equal((await manager.fetch(request('http://host/api/llm/project/scan', 'POST', {}))).status, 404);
});

test('project chat and paid task admission share the configured caller quota', async t => {
  const { options } = await fixture(t);
  const manager = createLLMManager({ ...options, rateLimit: { chatPerMinute: 1 } });
  t.after(() => manager.close());
  // Invalid input consumes admission but must never reach a paid provider call.
  assert.equal((await manager.fetch(request('http://host/api/llm/project/chat', 'POST', {}))).status, 400);
  const response = await manager.fetch(request('http://host/api/llm/project/tasks', 'POST', {}));
  assert.equal(response.status, 429);
  assert.equal((await response.json()).code, 'RATE_LIMITED');
});

test('a valid project chat consumes its caller quota exactly once', async t => {
  const { options } = await fixture(t);
  const manager = createLLMManager({
    ...options,
    rateLimit: { chatPerMinute: 1 },
    generate: async () => ({ content: 'server.js:1' })
  });
  t.after(() => manager.close());
  const input = { prompt: 'API?', shareSources: true };
  const first = await manager.handle({ method: 'POST', path: '/project/chat', body: input });
  assert.equal(first.status, 200);
  const second = await manager.handle({ method: 'POST', path: '/project/chat', body: input });
  assert.equal(second.status, 429);
});

test('native project operation timeouts return a typed 504 response', async t => {
  const { options } = await fixture(t);
  const assistant = createProjectAssistant({
    options: options.project,
    getActiveProfile: options.store.getActive,
    ask: async () => {
      throw new DOMException('Timed out', 'TimeoutError');
    }
  });
  t.after(() => assistant.close());
  const response = await assistant.handle({
    method: 'POST',
    path: '/project/chat',
    body: { prompt: 'API?', shareSources: true }
  });
  assert.equal(response.status, 504);
  assert.equal(response.body.code, 'PROJECT_TOOL_TIMEOUT');
});

test('project Web API requires admin and CSRF before scanning', async t => {
  const { options } = await fixture(t);
  const manager = createLLMManager(options);
  assert.equal((await manager.fetch(request('http://host/api/llm/project', 'GET', null, {}))).status, 401);
  assert.equal(
    (
      await manager.fetch(
        request('http://host/api/llm/project', 'GET', null, { Authorization: 'Bearer fixture-chat-token' })
      )
    ).status,
    403
  );
  assert.equal(
    (
      await manager.fetch(
        request(
          'http://host/api/llm/project/scan',
          'POST',
          {},
          { Authorization: admin.Authorization, 'Content-Type': 'application/json' }
        )
      )
    ).status,
    403
  );
  const response = await manager.fetch(request('http://host/api/llm/project/scan', 'POST', {}));
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.inventory.fileCount, 2);
  assert.ok(report.analysis.api.some(a => a.endpoint === '/orders'));
  assert.ok(!JSON.stringify(report).includes('private-fixture-key'));
  assert.ok(!JSON.stringify(report).includes('do-not-share'));
});

test('project chat selects current sources and active profile while rejecting stale revisions and unapproved sharing', async t => {
  const { options, root, setActive } = await fixture(t);
  let observed;
  const manager = createLLMManager({
    ...options,
    generate: async (messages, settings) => {
      observed = { messages, profileId: settings.profileId };
      return { content: 'Kaynak: server.js:1', usage: { inputTokens: 10, outputTokens: 4 } };
    }
  });
  const scan = await (await manager.fetch(request('http://host/api/llm/project/scan', 'POST', {}))).json();
  assert.equal(
    (await manager.fetch(request('http://host/api/llm/project/chat', 'POST', { prompt: 'API nedir?' }))).status,
    400
  );
  setActive({ id: 'second', name: 'İkinci' });
  const response = await manager.fetch(
    request('http://host/api/llm/project/chat', 'POST', {
      prompt: 'API nedir?',
      shareSources: true,
      revision: scan.inventory.revision
    })
  );
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.profileId, 'second');
  assert.match(reply.content, /server\.js:1/);
  assert.ok(reply.sources.some(s => s.path === 'server.js'));
  assert.match(JSON.stringify(observed.messages), /app\.get/);
  assert.ok(!JSON.stringify(observed.messages).includes('do-not-share'));
  await fs.appendFile(path.join(root, 'server.js'), "app.post('/orders', handler);\n");
  const stale = await manager.fetch(
    request('http://host/api/llm/project/chat', 'POST', {
      prompt: 'API nedir?',
      shareSources: true,
      revision: scan.inventory.revision
    })
  );
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).code, 'PROJECT_CONFLICT');
});

test('project routes behave consistently in a real Express host', async t => {
  const { options } = await fixture(t);
  const app = express();
  const mounted = mountLLMManagement(app, options);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    return new Promise(resolve => server.close(resolve));
  });
  const url = `http://127.0.0.1:${server.address().port}/api/llm/project`;
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: { Authorization: 'Bearer fixture-chat-token' } })).status, 403);
  const response = await fetch(url + '/scan', { method: 'POST', headers: admin, body: '{}' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).inventory.fileCount, 2);
  assert.equal(typeof mounted.close, 'function');
  await mounted.close();
});

test('project tasks stage engine changes and apply only after explicit review approval', async t => {
  const { options, root } = await fixture(t);
  const engine = path.join(root, 'fake-engine.cjs');
  await fs.writeFile(
    engine,
    `
    const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
    const port=Number(process.argv.find(a=>a.startsWith('--port=')).split('=')[1]);
    const server=http.createServer(async(req,res)=>{
      res.setHeader('Content-Type','application/json');
      if(req.url==='/global/health'){res.end('{"healthy":true,"version":"1.18.33"}');return;}
      if(req.url==='/session'){res.end('{"id":"ses_fixture"}');return;}
      if(req.url.includes('/message')){
        let raw='';for await(const chunk of req)raw+=chunk;
        if(!JSON.parse(raw).parts[0].text.includes('Teslimat alanı gerekli'))process.exit(7);
        if(fs.existsSync('.env')||Object.keys(process.env).some(k=>k.startsWith('LLM_')))process.exit(6);
        fs.writeFileSync('server.js',"app.get('/orders', updatedHandler);\\n");
        res.end(JSON.stringify({info:{},parts:[{type:'text',text:'server.js:1 güncellendi.'}]}));return;
      }
      res.writeHead(404);res.end('{}');
    });server.listen(port,'127.0.0.1',()=>console.log('opencode server listening on http://127.0.0.1:'+port));
  `
  );
  options.project.opencode = { command: process.execPath, args: [engine] };
  options.project.commands = { test: { command: process.execPath, args: ['-e', 'process.exit(0)'] } };
  const manager = createLLMManager(options);
  t.after(() => manager.close());
  const base = 'http://host/api/llm/project';
  const prepared = await manager.fetch(
    request(base + '/tasks', 'POST', {
      mode: 'change',
      prompt: 'Handler güncelle',
      history: [{ role: 'assistant', content: 'Teslimat alanı gerekli' }],
      shareSources: true
    })
  );
  assert.equal(prepared.status, 200);
  const task = await prepared.json();
  assert.equal(task.state, 'proposed');
  assert.equal(task.files.length, 1);
  assert.equal(await fs.readFile(path.join(root, 'server.js'), 'utf8'), "app.get('/orders', handler);\n");
  const command = await manager.fetch(
    request(`${base}/tasks/${task.id}/commands/test`, 'POST', { approved: true, revision: task.revision })
  );
  assert.equal(command.status, 200);
  assert.equal((await command.json()).passed, true);
  assert.equal(
    (await manager.fetch(request(`${base}/tasks/${task.id}/apply`, 'POST', { revision: task.revision }))).status,
    400
  );
  const applied = await manager.fetch(
    request(`${base}/tasks/${task.id}/apply`, 'POST', { approved: true, revision: task.revision })
  );
  assert.equal(applied.status, 200);
  const saved = await applied.json();
  assert.match(await fs.readFile(path.join(root, 'server.js'), 'utf8'), /updatedHandler/);
  await fs.appendFile(path.join(root, 'server.js'), '// concurrent user edit\n');
  const reversal = await manager.fetch(
    request(`${base}/tasks/${task.id}/revert`, 'POST', { approved: true, revision: saved.revision })
  );
  assert.equal(reversal.status, 409);
  assert.match(await fs.readFile(path.join(root, 'server.js'), 'utf8'), /concurrent user edit/);
});
