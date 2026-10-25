import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectProjectType, detectEntryFile, injectIntoEntryFile, initLLMProject } from '../src/init.js';

test('framework detection rejects unknown and separates unsupported frameworks', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-safe-'));
  try {
    for (const [dependency, type] of [
      ['fastify', 'fastify'],
      ['koa', 'koa'],
      ['hono', 'hono'],
      ['@nestjs/core', 'nestjs'],
      ['@tauri-apps/api', 'tauri'],
      ['unrecognized', 'unknown']
    ]) {
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ dependencies: { [dependency]: '*' } }));
      assert.equal(detectProjectType(cwd), type);
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('generated build outputs and browser components are never injected with server imports', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'inject-safe-'));
  try {
    fs.mkdirSync(path.join(cwd, 'dist'));
    fs.writeFileSync(path.join(cwd, 'dist/index.js'), 'compiled');
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ main: 'dist/index.js', dependencies: { express: '*' } })
    );
    fs.writeFileSync(path.join(cwd, 'server.ts'), 'const app = express();');
    assert.equal(detectEntryFile(cwd, 'express'), 'server.ts');
    for (const [type, file, content] of [
      ['nextjs', 'page.jsx', "'use client';\nexport default function Page() {}"],
      ['nuxt', 'app.vue', '<template>hi</template>'],
      ['sveltekit', 'page.svelte', '<p>hi</p>']
    ]) {
      fs.writeFileSync(path.join(cwd, file), content);
      initLLMProject({ cwd, type });
      assert.equal(injectIntoEntryFile({ cwd, type, entryFile: file }).modified, false);
      assert.equal(fs.readFileSync(path.join(cwd, file), 'utf8'), content);
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('server frameworks use isolated helpers and relative imports', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'server-only-'));
  try {
    for (const [type, helper] of [
      ['nuxt', 'server/utils/llm.js'],
      ['sveltekit', 'src/lib/server/llm.js']
    ]) {
      assert.ok(initLLMProject({ cwd, type }).createdFiles.includes(helper));
    }
    const res = initLLMProject({ cwd, type: 'nextjs' });
    assert.ok(res.createdFiles.includes('app/actions/llm.js'));
    assert.ok(!fs.readFileSync(path.join(cwd, 'app/api/llm/[...slug]/route.js'), 'utf8').includes('@/'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('CommonJS registers synchronously and desktop templates isolate renderer options', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cjs-safe-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    initLLMProject({ cwd, type: 'express' });
    const content = fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8');
    assert.ok(!content.includes('async function setupLLM'));
    assert.ok(content.includes('require('));
    initLLMProject({ cwd, type: 'electron', force: true });
    const desktop = fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8');
    assert.ok(desktop.includes("getPath('userData')"));
    assert.ok(!desktop.includes("'./data'"));
    assert.ok(fs.existsSync(path.join(cwd, 'preload.cjs')));
    assert.ok(desktop.includes('system:'));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('transaction rollback restores generated, forced, env, scripts and empty directory tree', async () => {
  const { runInteractiveInit } = await import('../src/init.js');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'journal-safe-'));
  const snapshot = () =>
    fs
      .readdirSync(cwd, { recursive: true })
      .sort()
      .map(rel => [
        rel,
        fs.statSync(path.join(cwd, rel)).isFile() ? fs.readFileSync(path.join(cwd, rel)).toString('base64') : null
      ]);
  try {
    fs.writeFileSync(
      path.join(cwd, 'package.json'),
      JSON.stringify({ type: 'module', dependencies: { express: '*' } })
    );
    fs.writeFileSync(
      path.join(cwd, 'server.js'),
      "import express from 'express';\nconst app = express();\napp.listen(3000);\n"
    );
    fs.writeFileSync(path.join(cwd, '.env'), '# original\r\nEXISTING=value\r\n');
    fs.writeFileSync(path.join(cwd, 'llm.js'), '// previous helper\n');
    const before = snapshot();
    // -y fails closed on missing host package and rolls back all scaffold changes.
    const res = await runInteractiveInit({ cwd, yes: true, force: true, openBrowser: false, logger: () => {} });
    assert.equal(res.ok, false);
    assert.equal(res.rolledBack, true);
    assert.deepEqual(snapshot(), before);
    const answers = ['e', 'h', 'h']; // detect, decline dependency installation, decline scaffold
    const decline = await runInteractiveInit({
      cwd,
      type: 'nextjs',
      force: true,
      askQuestion: () => answers.shift(),
      logger: () => {}
    });
    assert.equal(decline.rolledBack, true);
    assert.deepEqual(snapshot(), before);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('legacy csproj gets compatible JSON helper and journal restores compile registration', async () => {
  const { createChangeJournal } = await import('../src/init.js');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'netfx-safe-'));
  try {
    const xml =
      '<Project><PropertyGroup><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup><ItemGroup><Compile Include="Program.cs" /></ItemGroup></Project>';
    fs.writeFileSync(path.join(cwd, 'App.csproj'), xml);
    const journal = createChangeJournal(cwd);
    const res = initLLMProject({ cwd, type: 'dotnet', journal });
    assert.equal(res.targetFramework, 'v4.8');
    assert.ok(fs.readFileSync(path.join(cwd, 'App.csproj'), 'utf8').includes('Compile Include="LlmClient.cs"'));
    const content = fs.readFileSync(path.join(cwd, 'LlmClient.cs'), 'utf8');
    assert.ok(!/using var|System.Text.Json/.test(content));
    assert.ok(content.includes('CancellationToken'));
    journal.rollback();
    assert.equal(fs.readFileSync(path.join(cwd, 'App.csproj'), 'utf8'), xml);
    assert.deepEqual(fs.readdirSync(cwd), ['App.csproj']);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('manual frameworks preserve host file and Tauri produces only HTTP integration', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-safe-'));
  try {
    const content = '// Fastify host';
    fs.writeFileSync(path.join(cwd, 'server.js'), content);
    for (const type of ['fastify', 'koa', 'hono', 'nestjs']) {
      initLLMProject({ cwd, type });
      assert.equal(injectIntoEntryFile({ cwd, type, entryFile: 'server.js' }).modified, false);
    }
    initLLMProject({ cwd, type: 'tauri', force: true });
    assert.ok(!fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8').includes('ipcMain'));
    assert.equal(fs.readFileSync(path.join(cwd, 'server.js'), 'utf8'), content);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('generated CommonJS mounts before host 404 and serves authenticated HTTP synchronously', async () => {
  const { execFileSync } = await import('node:child_process');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cjs-host-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    const name = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).name;
    const target = path.join(cwd, 'node_modules', ...name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.resolve('.'), target, 'junction');
    initLLMProject({ cwd, type: 'express' });
    fs.writeFileSync(
      path.join(cwd, 'check.cjs'),
      `
const assert=require('node:assert/strict');
const express=require(${JSON.stringify(path.resolve('node_modules/express'))});
const { setupLLM }=require('./llm.js');
const app=express();
const manager=setupLLM(app,{adminPassword:'test-password'});
assert.equal(typeof manager.then,'undefined');
app.use((_req,res)=>res.status(404).end());
const server=app.listen(0,'127.0.0.1',async()=>{
 try {
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/llm',{headers:{Authorization:'Basic '+Buffer.from('admin:test-password').toString('base64')}});
  assert.equal(response.status,200);console.log('CJS_SYNC_HTTP_OK');
 } catch(error){console.error(error);process.exitCode=1;} finally{server.close();}
});
`
    );
    assert.match(
      execFileSync(process.execPath, ['check.cjs'], { cwd, encoding: 'utf8', timeout: 30000 }),
      /CJS_SYNC_HTTP_OK/
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('generated CommonJS loads its ESM graph and throws setup errors synchronously', async () => {
  const { execFileSync } = await import('node:child_process');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cjs-startup-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{}');
    const name = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).name;
    const target = path.join(cwd, 'node_modules', ...name.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.symlinkSync(path.resolve('.'), target, 'junction');
    initLLMProject({ cwd, type: 'express' });
    // A fresh CJS process must synchronously load the complete transitive ESM graph.
    // Adding top-level await anywhere in that graph makes require() fail here.
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
const assert = require('node:assert/strict');
const express = require(${JSON.stringify(path.resolve('node_modules/express'))});
const { setupLLM, askLLM } = require('./llm.js');
assert.equal(typeof setupLLM, 'function');
assert.equal(typeof askLLM, 'function');
const app = express();
assert.throws(
  () => setupLLM(app, { adminPassword: 'test-password', apiPath: 'invalid' }),
  { message: 'Geçersiz eklenti mount yolu.' }
);
// A failed startup must leave the host able to retry with valid configuration.
const manager = setupLLM(app, { adminPassword: 'test-password' });
assert.equal(typeof manager.then, 'undefined');
assert.equal(typeof manager.ask, 'function');
console.log('CJS_STARTUP_OK');
`
      ],
      { cwd, encoding: 'utf8', timeout: 30000 }
    );
    assert.match(output, /CJS_STARTUP_OK/);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Next config accepts automatic confirmation and rolls back exact content', async () => {
  const { configureNext } = await import('../src/init/next-config.js');
  const { createChangeJournal } = await import('../src/init/journal.js');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'next-config-'));
  try {
    const file = path.join(cwd, 'next.config.mjs');
    const original = 'export default { reactStrictMode: true };\n';
    fs.writeFileSync(file, original);
    const journal = createChangeJournal(cwd);
    await configureNext({
      cwd,
      journal,
      yes: true,
      logger: () => {},
      packageName: '@sirrakadembasti/llm-manager',
      promptUser: () => 'e'
    });
    assert.ok(fs.readFileSync(file, 'utf8').includes('serverExternalPackages'));
    journal.rollback();
    assert.equal(fs.readFileSync(file, 'utf8'), original);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
