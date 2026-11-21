import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderRequest } from '../src/runtime.js';
import { PROVIDERS } from '../src/providers.js';

test('YH1-C7: OpenAI reasoning models map thinking to reasoning_effort', () => {
  const messages = [{ role: 'user', content: 'Solve this riddle' }];

  // 1. gpt-5.x reasoning model enabled -> medium
  const p1 = {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-5.6-sol',
    apiKey: 'sk-test'
  };
  const req1 = buildProviderRequest(p1, messages, { thinking: 'enabled' });
  assert.equal(req1.body.reasoning_effort, 'medium');

  // 2. gpt-5.x reasoning model disabled -> low (kapanmış o-serisi artık aileye girmez)
  const req2 = buildProviderRequest(p1, messages, { thinking: 'disabled' });
  assert.equal(req2.body.reasoning_effort, 'low');
  const legacy = buildProviderRequest({ ...p1, model: 'o3-mini' }, messages, { thinking: 'disabled' });
  assert.equal(legacy.body.reasoning_effort, undefined);

  // 3. Non-reasoning model enabled -> medium
  const p3 = {
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    apiKey: 'sk-test'
  };
  const req3 = buildProviderRequest(p3, messages, { thinking: 'enabled' });
  assert.equal(req3.body.reasoning_effort, 'medium');

  // 4. Non-reasoning model disabled -> omitted
  const req4 = buildProviderRequest(p3, messages, { thinking: 'disabled' });
  assert.equal(req4.body.reasoning_effort, undefined);
});

test('YH1-C7: Anthropic düşünme alanını yalnız katalogdaki 5.x ailelerine gönderir; eski modellerde alan yok, örnekleme korunur', () => {
  const messages = [{ role: 'user', content: 'Explain quantum computing' }];
  const profile = model => ({
    provider: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    model,
    apiKey: 'sk-ant-test'
  });
  // Katalogda olmayan (eski veya yeni) model: ne açma ne kapatma için thinking gönderilir; temperature/top_p korunur.
  for (const model of ['claude-3-7-sonnet-latest', 'claude-sonnet-4-5', 'claude-haiku-4-5', 'claude-yeni-9-9']) {
    for (const thinking of ['enabled', 'disabled', 'auto']) {
      const { body } = buildProviderRequest(profile(model), messages, {
        thinking,
        maxOutputTokens: 4096,
        temperature: 0.7,
        topP: 0.9
      });
      assert.equal('thinking' in body, false, `${model}/${thinking}`);
      assert.equal(body.temperature, 0.7, `${model}/${thinking}`);
      assert.equal(body.top_p, 0.9, `${model}/${thinking}`);
    }
  }
  // Katalogdaki uyarlamalı aile düşünme alanını alır ve örnekleme göndermez.
  const adaptive = buildProviderRequest(profile('claude-sonnet-5-5'), messages, {
    thinking: 'enabled',
    temperature: 0.7
  }).body;
  assert.deepEqual(adaptive.thinking, { type: 'adaptive' });
  assert.equal(adaptive.temperature, undefined);
});

test('YH1-C7: Gemini 3+ düşünmeyi thinkingConfig.thinkingLevel ile eşler; kataloğun bilmediği modele ek alan gönderilmez', () => {
  const messages = [{ role: 'user', content: 'What is photosynthesis?' }];
  const profile = {
    provider: 'google',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.8-flash',
    apiKey: 'goog-test'
  };
  const config = (model, thinking, extra = {}) =>
    buildProviderRequest({ ...profile, model }, messages, { thinking, ...extra }).body.generationConfig.thinkingConfig;

  // 1. Gemini 3.x/4.x: etkinleştirme thinkingLevel ile, auto alan göndermez.
  assert.deepEqual(config('gemini-3.8-flash', 'enabled'), { thinkingLevel: 'medium' });
  assert.equal(config('gemini-3.8-flash', 'auto'), undefined);

  // 2. Katalogda olmayan (3 altı veya yeni) modeller: ne açma ne kapatma için thinkingConfig gönderilir.
  for (const model of [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
    'gemini-9-yeni'
  ]) {
    for (const thinking of ['enabled', 'disabled', 'auto'])
      assert.equal(config(model, thinking, { maxOutputTokens: 8192 }), undefined, `${model}/${thinking}`);
  }
});

test('YH1-C7: Qwen maps thinking to enable_thinking boolean', () => {
  const messages = [{ role: 'user', content: 'Analyze this data' }];
  const profile = {
    provider: 'qwen',
    baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: 'qwq-plus',
    apiKey: 'sk-qwen-test'
  };

  // 1. Thinking enabled -> enable_thinking: true
  const req1 = buildProviderRequest(profile, messages, { thinking: 'enabled' });
  assert.equal(req1.body.enable_thinking, true);

  // 2. Thinking disabled -> enable_thinking: false
  const req2 = buildProviderRequest(profile, messages, { thinking: 'disabled' });
  assert.equal(req2.body.enable_thinking, false);
});

test('YH1-C7: Xiaomi MiMo preserves existing thinking block', () => {
  const messages = [{ role: 'user', content: 'Hello MiMo' }];
  const profile = {
    provider: 'xiaomi_mimo',
    baseURL: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.6-pro',
    apiKey: 'sk-mimo-test'
  };

  const req1 = buildProviderRequest(profile, messages, { thinking: 'enabled' });
  assert.deepEqual(req1.body.thinking, { type: 'enabled' });

  const req2 = buildProviderRequest(profile, messages, { thinking: 'disabled' });
  assert.deepEqual(req2.body.thinking, { type: 'disabled' });
});

test('YH1-C7: PROVIDERS catalog declares capabilities.thinking: true for supported providers', () => {
  const supported = ['openai', 'anthropic', 'google', 'qwen', 'xiaomi_mimo', 'deepseek', 'openrouter', 'groq'];
  for (const id of supported) {
    const p = PROVIDERS.find(prov => prov.id === id);
    assert.ok(p, `Provider ${id} must exist in catalog`);
    assert.equal(p.capabilities?.thinking, true, `Provider ${id} must declare capabilities.thinking: true`);
  }
});

test('current catalog reasoning models map supported adaptive and disabled modes', () => {
  const base = { provider: 'anthropic', baseURL: 'https://api.anthropic.com/v1', apiKey: 'test' };
  const messages = [{ role: 'user', content: 'hello' }];
  const adaptive = buildProviderRequest({ ...base, model: 'claude-opus-5-5' }, messages, { thinking: 'enabled' });
  assert.deepEqual(adaptive.body.thinking, { type: 'adaptive' });
  assert.throws(
    () => buildProviderRequest({ ...base, model: 'claude-opus-5-5' }, messages, { thinking: 'disabled' }),
    error => error.code === 'RUNTIME_OPTIONS_INVALID'
  );
  const disabled = buildProviderRequest({ ...base, model: 'claude-haiku-5-5' }, messages, { thinking: 'disabled' });
  assert.deepEqual(disabled.body.thinking, { type: 'disabled' });
  const openai = { provider: 'openai', baseURL: 'https://api.openai.com/v1', apiKey: 'test', model: 'gpt-6-astra' };
  const reasoning = buildProviderRequest(openai, messages, { thinking: 'enabled', temperature: 0.4, topP: 0.8 });
  assert.equal(reasoning.body.reasoning_effort, 'medium');
  assert.equal(reasoning.body.temperature, undefined);
  assert.equal(reasoning.body.top_p, undefined);
  assert.equal(buildProviderRequest(openai, messages, { thinking: 'disabled' }).body.reasoning_effort, 'none');
});

test('Gemini 3/4 use thinkingLevel and reject unsupported full thinking-off', () => {
  const profile = {
    provider: 'google',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-4-argon',
    apiKey: 'test'
  };
  const messages = [{ role: 'user', content: 'hello' }];
  assert.deepEqual(
    buildProviderRequest(profile, messages, { thinking: 'enabled' }).body.generationConfig.thinkingConfig,
    { thinkingLevel: 'medium' }
  );
  assert.throws(
    () => buildProviderRequest(profile, messages, { thinking: 'disabled' }),
    error => error.code === 'RUNTIME_OPTIONS_INVALID'
  );
});
