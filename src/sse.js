import { classifyLLMError } from './runtime.js';

// Express ve Web (`fetch`) adaptörünün ortak SSE serileştirmesi; yalnız metin üretir, yazma/iptal adaptörde kalır.
const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

/** `meta`, `delta` ve `done` parçalarını SSE metnine çevirir; başka türler için `null`. */
export function sseFrame(chunk) {
  if (chunk.type === 'meta') {
    const { type: _type, ...meta } = chunk;
    return frame('meta', meta);
  }
  if (chunk.type === 'delta') return frame('delta', { text: chunk.text });
  if (chunk.type === 'done') {
    return frame('done', {
      usage: chunk.usage,
      finishReason: chunk.finishReason,
      profileId: chunk.profileId,
      fallbackUsed: chunk.fallbackUsed
    });
  }
  return null;
}

/** Akış sırasındaki hatayı `error` olayına çevirir; `providerMessage` yalnız yönetici içindir. */
export function sseErrorFrame(error, { principal, requestId } = {}) {
  const classified = classifyLLMError(error);
  return frame('error', {
    error: classified.error,
    code: classified.code,
    status: classified.status,
    providerMessage: principal?.isAdmin === true ? classified.providerMessage : undefined,
    requestId
  });
}
