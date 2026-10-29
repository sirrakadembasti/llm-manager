import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import {
  initLLMProject,
  injectIntoEntryFile,
  createChangeJournal,
  runInteractiveInit,
  detectEntryFile,
  probeAndOpenBrowser
} from '../src/init.js';
import { createStandaloneServer } from '../src/server.js';

const require = createRequire(import.meta.url);
const express = require('express');
function fixture(t, source = '') {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-integration-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ type: 'commonjs', dependencies: { express: '*' } })
  );
  fs.writeFileSync(
    path.join(cwd, 'app.js'),
    source || "const express = require('express');\nconst app = express();\nmodule.exports = app;\n"
  );
  const target = path.join(cwd, 'node_modules/@sirrakadembasti/llm-manager');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(path.resolve('.'), target, 'junction');
  return cwd;
}

test('init chooses llm2 when literal routes and public files occupy llm and llm1', t => {
  const cwd = fixture(t, "const app = express();\napp.get('/llm', handler);\n");
  fs.mkdirSync(path.join(cwd, 'public'));
  fs.writeFileSync(path.join(cwd, 'public/llm1.html'), 'existing page');
  const result = initLLMProject({ cwd, type: 'express' });
  assert.equal(result.pagePath, '/llm2');
  assert.equal(result.apiPath, '/api/llm2');
  assert.match(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), /LLM_PAGE_PATH=\/llm2/);
  assert.equal(fs.readFileSync(path.join(cwd, 'public/llm1.html'), 'utf8'), 'existing page');
  assert.equal(initLLMProject({ cwd, type: 'express' }).pagePath, '/llm2');
});

test('API collisions reserve the matching page suffix too', t => {
  const cwd = fixture(t, "const app = express();\napp.use('/api/llm', router);\n");
  assert.equal(initLLMProject({ cwd, type: 'express' }).pagePath, '/llm1');
});

test('credentials use target env, then example defaults, without resetting existing values', t => {
  const cwd = fixture(t);
  fs.writeFileSync(
    path.join(cwd, '.env.example'),
    'LLM_ADMIN_USER=operator\nLLM_ADMIN_PASSWORD=ExampleTestPassword123\n'
  );
  initLLMProject({ cwd, type: 'express' });
  const before = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
  assert.match(before, /LLM_ADMIN_USER=operator/);
  assert.match(before, /LLM_ADMIN_PASSWORD=ExampleTestPassword123/);
  initLLMProject({ cwd, type: 'express' });
  assert.equal(fs.readFileSync(path.join(cwd, '.env'), 'utf8'), before);
});

test('host authentication requires an explicit adapter before changing files', t => {
  const cwd = fixture(t);
  assert.throws(() => initLLMProject({ cwd, type: 'express', authMode: 'host' }), /hostAuthModule|adaptör/);
  assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
});

test('journal rolls back integration paths, credentials and generated files together', t => {
  const cwd = fixture(t);
  const original = fs.readFileSync(path.join(cwd, 'app.js'), 'utf8');
  const journal = createChangeJournal(cwd);
  initLLMProject({ cwd, type: 'express', journal });
  injectIntoEntryFile({ cwd, type: 'express', journal });
  journal.rollback();
  for (const name of ['.env', '.llm-manager.json', 'llm.js']) assert.equal(fs.existsSync(path.join(cwd, name)), false);
  assert.equal(fs.readFileSync(path.join(cwd, 'app.js'), 'utf8'), original);
});

test('unknown Express construction is left untouched instead of inserting an undefined app', t => {
  const source = 'const app = buildApplication();\nmodule.exports = app;\n';
  const cwd = fixture(t, source);
  initLLMProject({ cwd, type: 'express' });
  const result = injectIntoEntryFile({ cwd, type: 'express' });
  assert.equal(result.modified, false);
  assert.match(result.reason, /Express|elle/);
  assert.equal(fs.readFileSync(path.join(cwd, 'app.js'), 'utf8'), source);
});

test('generated Express integration preserves occupied routes and accepts configured Basic credentials', async t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, '.env'), 'LLM_ADMIN_USER=operator\nLLM_ADMIN_PASSWORD=TestPassword123\n');
  initLLMProject({ cwd, type: 'express' });
  const { setupLLM } = require(path.join(cwd, 'llm.js'));
  const app = express();
  app.get('/llm', (_req, res) => res.send('host page'));
  const manager = setupLLM(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await manager.close();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await fetch(base + '/llm')).text(), 'host page');
  assert.equal(manager.pagePath, '/llm1');
  const response = await fetch(base + '/llm1', {
    headers: { Authorization: 'Basic ' + Buffer.from('operator:TestPassword123').toString('base64') }
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /data-api-base="\/api\/llm1"/);
  assert.equal((await fetch(base + '/llm1')).status, 401);
});

test('host mode grants only explicit admin roles and never falls back to Basic auth', async t => {
  const cwd = fixture(t);
  fs.writeFileSync(
    path.join(cwd, 'auth.cjs'),
    `module.exports = function(req, res, next) {
    if (!req.headers['x-test-role']) return res.status(401).end();
    req.user = { id: 1, role: req.headers['x-test-role'] }; next();
  };`
  );
  initLLMProject({
    cwd,
    type: 'express',
    authMode: 'host',
    hostAuthModule: './auth.cjs',
    adminRoles: ['admin', 'owner']
  });
  const { setupLLM } = require(path.join(cwd, 'llm.js'));
  const app = express();
  const manager = setupLLM(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await manager.close();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [role, status] of [
    ['admin', 200],
    ['owner', 200],
    ['user', 403]
  ]) {
    assert.equal((await fetch(base + '/llm', { headers: { 'x-test-role': role } })).status, status);
    assert.equal((await fetch(base + '/api/llm/profiles', { headers: { 'x-test-role': role } })).status, status);
  }
  assert.equal(
    (
      await fetch(base + '/llm', {
        headers: { Authorization: 'Basic ' + Buffer.from('admin:anything').toString('base64') }
      })
    ).status,
    401
  );
});

test('standalone management uses selected paths for legacy and desktop integrations', async t => {
  const instance = await createStandaloneServer({
    port: 0,
    pagePath: '/llm2',
    apiPath: '/api/llm2',
    adminUser: 'operator',
    adminPassword: 'TestPassword123'
  });
  t.after(() => instance.close());
  assert.equal(new URL(instance.url).pathname, '/llm2');
  const base = new URL(instance.url).origin;
  const redirect = await fetch(base, { redirect: 'manual' });
  assert.equal(redirect.headers.get('location'), '/llm2');
  const response = await fetch(instance.url, {
    headers: { Authorization: 'Basic ' + Buffer.from('operator:TestPassword123').toString('base64') }
  });
  assert.equal(response.status, 200);
});

test('async host adapter errors fail closed instead of escaping Express 4', async t => {
  const cwd = fixture(t);
  const { mountLLMIntegration } = await import('../src/integration.js');
  const app = express();
  const manager = mountLLMIntegration(app, {
    cwd,
    authMode: 'host',
    requireAuth: async () => {
      throw new Error('session unavailable');
    }
  });
  app.use((_error, _req, res, _next) => res.status(503).json({ error: 'session unavailable' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await manager.close();
    await new Promise(resolve => server.close(resolve));
  });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/llm`, { signal: AbortSignal.timeout(1500) });
  assert.equal(response.status, 503);
});

test('injection places management after cookie parsing and before host CSRF', t => {
  const cwd = fixture(
    t,
    'const app = express();\napp.use(express.json());\napp.use(cookieParser());\napp.use(csrf);\nmodule.exports = app;\n'
  );
  initLLMProject({ cwd, type: 'express' });
  injectIntoEntryFile({ cwd, type: 'express' });
  const source = fs.readFileSync(path.join(cwd, 'app.js'), 'utf8');
  assert.ok(source.indexOf('setupLLM(app);') > source.indexOf('app.use(cookieParser());'));
  assert.ok(source.indexOf('setupLLM(app);') < source.indexOf('app.use(csrf);'));
});

test('host wizard never starts a separate Basic server or claims live session verification', async t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'auth.cjs'), 'module.exports = (req,res,next) => next();');
  const result = await runInteractiveInit({
    cwd,
    type: 'express',
    authMode: 'host',
    hostAuthModule: './auth.cjs',
    yes: true,
    openBrowser: false,
    logger() {}
  });
  assert.equal(result.ok, true);
  assert.equal(result.probe.ok, false);
  assert.equal(result.probe.skipped, true);
  assert.equal(result.probe.startedServer, false);
});

test('file route frameworks reserve existing pages and create suffixed management handlers', t => {
  for (const [type, existing, expected] of [
    ['nextjs', 'app/llm/page.js', 'app/llm1/[[...slug]]/route.js'],
    ['nuxt', 'pages/llm.vue', 'server/routes/llm1/[...slug].js'],
    ['sveltekit', 'src/routes/llm/+page.svelte', 'src/routes/llm1/[...slug]/+server.js']
  ]) {
    const cwd = fixture(t);
    fs.mkdirSync(path.dirname(path.join(cwd, existing)), { recursive: true });
    fs.writeFileSync(path.join(cwd, existing), 'existing host page');
    const result = initLLMProject({ cwd, type });
    assert.equal(result.pagePath, '/llm1', type);
    assert.ok(result.createdFiles.includes(expected), type);
    assert.equal(fs.readFileSync(path.join(cwd, existing), 'utf8'), 'existing host page');
    assert.equal(initLLMProject({ cwd, type }).pagePath, '/llm1', type);
  }
});

test('Express detection prefers the application over a bootstrap that only imports it', t => {
  const cwd = fixture(t);
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ main: 'server.js', dependencies: { express: '*' } })
  );
  fs.writeFileSync(path.join(cwd, 'server.js'), "const app = require('./app');\napp.listen(3000);\n");
  assert.equal(detectEntryFile(cwd, 'express'), 'app.js');
});

test('direct host-mode probes never create a fallback password server', async t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, '.env'), 'LLM_AUTH_MODE=host\nLLM_ADMIN_PASSWORD=TestPassword123\n');
  const result = await probeAndOpenBrowser({ cwd, port: 0, autoCloseStartedServer: true, openBrowser: false });
  assert.equal(result.skipped, true);
  assert.equal(result.startedServer, false);
  assert.equal(result.ok, false);
});

test('existing encrypted history never causes a missing custom key to be regenerated', async t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, '.env'), 'LLM_ADMIN_PASSWORD=TestPassword123\nLLM_CONFIG_KEY_PATH=data/custom.key\n');
  fs.mkdirSync(path.join(cwd, 'data'));
  fs.writeFileSync(path.join(cwd, 'data/llm-profiles.json.assistant.enc'), 'existing encrypted history');
  const { mountLLMIntegration } = await import('../src/integration.js');
  assert.throws(() => mountLLMIntegration(express(), { cwd }), /anahtar|key/i);
  assert.equal(fs.existsSync(path.join(cwd, 'data/custom.key')), false);
});

test('switching an old helper to host mode requires an explicit migration', t => {
  const cwd = fixture(t);
  fs.writeFileSync(path.join(cwd, 'llm.js'), 'module.exports = { setupLLM() {} };');
  fs.writeFileSync(path.join(cwd, 'auth.cjs'), 'module.exports = (req,res,next) => next();');
  assert.throws(
    () => initLLMProject({ cwd, type: 'express', authMode: 'host', hostAuthModule: './auth.cjs' }),
    /--force|elle/
  );
  assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
});

for (const framework of ['express', 'express5']) {
  test(`${framework} nested router collisions preserve the host page and API`, async t => {
    const cwd = fixture(t);
    const frameworkModule = require(framework);
    const app = frameworkModule();
    const pages = frameworkModule.Router();
    pages.get('/', (_req, res) => res.send('existing page'));
    app.use('/llm', pages);
    const api = frameworkModule.Router();
    api.get('/llm1', (_req, res) => res.json({ host: true }));
    app.use('/api', api);
    const { mountLLMIntegration } = await import('../src/integration.js');
    const manager = mountLLMIntegration(app, { cwd, adminPassword: 'TestPassword123' });
    t.after(() => manager.close());
    assert.equal(manager.pagePath, '/llm2');
    assert.equal(manager.apiPath, '/api/llm2');
  });
}

test('a prefixed Express Router reserves public paths and serves generated links under that prefix', async t => {
  const cwd = fixture(t);
  const app = express();
  const router = express.Router();
  router.get('/stok/llm', (_req, res) => res.send('host page'));
  const { mountLLMIntegration } = await import('../src/integration.js');
  const manager = mountLLMIntegration(router, { cwd, basePath: '/stok', adminPassword: 'TestPassword123' });
  app.use(router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await manager.close();
    await new Promise(resolve => server.close(resolve));
  });
  assert.equal(manager.pagePath, '/stok/llm1');
  const response = await fetch(`http://127.0.0.1:${server.address().port}/stok/llm1`, {
    headers: { Authorization: 'Basic ' + Buffer.from('admin:TestPassword123').toString('base64') }
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /data-api-base="\/stok\/api\/llm1"/);
});
