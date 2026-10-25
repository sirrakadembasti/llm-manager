import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));

for (const [label, dependency, esm] of [
  ['Express 4 ESM', 'express', true],
  ['Express 4 CJS', 'express', false],
  ['Express 5 ESM', 'express5', true]
]) {
  test(`real installed host: ${label}`, { timeout: 90000 }, async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-host-'));
    let child;
    try {
      const packageLink = path.join(cwd, 'node_modules', ...pkg.name.split('/'));
      fs.mkdirSync(path.dirname(packageLink), { recursive: true });
      fs.symlinkSync(root, packageLink, 'junction');
      fs.symlinkSync(
        path.join(root, 'node_modules', dependency),
        path.join(cwd, 'node_modules', 'express'),
        'junction'
      );
      fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: esm ? 'module' : 'commonjs' }));
      const imports = esm
        ? `import express from 'express'; import { mountLLMManagement } from '${pkg.name}';`
        : `const express = require('express'); const { mountLLMManagement } = await import('${pkg.name}');`;
      const source = `${esm ? '' : '(async()=>{'}
${imports}
const app=express();
mountLLMManagement(app,{dataDir:'./data',adminPassword:'host-test-password'});
app.use((_req,res)=>res.sendStatus(404));
const server=app.listen(0,'127.0.0.1',()=>console.log('READY:'+server.address().port));
${esm ? '' : '})().catch(error=>{console.error(error);process.exit(1)});'}`;
      fs.writeFileSync(path.join(cwd, 'host.js'), source);
      child = spawn(process.execPath, ['host.js'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', chunk => (stderr += chunk));
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Host startup timed out: ' + stderr)), 60000);
        const fail = code => {
          clearTimeout(timer);
          reject(new Error(`Host exited ${code}: ${stderr}`));
        };
        child.once('error', reject);
        child.once('exit', fail);
        let stdout = '';
        child.stdout.on('data', chunk => {
          stdout += chunk;
          const match = /READY:(\d+)/.exec(stdout);
          if (match) {
            clearTimeout(timer);
            child.off('exit', fail);
            resolve(Number(match[1]));
          }
        });
      });
      const base = `http://127.0.0.1:${port}`;
      assert.equal((await fetch(base + '/llm')).status, 401);
      const headers = { Authorization: 'Basic ' + Buffer.from('admin:host-test-password').toString('base64') };
      assert.equal((await fetch(base + '/llm', { headers })).status, 200);
      const saved = await fetch(base + '/api/llm/profiles', {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', 'X-LLM-CSRF': '1' },
        body: JSON.stringify({
          name: 'host',
          provider: 'openai',
          baseURL: 'https://api.openai.com/v1',
          model: 'test-model',
          apiKey: 'test-only-key'
        })
      });
      assert.equal(saved.status, 201, await saved.text());
    } finally {
      if (child && child.exitCode === null) {
        const stopped = new Promise(resolve => child.once('exit', resolve));
        child.kill();
        await stopped;
      }
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}
