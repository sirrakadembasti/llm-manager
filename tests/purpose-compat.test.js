import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createLLMManager } from '../src/core.js';

// Removing alias normalization or its per-alias warning guard breaks this process boundary.
test('legacy purposes preserve MiMo policy and warn once per alias across repeated calls', () => {
  const runtime = new URL('../src/runtime.js', import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { resolveRuntimeOptions } from ${JSON.stringify(runtime)};
    const profile = { provider: 'xiaomi_mimo', thinking: 'auto' };
    for (let i = 0; i < 2; i++) {
      console.log(JSON.stringify(['manager', 'production', 'diagnostic', 'default', 'quick'].map(
        purpose => resolveRuntimeOptions(profile, { purpose }).thinking
      )));
    }
  `
    ],
    { encoding: 'utf8', timeout: 10000 }
  );
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(
    child.stdout
      .trim()
      .split(/\r?\n/)
      .map(line => JSON.parse(line)),
    [
      ['disabled', 'auto', 'disabled', 'auto', 'disabled'],
      ['disabled', 'auto', 'disabled', 'auto', 'disabled']
    ]
  );
  assert.equal((child.stderr.match(/LLM_PURPOSE_DEPRECATED/g) || []).length, 2);
  assert.equal((child.stderr.match(/purpose 'manager' yerine 'diagnostic'/g) || []).length, 1);
  assert.equal((child.stderr.match(/purpose 'production' yerine 'default'/g) || []).length, 1);
});

// Reintroducing domain prompts or forwarding unrecognized body options breaks the adapter contract.
test('custom generators receive neutral diagnostics and only supported options for tests and chat', async () => {
  const profile = { id: 'p', provider: 'xiaomi_mimo', thinking: 'auto' };
  const calls = [];
  const manager = createLLMManager({
    store: { get: async () => profile, getActive: async () => profile, recordTest: async () => profile },
    rateLimit: false,
    retry: false,
    generate: async (messages, options) => {
      calls.push({ messages, options });
      return 'Yanıt';
    }
  });
  for (const mode of ['conversation', 'quick']) {
    assert.equal((await manager.handle({ method: 'POST', path: '/profiles/p/test', body: { mode } })).status, 200);
  }
  assert.deepEqual(calls[0].messages, [
    { role: 'system', content: 'Yardımsever bir asistansın. Kısa ve doğru yanıt ver.' },
    {
      role: 'user',
      content:
        'Bir web uygulamasında kullanıcı kimlik doğrulaması için üç temel güvenlik önlemini maddeler halinde yaz.'
    }
  ]);
  assert.deepEqual(calls[1].messages, [{ role: 'user', content: 'Yalnızca OK yaz.' }]);
  assert.equal(
    (
      await manager.handle({
        method: 'POST',
        path: '/chat',
        body: {
          prompt: 'Merhaba',
          useManagedProfile: true,
          allowMockFallback: true
        }
      })
    ).status,
    200
  );
  assert.deepEqual(
    calls.map(call => call.options.purpose),
    ['diagnostic', 'quick', 'default']
  );
  assert.deepEqual(
    calls.map(call => call.options.thinking),
    ['disabled', 'disabled', 'auto']
  );
  for (const { options } of calls) {
    assert.equal(Object.hasOwn(options, 'useManagedProfile'), false);
    assert.equal(Object.hasOwn(options, 'allowMockFallback'), false);
  }
});
