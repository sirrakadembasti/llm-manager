// Next.js / Nuxt / SvelteKit yönetimi kendi rotalarında sunar: sihirbaz ayrı Express sunucusu açmamalı.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { runInteractiveInit, initLLMProject, verifyIntegration } from '../src/init.js';
import { probeCompiledHost, probeAndOpenBrowser } from '../src/init/probe.js';

const packageName = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;

function nextFixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-next-probe-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ private: true, dependencies: { next: '^16.0.0', react: '^19.0.0' } })
  );
  fs.mkdirSync(path.join(cwd, 'app'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'app', 'page.tsx'), 'export default function Page() { return null; }\n');
  const target = path.join(cwd, 'node_modules', ...packageName.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(path.resolve('.'), target, 'junction');
  return cwd;
}

async function closedPort() {
  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function runWizard(cwd, hostPort) {
  const logs = [];
  const opened = [];
  const result = await runInteractiveInit({
    cwd,
    type: 'nextjs',
    password: 'next-probe-password',
    hostPort,
    autoCloseServer: true,
    installRunner() {
      assert.fail('Next.js kurulumunda paket kurulumu istenmemeli');
    },
    askQuestion: async () => 'e',
    logger: message => logs.push(String(message)),
    browserOpener: url => {
      opened.push(url);
    }
  });
  t_cleanup(result);
  return { result, logs, opened };
}
function t_cleanup(result) {
  if (result?.probe?.server) result.probe.server.close();
}

test('Next.js sihirbazı ayrı yönetim sunucusu açmaz; yönetimi süreç içinde doğrular ve uygulamayı başlatmayı söyler', async t => {
  const cwd = nextFixture(t);
  const hostPort = await closedPort();
  const { result, logs, opened } = await runWizard(cwd, hostPort);
  assert.equal(result.ok, true, logs.join('\n'));
  assert.equal(result.probe.startedServer, false);
  assert.equal(result.probe.server, undefined);
  assert.equal(result.probe.inProcess, true);
  assert.equal(result.probe.hostVerified, false);
  assert.deepEqual(opened, []);
  const text = logs.join('\n');
  assert.match(text, /npm run dev/);
  assert.ok(text.includes(`http://localhost:${hostPort}/llm`), text);
  assert.doesNotMatch(text, /açık bırakıldı|8010/);
  assert.equal(
    result.verification.checks.some(check => check.id === 'standalone_express'),
    false,
    'Next.js için Express önkoşulu aranmamalı'
  );
});

test('Next.js uygulaması çalışıyorsa sihirbaz yönetim sayfasını orada doğrular ve tarayıcıyı oraya açar', async t => {
  const cwd = nextFixture(t);
  const host = http.createServer((req, res) => {
    if (req.url === '/llm' && req.headers.authorization) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<main data-api-base="/api/llm"></main>');
    }
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="LLM Yonetimi"' });
    res.end();
  });
  host.listen(0, '127.0.0.1');
  await once(host, 'listening');
  t.after(() => host.close());
  const hostPort = host.address().port;
  const { result, opened } = await runWizard(cwd, hostPort);
  assert.equal(result.ok, true);
  assert.equal(result.probe.startedServer, false);
  assert.equal(result.probe.hostVerified, true);
  assert.deepEqual(opened, [`http://localhost:${hostPort}/llm`]);
});

test('sır dosyası kontrolü .env* ve /data/ gibi kapsayan .gitignore kurallarını kabul eder', t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-verify-gitignore-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: 'module', dependencies: { express: '*' } }));
  fs.writeFileSync(path.join(cwd, 'server.js'), "import express from 'express';\nconst app = express();\n");
  fs.writeFileSync(path.join(cwd, '.gitignore'), '/data/\n.env*\n!.env.example\n*.key\n');
  initLLMProject({ cwd, type: 'express', password: 'test-password-123' });
  assert.equal(fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8'), '/data/\n.env*\n!.env.example\n*.key\n');
  const check = verifyIntegration({ cwd, type: 'express' }).checks.find(item => item.id === 'secrets_ignored');
  assert.equal(check.ok, true);
});

async function foreignServer(t, handler) {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push(req.headers.authorization);
    handler(req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return { seen, port: server.address().port };
}

test('sihirbaz probu yönetici parolasını LLM Yonetimi kimlik doğrulaması sunmayan sürece göndermez', async t => {
  for (const handler of [
    (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<main data-api-base="/api/llm"></main>');
    },
    (req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Baska Uygulama"' });
      res.end();
    }
  ]) {
    const { seen, port } = await foreignServer(t, handler);
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-probe-foreign-'));
    t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
    const compiled = await probeCompiledHost({
      cwd,
      type: 'nextjs',
      hostPort: port,
      password: 'gizli-parola-123',
      openBrowser: false
    });
    assert.equal(compiled.hostVerified, false);
    const standalone = await probeAndOpenBrowser({
      cwd,
      port,
      password: 'gizli-parola-123',
      startServerIfNeeded: false,
      openBrowser: false
    });
    assert.equal(standalone.ok, false);
    assert.deepEqual(seen.filter(Boolean), []);
  }
});
