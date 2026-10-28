import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const { runGraphify } = await import('../src/project/graphify.js').catch(() => ({}));

async function fixture(t, body) {
  assert.equal(typeof runGraphify, 'function');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-graphify-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const script = path.join(root, 'graphify-runner.cjs');
  await fs.writeFile(script, body);
  return { command: process.execPath, args: [script] };
}

test('Graphify adapter invokes code-only extraction on a clean copy with isolated credentials', async t => {
  const runner = await fixture(
    t,
    `
    const fs = require('node:fs'), path = require('node:path');
    const args = process.argv.slice(2);
    if (args[0] !== 'extract' || !args.includes('--code-only')) process.exit(2);
    if (Object.keys(process.env).some(k => k.startsWith('LLM_'))) process.exit(3);
    if (fs.readFileSync(path.join(args[1], 'src/app.js'), 'utf8') !== 'export const app = 1;') process.exit(4);
    const out = path.join(args[args.indexOf('--out') + 1], 'graphify-out');
    fs.mkdirSync(out, {recursive:true});
    fs.writeFileSync(path.join(out, 'graph.json'), JSON.stringify({nodes:[{id:'app',label:'app',source_file:'src/app.js',source_location:'L1'}],links:[]}));
  `
  );
  const result = await runGraphify({ files: [{ path: 'src/app.js', content: 'export const app = 1;' }], ...runner });
  assert.equal(result.status, 'ready');
  assert.equal(result.nodes[0].path, 'src/app.js');
  assert.equal(result.nodes[0].line, 1);
});

test('Graphify adapter rejects graph references outside the source inventory', async t => {
  const runner = await fixture(
    t,
    `
    const fs = require('node:fs'), path = require('node:path'), args=process.argv.slice(2);
    const out=path.join(args[args.indexOf('--out')+1],'graphify-out');fs.mkdirSync(out,{recursive:true});
    fs.writeFileSync(path.join(out,'graph.json'),JSON.stringify({nodes:[{id:'x',source_file:'../private.js',source_location:'L1'}],links:[]}));
  `
  );
  await assert.rejects(runGraphify({ files: [{ path: 'src/app.js', content: 'export const app = 1;' }], ...runner }), {
    code: 'PROJECT_GRAPH_INVALID'
  });
});

test('Graphify adapter bounds a hung process and distinguishes missing executable', async t => {
  const runner = await fixture(t, 'setInterval(() => {}, 1000);');
  await assert.rejects(runGraphify({ files: [], ...runner, timeoutMs: 100 }), { code: 'PROJECT_TOOL_TIMEOUT' });
  const unavailable = await runGraphify({ files: [], command: 'llm-manager-nonexistent-graphify-command' });
  assert.equal(unavailable.status, 'unavailable');
});

test('Graphify cancellation closes the child process without changing the supplied sources', async t => {
  const runner = await fixture(t, 'setInterval(() => {}, 1000);');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  t.after(() => clearTimeout(timer));
  const files = [{ path: 'src/app.js', content: 'export const app = 1;' }];
  await assert.rejects(runGraphify({ files, ...runner, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(files[0].content, 'export const app = 1;');
});
