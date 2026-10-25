import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initLLMProject, injectIntoEntryFile, verifyIntegration } from '../src/init.js';

for (const [type, base, sample] of [
  ['nextjs', '', 'app/actions/llm.js'],
  ['nextjs', 'src/app', 'src/app/actions/llm.js'],
  ['sveltekit', '', 'src/routes/api/ask/+server.js']
]) {
  test(`${type} verification requires nonempty sample ${sample}`, () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g09-verify-'));
    try {
      if (base) fs.mkdirSync(path.join(cwd, base), { recursive: true });
      initLLMProject({ cwd, type });
      const check = () => verifyIntegration({ cwd, type }).checks.find(c => c.id === 'helper_files');
      assert.equal(check().ok, true);
      fs.writeFileSync(path.join(cwd, sample), '  \n');
      assert.equal(check().ok, false);
      assert.match(check().error, new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      fs.unlinkSync(path.join(cwd, sample));
      assert.equal(check().ok, false);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}

test('Next client directives after comments never receive server imports', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g09-client-'));
  try {
    for (const prefix of ['// license\r\n\r\n', '/* license\n * comment */\n// note\n', '\uFEFF /* license */ ']) {
      const content = `${prefix}"use client";\nexport default function Page() { return null; }\n`;
      fs.writeFileSync(path.join(cwd, 'page.jsx'), content);
      const result = injectIntoEntryFile({ cwd, type: 'nextjs', entryFile: 'page.jsx' });
      assert.equal(result.modified, false);
      assert.match(result.reason, /İstemci bileşenine sunucu modülü eklenemez/);
      assert.equal(fs.readFileSync(path.join(cwd, 'page.jsx'), 'utf8'), content);
    }
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Next server-only marker is conditional on installed host package', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g09-marker-'));
  try {
    fs.mkdirSync(path.join(cwd, 'src/app'), { recursive: true });
    initLLMProject({ cwd, type: 'nextjs' });
    assert.ok(!fs.readFileSync(path.join(cwd, 'src/llm.js'), 'utf8').includes("import 'server-only'"));
    fs.mkdirSync(path.join(cwd, 'node_modules/server-only'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'node_modules/server-only/package.json'), '{"name":"server-only"}');
    initLLMProject({ cwd, type: 'nextjs', force: true });
    assert.ok(fs.readFileSync(path.join(cwd, 'src/llm.js'), 'utf8').startsWith("import 'server-only';\n"));
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Svelte ask delegates authorization and preserves request credentials and body', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g09-auth-'));
  try {
    initLLMProject({ cwd, type: 'sveltekit' });
    const source = fs.readFileSync(path.join(cwd, 'src/routes/api/ask/+server.js'), 'utf8');
    const { createLLMManager } = await import('../src/core.js');
    const llm = createLLMManager({ dataDir: path.join(cwd, 'data'), adminPassword: 'test-password' });
    // Execute the generated handler with the real manager, replacing only Svelte's import alias.
    const POST = new Function('llm', source.replace(/^import[^\n]*\n/, '').replace('export const POST =', 'return'))(
      llm
    );
    const response = await POST({
      request: new Request('http://localhost/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      })
    });
    assert.equal(response.status, 401);
    let forwarded;
    const capture = new Function('llm', source.replace(/^import[^\n]*\n/, '').replace('export const POST =', 'return'))(
      {
        fetch: request => {
          forwarded = request;
          return new Response();
        }
      }
    );
    await capture({
      request: new Request('http://localhost/api/ask', {
        method: 'POST',
        headers: { Authorization: 'Bearer host-chat-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' })
      })
    });
    assert.equal(new URL(forwarded.url).pathname, '/api/llm/chat');
    assert.equal(forwarded.headers.get('Authorization'), 'Bearer host-chat-token');
    assert.deepEqual(await forwarded.json(), { prompt: 'hello' });
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('Next sample action fails closed with Turkish authorization instructions', async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'g09-action-'));
  try {
    initLLMProject({ cwd, type: 'nextjs' });
    const source = fs.readFileSync(path.join(cwd, 'app/actions/llm.js'), 'utf8');
    let calls = 0;
    const ask = new Function(
      'askLLM',
      source.replace(/^import[^\n]*\n/m, '').replace('export async function ask', 'async function ask') +
        '\nreturn ask;'
    )(() => {
      calls++;
    });
    await assert.rejects(ask('hello'), /Bu eylemi etkinleştirmeden önce host kullanıcı yetkilendirmesini yapılandırın/);
    assert.equal(calls, 0);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
