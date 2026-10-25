import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runInteractiveInit, verifyIntegration } from '../src/init.js';
const PKG = '@sirrakadembasti/llm-manager';
function fixture(t) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g20-host-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"type":"module","version":"2.0.0"}');
  return cwd;
}
for (const type of ['spa', 'tauri']) {
  test(`${type} Node host verifies physical manager installation`, t => {
    const cwd = fixture(t);
    assert.equal(verifyIntegration({ cwd, type }).checks.find(c => c.id === 'package_installed')?.ok, false);
  });
}
test('install prompt pins version and successful command is rechecked before scaffold', async t => {
  const cwd = fixture(t);
  const prompts = [];
  const calls = [];
  await assert.rejects(
    runInteractiveInit({
      cwd,
      type: 'spa',
      allowedOrigins: 'http://localhost:3000',
      logger() {},
      askQuestion(prompt) {
        prompts.push(prompt);
        return 'e';
      },
      installRunner(command, args, options) {
        calls.push({ command, args, options });
      }
    }),
    /kurulum.*doğrulanamadı/i
  );
  assert.match(
    prompts.find(p => p.includes('Paket projeye')),
    /npm install github:sirrakadembasti\/llm-manager#v2\.0\.0/
  );
  assert.equal(calls[0].command, 'npm');
  assert.deepEqual(calls[0].args, ['install', 'github:sirrakadembasti/llm-manager#v2.0.0']);
  assert.equal(calls[0].options.cwd, cwd);
  assert.equal(calls[0].options.stdio, 'inherit');
  assert.equal(calls[0].options.shell, process.platform === 'win32');
  assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
});
test('declined missing manager install fails verification without network', async t => {
  const cwd = fixture(t);
  const result = await runInteractiveInit({
    cwd,
    type: 'spa',
    allowedOrigins: 'http://localhost:3000',
    logger() {},
    openBrowser: false,
    askQuestion: prompt => (prompt.includes('Paket projeye') ? 'h' : 'e'),
    installRunner() {
      assert.fail('declined installation must not execute');
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.verification.checks.find(c => c.id === 'package_installed').ok, false);
});
test('standalone loader diagnoses missing Express and uses physical host server over cache', async t => {
  const cwd = fixture(t);
  const cache = fixture(t);
  fs.cpSync(new URL('../src', import.meta.url), path.join(cache, 'src'), { recursive: true });
  fs.copyFileSync(new URL('../package.json', import.meta.url), path.join(cache, 'package.json'));
  const { loadStandaloneServer } = await import(
    new URL(`file:///${path.join(cache, 'src/init/standalone.js').replaceAll('\\', '/')}`)
  );
  await assert.rejects(loadStandaloneServer(cwd), /Express.*npm install express@\^4\.19\.2/i);
  const hostPackage = path.join(cwd, 'node_modules', PKG);
  fs.mkdirSync(path.join(hostPackage, 'src'), { recursive: true });
  fs.writeFileSync(path.join(hostPackage, 'package.json'), '{"type":"module","version":"2.0.0"}');
  fs.writeFileSync(path.join(hostPackage, 'src/server.js'), 'export const createStandaloneServer = () => "host";');
  const express = path.join(cwd, 'node_modules/express');
  fs.mkdirSync(express);
  fs.writeFileSync(path.join(express, 'package.json'), '{"name":"express","version":"3.0.0","main":"index.js"}');
  fs.writeFileSync(path.join(express, 'index.js'), 'module.exports = {};');
  await assert.rejects(loadStandaloneServer(cwd), /Express/);
  fs.writeFileSync(path.join(express, 'package.json'), '{"name":"express","version":"4.19.2","main":"index.js"}');
  assert.equal((await loadStandaloneServer(cwd)).createStandaloneServer(), 'host');
});

test('clean copied cache imports core without Express and confirmed host installs enable real probe', async t => {
  const cwd = fixture(t);
  const cache = fixture(t);
  for (const name of ['src', 'public'])
    fs.cpSync(new URL('../' + name, import.meta.url), path.join(cache, name), { recursive: true });
  fs.copyFileSync(new URL('../package.json', import.meta.url), path.join(cache, 'package.json'));
  const linkDependency = (base, name) => {
    fs.mkdirSync(path.join(base, 'node_modules'), { recursive: true });
    fs.symlinkSync(
      path.resolve('node_modules', name),
      path.join(base, 'node_modules', name),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
  };
  linkDependency(cache, 'undici');
  const { pathToFileURL } = await import('node:url');
  await import(pathToFileURL(path.join(cache, 'src/core.js')).href);
  const { loadStandaloneServer } = await import(pathToFileURL(path.join(cache, 'src/init/standalone.js')).href);
  await assert.rejects(loadStandaloneServer(cwd), /Express/);
  const { runInteractiveInit: runCopied } = await import(pathToFileURL(path.join(cache, 'src/init.js')).href);
  const installs = [];
  const result = await runCopied({
    cwd,
    type: 'spa',
    port: 0,
    password: 'g20-test-password',
    allowedOrigins: 'http://localhost:3000',
    openBrowser: false,
    autoCloseServer: true,
    logger() {},
    askQuestion: () => 'e',
    installRunner(command, args) {
      installs.push(args[1]);
      if (args[1].startsWith('github:')) {
        const target = path.join(cwd, 'node_modules', PKG);
        fs.mkdirSync(target, { recursive: true });
        for (const name of ['src', 'public'])
          fs.cpSync(path.join(cache, name), path.join(target, name), { recursive: true });
        fs.copyFileSync(path.join(cache, 'package.json'), path.join(target, 'package.json'));
        linkDependency(cwd, 'undici');
      } else linkDependency(cwd, 'express');
    }
  });
  assert.deepEqual(installs, ['github:sirrakadembasti/llm-manager#v2.0.0', 'express@^4.19.2']);
  assert.equal(result.ok, true);
  assert.equal(result.probe.startedServer, true);
  assert.equal(result.verification.checks.find(c => c.id === 'standalone_express').ok, true);
  // The cache still has no Express: successful probe came from the installed host copy.
  assert.equal(fs.existsSync(path.join(cache, 'node_modules/express')), false);
  await assert.rejects(loadStandaloneServer(cache), /Express/);
});

test('package-less static SPA remains HTTP-only without starting a management server', async t => {
  const cwd = fixture(t);
  fs.unlinkSync(path.join(cwd, 'package.json'));
  const messages = [];
  const result = await runInteractiveInit({
    cwd,
    type: 'spa',
    yes: true,
    port: 0,
    openBrowser: false,
    autoCloseServer: true,
    logger: line => messages.push(line),
    installRunner() {
      assert.fail('Static HTTP client must not install Node dependencies');
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.probe.startedServer, false);
  assert.equal(
    result.verification.checks.some(c => c.id === 'package_installed'),
    false
  );
  assert.match(messages.join('\n'), /HTTP istemcisi/);
});

test('Express installer success is rechecked before writing scaffold files', async t => {
  const cwd = fixture(t);
  const installed = path.join(cwd, 'node_modules', PKG);
  fs.mkdirSync(installed, { recursive: true });
  fs.writeFileSync(path.join(installed, 'package.json'), '{}');
  const specs = [];
  await assert.rejects(
    runInteractiveInit({
      cwd,
      type: 'spa',
      logger() {},
      askQuestion: () => 'e',
      installRunner(command, args) {
        specs.push(args[1]);
      }
    }),
    /Express kurulumu doğrulanamadı/
  );
  assert.deepEqual(specs, ['express@^4.19.2']);
  assert.equal(fs.existsSync(path.join(cwd, '.env')), false);
});
