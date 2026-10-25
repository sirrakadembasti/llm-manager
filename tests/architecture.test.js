import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStandaloneServer } from '../src/server.js';
import * as indexExports from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../src');

test('YH1-A1: src/core.js and dependencies do not import express and src/index.js does not statically import init.js', () => {
  const indexContent = fs.readFileSync(path.join(srcDir, 'index.js'), 'utf8');
  assert.equal(
    /^\s*import\b.*from\s*['"]\.\/init\.js['"]/m.test(indexContent),
    false,
    'src/index.js must not statically import init.js'
  );

  const coreContent = fs.readFileSync(path.join(srcDir, 'core.js'), 'utf8');
  assert.equal(
    coreContent.includes("from 'express'") || coreContent.includes('from "express"'),
    false,
    'src/core.js must not import express'
  );

  const runtimeContent = fs.readFileSync(path.join(srcDir, 'runtime.js'), 'utf8');
  assert.equal(
    runtimeContent.includes("from 'express'") || runtimeContent.includes('from "express"'),
    false,
    'src/runtime.js must not import express'
  );

  const storeContent = fs.readFileSync(path.join(srcDir, 'profileStore.js'), 'utf8');
  assert.equal(
    storeContent.includes("from 'express'") || storeContent.includes('from "express"'),
    false,
    'src/profileStore.js must not import express'
  );

  const transportContent = fs.readFileSync(path.join(srcDir, 'providerTransport.js'), 'utf8');
  assert.equal(
    transportContent.includes("from 'express'") || transportContent.includes('from "express"'),
    false,
    'src/providerTransport.js must not import express'
  );
});

test('YH1-A1: deprecated lazy wrappers in src/index.js export async functions', async () => {
  assert.equal(typeof indexExports.runInteractiveInit, 'function');
  assert.equal(typeof indexExports.probeAndOpenBrowser, 'function');
  assert.equal(typeof indexExports.initLLMProject, 'function');
  assert.equal(typeof indexExports.verifyIntegration, 'function');
  assert.equal(typeof indexExports.injectIntoEntryFile, 'function');
});

test('YH1-A2: createStandaloneServer starts, responds, handles CORS and validates non-local host password', async () => {
  // 1. Rejects non-local host with password < 12 chars
  await assert.rejects(
    () => createStandaloneServer({ host: '0.0.0.0', adminPassword: 'short' }),
    /Ağa açık sunucu için en az 12 karakterlik parola gerekir/
  );

  // 2. Starts on localhost:0 with allowedOrigins: ['*']
  const serverInstance = await createStandaloneServer({
    host: '127.0.0.1',
    port: 0,
    adminPassword: 'test-admin-password-123',
    allowedOrigins: '*'
  });

  try {
    assert.ok(serverInstance.url.startsWith('http://127.0.0.1:'));
    assert.ok(serverInstance.port > 0);

    // GET /llm redirect or page with Basic Auth
    const pageRes = await fetch(serverInstance.url, {
      headers: {
        Authorization: 'Basic ' + Buffer.from('admin:test-admin-password-123').toString('base64')
      }
    });
    assert.equal(pageRes.status, 200);

    // CORS on /api/llm/chat with '*' allows Origin: * and NO Allow-Credentials
    const chatOptionsRes = await fetch(`http://127.0.0.1:${serverInstance.port}/api/llm/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://any-site.example.com'
      }
    });
    assert.equal(chatOptionsRes.status, 204);
    assert.equal(chatOptionsRes.headers.get('access-control-allow-origin'), '*');
    assert.equal(chatOptionsRes.headers.get('access-control-allow-credentials'), null);

    // CORS on /api/llm/profiles with '*' does NOT allow cross-origin
    const profilesOptionsRes = await fetch(`http://127.0.0.1:${serverInstance.port}/api/llm/profiles`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://any-site.example.com'
      }
    });
    assert.equal(profilesOptionsRes.headers.get('access-control-allow-origin'), null);
  } finally {
    await serverInstance.close();
  }

  // 3. Explicit allowedOrigins supports credentials
  const explicitOriginServer = await createStandaloneServer({
    host: '127.0.0.1',
    port: 0,
    adminPassword: 'test-admin-password-123',
    allowedOrigins: ['http://localhost:5173']
  });

  try {
    const res = await fetch(`http://127.0.0.1:${explicitOriginServer.port}/api/llm/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173'
      }
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  } finally {
    await explicitOriginServer.close();
  }
});

test('core subpath loads with optional Express, dotenv and wizard imports blocked', async () => {
  const os = await import('node:os');
  const { execFileSync } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'core-isolation-'));
  try {
    const loader = path.join(cwd, 'block-optional.mjs');
    fs.writeFileSync(
      loader,
      `export async function resolve(specifier, context, nextResolve) {
      if (specifier === 'express' || specifier === 'dotenv' || specifier === 'node:child_process' || /(?:^|\\/)init(?:\\/|\\.js$)/.test(specifier)) throw new Error('Optional dependency loaded: '+specifier);
      return nextResolve(specifier,context);
    }`
    );
    const output = execFileSync(
      process.execPath,
      [
        '--no-warnings',
        '--experimental-loader',
        pathToFileURL(loader).href,
        '--input-type=module',
        '-e',
        "const core=await import('@sirrakadembasti/llm-manager/core'); console.log(typeof core.createLLMManager)"
      ],
      { cwd: path.dirname(srcDir), encoding: 'utf8' }
    );
    assert.equal(output.trim(), 'function');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
