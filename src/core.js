// Framework-bağımsız çekirdek: HTTP çerçevesi (Express, Fastify, Koa, Next.js...) bilmez.
// Girdi: { method, path, body }  ->  Çıktı: { status, body } veya eşleşme yoksa null.
// Kimlik doğrulama, yönetici yetkisi ve CSRF denetimi host/adaptör sorumluluğundadır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialEndpointProblem } from './credentialValidation.js';
import { LLMError, ErrorCodes } from './errors.js';
import { createRateLimiter } from './rateLimit.js';
import { createStructuredLogger, redact, sanitizeRequestId } from './logger.js';
import {
  generateProfileResponse,
  classifyLLMError,
  providerEndpoint,
  providerAuthHeaders,
  resolveRuntimeOptions,
  executeWithRetry
} from './runtime.js';
import { providerFetch } from './providerTransport.js';
import { PROVIDERS, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import { getTransport } from './transports/index.js';

export {
  LLMError,
  ErrorCodes,
  generateProfileResponse,
  classifyLLMError,
  PROVIDERS,
  validateProviderUrl,
  createLLMProfileStore,
  createRateLimiter,
  createStructuredLogger,
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
export function createUiAssets({ apiPath = '/api/llm', pagePath = '/llm' } = {}) {
  if (![apiPath, pagePath].every(isValidMountPath)) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Geçersiz eklenti mount yolu.', {
      status: 400,
      retryable: false
    });
  }
  let html = fs.readFileSync(path.join(publicDir, 'llm.html'), 'utf8');
  html = html.replace(/data-api-base="[^"]*"/, `data-api-base="${apiPath}"`);
  if (!html.includes('data-api-base=')) html = html.replace('<body', `<body data-api-base="${apiPath}"`);
  html = html.replace(/src="(?:\.\/|\/llm\/)llm-ui\.js"/, `src="${pagePath}/llm-ui.js"`);
  const script = fs.readFileSync(path.join(publicDir, 'llm-ui.js'), 'utf8');
  return { html, script };
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
      content: 'Bir yazılım projesinin Manager ajanısın. Türkçe yanıt ver; yapılmamış işlemi yapılmış gibi gösterme.'
    },
    {
      role: 'user',
      content:
        'Otel yönetimi uygulaması için oda, rezervasyon, kullanıcı rolleri ve veri güvenliğini kapsayan kısa bir mimari plan öner.'
    }
  ];
}

const ok = (body, status = 200) => ({ status, body });
const notFound = () => ({ status: 404 });
const profileError = error => ({
  status:
    error.status ||
    (error.code === ErrorCodes.PROFILE_NOT_FOUND ? 404 : error.code === ErrorCodes.PROFILE_CONFLICT ? 409 : 400),
  body: { error: error.message, code: error.code || ErrorCodes.PROFILE_INVALID }
});

export function createLLMManager({
  dataDir,
  filePath,
  encryptionKey,
  allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true',
  store = createLLMProfileStore({ dataDir, filePath, encryptionKey, allowLocalHttp }),
  generate,
  testMessages,
  validateTestReply,
  limits: customLimits,
  chatOverrides = 'admin',
  chatAccess = 'authenticated',
  rateLimit: rateLimitConfig,
  retry: retryConfig,
  logger: customLogger = null,
  getClientId
} = {}) {
  const pendingTests = new Set();
  let cachedUiKey = '';
  let cachedUi = null;

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

  async function testProfile(id, body, { clientKey, requestId } = {}) {
    if (rateLimiters) {
      const key = clientKey || id;
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
      const purpose = quick ? 'quick' : 'manager';
      const messages = testMessages ? testMessages(mode, profile) : defaultTestMessages(mode);
      const options = {
        ...profile,
        ...resolveRuntimeOptions(profile, { purpose }),
        purpose,
        allowLocalHttp,
        useManagedProfile: false,
        allowMockFallback: false
      };
      const reply = generate
        ? await generate(messages, options)
        : await generateProfileResponse(messages, profile, options);
      if (!reply) {
        throw new LLMError(ErrorCodes.LLM_EMPTY_RESPONSE, 'Model kullanılabilir cevap üretmedi.', {
          status: 502,
          retryable: true
        });
      }
      if (validateTestReply) await validateTestReply(reply, { mode, profile });
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
        durationMs,
        message: quick
          ? 'Kısa bağlantı ve model yanıtı doğrulandı.'
          : 'Sohbet tarzı model yanıtı doğrulandı. Bu test üretim kabul testi değildir.',
        requestId
      });
    } catch (error) {
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

  async function listModels(id, { clientKey, requestId } = {}) {
    if (rateLimiters) {
      const key = clientKey || id;
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
      const url = providerEndpoint(profile, 'models', allowLocalHttp);
      const response = await providerFetch(url, {
        headers: providerAuthHeaders(profile),
        signal: AbortSignal.timeout(10000),
        allowLocalHttp
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
      const key = clientKey || (principal?.isAdmin ? 'admin' : principal?.id || 'client');
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

    let purpose = body?.purpose;
    if (purpose !== undefined && !['quick', 'manager', 'production'].includes(purpose)) {
      return ok({ error: 'Geçersiz çağrı amacı (purpose).', code: 'PURPOSE_INVALID', requestId }, 400);
    }
    if (!canOverride && purpose !== 'quick') {
      purpose = undefined;
    }

    const profileIdToUse = canOverride && body?.profileId ? String(body.profileId) : null;
    const profile = profileIdToUse ? await store.get(profileIdToUse) : await store.getActive();
    if (!profile) {
      return profileIdToUse
        ? ok({ error: 'Profil bulunamadı.', code: 'PROFILE_NOT_FOUND', requestId }, 404)
        : ok({ error: 'Etkin LLM profili seçilmedi.', code: 'ACTIVE_PROFILE_MISSING', requestId }, 409);
    }

    const start = Date.now();
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

      const candidateProfiles = [profile];
      if (Array.isArray(profile.fallbackProfileIds) && profile.fallbackProfileIds.length > 0) {
        for (const fbId of profile.fallbackProfileIds) {
          if (fbId && fbId !== profile.id) {
            const fbProfile = await store.get(fbId);
            if (fbProfile) candidateProfiles.push(fbProfile);
          }
        }
      }

      let lastError;
      for (let pIdx = 0; pIdx < candidateProfiles.length; pIdx++) {
        const currentProfile = candidateProfiles[pIdx];
        const isFallback = pIdx > 0;
        const runtimeOpts = resolveRuntimeOptions(currentProfile, overrides);
        const options = {
          ...currentProfile,
          ...runtimeOpts,
          purpose,
          allowLocalHttp,
          useManagedProfile: false,
          allowMockFallback: false
        };

        try {
          const executeOnce = async ({ signal } = {}) => {
            if (generate) {
              return await generate(messages, options);
            }
            return await generateProfileResponse(messages, currentProfile, {
              ...options,
              signal,
              raw: true
            });
          };

          const responseResult = retryPolicy
            ? await executeWithRetry(executeOnce, {
                attempts: retryPolicy.attempts ?? 2,
                baseMs: retryPolicy.baseMs ?? 500,
                maxMs: retryPolicy.maxMs ?? 4000,
                deadlineMs: runtimeOpts.timeoutMs,
                signal: body?.signal
              })
            : await executeOnce({ signal: body?.signal });

          const content = typeof responseResult === 'string' ? responseResult : responseResult?.content;
          const finishReason = typeof responseResult === 'object' ? responseResult?.finishReason : 'stop';
          const usage = typeof responseResult === 'object' ? responseResult?.usage : null;

          if (!content) {
            throw new LLMError(ErrorCodes.LLM_EMPTY_RESPONSE, 'Model kullanılabilir cevap üretmedi.', {
              status: 502,
              retryable: true
            });
          }

          const durationMs = Date.now() - start;
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
      if (
        error?.code === ErrorCodes.RUNTIME_OPTIONS_INVALID ||
        (!error?.upstreamStatus &&
          !error?.code &&
          /Yanıt süresi|Token bütçesi|düşünme ayarı/.test(error?.message || ''))
      ) {
        return ok({ error: error.message, code: ErrorCodes.RUNTIME_OPTIONS_INVALID, requestId }, 400);
      }
      const classified = classifyLLMError(error);
      const durationMs = Date.now() - start;
      logger.warn('chat.completed', {
        requestId,
        profileId: profile.id,
        provider: profile.provider,
        model: profile.model,
        durationMs,
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

  // path: eklenti köküne göre göreli yol, örn. '/profiles/abc/test' veya '/chat'.
  async function handle({ method, path: routePath, body, principal, requestId, clientKey } = {}) {
    const verb = String(method || 'GET').toUpperCase();
    const match = /^\/(catalog|chat|profiles)(?:\/([^/]+)(?:\/(activate|test|models))?)?\/?$/.exec(routePath || '');
    if (!match) return null;
    const [, resource, rawId, action] = match;
    let id;
    try {
      id = rawId === undefined ? undefined : decodeURIComponent(rawId);
    } catch {
      return notFound();
    }

    if (resource === 'catalog')
      return verb === 'GET' && id === undefined ? ok({ providers: PROVIDERS, requestId }) : null;
    if (resource === 'chat')
      return verb === 'POST' && id === undefined ? chatCompletion(body, { principal, requestId, clientKey }) : null;

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
    if (action === 'test' && verb === 'POST') return testProfile(id, body, { clientKey, requestId });
    if (action === 'models' && verb === 'GET') return listModels(id, { clientKey, requestId });
    return null;
  }

  // Next.js, SvelteKit, Nuxt, Astro, Hono, Bun/Deno için standart Web Request -> Response adaptörü.
  async function fetchHandler(request, { apiPath = '/api/llm', pagePath = '/llm', requireCsrf = true } = {}) {
    const key = `${apiPath}|${pagePath}`;
    if (cachedUiKey !== key) {
      cachedUi = createUiAssets({ apiPath, pagePath });
      cachedUiKey = key;
    }
    const requestId = sanitizeRequestId(request.headers.get('x-request-id'));
    const commonHeaders = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'x-request-id': requestId
    };
    const pathname = new URL(request.url, 'http://localhost').pathname;
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

      const clientKey = typeof getClientId === 'function' ? getClientId(request) : null;
      const result = await handle({ method: request.method, path: subPath, body, requestId, clientKey });
      if (!result) return new Response(null, { status: 404, headers: commonHeaders });
      if (result.body === undefined) return new Response(null, { status: result.status, headers: commonHeaders });
      return Response.json(result.body, { status: result.status, headers: commonHeaders });
    }
    return new Response(null, { status: 404, headers: commonHeaders });
  }

  return { handle, ask, fetch: fetchHandler, store };
}
