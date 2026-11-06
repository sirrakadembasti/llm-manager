import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const { runGraphify } = await import('../src/project/graphify.js').catch(() => ({}));

test('reader and Graphify copy share safe Vue expressions while real secrets never reach the subprocess', async t => {
  const { createProjectFiles } = await import('../src/project/files.js');
  const { createProjectWorkspace } = await import('../src/project/workspace.js');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-privacy-project-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const vue = "const newPassword = ref('');\nconst showModalPassword = ref(false);";
  await fs.writeFile(path.join(root, 'Admin.vue'), vue);
  await fs.writeFile(path.join(root, 'private.js'), 'const password="synthetic-private-password-value";');
  await fs.writeFile(path.join(root, '.env'), 'PRIVATE=not-shared');
  await fs.writeFile(path.join(root, 'private.key'), 'PRIVATE');
  const snapshot = await createProjectFiles({ root }).scan();
  assert.deepEqual(
    snapshot.files.map(file => file.path),
    ['Admin.vue']
  );
  const runner = await fixture(
    t,
    `const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2);if(fs.readdirSync(args[1]).join(',')!=='Admin.vue')process.exit(3);if(!fs.readFileSync(path.join(args[1],'Admin.vue'),'utf8').includes("ref('')"))process.exit(4);const out=path.join(args[args.indexOf('--out')+1],'graphify-out');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'graph.json'),'{"nodes":[],"links":[]}');`
  );
  assert.equal((await runGraphify({ files: snapshot.files, ...runner })).status, 'ready');
  await assert.rejects(
    createProjectWorkspace([{ path: 'private.js', content: 'const password="synthetic-private-password-value";' }]),
    { code: 'PROJECT_SECRET_DETECTED' }
  );
});

test('Graphify discovery only accepts absolute host PATH directories and detects later installs', async t => {
  const { findGraphifyCommand } = await import('../src/project/graphify.js');
  assert.equal(typeof findGraphifyCommand, 'function');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-graphify-discovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const env = { PATH: ['.', root].join(path.delimiter) };
  assert.equal(await findGraphifyCommand(env), null);
  const executable = path.join(root, process.platform === 'win32' ? 'graphify.exe' : 'graphify');
  await fs.writeFile(executable, '', { mode: 0o700 });
  assert.equal(await findGraphifyCommand(env), executable);
});

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

test('Graphify accepts results when the temporary directory is reached through a link or short name', async t => {
  // macOS exposes /var through /private/var and Windows runners use 8.3 TEMP
  // names; the workspace must compare real paths in both cases.
  const runner = await fixture(
    t,
    `const fs=require('node:fs'),path=require('node:path'),args=process.argv.slice(2);const out=path.join(args[args.indexOf('--out')+1],'graphify-out');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'graph.json'),'{"nodes":[],"links":[]}');`
  );
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-graphify-linked-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const real = path.join(base, 'real');
  const linked = path.join(base, 'linked');
  await fs.mkdir(real);
  await fs.symlink(real, linked, process.platform === 'win32' ? 'junction' : 'dir');
  const names = ['TMPDIR', 'TEMP', 'TMP'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) process.env[name] = linked;
  try {
    assert.equal(os.tmpdir(), linked);
    const result = await runGraphify({ files: [{ path: 'src/app.js', content: 'export const app = 1;' }], ...runner });
    assert.equal(result.status, 'ready');
  } finally {
    for (const name of names)
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
  }
  assert.deepEqual(await fs.readdir(real), [], 'workspace is disposed through the real path');
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

test('Graphify adapter rejects successful processes without a graph result', async t => {
  const runner = await fixture(t, 'process.exit(0);');
  await assert.rejects(runGraphify({ files: [], ...runner }), { code: 'PROJECT_GRAPH_INVALID' });
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
