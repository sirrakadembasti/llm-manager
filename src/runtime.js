import { credentialEndpointProblem } from './credentialValidation.js';
import { LLMError, ErrorCodes } from './errors.js';
import { providerFetch } from './providerTransport.js';
import { validateProviderUrl, PROVIDERS } from './providers.js';
import { getTransport } from './transports/index.js';
import { setTimeout as sleep } from 'node:timers/promises';

const warnedPurposes = new Set();
export function normalizePurpose(value = 'default') {
  const aliases = { manager: 'diagnostic', production: 'default' };
  if (Object.hasOwn(aliases, value)) {
    if (!warnedPurposes.has(value)) {
      warnedPurposes.add(value);
      process.emitWarning(`purpose '${value}' yerine '${aliases[value]}' kullanın.`, {
        code: 'LLM_PURPOSE_DEPRECATED'
      });
    }
    return aliases[value];
  }
  if (!['quick', 'diagnostic', 'default'].includes(value)) {
    throw new LLMError(ErrorCodes.PURPOSE_INVALID, 'Geçersiz çağrı amacı (purpose).', {
      status: 400,
      retryable: false
    });
  }
  return value;
}

export function normalizeRuntimeOptions(input = {}) {
  const timeoutMs = Number(input.timeoutMs ?? 120000);
  const maxOutputTokens = Number(input.maxOutputTokens ?? 8192);
  const thinking = input.thinking ?? 'auto';
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5000 || timeoutMs > 300000) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Yanıt süresi 5000–300000 ms arasında olmalıdır.', {
      status: 400,
      retryable: false
    });
  }
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32768) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Token bütçesi 256–32768 arasında olmalıdır.', {
      status: 400,
      retryable: false
    });
  }
  if (!['auto', 'enabled', 'disabled'].includes(thinking)) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Geçersiz düşünme ayarı.', {
      status: 400,
      retryable: false
    });
  }

  const result = { timeoutMs, maxOutputTokens, thinking };

  if (input.temperature !== undefined && input.temperature !== null && input.temperature !== '') {
    const temp = Number(input.temperature);
    if (isNaN(temp) || temp < 0 || temp > 2) {
      throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Sıcaklık (temperature) 0.0–2.0 arasında olmalıdır.', {
        status: 400,
        retryable: false
      });
    }
    result.temperature = temp;
  }

  if (input.topP !== undefined && input.topP !== null && input.topP !== '') {
    const topP = Number(input.topP);
    if (isNaN(topP) || topP < 0 || topP > 1) {
      throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Top-P 0.0–1.0 arasında olmalıdır.', {
        status: 400,
        retryable: false
      });
    }
    result.topP = topP;
  }

  if (input.stop !== undefined && input.stop !== null && input.stop !== '') {
    const stopList = Array.isArray(input.stop) ? input.stop : [input.stop];
    if (stopList.length > 4 || stopList.some(s => typeof s !== 'string' || s.length > 100)) {
      throw new LLMError(
        ErrorCodes.RUNTIME_OPTIONS_INVALID,
        'Durdurma dizileri en fazla 4 adet ve her biri en fazla 100 karakter olabilir.',
        {
          status: 400,
          retryable: false
        }
      );
    }
    result.stop = stopList;
  }

  if (input.responseFormat !== undefined && input.responseFormat !== null && input.responseFormat !== '') {
    if (!['text', 'json'].includes(input.responseFormat)) {
      throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, "Yanıt biçimi 'text' veya 'json' olmalıdır.", {
        status: 400,
        retryable: false
      });
    }
    result.responseFormat = input.responseFormat;
  }

  return result;
}

export function resolveRuntimeOptions(profile, options = {}) {
  const purpose = normalizePurpose(options.purpose);
  const normalized = normalizeRuntimeOptions({ ...profile, ...options });
  if (purpose === 'quick') {
    return {
      ...normalized,
      timeoutMs: Math.min(normalized.timeoutMs, 20000),
      maxOutputTokens: Math.min(normalized.maxOutputTokens, 512),
      thinking: profile.provider === 'xiaomi_mimo' ? 'disabled' : normalized.thinking
    };
  }
  if (purpose === 'diagnostic' && profile.provider === 'xiaomi_mimo' && normalized.thinking === 'auto') {
    return { ...normalized, thinking: 'disabled' };
  }
  return normalized;
}

export function providerEndpoint(profile, suffix, options = {}) {
  const opts = typeof options === 'boolean' ? { allowLocalHttp: options } : options;
  const allowLocalHttp = opts.allowLocalHttp ?? process.env.LLM_ALLOW_LOCAL_HTTP === 'true';
  const allowedPrivateHosts = opts.allowedPrivateHosts || [];
  const base = validateProviderUrl(profile.baseURL, { allowLocalHttp, allowedPrivateHosts })
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|messages|models)$/, '');
  return `${base}/${suffix}`;
}

export function providerAuthHeaders(profile) {
  const transportId = profile?.transport || PROVIDERS.find(p => p.id === profile?.provider)?.transport || 'openai';
  const transport = getTransport(transportId);
  return transport.authHeaders(profile);
}

export async function executeWithRetry(
  operation,
  { attempts = 2, baseMs = 500, maxMs = 4000, deadlineMs = 120000, signal = null } = {}
) {
  let lastError;
  const start = Date.now();
  const cancellationError = () =>
    new LLMError(
      signal?.reason?.name === 'TimeoutError' ? ErrorCodes.LLM_TIMEOUT : ErrorCodes.LLM_ABORTED,
      signal?.reason?.name === 'TimeoutError' ? 'Model yanıtı süre sınırını aştı.' : 'İstek iptal edildi.',
      {
        status: signal?.reason?.name === 'TimeoutError' ? 504 : 499,
        retryable: signal?.reason?.name === 'TimeoutError'
      }
    );

  for (let attempt = 0; attempt <= attempts; attempt++) {
    if (signal?.aborted) {
      throw cancellationError();
    }
    const elapsed = Date.now() - start;
    const remainingTime = deadlineMs - elapsed;
    if (remainingTime <= 0) {
      break;
    }

    try {
      const deadline = new AbortController();
      const timer = setTimeout(
        () => deadline.abort(new DOMException('Deadline exceeded', 'TimeoutError')),
        remainingTime
      );
      const combinedSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
      let onAbort;
      try {
        return await new Promise((resolve, reject) => {
          onAbort = () =>
            reject(
              signal?.aborted
                ? cancellationError()
                : new LLMError(ErrorCodes.LLM_TIMEOUT, 'Model yanıtı süre sınırını aştı.', {
                    status: 504,
                    retryable: true
                  })
            );
          combinedSignal.addEventListener('abort', onAbort, { once: true });
          if (combinedSignal.aborted) return onAbort();
          Promise.resolve()
            .then(() => operation({ signal: combinedSignal, attempt, remainingTime }))
            .then(resolve, reject);
        });
      } finally {
        clearTimeout(timer);
        if (onAbort) combinedSignal.removeEventListener('abort', onAbort);
      }
    } catch (err) {
      lastError = err;
      const classified = classifyLLMError(err);
      if (!classified.retryable || attempt === attempts) {
        throw err;
      }

      let delayMs = Math.min(maxMs, Math.round(baseMs * Math.pow(2, attempt) * (0.75 + Math.random() * 0.5)));
      if (err.retryAfterSec !== undefined) {
        const retryAfterMs = err.retryAfterSec * 1000;
        if (retryAfterMs > maxMs) {
          throw err;
        }
        delayMs = retryAfterMs;
      }

      if (Date.now() - start + delayMs >= deadlineMs) {
        throw err;
      }

      try {
        await sleep(delayMs, undefined, { signal: signal || undefined });
      } catch {
        throw cancellationError();
      }
    }
  }

  throw (
    lastError ||
    new LLMError(ErrorCodes.LLM_TIMEOUT, 'Model yanıtı süre sınırını aştı.', { status: 504, retryable: true })
  );
}

const KNOWN_CODE_DEFAULTS = {
  [ErrorCodes.LLM_ABORTED]: {
    status: 499,
    message: 'İstek iptal edildi.',
    retryable: false
  },
  [ErrorCodes.LLM_TIMEOUT]: {
    status: 504,
    message: 'Model yanıtı süre sınırını aştı. Süreyi artırın veya daha hızlı düşünme/model ayarı kullanın.',
    retryable: true
  },
  [ErrorCodes.LLM_RATE_LIMIT]: {
    status: 502,
    message: 'Sağlayıcının hız veya kota sınırına ulaşıldı. Bir süre bekleyip kota durumunu kontrol edin.',
    retryable: true
  },
  [ErrorCodes.LLM_BILLING]: {
    status: 502,
    message: 'Sağlayıcı ödeme veya bakiye nedeniyle isteği reddetti. Bakiye ve aboneliği kontrol edin.',
    retryable: false
  },
  [ErrorCodes.LLM_FORBIDDEN]: {
    status: 502,
    message: 'Anahtarın model veya hizmet erişim izni yok.',
    retryable: false
  },
  [ErrorCodes.LLM_AUTH]: {
    status: 502,
    message: 'Sağlayıcı API anahtarını veya model erişim yetkisini kabul etmedi. Profili kontrol edin.',
    retryable: false
  },
  [ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH]: {
    status: 400,
    message: 'Xiaomi anahtar türü ile PAYG / Token Plan adresi eşleşmiyor.',
    retryable: false
  },
  [ErrorCodes.LLM_REQUEST_REJECTED]: {
    status: 502,
    message: 'Sağlayıcı model, adres veya istek ayarını reddetti. Profil testlerini çalıştırın.',
    retryable: false
  },
  [ErrorCodes.LLM_EMPTY_RESPONSE]: {
    status: 502,
    message: 'Model kullanılabilir cevap üretmedi. Token bütçesini ve düşünme ayarını kontrol edin.',
    retryable: true
  },
  [ErrorCodes.LLM_TRUNCATED]: {
    status: 422,
    message: 'Model yanıtı token bütçesine takıldı. Token bütçesini artırın veya isteği küçültün.',
    retryable: false
  },
  [ErrorCodes.LLM_CONTENT_FILTERED]: {
    status: 422,
    message: 'Model yanıtı güvenlik veya içerik filtresi nedeniyle engellendi.',
    retryable: false
  },
  [ErrorCodes.LLM_RESPONSE_TOO_LARGE]: {
    status: 502,
    message: 'Sağlayıcı yanıt boyutu izin verilen sınırı aştı.',
    retryable: false
  },
  [ErrorCodes.LLM_DNS_BLOCKED]: {
    status: 502,
    message: 'Sağlayıcı adresi güvenlik ilkesi gereği engellendi. Yalnızca genel HTTPS adresleri kullanılabilir.',
    retryable: false
  },
  [ErrorCodes.LLM_UPSTREAM_UNAVAILABLE]: {
    status: 503,
    message: 'Sağlayıcı geçici olarak hizmet veremiyor. Lütfen daha sonra tekrar deneyin.',
    retryable: true
  },
  [ErrorCodes.LLM_NETWORK]: {
    status: 502,
    message: 'Sağlayıcıya ağ bağlantısı kurulamadı. DNS, internet ve proxy ayarlarını kontrol edin.',
    retryable: true
  },
  [ErrorCodes.RUNTIME_OPTIONS_INVALID]: {
    status: 400,
    message: 'Çalışma zamanı seçenekleri geçersiz.',
    retryable: false
  },
  [ErrorCodes.PROFILE_INVALID]: {
    status: 400,
    message: 'Profil ayarları geçersiz.',
    retryable: false
  },
  [ErrorCodes.PROFILE_NOT_FOUND]: {
    status: 404,
    message: 'Profil bulunamadı.',
    retryable: false
  },
  [ErrorCodes.PROFILE_CONFLICT]: {
    status: 409,
    message: 'Profil başka bir işlemde değiştirildi; yenileyin.',
    retryable: false
  }
};

export function classifyLLMError(error) {
  const upstreamStatus =
    Number(error?.upstreamStatus || /(?:HTTP|Hatası[: (]*)\s*(\d{3})/i.exec(error?.message || '')?.[1]) || null;
  const name = error?.name || '';
  const text = String(error?.message || '');

  // 1. Birincil yol: tipli error.code kontrolü
  if (error?.code && KNOWN_CODE_DEFAULTS[error.code]) {
    const meta = KNOWN_CODE_DEFAULTS[error.code];
    return {
      code: error.code,
      status: error.status ?? meta.status,
      error: meta.message,
      retryable: error.retryable ?? meta.retryable,
      upstreamStatus: error.upstreamStatus ?? upstreamStatus
    };
  }

  if (!error?.code && !error?.upstreamStatus && /Yanıt süresi|Token bütçesi|düşünme ayarı/.test(text)) {
    const meta = KNOWN_CODE_DEFAULTS[ErrorCodes.RUNTIME_OPTIONS_INVALID];
    return {
      code: ErrorCodes.RUNTIME_OPTIONS_INVALID,
      status: meta.status,
      error: meta.message,
      retryable: meta.retryable,
      upstreamStatus
    };
  }

  // 2. İkincil / yedek yol: HTTP durumu ve metin tespiti
  let code = 'LLM_PROVIDER_ERROR';
  let status = 502;
  let message = 'Model sağlayıcısından yanıt alınamadı. Sağlayıcı durumunu ve profil ayarlarını kontrol edin.';
  let retryable = true;

  if (name === 'AbortError' || /abort/i.test(name) || /aborted|iptal edildi/i.test(text)) {
    code = ErrorCodes.LLM_ABORTED;
    status = 499;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_ABORTED].message;
  } else if (/Timeout/.test(name) || /timeout|zaman aşımı/i.test(text)) {
    code = ErrorCodes.LLM_TIMEOUT;
    status = 504;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_TIMEOUT].message;
  } else if (upstreamStatus && upstreamStatus >= 500 && upstreamStatus <= 599) {
    code = ErrorCodes.LLM_UPSTREAM_UNAVAILABLE;
    status = 503;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_UPSTREAM_UNAVAILABLE].message;
  } else if (upstreamStatus === 429) {
    code = ErrorCodes.LLM_RATE_LIMIT;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_RATE_LIMIT].message;
  } else if (upstreamStatus === 402) {
    code = ErrorCodes.LLM_BILLING;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_BILLING].message;
  } else if (upstreamStatus === 403) {
    code = ErrorCodes.LLM_FORBIDDEN;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_FORBIDDEN].message;
  } else if (error?.code === ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH) {
    code = ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH;
    status = 400;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH].message;
  } else if (upstreamStatus === 401) {
    code = ErrorCodes.LLM_AUTH;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_AUTH].message;
  } else if (upstreamStatus === 400 || upstreamStatus === 404) {
    code = ErrorCodes.LLM_REQUEST_REJECTED;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_REQUEST_REJECTED].message;
  } else if (error?.code === ErrorCodes.LLM_CONTENT_FILTERED || /safety|güvenlik|içerik filtre/i.test(text)) {
    code = ErrorCodes.LLM_CONTENT_FILTERED;
    status = 422;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_CONTENT_FILTERED].message;
  } else if (error?.code === ErrorCodes.LLM_EMPTY_RESPONSE || /boş içerik|model yanıtı alınamadı|empty/i.test(text)) {
    code = ErrorCodes.LLM_EMPTY_RESPONSE;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_EMPTY_RESPONSE].message;
  } else if (error?.code === ErrorCodes.LLM_TRUNCATED || /token sınırı/i.test(text)) {
    code = ErrorCodes.LLM_TRUNCATED;
    status = 422;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_TRUNCATED].message;
  } else if (error?.code === ErrorCodes.LLM_RESPONSE_TOO_LARGE || /EXTERNAL_RESPONSE_TOO_LARGE/i.test(text)) {
    code = ErrorCodes.LLM_RESPONSE_TOO_LARGE;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_RESPONSE_TOO_LARGE].message;
  } else if (error?.code === ErrorCodes.LLM_DNS_BLOCKED || /DNS.*must resolve|public HTTPS hostname/i.test(text)) {
    code = ErrorCodes.LLM_DNS_BLOCKED;
    retryable = false;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_DNS_BLOCKED].message;
  } else if (/fetch|DNS|ağ|network|ECONN|ENOTFOUND/i.test(text) || error?.cause) {
    code = ErrorCodes.LLM_NETWORK;
    message = KNOWN_CODE_DEFAULTS[ErrorCodes.LLM_NETWORK].message;
  }

  return { code, status, error: message, retryable, upstreamStatus };
}

export function buildProviderRequest(profile, messages, options = {}) {
  const problem = credentialEndpointProblem(profile.provider, profile.baseURL, profile.apiKey);
  if (problem)
    throw new LLMError(ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH, problem, { status: 400, retryable: false });

  const { timeoutMs, maxOutputTokens, thinking } = resolveRuntimeOptions(profile, options);
  const transportId = profile.transport || PROVIDERS.find(p => p.id === profile.provider)?.transport || 'openai';
  const transport = getTransport(transportId);
  const endpointSuffix = transport.chatEndpoint(profile);
  const url = providerEndpoint(profile, endpointSuffix, options);
  const headers = { 'content-type': 'application/json', ...transport.authHeaders(profile) };
  const body = transport.buildBody(profile, messages, {
    maxOutputTokens,
    thinking,
    ...options
  });
  return { url, headers, body, timeoutMs, transport };
}

export async function generateProfileResponse(messages, profile, options = {}) {
  const request = buildProviderRequest(profile, messages, options);
  const deadline = AbortSignal.timeout(request.timeoutMs);
  const userSignal = options.signal;
  const signal = userSignal ? AbortSignal.any([userSignal, deadline]) : deadline;
  let response;
  try {
    response = await providerFetch(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal,
      allowLocalHttp: options.allowLocalHttp,
      proxyUrl: options.proxyUrl,
      allowedHosts: options.allowedHosts,
      allowedPrivateHosts: options.allowedPrivateHosts
    });
  } catch (fetchError) {
    if (userSignal?.aborted && userSignal.reason?.name !== 'TimeoutError') {
      throw new LLMError(ErrorCodes.LLM_ABORTED, 'İstek iptal edildi.', {
        status: 499,
        retryable: false,
        cause: fetchError
      });
    }
    if (deadline.aborted || userSignal?.reason?.name === 'TimeoutError') {
      throw new LLMError(
        ErrorCodes.LLM_TIMEOUT,
        'Model yanıtı süre sınırını aştı. Süreyi artırın veya daha hızlı düşünme/model ayarı kullanın.',
        { status: 504, retryable: true, cause: fetchError }
      );
    }
    throw fetchError;
  }

  if (!response.ok) {
    const is5xx = response.status >= 500 && response.status <= 599;
    const error = new LLMError(
      is5xx
        ? ErrorCodes.LLM_UPSTREAM_UNAVAILABLE
        : response.status === 429
          ? ErrorCodes.LLM_RATE_LIMIT
          : ErrorCodes.LLM_PROVIDER_ERROR,
      `Sağlayıcı HTTP ${response.status} döndürdü.`,
      {
        upstreamStatus: response.status,
        status: is5xx ? 503 : 502,
        retryable: is5xx || response.status === 429
      }
    );
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter !== null) {
      const seconds = /^\d+(?:\.\d+)?$/.test(retryAfter.trim())
        ? Number(retryAfter)
        : (Date.parse(retryAfter) - Date.now()) / 1000;
      if (Number.isFinite(seconds)) error.retryAfterSec = Math.max(0, seconds);
    }
    throw error;
  }

  const payload = await response.json();
  const transport = request.transport || getTransport(profile.transport);
  const parsed = transport.parseResponse(payload);
  const { content, finishReason, usage, reasoning } = parsed;

  if (['SAFETY', 'content_filter'].includes(finishReason)) {
    throw new LLMError(
      ErrorCodes.LLM_CONTENT_FILTERED,
      'Model yanıtı güvenlik veya içerik filtresi nedeniyle engellendi.',
      { status: 422, retryable: false }
    );
  }
  if (['length', 'MAX_TOKENS', 'max_tokens'].includes(finishReason)) {
    if (options.acceptTruncated === true)
      return options.raw === true ? { content: content || '', finishReason, usage, truncated: true } : content || '';
    throw new LLMError(ErrorCodes.LLM_TRUNCATED, 'Model yanıtı token sınırında kesildi.', {
      status: 422,
      retryable: false
    });
  }
  if (!content) {
    if (options.acceptTruncated === true && reasoning)
      return options.raw === true ? { content: '', finishReason, usage, truncated: true } : '';
    throw new LLMError(ErrorCodes.LLM_EMPTY_RESPONSE, 'Sağlayıcı kullanılabilir model yanıtı üretmedi.', {
      status: 502,
      retryable: true
    });
  }
  if (options.raw === true) {
    return { content, finishReason, usage, reasoning };
  }
  return content;
}

export async function* parseSseStream(stream, transport) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = 'message';
  let currentData = [];
  const accumulatedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let lastFinishReason = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) {
          if (currentData.length > 0) {
            const dataStr = currentData.join('\n');
            const parsed = transport.parseStreamEvent(dataStr, currentEvent);
            if (parsed) {
              if (parsed.usage) {
                if (parsed.usage.inputTokens !== undefined) accumulatedUsage.inputTokens = parsed.usage.inputTokens;
                if (parsed.usage.outputTokens !== undefined) {
                  accumulatedUsage.outputTokens = parsed.usage.outputTokens;
                }
                accumulatedUsage.totalTokens =
                  (accumulatedUsage.inputTokens || 0) + (accumulatedUsage.outputTokens || 0);
              }
              if (parsed.finishReason) {
                lastFinishReason = parsed.finishReason;
              }
              if (parsed.text) {
                yield { type: 'delta', text: parsed.text };
              }
              if (parsed.done) {
                yield {
                  type: 'done',
                  finishReason: lastFinishReason || 'stop',
                  usage: accumulatedUsage
                };
                return;
              }
            }
            currentEvent = 'message';
            currentData = [];
          }
          continue;
        }

        if (line.startsWith(':')) {
          continue;
        }
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          currentData.push(line.slice(5).trimStart());
        }
      }
    }

    if (buffer.trim() || currentData.length > 0) {
      if (buffer.startsWith('data:')) currentData.push(buffer.slice(5).trimStart());
      if (currentData.length > 0) {
        const dataStr = currentData.join('\n');
        const parsed = transport.parseStreamEvent(dataStr, currentEvent);
        if (parsed) {
          if (parsed.usage) {
            if (parsed.usage.inputTokens !== undefined) accumulatedUsage.inputTokens = parsed.usage.inputTokens;
            if (parsed.usage.outputTokens !== undefined) {
              accumulatedUsage.outputTokens = parsed.usage.outputTokens;
            }
            accumulatedUsage.totalTokens = (accumulatedUsage.inputTokens || 0) + (accumulatedUsage.outputTokens || 0);
          }
          if (parsed.finishReason) lastFinishReason = parsed.finishReason;
          if (parsed.text) yield { type: 'delta', text: parsed.text };
        }
      }
    }

    yield {
      type: 'done',
      finishReason: lastFinishReason || 'stop',
      usage: accumulatedUsage
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function* generateProfileStream(messages, profile, options = {}) {
  const request = buildProviderRequest(profile, messages, { ...options, stream: true });
  const transport = request.transport;
  const endpointSuffix =
    typeof transport.streamEndpoint === 'function'
      ? transport.streamEndpoint(profile)
      : transport.chatEndpoint(profile);
  const url = providerEndpoint(profile, endpointSuffix, options);
  const deadline = AbortSignal.timeout(request.timeoutMs);
  const userSignal = options.signal;
  const signal = userSignal ? AbortSignal.any([userSignal, deadline]) : deadline;

  let response;
  try {
    response = await providerFetch(url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal,
      allowLocalHttp: options.allowLocalHttp,
      proxyUrl: options.proxyUrl,
      allowedHosts: options.allowedHosts,
      allowedPrivateHosts: options.allowedPrivateHosts,
      stream: true
    });
  } catch (fetchError) {
    if (userSignal?.aborted) {
      throw new LLMError(ErrorCodes.LLM_ABORTED, 'İstek iptal edildi.', {
        status: 499,
        retryable: false,
        cause: fetchError
      });
    }
    if (deadline.aborted) {
      throw new LLMError(
        ErrorCodes.LLM_TIMEOUT,
        'Model yanıtı süre sınırını aştı. Süreyi artırın veya daha hızlı düşünme/model ayarı kullanın.',
        { status: 504, retryable: true, cause: fetchError }
      );
    }
    throw fetchError;
  }

  if (!response.ok) {
    const is5xx = response.status >= 500 && response.status <= 599;
    throw new LLMError(
      is5xx ? ErrorCodes.LLM_UPSTREAM_UNAVAILABLE : ErrorCodes.LLM_PROVIDER_ERROR,
      `Sağlayıcı HTTP ${response.status} döndürdü.`,
      {
        status: is5xx ? 503 : 502,
        upstreamStatus: response.status,
        retryable: is5xx || response.status === 429
      }
    );
  }

  yield* parseSseStream(response.body, transport);
}
