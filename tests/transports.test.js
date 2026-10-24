import test from 'node:test';
import assert from 'node:assert/strict';
import { getTransport, openai, anthropic, google } from '../src/transports/index.js';
import { buildProviderRequest } from '../src/runtime.js';
import { LLMError, ErrorCodes } from '../src/errors.js';

test('YH1-A5: getTransport resolves correct transport instances', () => {
  assert.equal(getTransport('openai'), openai);
  assert.equal(getTransport('anthropic'), anthropic);
  assert.equal(getTransport('google'), google);
  assert.equal(getTransport('unknown'), openai);
});

test('YH1-A5: OpenAI transport - authHeaders, chatEndpoint, buildBody, usage normalization and Perplexity merging', () => {
  const profile = {
    apiKey: 'sk-test-12345',
    model: 'gpt-4o',
    provider: 'openai',
    transport: 'openai'
  };

  assert.deepEqual(openai.authHeaders(profile), { Authorization: 'Bearer sk-test-12345' });
  assert.equal(openai.chatEndpoint(profile), 'chat/completions');

  // buildBody
  const body = openai.buildBody(profile, [{ role: 'user', content: 'hello' }], { maxOutputTokens: 1024 });
  assert.equal(body.model, 'gpt-4o');
  assert.equal(body.max_completion_tokens, 1024);
  assert.equal(body.messages[0].content, 'hello');

  // parseResponse and usage normalization
  const parsed = openai.parseResponse({
    choices: [
      {
        message: { role: 'assistant', content: 'Hi there!', reasoning_content: 'thinking...' },
        finish_reason: 'stop'
      }
    ],
    usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
  });
  assert.equal(parsed.content, 'Hi there!');
  assert.equal(parsed.finishReason, 'stop');
  assert.equal(parsed.reasoning, 'thinking...');
  assert.deepEqual(parsed.usage, { inputTokens: 15, outputTokens: 25, totalTokens: 40 });

  // Perplexity role alternation merging
  const pplxProfile = { ...profile, provider: 'perplexity' };
  const rawMessages = [
    { role: 'system', content: 'System instruction' },
    { role: 'user', content: 'First question' },
    { role: 'user', content: 'Second follow-up' },
    { role: 'assistant', content: 'Answer 1' },
    { role: 'assistant', content: 'Answer 2' }
  ];
  const normalized = openai.normalizeMessages(rawMessages, pplxProfile);
  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].role, 'system');
  assert.equal(normalized[1].role, 'user');
  assert.equal(normalized[1].content, 'First question\n\nSecond follow-up');
  assert.equal(normalized[2].role, 'assistant');
  assert.equal(normalized[2].content, 'Answer 1\n\nAnswer 2');

  // parseModels
  const models = openai.parseModels({
    data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }, { id: 'gpt-4o' }]
  });
  assert.deepEqual(models, ['gpt-4o', 'gpt-4o-mini']);
});

test('YH1-A5: Anthropic transport - consecutive role merging, first assistant rejection and usage normalization', () => {
  const profile = {
    apiKey: 'sk-ant-test-12345',
    model: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    transport: 'anthropic'
  };

  assert.deepEqual(anthropic.authHeaders(profile), {
    'x-api-key': 'sk-ant-test-12345',
    'anthropic-version': '2023-06-01'
  });
  assert.equal(anthropic.chatEndpoint(profile), 'messages');

  // Rejection when first non-system message is assistant
  assert.throws(
    () => {
      anthropic.normalizeMessages(
        [
          { role: 'system', content: 'sys' },
          { role: 'assistant', content: 'I am ready' },
          { role: 'user', content: 'hi' }
        ],
        profile
      );
    },
    err => err instanceof LLMError && err.code === ErrorCodes.MESSAGES_INVALID
  );

  // Consecutive same roles merged with \n\n
  const merged = anthropic.normalizeMessages(
    [
      { role: 'user', content: 'Part 1' },
      { role: 'user', content: 'Part 2' },
      { role: 'assistant', content: 'Reply' }
    ],
    profile
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].role, 'user');
  assert.equal(merged[0].content, 'Part 1\n\nPart 2');
  assert.equal(merged[1].role, 'assistant');

  // buildBody extracts system to top-level system field
  const body = anthropic.buildBody(
    profile,
    [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' }
    ],
    { maxOutputTokens: 2048 }
  );
  assert.equal(body.system, 'System prompt');
  assert.equal(body.max_tokens, 2048);
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].content, 'Hello');

  // parseResponse and usage normalization
  const parsed = anthropic.parseResponse({
    content: [{ type: 'text', text: 'Hello from Claude!' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 30, output_tokens: 50 }
  });
  assert.equal(parsed.content, 'Hello from Claude!');
  assert.equal(parsed.finishReason, 'end_turn');
  assert.deepEqual(parsed.usage, { inputTokens: 30, outputTokens: 50, totalTokens: 80 });

  // parseModels
  const models = anthropic.parseModels({
    data: [{ id: 'claude-sonnet-4-20250514' }]
  });
  assert.deepEqual(models, ['claude-sonnet-4-20250514']);
});

test('YH1-A5: Google transport - consecutive role merging, models/ strip, and usage normalization', () => {
  const profile = {
    apiKey: 'AIzaSyTest12345',
    model: 'models/gemini-2.5-flash',
    provider: 'google',
    transport: 'google',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta'
  };

  assert.deepEqual(google.authHeaders(profile), { 'x-goog-api-key': 'AIzaSyTest12345' });
  assert.equal(google.chatEndpoint(profile), 'models/gemini-2.5-flash:generateContent');

  // Consecutive user messages merged
  const normalized = google.normalizeMessages(
    [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Are you there?' }
    ],
    profile
  );
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].content, 'Hello\n\nAre you there?');

  // buildBody converts to contents with parts and systemInstruction
  const body = google.buildBody(
    profile,
    [
      { role: 'system', content: 'System instruction' },
      { role: 'user', content: 'Hi' }
    ],
    { maxOutputTokens: 4096 }
  );
  assert.deepEqual(body.systemInstruction, { parts: [{ text: 'System instruction' }] });
  assert.equal(body.contents.length, 1);
  assert.equal(body.contents[0].role, 'user');
  assert.deepEqual(body.contents[0].parts, [{ text: 'Hi' }]);

  // parseResponse and usageMetadata normalization
  const parsed = google.parseResponse({
    candidates: [
      {
        content: { parts: [{ text: 'Hello from Gemini!' }] },
        finishReason: 'STOP'
      }
    ],
    usageMetadata: { promptTokenCount: 18, candidatesTokenCount: 22, totalTokenCount: 40 }
  });
  assert.equal(parsed.content, 'Hello from Gemini!');
  assert.equal(parsed.finishReason, 'STOP');
  assert.deepEqual(parsed.usage, { inputTokens: 18, outputTokens: 22, totalTokens: 40 });

  // parseModels strips leading models/ and filters non-generateContent
  const models = google.parseModels({
    models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }
    ]
  });
  assert.deepEqual(models, ['gemini-2.5-flash', 'gemini-2.5-pro']);
});

test('YH1-A5: buildProviderRequest dispatches to strategy pattern cleanly', () => {
  const req = buildProviderRequest(
    {
      provider: 'anthropic',
      transport: 'anthropic',
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant-test-key-12345',
      model: 'claude-3-5-haiku-latest'
    },
    [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' }
    ],
    { allowLocalHttp: true }
  );

  assert.equal(req.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(req.headers['x-api-key'], 'sk-ant-test-key-12345');
  assert.equal(req.body.system, 'sys');
  assert.equal(req.body.messages[0].content, 'hello');
});
