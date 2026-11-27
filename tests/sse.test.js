import test from 'node:test';
import assert from 'node:assert/strict';
import { sseFrame, sseErrorFrame } from '../src/sse.js';
import { LLMError } from '../src/errors.js';

test('sseFrame serializes meta, delta and done and ignores other chunk types', () => {
  assert.equal(sseFrame({ type: 'meta', sources: [1] }), 'event: meta\ndata: {"sources":[1]}\n\n');
  assert.equal(sseFrame({ type: 'delta', text: 'a\nb' }), 'event: delta\ndata: {"text":"a\\nb"}\n\n');
  assert.equal(
    sseFrame({
      type: 'done',
      usage: { inputTokens: 1 },
      finishReason: 'stop',
      profileId: 'p',
      fallbackUsed: false,
      extra: 1
    }),
    'event: done\ndata: {"usage":{"inputTokens":1},"finishReason":"stop","profileId":"p","fallbackUsed":false}\n\n'
  );
  assert.equal(sseFrame({ type: 'unknown' }), null);
});

test('sseErrorFrame exposes providerMessage only to administrators', () => {
  const error = new LLMError('LLM_PROVIDER_ERROR', 'ham', { status: 502, retryable: false });
  error.providerMessage = 'gizli ayrıntı';
  const admin = sseErrorFrame(error, { principal: { isAdmin: true }, requestId: 'r1' });
  const chat = sseErrorFrame(error, { principal: { isAdmin: false }, requestId: 'r1' });
  const anonymous = sseErrorFrame(error, { requestId: 'r1' });
  assert.match(admin, /^event: error\ndata: /);
  assert.match(admin, /"requestId":"r1"/);
  assert.ok(admin.includes('gizli ayrıntı'));
  assert.ok(!chat.includes('gizli ayrıntı'));
  assert.ok(!anonymous.includes('providerMessage'));
});
