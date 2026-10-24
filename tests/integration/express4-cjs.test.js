import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const moduleUrl = pathToFileURL(path.join(rootDir, 'src/index.js')).href;

function createTempDir(prefix = 'llm-cjs-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('YH1-F2: Express CJS host application can dynamically import and mount llm-manager', async () => {
  const tempDir = createTempDir();
  const cjsScriptPath = path.join(tempDir, 'app.cjs');
  const packageJsonPath = path.join(tempDir, 'package.json');

  fs.writeFileSync(packageJsonPath, JSON.stringify({ name: 'test-cjs-app', type: 'commonjs' }));

  // Create a CJS script that uses dynamic import to load llm-manager and mount it on Express
  const cjsScript = `
const express = require('express');
const http = require('http');

async function main() {
  const { mountLLMManagement } = await import('${moduleUrl}');
  const app = express();
  app.use(express.json());

  mountLLMManagement(app, {
    adminPassword: 'super-secret-password-1234',
    dataDir: '${tempDir.replace(/\\/g, '/')}',
    allowLocalHttp: true
  });

  const server = http.createServer(app);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    process.stdout.write('READY:' + port + '\\n');
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
`;
  fs.writeFileSync(cjsScriptPath, cjsScript);

  const proc = spawn('node', [cjsScriptPath], {
    cwd: tempDir,
    env: { ...process.env, NODE_PATH: path.join(rootDir, 'node_modules') },
    stdio: ['ignore', 'pipe', 'inherit']
  });

  let port = null;
  const exitPromise = new Promise((_, reject) => {
    proc.on('exit', code => {
      if (code !== 0 && code !== null) reject(new Error(`CJS process exited with code ${code}`));
    });
  });

  const readyPromise = new Promise((resolve, reject) => {
    let output = '';
    proc.stdout.on('data', data => {
      output += data.toString();
      const match = /READY:(\d+)/.exec(output);
      if (match) {
        port = Number(match[1]);
        resolve(port);
      }
    });
    proc.on('error', reject);
  });

  try {
    await Promise.race([readyPromise, exitPromise]);
    assert.ok(port > 0);

    const baseUrl = `http://127.0.0.1:${port}`;
    const authHeader = 'Basic ' + Buffer.from('admin:super-secret-password-1234').toString('base64');

    // Test GET /llm
    const res = await fetch(`${baseUrl}/llm`, {
      headers: { Authorization: authHeader }
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('LLM'));

    // Test GET /api/llm/profiles
    const profRes = await fetch(`${baseUrl}/api/llm/profiles`, {
      headers: { Authorization: authHeader }
    });
    assert.equal(profRes.status, 200);
    const profiles = await profRes.json();
    assert.ok(Array.isArray(profiles.profiles));
  } finally {
    proc.kill();
  }
});
