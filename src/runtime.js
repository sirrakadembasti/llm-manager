import { credentialEndpointProblem } from './credentialValidation.js';
import { providerFetch } from './providerTransport.js';
import { validateProviderUrl } from './providers.js';

export function normalizeRuntimeOptions(input = {}) {
  const timeoutMs = Number(input.timeoutMs ?? 120000);
  const maxOutputTokens = Number(input.maxOutputTokens ?? 8192);
  const thinking = input.thinking ?? 'auto';
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 300000) throw new Error('Yanıt süresi 5000–300000 ms arasında olmalıdır.');
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32768) throw new Error('Token bütçesi 256–32768 arasında olmalıdır.');
  if (!['auto', 'enabled', 'disabled'].includes(thinking)) throw new Error('Geçersiz düşünme ayarı.');
  return { timeoutMs, maxOutputTokens, thinking };
}

export function classifyLLMError(error) {
  const upstreamStatus = Number(error?.upstreamStatus || /(?:HTTP|Hatası[: (]*)\s*(\d{3})/i.exec(error?.message || '')?.[1]) || null;
  const name = error?.name || '';
  const text = String(error?.message || '');
  let code = 'LLM_PROVIDER_ERROR', status = 502, message = 'Model sağlayıcısından yanıt alınamadı. Sağlayıcı durumunu ve profil ayarlarını kontrol edin.', retryable = true;
  if (/Timeout|Abort/.test(name) || /timeout|zaman aşımı|aborted/i.test(text)) {
    code = 'LLM_TIMEOUT'; status = 504; message = 'Model yanıtı süre sınırını aştı. Süreyi artırın veya daha hızlı düşünme/model ayarı kullanın.';
  } else if (upstreamStatus === 429) {
    code = 'LLM_RATE_LIMIT'; message = 'Sağlayıcının hız veya kota sınırına ulaşıldı. Bir süre bekleyip kota durumunu kontrol edin.';
  } else if (upstreamStatus === 402) {
    code = 'LLM_BILLING';
    retryable = false;
    message = 'Sağlayıcı ödeme veya bakiye nedeniyle isteği reddetti. Bakiye ve aboneliği kontrol edin.';
  } else if (upstreamStatus === 403) {
    code = 'LLM_FORBIDDEN';
    retryable = false;
    message = 'Anahtarın model veya hizmet erişim izni yok.';
  } else if (error?.code === 'AI_CREDENTIAL_ENDPOINT_MISMATCH') {
    code = 'AI_CREDENTIAL_ENDPOINT_MISMATCH';
    retryable = false;
    message = 'Xiaomi anahtar türü ile PAYG / Token Plan adresi eşleşmiyor.';
  } else if (upstreamStatus === 401) {
    code = 'LLM_AUTH'; retryable = false; message = 'Sağlayıcı API anahtarını veya model erişim yetkisini kabul etmedi. Profili kontrol edin.';
  } else if (upstreamStatus === 400 || upstreamStatus === 404) {
    code = 'LLM_REQUEST_REJECTED'; retryable = false; message = 'Sağlayıcı model, adres veya istek ayarını reddetti. Profil testlerini çalıştırın.';
  } else if (error?.code === 'LLM_EMPTY_RESPONSE' || /boş içerik|model yanıtı alınamadı|empty/i.test(text)) {
    code = 'LLM_EMPTY_RESPONSE'; message = 'Model kullanılabilir cevap üretmedi. Token bütçesini ve düşünme ayarını kontrol edin.';
  } else if (error?.code === 'LLM_TRUNCATED' || /token sınırı/i.test(text)) {
    code = 'LLM_TRUNCATED'; message = 'Model yanıtı token bütçesine takıldı. Token bütçesini artırın veya isteği küçültün.';
  } else if (/fetch|DNS|ağ|network|ECONN|ENOTFOUND/i.test(text) || error?.cause) {
    code = 'LLM_NETWORK'; message = 'Sağlayıcıya ağ bağlantısı kurulamadı. DNS, internet ve proxy ayarlarını kontrol edin.';
  }
  return { code, status, error: message, retryable, upstreamStatus };
}

export function buildProviderRequest(profile, messages, options = {}) {
  const problem = credentialEndpointProblem(profile.provider, profile.baseURL, profile.apiKey);
  if (problem) throw Object.assign(new Error(problem), { code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH' });

  const normalized = normalizeRuntimeOptions({ ...profile, ...options });
  const { timeoutMs, maxOutputTokens, thinking } = options.purpose === 'quick'
    ? {
        ...normalized,
        timeoutMs: Math.min(normalized.timeoutMs, 20000),
        maxOutputTokens: Math.min(normalized.maxOutputTokens, 512),
        thinking: profile.provider === 'xiaomi_mimo' ? 'disabled' : normalized.thinking
      }
    : normalized;

  const base = validateProviderUrl(profile.baseURL, { allowLocalHttp: process.env.LLM_ALLOW_LOCAL_HTTP === 'true' })
    .replace(/\/+$/, '').replace(/\/(chat\/completions|messages|models)$/, '');
  const transport = profile.transport || 'openai';
  let url, headers, body;
  if (transport === 'google') {
    url = `${base}/models/${encodeURIComponent(profile.model)}:generateContent`;
    headers = { 'content-type': 'application/json', 'x-goog-api-key': profile.apiKey };
    body = {
      generationConfig: { maxOutputTokens },
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    };
    const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    if (system) body.systemInstruction = { parts: [{ text: system }] };
  } else if (transport === 'anthropic') {
    url = `${base}/messages`;
    headers = { 'content-type': 'application/json', 'x-api-key': profile.apiKey, 'anthropic-version': '2023-06-01' };
    body = {
      model: profile.model,
      max_tokens: maxOutputTokens,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
    };
  } else {
    url = `${base}/chat/completions`;
    headers = { 'content-type': 'application/json', Authorization: `Bearer ${profile.apiKey}` };
    const modern = ['openai', 'xiaomi_mimo'].includes(profile.provider);
    body = { model: profile.model, messages, [modern ? 'max_completion_tokens' : 'max_tokens']: maxOutputTokens };
    if (profile.provider === 'xiaomi_mimo') {
      const effective = thinking === 'auto' && options.purpose === 'manager' ? 'disabled' : thinking;
      if (effective !== 'auto') body.thinking = { type: effective };
    }
  }
  return { url, headers, body, timeoutMs };
}

export async function generateProfileResponse(messages, profile, options = {}) {
  const request = buildProviderRequest(profile, messages, options);
  const deadline = AbortSignal.timeout(request.timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, deadline]) : deadline;
  const response = await providerFetch(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal
  });
  if (!response.ok) {
    const error = new Error(`Sağlayıcı HTTP ${response.status} döndürdü.`);
    error.upstreamStatus = response.status;
    throw error;
  }
  const payload = await response.json();
  const content = profile.transport === 'google'
    ? payload.candidates?.[0]?.content?.parts?.filter(p => p.text).map(p => p.text).join('\n')
    : profile.transport === 'anthropic'
      ? payload.content?.filter(p => p.type === 'text').map(p => p.text).join('\n')
      : payload.choices?.[0]?.message?.content;
  const finishReason = payload.choices?.[0]?.finish_reason || payload.candidates?.[0]?.finishReason || payload.stop_reason;
  if (['length', 'MAX_TOKENS', 'max_tokens'].includes(finishReason)) {
    throw Object.assign(new Error('Model yanıtı token sınırında kesildi.'), { code: 'LLM_TRUNCATED' });
  }
  if (!content) {
    const error = new Error('Sağlayıcı kullanılabilir model yanıtı üretmedi.');
    error.code = ['length', 'MAX_TOKENS'].includes(payload.choices?.[0]?.finish_reason || payload.candidates?.[0]?.finishReason)
      ? 'LLM_TRUNCATED'
      : 'LLM_EMPTY_RESPONSE';
    throw error;
  }
  return content;
}
