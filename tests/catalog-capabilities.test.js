import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROVIDERS, MODEL_FAMILIES, CATALOG_VERSION, CATALOG_UPDATED_AT, modelFamily } from '../src/providers.js';
import { buildProviderRequest } from '../src/runtime.js';

const messages = [{ role: 'user', content: 'Merhaba' }];
const profile = (provider, model) => ({
  provider,
  model,
  baseURL: PROVIDERS.find(p => p.id === provider).baseURL,
  apiKey: 'k'
});

test('K18: model ailesi öneklerle ve sınır karakteriyle (. veya -) eşleşir', () => {
  assert.equal(modelFamily('openai', 'gpt-6').disableThinking, 'none');
  assert.equal(modelFamily('openai', 'gpt-6.1-sol').disableThinking, 'none');
  assert.equal(modelFamily('openai', 'GPT-6-astra').disableThinking, 'none');
  assert.equal(modelFamily('openai', 'gpt-5.1').disableThinking, 'low');
  assert.equal(modelFamily('anthropic', 'claude-sonnet-5-5-20260101').disableThinking, 'between_tools');
  assert.equal(modelFamily('google', 'models/gemini-3.8-flash').thinking, 'level');
  // Önek sınırı: gpt-60, onyx, gemini-30 aileye girmez; başka taşımanın ailesi de uygulanmaz.
  for (const [transport, model] of [
    ['openai', 'gpt-60'],
    ['openai', 'omni-moderation'],
    ['openai', 'llama-3'],
    // Kapanmış veya 1 yılı aşmış modeller kural ailesinden çıkarıldı (2026-11-21).
    ['openai', 'o1'],
    ['openai', 'o3-mini'],
    ['openai', 'o4-mini'],
    ['google', 'gemini-2.5-pro'],
    ['google', 'gemini-2.5-flash-lite'],
    ['google', 'gemini-30'],
    ['anthropic', 'claude-opus-5-50'],
    ['anthropic', 'gpt-6'],
    ['openai', undefined]
  ])
    assert.equal(modelFamily(transport, model), null, `${transport}/${model}`);
});

test('K18: katalogdaki ailelerin yapısı geçerli ve OpenAI uyumlu her sağlayıcı yeteneklerini açıkça tanımlar', () => {
  const transports = new Set(['openai', 'anthropic', 'google']);
  for (const family of MODEL_FAMILIES) {
    assert.ok(transports.has(family.transport), JSON.stringify(family));
    assert.ok(Array.isArray(family.match) && family.match.length > 0, JSON.stringify(family));
    assert.ok(family.match.every(prefix => prefix === prefix.toLowerCase() && !/[\s*]/.test(prefix)));
  }
  const styles = new Set(['reasoning_effort', 'thinking_object', 'enable_thinking']);
  for (const provider of PROVIDERS.filter(item => item.transport === 'openai')) {
    assert.ok(['max_tokens', 'max_completion_tokens'].includes(provider.tokenField), provider.id);
    assert.equal(typeof provider.streamUsage, 'boolean', provider.id);
    assert.ok(styles.has(provider.thinkingStyle), provider.id);
  }
});

test('K18: katalogda olmayan model adı için ek alan gönderilmez', () => {
  const unknown = 'bilinmeyen-model-9';
  const openai = buildProviderRequest(profile('openai', unknown), messages, { thinking: 'disabled' });
  assert.equal('reasoning_effort' in openai.body, false);
  assert.equal(openai.body.temperature, undefined);
  const withSampling = buildProviderRequest(profile('openai', unknown), messages, { temperature: 0.3 });
  assert.equal(withSampling.body.temperature, 0.3);
  const anthropic = buildProviderRequest(profile('anthropic', 'claude-yeni-9-9'), messages, { thinking: 'disabled' });
  assert.equal('thinking' in anthropic.body, false);
  const google = buildProviderRequest(profile('google', 'gemini-yeni-9'), messages, { thinking: 'enabled' });
  assert.equal(google.body.generationConfig.thinkingConfig, undefined);
});

test('K18: taşıma dosyalarında model adı düzenli ifadesi kalmaz', () => {
  for (const file of ['openai', 'anthropic', 'google']) {
    const source = fs.readFileSync(new URL(`../src/transports/${file}.js`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\/\^[^/\n]*(?:gpt|claude|gemini|o\\d)/i, file);
    assert.doesNotMatch(source, /profile\.model\s*\)?\.(?:startsWith|test)|\.test\(profile\.model/, file);
  }
});

test('K18: kapanmış veya 1 yılı aşmış modeller katalogdan çıkarıldı', () => {
  const models = id => PROVIDERS.find(p => p.id === id).models;
  for (const gone of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'])
    assert.ok(!models('groq').includes(gone), gone);
  // Kapanış duyurusu olmayan, Groq'un önerdiği yedekler ve Cohere'in öteki modelleri korunur.
  assert.ok(models('groq').includes('openai/gpt-oss-120b'));
  assert.ok(models('cohere').includes('command-a-plus-05-2026'));
  assert.deepEqual(models('cohere'), ['command-a-plus-05-2026']);
  // Katalog içeriği değişince sürüm ve tarih de güncellenir.
  assert.equal(CATALOG_VERSION, '2026.11');
  assert.equal(CATALOG_UPDATED_AT, '2026-11-21');
});
