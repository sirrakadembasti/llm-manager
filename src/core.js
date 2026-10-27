// Framework-bağımsız çekirdek: HTTP çerçevesi (Express, Fastify, Koa, Next.js...) bilmez.
// Girdi: { method, path, body }  ->  Çıktı: { status, body } veya eşleşme yoksa null.
// Kimlik doğrulama, yönetici yetkisi ve CSRF denetimi host/adaptör sorumluluğundadır.
import fs from 'node:fs';
import { checkBasicAuth, checkBearerToken } from './auth.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialEndpointProblem } from './credentialValidation.js';
import { LLMError, ErrorCodes, isLLMError } from './errors.js';
import { createRateLimiter } from './rateLimit.js';
import { createStructuredLogger, redact, sanitizeRequestId } from './logger.js';
import {
  generateProfileResponse,
  generateProfileStream,
  classifyLLMError,
  providerEndpoint,
  providerAuthHeaders,
  resolveRuntimeOptions,
  normalizePurpose,
  executeWithRetry
} from './runtime.js';
import { providerFetch } from './providerTransport.js';
import { PROVIDERS, CATALOG_VERSION, CATALOG_UPDATED_AT, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import { getTransport } from './transports/index.js';
import { createUsageTracker } from './usageLogger.js';
import { MESSAGES, getErrorMessage } from './messages.js';

const PACKAGE_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

export {
  LLMError,
  ErrorCodes,
  generateProfileResponse,
  classifyLLMError,
  PROVIDERS,
  CATALOG_VERSION,
  CATALOG_UPDATED_AT,
  PACKAGE_VERSION,
  validateProviderUrl,
  createLLMProfileStore,
  createRateLimiter,
  createStructuredLogger,
  createUsageTracker,
  MESSAGES,
  getErrorMessage,
  redact,
  sanitizeRequestId
};
export const CSRF_HEADER = 'X-LLM-CSRF';
export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

export function isValidMountPath(value) {
  return typeof value === 'string' && /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value);
}

// Yönetim sayfası ve betiği bir kez okunup yol ayarlarıyla önbelleğe alınır.
export function createUiAssets({ apiPath = '/api/llm', pagePath = '/llm', locale = 'tr', homeUrl = '/' } = {}) {
  if (![apiPath, pagePath].every(isValidMountPath)) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Geçersiz eklenti mount yolu.', {
      status: 400,
      retryable: false
    });
  }
  const normalizedLocale = String(locale).toLowerCase() === 'en' ? 'en' : 'tr';
  const dictPath = path.join(publicDir, 'i18n', `${normalizedLocale}.json`);
  const dictJson = fs.existsSync(dictPath) ? fs.readFileSync(dictPath, 'utf8') : '{}';
  const dict = JSON.parse(dictJson);

  let html = fs.readFileSync(path.join(publicDir, 'llm.html'), 'utf8');
  html = html.replace(/<html[^>]*lang="[^"]*"/, `<html lang="${normalizedLocale}"`);
  html = html.replace(/data-api-base="[^"]*"/, `data-api-base="${apiPath}"`);
  if (!html.includes('data-api-base=')) html = html.replace('<body', `<body data-api-base="${apiPath}"`);
  html = html.replace(/data-locale="[^"]*"/, `data-locale="${normalizedLocale}"`);
  if (!html.includes('data-locale=')) html = html.replace('<body', `<body data-locale="${normalizedLocale}"`);
  html = html.replace(/data-home-url="[^"]*"/, `data-home-url="${homeUrl}"`);
  if (!html.includes('data-home-url=')) html = html.replace('<body', `<body data-home-url="${homeUrl}"`);
  html = html.replace(/src="(?:\.\/|\/llm\/)llm-ui\.js"/, `src="${pagePath}/llm-ui.js"`);

  // Replace data-i18n text in html
  html = html.replace(/data-i18n="([^"]+)">([^<]*)</g, (match, key) => {
    return dict[key] ? `data-i18n="${key}">${dict[key]}<` : match;
  });
  html = html.replace(/data-i18n-placeholder="([^"]+)"\s+placeholder="[^"]*"/g, (match, key) => {
    return dict[key] ? `data-i18n-placeholder="${key}" placeholder="${dict[key]}"` : match;
  });

  // Embed translation json into document
  const i18nScript = `<script id="llm-i18n" type="application/json">${dictJson}</script>`;
  html = html.replace('</body>', `${i18nScript}\n</body>`);

  const script = fs.readFileSync(path.join(publicDir, 'llm-ui.js'), 'utf8');
  return { html, script, locale: normalizedLocale };
}

// Sağlayıcı yanıtından benzersiz, temizlenmiş model kimliği listesi çıkarır.
function extractModelIds(body, profile) {
  const transport = getTransport(profile?.transport);
  return transport.parseModels(body);
}

function defaultTestMessages(mode) {
  if (mode === 'quick') return [{ role: 'user', content: 'Yalnızca OK yaz.' }];
  return [
    {
      role: 'system',
      content: 'Yardımsever bir asistansın. Kısa ve doğru yanıt ver.'
    },
    {
      role: 'user',
      content:
        'Bir web uygulamasında kullanıcı kimlik doğrulaması için üç temel güvenlik önlemini maddeler halinde yaz.'
    }
  ];
}

const ok = (body, status = 200) => ({ status, body });
const safeUsage = usage => {
  if (!usage || typeof usage !== 'object') return null;
  const tokenCount = value => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  const inputTokens = tokenCount(usage.inputTokens);
  const outputTokens = tokenCount(usage.outputTokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokens === undefined ? inputTokens + outputTokens : tokenCount(usage.totalTokens)
  };
};
const notFound = () => ({ status: 404, body: { error: 'Profil bulunamadı.', code: ErrorCodes.PROFILE_NOT_FOUND } });
const profileError = error => ({
  status:
    error.status ||
    (error.code === ErrorCodes.PROFILE_NOT_FOUND ? 404 : error.code === ErrorCodes.PROFILE_CONFLICT ? 409 : 400),
  body: { error: error.message, code: error.code || ErrorCodes.PROFILE_INVALID }
});
const isStoreFormatError = error =>
  isLLMError(error) && (error.code === ErrorCodes.STORE_CORRUPT || error.code === ErrorCodes.STORE_VERSION_UNSUPPORTED);

export function createLLMManager({
  adminPassword = process.env.LLM_ADMIN_PASSWORD,
  adminUser = 'admin',
  chatTokens = process.env.LLM_CHAT_TOKENS,
  authorize,
  insecureNoAuth = false,
  dataDir,
  filePath,
  encryptionKey,
  allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true',
  proxyUrl = process.env.LLM_HTTPS_PROXY || process.env.HTTPS_PROXY,
  allowedHosts = [],
  allowedPrivateHosts = [],
  store = createLLMProfileStore({ dataDir, filePath, encryptionKey, allowLocalHttp, allowedPrivateHosts }),
  generate,
  generateStream,
  testMessages,
  validateTestReply,
  limits: customLimits,
  chatOverrides = 'admin',
  chatAccess = 'authenticated',
  rateLimit: rateLimitConfig,
  retry: retryConfig,
  logger: customLogger = null,
  health = true,
  usageLog = false,
  locale = 'tr',
  homeUrl = '/',
  getClientId
} = {}) {
  const pendingTests = new Set();
  let warnedMissingAuth = false;
  let cachedUiKey = '';
  let cachedUi = null;

  const usageDir = dataDir || (filePath ? path.dirname(filePath) : 'data');
  const usageTracker = createUsageTracker({ dataDir: usageDir, enabled: usageLog });

  const defaultRetryConfig = {
    attempts: 2,
    baseMs: 500,
    maxMs: 4000
  };
  const retryPolicy = retryConfig === false ? null : { ...defaultRetryConfig, ...retryConfig };

  const limits = {
    maxMessages: 100,
    maxChars: 200000,
    maxSingleMessageChars: 100000,
    maxBodyBytes: 256 * 1024,
    ...customLimits
  };

  const networkOptions = {
    allowLocalHttp,
    proxyUrl,
    allowedHosts,
    allowedPrivateHosts
  };

  const logger = createStructuredLogger(customLogger);
  const rateLimiters =
    rateLimitConfig === false
      ? null
      : {
          chat: createRateLimiter({
            capacity: rateLimitConfig?.chatPerMinute ?? 30,
            refillPerSec: (rateLimitConfig?.chatPerMinute ?? 30) / 60
          }),
          test: createRateLimiter({
            capacity: rateLimitConfig?.testPerMinute ?? 10,
            refillPerSec: (rateLimitConfig?.testPerMinute ?? 10) / 60
          }),
          models: createRateLimiter({
            capacity: rateLimitConfig?.testPerMinute ?? 10,
            refillPerSec: (rateLimitConfig?.testPerMinute ?? 10) / 60
          })
        };

  const authLimit = rateLimitConfig?.authFailuresPerMinute ?? 10;
  const authLimiter =
    rateLimitConfig === false ? null : createRateLimiter({ capacity: authLimit, refillPerSec: authLimit / 60 });
  const guarded = async (fn, status = 200) => {
    try {
      return ok(await fn(), status);
    } catch (error) {
      return profileError(error);
    }
  };

  function normalizeMessagesInput(bodyOrInput, systemPrompt) {
    if (Array.isArray(bodyOrInput)) return bodyOrInput;
    if (typeof bodyOrInput === 'string' && bodyOrInput.trim()) {
      return [
        ...(typeof systemPrompt === 'string' && systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: bodyOrInput }
      ];
    }
    if (bodyOrInput && typeof bodyOrInput === 'object') {
      if (Array.isArray(bodyOrInput.messages)) return bodyOrInput.messages;
      if (typeof bodyOrInput.prompt === 'string' && bodyOrInput.prompt.trim()) {
        return [
          ...(typeof bodyOrInput.system === 'string' && bodyOrInput.system.trim()
            ? [{ role: 'system', content: bodyOrInput.system }]
            : []),
          { role: 'user', content: bodyOrInput.prompt }
        ];
      }
    }
    return null;
  }

  function rateIdentity(clientKey, principal) {
    if (clientKey) return `client:${clientKey}`;
    if (typeof principal?.id === 'string' && principal.id) return `principal:${principal.id}`;
    return 'anonymous';
  }

  async function testProfile(id, body, { principal, clientKey, requestId } = {}) {
    if (rateLimiters) {
      const key = rateIdentity(clientKey, principal);
      const res = rateLimiters.test.take(key);
      if (!res.ok) {
        return ok(
          {
            error: 'Çok fazla test isteği yapıldı. Lütfen biraz bekleyin.',
            code: ErrorCodes.RATE_LIMITED || 'RATE_LIMITED',
            retryAfterSec: res.retryAfterSec,
            requestId
          },
          429
        );
      }
    }

    const mode = body?.mode || 'quick';
    if (!['quick', 'conversation'].includes(mode))
      return ok({ error: 'Geçersiz test türü.', code: 'TEST_MODE_INVALID', requestId }, 400);
    if (pendingTests.has(id))
      return ok({ error: 'Bu profil için test devam ediyor.', code: 'TEST_IN_PROGRESS', requestId }, 409);
    pendingTests.add(id);
    const start = Date.now();
    let profile;
    try {
      profile = await store.get(id);
      if (!profile) return notFound();
      const quick = mode === 'quick';
      const purpose = quick ? 'quick' : 'diagnostic';
      const messages = testMessages ? testMessages(mode, profile) : defaultTestMessages(mode);
      const options = {
        ...profile,
        ...resolveRuntimeOptions(profile, { purpose }),
        purpose,
        ...networkOptions
      };
      const result = generate
        ? await generate(messages, options)
        : await generateProfileResponse(messages, profile, { ...options, acceptTruncated: quick, raw: true });
      const reply = typeof result === 'string' ? result : result?.content;
      const truncated = quick && result?.truncated === true;
      if (!reply && !truncated) {
        throw new LLMError(ErrorCodes.LLM_EMPTY_RESPONSE, 'Model kullanılabilir cevap üretmedi.', {
          status: 502,
          retryable: true
        });
      }
      if (validateTestReply && !truncated) await validateTestReply(reply, { mode, profile });
      const durationMs = Date.now() - start;
      if ((await store.recordTest(profile.id, 'passed', profile.revision, { mode, durationMs })) === null) {
        return ok(
          { error: 'Profil test sırasında değişti; yeniden sınayın.', code: 'PROFILE_CONFLICT', requestId },
          409
        );
      }
      return ok({
        ok: true,
        mode,
        ...(truncated ? { truncated: true } : {}),
        durationMs,
        message: truncated
          ? 'Bağlantı ve kimlik doğrulandı (model düşünme nedeniyle yanıtı kısa kesti; sohbet testini çalıştırın).'
          : quick
            ? 'Kısa bağlantı ve model yanıtı doğrulandı.'
            : 'Sohbet tarzı model yanıtı doğrulandı. Bu test üretim kabul testi değildir.',
        requestId
      });
    } catch (error) {
      if (isStoreFormatError(error)) throw error;
      const classified = classifyLLMError(error);
      if (profile) {
        try {
          await store.recordTest(profile.id, 'failed', profile.revision, {
            mode,
            durationMs: Date.now() - start,
            code: classified.code
          });
        } catch {}
      }
      return ok({ ...classified, mode, durationMs: Date.now() - start, requestId }, classified.status);
    } finally {
      pendingTests.delete(id);
    }
  }

  async function listModels(id, { principal, clientKey, requestId } = {}) {
    if (rateLimiters) {
      const key = rateIdentity(clientKey, principal);
      const res = rateLimiters.models.take(key);
      if (!res.ok) {
        return ok(
          {
            error: 'Çok fazla model listeleme isteği yapıldı. Lütfen biraz bekleyin.',
            code: ErrorCodes.RATE_LIMITED || 'RATE_LIMITED',
            retryAfterSec: res.retryAfterSec,
            requestId
          },
          429
        );
      }
    }

    try {
      const profile = await store.get(id);
      if (!profile) return notFound();
      const problem = credentialEndpointProblem(profile.provider, profile.baseURL, profile.apiKey);
      if (problem) return ok({ code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH', error: problem, requestId }, 400);
      const url = providerEndpoint(profile, 'models', networkOptions);
      const response = await providerFetch(url, {
        headers: providerAuthHeaders(profile),
        signal: AbortSignal.timeout(10000),
        ...networkOptions
      });
      if (!response.ok)
        return ok(
          {
            error: `Model listesi alınamadı (HTTP ${response.status}). Model kimliğini elle girebilirsiniz.`,
            requestId
          },
          502
        );
      return ok({ models: extractModelIds(await response.json(), profile), requestId });
    } catch (error) {
      if (isStoreFormatError(error)) throw error;
      return ok({ error: 'Model listesi alınamadı. Model kimliğini elle girebilirsiniz.', requestId }, 502);
    }
  }

  async function previewModels(body, { principal, clientKey, requestId } = {}) {
    if (principal && principal.isAdmin !== true) {
      return ok({ error: 'Yönetici yetkisi gerekli.', code: 'FORBIDDEN', requestId }, 403);
    }
    if (rateLimiters) {
      const key = rateIdentity(clientKey, principal);
      const res = rateLimiters.models.take(key);
      if (!res.ok) {
        return ok(
          {
            error: 'Çok fazla model listeleme isteği yapıldı. Lütfen biraz bekleyin.',
            code: ErrorCodes.RATE_LIMITED || 'RATE_LIMITED',
            retryAfterSec: res.retryAfterSec,
            requestId
          },
          429
        );
      }
    }

    const { provider, baseURL, apiKey: candidateKey, profileId } = body || {};
    if (!baseURL || !provider) {
      return ok({ error: 'Sağlayıcı ve API adresi zorunludur.', code: 'PARAMS_INVALID', requestId }, 400);
    }

    let apiKey = candidateKey;
    if (!apiKey && profileId) {
      const existing = await store.get(profileId);
      if (
        existing &&
        (existing.provider !== provider || existing.baseURL.replace(/\/+$/, '') !== String(baseURL).replace(/\/+$/, ''))
      ) {
        return ok(
          {
            error: 'Sağlayıcı veya API adresi değiştiğinde yeni API anahtarı girilmelidir.',
            code: ErrorCodes.PROFILE_INVALID,
            requestId
          },
          400
        );
      }
      if (existing?.apiKey) apiKey = existing.apiKey;
    }
    if (!apiKey) {
      return ok({ error: 'API anahtarı girilmelidir.', code: 'API_KEY_REQUIRED', requestId }, 400);
    }

    const dummyProfile = {
      provider,
      baseURL,
      apiKey
    };

    const problem = credentialEndpointProblem(provider, baseURL, apiKey);
    if (problem) return ok({ code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH', error: problem, requestId }, 400);

    try {
      const url = providerEndpoint(dummyProfile, 'models', networkOptions);
      const response = await providerFetch(url, {
        headers: providerAuthHeaders(dummyProfile),
        signal: AbortSignal.timeout(10000),
        ...networkOptions
      });
      if (!response.ok) {
        return ok(
          {
            error: `Model listesi alınamadı (HTTP ${response.status}). Model kimliğini elle girebilirsiniz.`,
            requestId
          },
          502
        );
      }
      return ok({ models: extractModelIds(await response.json(), dummyProfile), requestId });
    } catch {
      return ok({ error: 'Model listesi alınamadı. Model kimliğini elle girebilirsiniz.', requestId }, 502);
    }
  }

  async function chatCompletion(body, { principal, requestId, clientKey } = {}) {
    if (chatAccess === false) {
      return ok({ error: 'Sohbet uç noktası kapalı.', code: 'CHAT_DISABLED', requestId }, 404);
    }
    if (chatAccess === 'admin' && principal && principal.isAdmin !== true) {
      return ok({ error: 'Yönetici yetkisi gerekli.', code: 'FORBIDDEN', requestId }, 403);
    }

    if (rateLimiters) {
      const key = rateIdentity(clientKey, principal);
      const res = rateLimiters.chat.take(key);
      if (!res.ok) {
        return ok(
          {
            error: 'Çok fazla sohbet isteği yapıldı. Lütfen biraz bekleyin.',
            code: ErrorCodes.RATE_LIMITED || 'RATE_LIMITED',
            retryAfterSec: res.retryAfterSec,
            requestId
          },
          429
        );
      }
    }

    const messages = normalizeMessagesInput(body);
    if (!Array.isArray(messages) || !messages.length) {
      return ok(
        { error: 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.', code: 'MESSAGES_INVALID', requestId },
        400
      );
    }
    if (messages.length > limits.maxMessages) {
      return ok(
        { error: `En fazla ${limits.maxMessages} mesaj gönderilebilir.`, code: 'MESSAGES_INVALID', requestId },
        400
      );
    }

    let totalChars = 0;
    let hasUserMessage = false;
    for (const m of messages) {
      if (!m || typeof m !== 'object') {
        return ok({ error: 'Mesaj biçimi geçersiz.', code: 'MESSAGES_INVALID', requestId }, 400);
      }
      if (!['system', 'user', 'assistant'].includes(m.role)) {
        return ok(
          { error: "'role' yalnızca 'system', 'user' veya 'assistant' olabilir.", code: 'MESSAGES_INVALID', requestId },
          400
        );
      }
      if (typeof m.content !== 'string' || !m.content.trim()) {
        return ok(
          {
            error: 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.',
            code: 'MESSAGES_INVALID',
            requestId
          },
          400
        );
      }
      if (m.content.length > limits.maxSingleMessageChars) {
        return ok(
          {
            error: `Tek bir mesaj en fazla ${limits.maxSingleMessageChars} karakter olabilir.`,
            code: 'MESSAGES_INVALID',
            requestId
          },
          400
        );
      }
      totalChars += m.content.length;
      if (m.role === 'user') hasUserMessage = true;
    }

    if (!hasUserMessage) {
      return ok({ error: "En az bir 'user' mesajı zorunludur.", code: 'MESSAGES_INVALID', requestId }, 400);
    }
    if (totalChars > limits.maxChars) {
      return ok(
        { error: `Toplam mesaj boyutu ${limits.maxChars} karakteri aşamaz.`, code: 'MESSAGES_INVALID', requestId },
        400
      );
    }

    const canOverride =
      chatOverrides === 'all' ||
      (chatOverrides === 'admin' && (principal === undefined || principal?.isAdmin === true));

    let purpose;
    try {
      purpose = normalizePurpose(body?.purpose);
    } catch {
      return ok({ error: 'Geçersiz çağrı amacı (purpose).', code: 'PURPOSE_INVALID', requestId }, 400);
    }
    if (!canOverride && purpose !== 'quick') {
      purpose = 'default';
    }

    const profileIdToUse = canOverride && body?.profileId ? String(body.profileId) : null;
    const profile = profileIdToUse ? await store.get(profileIdToUse) : await store.getActive();
    if (!profile) {
      return profileIdToUse
        ? ok({ error: 'Profil bulunamadı.', code: 'PROFILE_NOT_FOUND', requestId }, 404)
        : ok({ error: 'Etkin LLM profili seçilmedi.', code: 'ACTIVE_PROFILE_MISSING', requestId }, 409);
    }

    const start = Date.now();
    let completionProfile = profile;
    try {
      const overrides = {};
      if (canOverride) {
        if (body?.timeoutMs !== undefined) overrides.timeoutMs = body.timeoutMs;
        if (body?.maxOutputTokens !== undefined) overrides.maxOutputTokens = body.maxOutputTokens;
        if (body?.thinking !== undefined) overrides.thinking = body.thinking;
        if (body?.temperature !== undefined) overrides.temperature = body.temperature;
        if (body?.topP !== undefined) overrides.topP = body.topP;
        if (body?.stop !== undefined) overrides.stop = body.stop;
        if (body?.responseFormat !== undefined) overrides.responseFormat = body.responseFormat;
      }
      if (purpose !== undefined) overrides.purpose = purpose;
      const timeoutBudget = resolveRuntimeOptions(profile, overrides).timeoutMs;
      const budgetSignal = AbortSignal.timeout(timeoutBudget);
      const requestSignal = body?.signal ? AbortSignal.any([body.signal, budgetSignal]) : budgetSignal;

      const candidateProfiles = [profile];
      if (Array.isArray(profile.fallbackProfileIds) && profile.fallbackProfileIds.length > 0) {
        for (const fbId of profile.fallbackProfileIds) {
          if (fbId && fbId !== profile.id) {
            const fbProfile = await store.get(fbId);
            if (fbProfile) candidateProfiles.push(fbProfile);
          }
        }
      }

      if (body?.stream === true) {
        async function* streamGenerator() {
          let lastStreamError;
          let yieldedAny = false;
          let finalStreamUsage = null;
          let completionCode = ErrorCodes.LLM_ABORTED;
          let currentProfile = profile;
          let isFallback = false;
          try {
            for (let pIdx = 0; pIdx < candidateProfiles.length; pIdx++) {
              currentProfile = candidateProfiles[pIdx];
              isFallback = pIdx > 0;
              const runtimeOpts = resolveRuntimeOptions(currentProfile, overrides);
              const options = {
                ...currentProfile,
                ...runtimeOpts,
                purpose,
                ...networkOptions,
                signal: requestSignal
              };

              try {
                let streamIterator;
                const first = await executeWithRetry(
                  async ({ signal }) => {
                    streamIterator = (
                      generateStream
                        ? generateStream(messages, { ...options, signal })
                        : generateProfileStream(messages, currentProfile, { ...options, signal })
                    )[Symbol.asyncIterator]();
                    try {
                      return await streamIterator.next();
                    } catch (error) {
                      await streamIterator.return?.();
                      throw error;
                    }
                  },
                  {
                    attempts: retryPolicy ? (retryPolicy.attempts ?? 2) : 0,
                    baseMs: retryPolicy?.baseMs ?? 500,
                    maxMs: retryPolicy?.maxMs ?? 4000,
                    deadlineMs: Math.max(0, timeoutBudget - (Date.now() - start)),
                    signal: requestSignal
                  }
                );

                finalStreamUsage = null;
                try {
                  for (let next = first; !next.done; next = await streamIterator.next()) {
                    const chunk = next.value;
                    yieldedAny = true;
                    if (chunk.type === 'done') {
                      finalStreamUsage = safeUsage(chunk.usage);
                      completionCode = 'OK';
                    }
                    yield chunk.type === 'done'
                      ? {
                          ...chunk,
                          usage: safeUsage(chunk.usage),
                          profileId: currentProfile.id,
                          fallbackUsed: isFallback
                        }
                      : chunk;
                  }
                } finally {
                  await streamIterator.return?.();
                }
                if (requestSignal.aborted) {
                  throw new LLMError(
                    requestSignal.reason?.name === 'TimeoutError' ? ErrorCodes.LLM_TIMEOUT : ErrorCodes.LLM_ABORTED,
                    requestSignal.reason?.name === 'TimeoutError'
                      ? 'Model yanıtı süre sınırını aştı.'
                      : 'İstek iptal edildi.',
                    { retryable: false }
                  );
                }
                completionCode = 'OK';
                logger.info('chat.stream.completed', {
                  requestId,
                  profileId: currentProfile.id,
                  provider: currentProfile.provider,
                  model: currentProfile.model,
                  durationMs: Date.now() - start,
                  fallbackUsed: isFallback
                });
                return;
              } catch (err) {
                lastStreamError = err;
                if (err?.usage) finalStreamUsage = safeUsage(err.usage);
                const classified = classifyLLMError(err);
                if (
                  requestSignal.aborted ||
                  yieldedAny ||
                  !classified.retryable ||
                  pIdx === candidateProfiles.length - 1
                ) {
                  throw err;
                }
                logger.warn('chat.fallback', {
                  requestId,
                  failedProfileId: currentProfile.id,
                  nextProfileId: candidateProfiles[pIdx + 1]?.id,
                  error: classified.error,
                  code: classified.code
                });
              }
            }
            throw lastStreamError;
          } catch (error) {
            completionCode = classifyLLMError(error).code;
            throw error;
          } finally {
            if (requestSignal.aborted) {
              completionCode =
                requestSignal.reason?.name === 'TimeoutError' ? ErrorCodes.LLM_TIMEOUT : ErrorCodes.LLM_ABORTED;
            }
            await usageTracker.record({
              profileId: currentProfile.id,
              model: currentProfile.model,
              durationMs: Date.now() - start,
              inputTokens: finalStreamUsage?.inputTokens || 0,
              outputTokens: finalStreamUsage?.outputTokens || 0,
              code: completionCode
            });
            logger[completionCode === 'OK' ? 'info' : 'warn']('chat.completed', {
              requestId,
              profileId: currentProfile.id,
              provider: currentProfile.provider,
              model: currentProfile.model,
              durationMs: Date.now() - start,
              usage: finalStreamUsage,
              code: completionCode,
              fallbackUsed: isFallback
            });
          }
        }

        return {
          status: 200,
          isStream: true,
          stream: streamGenerator(),
          requestId
        };
      }

      let lastError;
      for (let pIdx = 0; pIdx < candidateProfiles.length; pIdx++) {
        const currentProfile = candidateProfiles[pIdx];
        completionProfile = currentProfile;
        const isFallback = pIdx > 0;
        const runtimeOpts = resolveRuntimeOptions(currentProfile, overrides);
        const options = {
          ...currentProfile,
          ...runtimeOpts,
          purpose,
          ...networkOptions
        };

        try {
          const executeOnce = async ({ signal } = {}) => {
            if (generate) {
              return await generate(messages, { ...options, signal });
            }
            return await generateProfileResponse(messages, currentProfile, {
              ...options,
              signal,
              raw: true
            });
          };

          const responseResult = await executeWithRetry(executeOnce, {
            attempts: retryPolicy ? (retryPolicy.attempts ?? 2) : 0,
            baseMs: retryPolicy?.baseMs ?? 500,
            maxMs: retryPolicy?.maxMs ?? 4000,
            deadlineMs: Math.max(0, timeoutBudget - (Date.now() - start)),
            signal: requestSignal
          });

          const content = typeof responseResult === 'string' ? responseResult : responseResult?.content;
          const finishReason = typeof responseResult === 'object' ? responseResult?.finishReason : 'stop';
          const usage = typeof responseResult === 'object' ? safeUsage(responseResult?.usage) : null;

          if (!content) {
            throw new LLMError(ErrorCodes.LLM_EMPTY_RESPONSE, 'Model kullanılabilir cevap üretmedi.', {
              status: 502,
              retryable: true
            });
          }

          const durationMs = Date.now() - start;
          await usageTracker.record({
            profileId: currentProfile.id,
            model: currentProfile.model,
            durationMs,
            inputTokens: usage?.inputTokens || 0,
            outputTokens: usage?.outputTokens || 0,
            code: 'OK'
          });

          logger.info('chat.completed', {
            requestId,
            profileId: currentProfile.id,
            provider: currentProfile.provider,
            model: currentProfile.model,
            durationMs,
            usage,
            fallbackUsed: isFallback,
            code: 'OK'
          });

          return ok({
            ok: true,
            content,
            text: content,
            profileId: currentProfile.id,
            profileName: currentProfile.name,
            provider: currentProfile.provider,
            model: currentProfile.model,
            durationMs,
            usage,
            finishReason,
            requestId,
            ...(isFallback ? { fallbackUsed: true, primaryProfileId: profile.id } : {})
          });
        } catch (err) {
          lastError = err;
          const classified = classifyLLMError(err);
          if (!classified.retryable || pIdx === candidateProfiles.length - 1) {
            throw err;
          }
          logger.warn('chat.fallback', {
            requestId,
            failedProfileId: currentProfile.id,
            nextProfileId: candidateProfiles[pIdx + 1]?.id,
            error: classified.error,
            code: classified.code
          });
        }
      }

      throw lastError;
    } catch (error) {
      if (isStoreFormatError(error)) throw error;
      const classified = classifyLLMError(error);
      if (classified.code === ErrorCodes.RUNTIME_OPTIONS_INVALID) {
        return ok({ error: error.message, code: ErrorCodes.RUNTIME_OPTIONS_INVALID, requestId }, 400);
      }
      const durationMs = Date.now() - start;
      await usageTracker.record({
        profileId: completionProfile.id,
        model: completionProfile.model,
        durationMs,
        inputTokens: 0,
        outputTokens: 0,
        code: classified.code || 'ERROR'
      });
      logger.warn('chat.completed', {
        requestId,
        profileId: completionProfile.id,
        provider: completionProfile.provider,
        model: completionProfile.model,
        durationMs,
        usage: null,
        fallbackUsed: completionProfile.id !== profile.id,
        code: classified.code
      });
      return ok({ ...classified, durationMs, requestId }, classified.status);
    }
  }

  // Tek satırlık kullanım: await llm.ask('Merhaba!') veya await llm.ask([{ role: 'user', content: '...' }])
  async function ask(promptOrMessages, options = {}) {
    const messages = normalizeMessagesInput(promptOrMessages, options.system);
    if (!Array.isArray(messages) || !messages.length) {
      throw new LLMError(ErrorCodes.MESSAGES_INVALID, 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.', {
        status: 400,
        retryable: false
      });
    }
    const result = await chatCompletion({ ...options, messages }, { principal: { isAdmin: true } });
    if (result.status !== 200) {
      throw new LLMError(result.body?.code || 'LLM_ERROR', result.body?.error || 'Model çağrısı başarısız.', {
        status: result.status
      });
    }
    if (options.raw === true) {
      return result.body;
    }
    return result.body.content;
  }

  // Akışlı kullanım: for await (const chunk of llm.stream('Merhaba!')) { ... }
  async function* stream(promptOrMessages, options = {}) {
    const messages = normalizeMessagesInput(promptOrMessages, options.system);
    if (!Array.isArray(messages) || !messages.length) {
      throw new LLMError(ErrorCodes.MESSAGES_INVALID, 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.', {
        status: 400,
        retryable: false
      });
    }
    const result = await chatCompletion({ ...options, messages, stream: true }, { principal: { isAdmin: true } });
    if (result.status !== 200) {
      throw new LLMError(result.body?.code || 'LLM_ERROR', result.body?.error || 'Model çağrısı başarısız.', {
        status: result.status
      });
    }
    if (result.isStream && result.stream) {
      yield* result.stream;
    }
  }

  // path: eklenti köküne göre göreli yol, örn. '/profiles/abc/test' veya '/chat'.
  async function handle(input = {}) {
    try {
      return await handleRoute(input);
    } catch (error) {
      if (!isStoreFormatError(error)) throw error;
      const publicHealth =
        String(input.method || 'GET').toUpperCase() === 'GET' && /^\/health\/?(?:\?|$)/.test(input.path || '');
      return ok(
        {
          code: error.code,
          error: publicHealth ? 'Profil depolama alanı okunamadı. Yöneticiyle iletişime geçin.' : error.message,
          requestId: input.requestId
        },
        500
      );
    }
  }

  async function handleRoute({ method, path: routePath, body, query, principal, requestId, clientKey, signal } = {}) {
    const verb = String(method || 'GET').toUpperCase();
    const cleanPath = (routePath || '').split('?')[0];
    const match = /^\/(catalog|chat|profiles|models|health|usage)(?:\/([^/]+)(?:\/(activate|test|models))?)?\/?$/.exec(
      cleanPath
    );
    if (!match) return null;
    const [, resource, rawId, action] = match;
    let id;
    try {
      id = rawId === undefined ? undefined : decodeURIComponent(rawId);
    } catch {
      return notFound();
    }

    if (resource === 'health') {
      if (health === false || verb !== 'GET' || id !== undefined) return null;
      const active = await store.getActive();
      return ok({
        ok: true,
        version: PACKAGE_VERSION,
        hasActiveProfile: Boolean(active),
        requestId
      });
    }

    if (resource === 'usage') {
      if (principal && principal.isAdmin !== true) {
        return ok({ error: 'Yönetici yetkisi gerekli.', code: 'FORBIDDEN', requestId }, 403);
      }
      if (verb !== 'GET' || id !== undefined) return null;
      let queryMonth = query?.month;
      if (!queryMonth && routePath && routePath.includes('?')) {
        try {
          const parsed = new URL(routePath, 'http://localhost');
          queryMonth = parsed.searchParams.get('month');
        } catch {}
      }
      const targetMonth = queryMonth || new Date().toISOString().slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
        return ok({ error: 'Geçersiz ay formatı. YYYY-MM bekleniyor.', code: 'PARAMS_INVALID', requestId }, 400);
      }
      const summary = await usageTracker.getSummary(targetMonth);
      return ok({ ok: true, ...summary, requestId });
    }

    if (resource === 'catalog')
      return verb === 'GET' && id === undefined
        ? ok({ providers: PROVIDERS, catalogVersion: CATALOG_VERSION, updatedAt: CATALOG_UPDATED_AT, requestId })
        : null;
    if (resource === 'models')
      return verb === 'POST' && id === 'preview' ? previewModels(body, { principal, clientKey, requestId }) : null;
    if (resource === 'chat')
      return verb === 'POST' && id === undefined
        ? chatCompletion(body ? { ...body, signal: body.signal || signal } : { signal }, {
            principal,
            requestId,
            clientKey
          })
        : null;

    if (id === undefined) {
      if (verb === 'GET') return ok(await store.list());
      if (verb === 'POST') {
        const res = await guarded(() => store.save(body), 201);
        if (res.status === 201 && res.body?.id) {
          logger.info('profile.saved', {
            profileId: res.body.id,
            name: res.body.name,
            provider: res.body.provider,
            model: res.body.model
          });
        }
        return res;
      }
      return null;
    }
    if (!action) {
      if (verb === 'PUT') {
        const res = await guarded(() => store.save({ ...body, id }));
        if (res.status === 200 && res.body?.id) {
          logger.info('profile.saved', {
            profileId: res.body.id,
            name: res.body.name,
            provider: res.body.provider,
            model: res.body.model
          });
        }
        return res;
      }
      if (verb === 'DELETE') return guarded(() => store.remove(id, body?.revision));
      return null;
    }
    if (action === 'activate' && verb === 'POST') return guarded(() => store.activate(id, body?.revision));
    if (action === 'test' && verb === 'POST') return testProfile(id, body, { principal, clientKey, requestId });
    if (action === 'models' && verb === 'GET') return listModels(id, { principal, clientKey, requestId });
    return null;
  }

  // Next.js, SvelteKit, Nuxt, Astro, Hono, Bun/Deno için standart Web Request -> Response adaptörü.
  async function fetchHandler(
    request,
    {
      apiPath = '/api/llm',
      pagePath = '/llm',
      requireCsrf = true,
      locale: customLocale,
      homeUrl: customHomeUrl,
      adminPassword: password = adminPassword,
      adminUser: user = adminUser,
      chatTokens: tokens = chatTokens,
      authorize: authorizeRequest = authorize,
      insecureNoAuth: allowNoAuth = insecureNoAuth
    } = {}
  ) {
    const activeLocale = customLocale || locale || 'tr';
    const activeHomeUrl = customHomeUrl || homeUrl || '/';
    const key = `${apiPath}|${pagePath}|${activeLocale}|${activeHomeUrl}`;
    if (cachedUiKey !== key) {
      cachedUi = createUiAssets({ apiPath, pagePath, locale: activeLocale, homeUrl: activeHomeUrl });
      cachedUiKey = key;
    }
    const requestId = sanitizeRequestId(request.headers.get('x-request-id'));
    const commonHeaders = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'x-request-id': requestId
    };
    const parsedReqUrl = new URL(request.url, 'http://localhost');
    const pathname = parsedReqUrl.pathname;
    const query = Object.fromEntries(parsedReqUrl.searchParams.entries());
    const clientKey = typeof getClientId === 'function' ? getClientId(request) : null;
    const isApi = pathname === apiPath || pathname.startsWith(`${apiPath}/`);
    const isManaged = isApi || pathname === pagePath || pathname === `${pagePath}/llm-ui.js`;
    const isHealth = request.method === 'GET' && pathname === `${apiPath}/health`;
    let principal;
    if (isManaged && !isHealth) {
      const authorization = request.headers.get('authorization') || '';
      const deny = (status, code, error) =>
        Response.json(
          { code, error, requestId },
          {
            status,
            headers: {
              ...commonHeaders,
              ...(status === 401 ? { 'WWW-Authenticate': 'Basic realm="LLM Yonetimi"' } : {})
            }
          }
        );
      principal = checkBearerToken(authorization, tokens);
      if (!principal) {
        if (typeof authorizeRequest === 'function') principal = await authorizeRequest(request);
        else if (password) principal = checkBasicAuth(authorization, { user, password }).principal;
        else if (allowNoAuth === true) principal = { isAdmin: true, kind: 'insecure' };
        else {
          if (!warnedMissingAuth) {
            warnedMissingAuth = true;
            const warning = 'LLM yönetimi kimlik doğrulaması yapılandırılmadığı için kapalı.';
            if (customLogger) logger.warn(warning);
            else console.warn(warning);
          }
          return deny(500, 'AUTH_NOT_CONFIGURED', 'Kimlik doğrulama yapılandırılmadı.');
        }
      }
      if (!principal) {
        const limit = authLimiter?.take(clientKey || 'anonymous');
        if (limit && !limit.ok) {
          const response = deny(429, 'RATE_LIMITED', 'Çok fazla hatalı giriş denemesi yapıldı.');
          response.headers.set('Retry-After', String(limit.retryAfterSec));
          return response;
        }
        logger.warn('auth.failed', { requestId, ip: clientKey || undefined });
        return deny(401, 'UNAUTHORIZED', 'Kimlik doğrulama gerekli.');
      }
      authLimiter?.reset(clientKey || 'anonymous');
      const isChat = pathname === `${apiPath}/chat` && request.method === 'POST';
      if (principal.isAdmin !== true && (!isChat || chatAccess === 'admin')) {
        return deny(403, 'FORBIDDEN', 'Yönetici yetkisi gerekli.');
      }
    }
    if (request.method === 'GET' && pathname === pagePath) {
      return new Response(cachedUi.html, {
        status: 200,
        headers: {
          ...commonHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      });
    }
    if (request.method === 'GET' && pathname === `${pagePath}/llm-ui.js`) {
      return new Response(cachedUi.script, {
        status: 200,
        headers: { ...commonHeaders, 'Content-Type': 'text/javascript; charset=utf-8' }
      });
    }
    if (pathname === apiPath || pathname.startsWith(`${apiPath}/`)) {
      if (requireCsrf && !SAFE_METHODS.includes(request.method) && request.headers.get(CSRF_HEADER) !== '1') {
        return Response.json(
          { error: 'İstek doğrulama başlığı eksik.', code: 'CSRF_REQUIRED', requestId },
          { status: 403, headers: commonHeaders }
        );
      }
      const subPath = pathname.slice(apiPath.length) || '/';
      let body = null;
      if (!SAFE_METHODS.includes(request.method)) {
        const contentLength = Number(request.headers.get('content-length'));
        if (contentLength && contentLength > limits.maxBodyBytes) {
          return Response.json(
            { error: 'Gövde boyutu sınırı aştı.', code: 'BODY_TOO_LARGE', requestId },
            { status: 413, headers: commonHeaders }
          );
        }

        if (request.body) {
          const reader = request.body.getReader();
          const chunks = [];
          let byteCount = 0;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              byteCount += value.byteLength;
              if (byteCount > limits.maxBodyBytes) {
                await reader.cancel();
                return Response.json(
                  { error: 'Gövde boyutu sınırı aştı.', code: 'BODY_TOO_LARGE', requestId },
                  { status: 413, headers: commonHeaders }
                );
              }
              chunks.push(Buffer.from(value));
            }
          } finally {
            reader.releaseLock();
          }
          const raw = Buffer.concat(chunks).toString('utf8').trim();
          if (raw) {
            try {
              body = JSON.parse(raw);
            } catch {
              return Response.json(
                { error: 'Geçersiz JSON gövdesi.', code: ErrorCodes.BODY_INVALID || 'BODY_INVALID', requestId },
                { status: 400, headers: commonHeaders }
              );
            }
          } else {
            body = {};
          }
        } else {
          body = {};
        }
      }

      const responseAbort = new AbortController();
      const responseSignal = AbortSignal.any([request.signal, responseAbort.signal]);
      const result = await handle({
        principal,
        method: request.method,
        path: subPath,
        query,
        body,
        requestId,
        clientKey,
        signal: responseSignal
      });
      if (!result) return new Response(null, { status: 404, headers: commonHeaders });
      if (result.status === 429 && result.body?.retryAfterSec) {
        commonHeaders['Retry-After'] = String(result.body.retryAfterSec);
      }

      if (result.isStream && result.stream) {
        let cancelled = false;
        const sseStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of result.stream) {
                if (cancelled || responseSignal.aborted) break;
                if (chunk.type === 'delta') {
                  controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`));
                } else if (chunk.type === 'done') {
                  controller.enqueue(
                    encoder.encode(
                      `event: done\ndata: ${JSON.stringify({ usage: chunk.usage, finishReason: chunk.finishReason, profileId: chunk.profileId, fallbackUsed: chunk.fallbackUsed })}\n\n`
                    )
                  );
                }
              }
              if (!cancelled) controller.close();
            } catch (err) {
              if (cancelled) return;
              const classified = classifyLLMError(err);
              controller.enqueue(
                encoder.encode(
                  `event: error\ndata: ${JSON.stringify({ error: classified.error, code: classified.code, status: classified.status, requestId })}\n\n`
                )
              );
              controller.close();
            }
          },
          cancel() {
            cancelled = true;
            responseAbort.abort();
          }
        });

        return new Response(sseStream, {
          status: 200,
          headers: {
            ...commonHeaders,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive'
          }
        });
      }

      if (result.body === undefined) return new Response(null, { status: result.status, headers: commonHeaders });
      const responseBody =
        result.status >= 400 && result.body && typeof result.body === 'object'
          ? { ...result.body, requestId }
          : result.body;
      return Response.json(responseBody, { status: result.status, headers: commonHeaders });
    }
    return new Response(null, { status: 404, headers: commonHeaders });
  }

  return { handle, ask, stream, fetch: fetchHandler, store };
}
