import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProviderUrl, PROVIDERS } from '../src/providers.js';
import { providerFetch } from '../src/providerTransport.js';
import { LLMError, ErrorCodes } from '../src/errors.js';

test('YH1-C8: Proxy restricts outbound requests to known providers or explicit allowedHosts', async () => {
  // 1. Attempting unknown host through proxy throws LLM_DNS_BLOCKED
  await assert.rejects(
    async () => {
      await providerFetch('https://unauthorized-internal.corp/v1/chat', {
        proxyUrl: 'http://127.0.0.1:8888',
        allowedHosts: []
      });
    },
    err => {
      assert.ok(err instanceof LLMError);
      assert.equal(err.code, ErrorCodes.LLM_DNS_BLOCKED);
      assert.match(err.message, /Proxy üzerinden yalnızca bilinen/);
      return true;
    }
  );

  // 2. Known provider (api.openai.com) passes the proxy whitelist check
  // (Fails at connection since proxy 127.0.0.1:59999 has no listener, but MUST NOT throw LLM_DNS_BLOCKED)
  try {
    await providerFetch('https://api.openai.com/v1/models', {
      proxyUrl: 'http://127.0.0.1:59999',
      signal: AbortSignal.timeout(50)
    });
  } catch (err) {
    assert.notEqual(err.code, ErrorCodes.LLM_DNS_BLOCKED, 'Known provider must pass proxy SSRF check');
  }

  // 3. Explicit allowedHosts passes proxy whitelist check
  try {
    await providerFetch('https://custom-gateway.enterprise.com/v1/models', {
      proxyUrl: 'http://127.0.0.1:59999',
      allowedHosts: ['custom-gateway.enterprise.com'],
      signal: AbortSignal.timeout(50)
    });
  } catch (err) {
    assert.notEqual(err.code, ErrorCodes.LLM_DNS_BLOCKED, 'Explicit allowedHosts must pass proxy check');
  }
});

test('YH1-C9: validateProviderUrl allows private IPs and LAN hosts only when listed in allowedPrivateHosts', () => {
  // 1. Unlisted private IP throws error without allowLocalHttp or allowedPrivateHosts
  assert.throws(
    () => validateProviderUrl('http://192.168.1.50:11434/v1'),
    /Yerel API adresi kapalıdır|IP adresine doğrudan bağlantı kapalıdır/
  );

  // 2. Unlisted LAN hostname throws error
  assert.throws(() => validateProviderUrl('http://ollama.local:11434/v1'), /Yerel API adresi kapalıdır/);

  // 3. Listed host in allowedPrivateHosts is accepted with HTTP and numeric IP
  const url1 = validateProviderUrl('http://192.168.1.50:11434/v1', {
    allowedPrivateHosts: ['192.168.1.50:11434']
  });
  assert.equal(url1, 'http://192.168.1.50:11434/v1');

  // 4. Listed hostname in allowedPrivateHosts is accepted
  const url2 = validateProviderUrl('http://ollama.lan:11434/v1', {
    allowedPrivateHosts: ['ollama.lan']
  });
  assert.equal(url2, 'http://ollama.lan:11434/v1');
});

test('YH1-C9: Ollama catalog entry exists with default models and LAN note', () => {
  const ollama = PROVIDERS.find(p => p.id === 'ollama');
  assert.ok(ollama, 'Ollama provider must exist in catalog');
  assert.equal(ollama.baseURL, 'http://localhost:11434/v1');
  assert.equal(ollama.transport, 'openai');
  assert.ok(Array.isArray(ollama.models));
  assert.ok(ollama.models.includes('llama3.2'));
  assert.ok(ollama.models.includes('deepseek-r1'));
  assert.ok(ollama.note, 'Ollama should have a configuration note');
});
