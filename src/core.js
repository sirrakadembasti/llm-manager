// Framework-bağımsız çekirdek: HTTP çerçevesi (Express, Fastify, Koa, Next.js...) bilmez.
// Girdi: { method, path, body }  ->  Çıktı: { status, body } veya eşleşme yoksa null.
// Kimlik doğrulama, yönetici yetkisi ve CSRF denetimi host/adaptör sorumluluğundadır.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { credentialEndpointProblem } from './credentialValidation.js';
import {
  generateProfileResponse,
  classifyLLMError,
  providerEndpoint,
  providerAuthHeaders,
  resolveRuntimeOptions
} from './runtime.js';
import { providerFetch } from './providerTransport.js';
import { PROVIDERS, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';

export { generateProfileResponse, classifyLLMError, PROVIDERS, validateProviderUrl, createLLMProfileStore };
export const CSRF_HEADER = 'X-LLM-CSRF';
export const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

export function isValidMountPath(value) {
  return typeof value === 'string' && /^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value);
}

// Yönetim sayfası ve betiği bir kez okunup yol ayarlarıyla önbelleğe alınır.
export function createUiAssets({ apiPath = '/api/llm', pagePath = '/llm' } = {}) {
  if (![apiPath, pagePath].every(isValidMountPath)) throw new Error('Geçersiz eklenti mount yolu.');
  let html = fs.readFileSync(path.join(publicDir, 'llm.html'), 'utf8');
  html = html.replace(/data-api-base="[^"]*"/, `data-api-base="${apiPath}"`);
  if (!html.includes('data-api-base=')) html = html.replace('<body', `<body data-api-base="${apiPath}"`);
  html = html.replace(/src="(?:\.\/|\/llm\/)llm-ui\.js"/, `src="${pagePath}/llm-ui.js"`);
  const script = fs.readFileSync(path.join(publicDir, 'llm-ui.js'), 'utf8');
  return { html, script };
}

// Sağlayıcı yanıtından benzersiz, temizlenmiş model kimliği listesi çıkarır.
function extractModelIds(body, profile) {
  const isGoogle = profile.transport === 'google';
  const ids = (body.data || body.models || [])
    .filter(item => !isGoogle || item.supportedGenerationMethods?.includes('generateContent'))
    .map(item => item.id || item.name)
    .filter(Boolean)
    .map(id => isGoogle ? String(id).replace(/^models\//, '') : String(id));
  return [...new Set(ids)].filter(id => id.length <= 160).slice(0, 500);
}

function defaultTestMessages(mode) {
  if (mode === 'quick') return [{ role: 'user', content: 'Yalnızca OK yaz.' }];
  return [
    { role: 'system', content: 'Bir yazılım projesinin Manager ajanısın. Türkçe yanıt ver; yapılmamış işlemi yapılmış gibi gösterme.' },
    { role: 'user', content: 'Otel yönetimi uygulaması için oda, rezervasyon, kullanıcı rolleri ve veri güvenliğini kapsayan kısa bir mimari plan öner.' }
  ];
}

const ok = (body, status = 200) => ({ status, body });
const notFound = () => ({ status: 404 });
const profileError = error => ({
  status: error.code === 'PROFILE_NOT_FOUND' ? 404 : error.code === 'PROFILE_CONFLICT' ? 409 : 400,
  body: { error: error.message, code: error.code || 'PROFILE_INVALID' }
});

export function createLLMManager({
  dataDir,
  filePath,
  encryptionKey,
  allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true',
  store = createLLMProfileStore({ dataDir, filePath, encryptionKey, allowLocalHttp }),
  generate,
  testMessages,
  validateTestReply
} = {}) {
  const pendingTests = new Set();
  let cachedUiKey = '';
  let cachedUi = null;

  const guarded = (fn, status = 200) => {
    try { return ok(fn(), status); } catch (error) { return profileError(error); }
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
          ...(typeof bodyOrInput.system === 'string' && bodyOrInput.system.trim() ? [{ role: 'system', content: bodyOrInput.system }] : []),
          { role: 'user', content: bodyOrInput.prompt }
        ];
      }
    }
    return null;
  }

  async function testProfile(id, body) {
    const mode = body?.mode || 'quick';
    if (!['quick', 'conversation'].includes(mode)) return ok({ error: 'Geçersiz test türü.', code: 'TEST_MODE_INVALID' }, 400);
    if (pendingTests.has(id)) return ok({ error: 'Bu profil için test devam ediyor.', code: 'TEST_IN_PROGRESS' }, 409);
    pendingTests.add(id);
    const start = Date.now();
    let profile;
    try {
      profile = store.get(id);
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
      const reply = generate ? await generate(messages, options) : await generateProfileResponse(messages, profile, options);
      if (!reply) {
        const error = new Error('Model kullanılabilir cevap üretmedi.');
        error.code = 'LLM_EMPTY_RESPONSE';
        throw error;
      }
      if (validateTestReply) await validateTestReply(reply, { mode, profile });
      const durationMs = Date.now() - start;
      if (store.recordTest(profile.id, 'passed', profile.revision, { mode, durationMs }) === null) {
        return ok({ error: 'Profil test sırasında değişti; yeniden sınayın.', code: 'PROFILE_CONFLICT' }, 409);
      }
      return ok({
        ok: true, mode, durationMs,
        message: quick
          ? 'Kısa bağlantı ve model yanıtı doğrulandı.'
          : 'Sohbet tarzı model yanıtı doğrulandı. Bu test üretim kabul testi değildir.'
      });
    } catch (error) {
      const classified = classifyLLMError(error);
      if (profile) {
        try { store.recordTest(profile.id, 'failed', profile.revision, { mode, durationMs: Date.now() - start, code: classified.code }); } catch {}
      }
      return ok({ ...classified, mode, durationMs: Date.now() - start }, classified.status);
    } finally {
      pendingTests.delete(id);
    }
  }

  async function listModels(id) {
    try {
      const profile = store.get(id);
      if (!profile) return notFound();
      const problem = credentialEndpointProblem(profile.provider, profile.baseURL, profile.apiKey);
      if (problem) return ok({ code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH', error: problem }, 400);
      const url = providerEndpoint(profile, 'models', allowLocalHttp);
      const response = await providerFetch(url, { headers: providerAuthHeaders(profile), signal: AbortSignal.timeout(10000), allowLocalHttp });
      if (!response.ok) return ok({ error: `Model listesi alınamadı (HTTP ${response.status}). Model kimliğini elle girebilirsiniz.` }, 502);
      return ok({ models: extractModelIds(await response.json(), profile) });
    } catch {
      return ok({ error: 'Model listesi alınamadı. Model kimliğini elle girebilirsiniz.' }, 502);
    }
  }

  async function chatCompletion(body) {
    const messages = normalizeMessagesInput(body);
    if (
      !Array.isArray(messages)
      || !messages.length
      || !messages.every(m => m && typeof m.role === 'string' && typeof m.content === 'string' && m.content.trim())
    ) {
      return ok({ error: 'Geçerli bir mesaj listesi (messages) veya prompt zorunludur.', code: 'MESSAGES_INVALID' }, 400);
    }
    const purpose = body?.purpose;
    if (purpose !== undefined && !['quick', 'manager', 'production'].includes(purpose)) {
      return ok({ error: 'Geçersiz çağrı amacı (purpose).', code: 'PURPOSE_INVALID' }, 400);
    }
    const profile = body?.profileId ? store.get(String(body.profileId)) : store.getActive();
    if (!profile) {
      return body?.profileId
        ? ok({ error: 'Profil bulunamadı.', code: 'PROFILE_NOT_FOUND' }, 404)
        : ok({ error: 'Etkin LLM profili seçilmedi.', code: 'ACTIVE_PROFILE_MISSING' }, 409);
    }
    const start = Date.now();
    try {
      const overrides = {};
      if (body?.timeoutMs !== undefined) overrides.timeoutMs = body.timeoutMs;
      if (body?.maxOutputTokens !== undefined) overrides.maxOutputTokens = body.maxOutputTokens;
      if (body?.thinking !== undefined) overrides.thinking = body.thinking;
      if (purpose !== undefined) overrides.purpose = purpose;
      const runtimeOpts = resolveRuntimeOptions(profile, overrides);
      const options = {
        ...profile,
        ...runtimeOpts,
        purpose,
        allowLocalHttp,
        useManagedProfile: false,
        allowMockFallback: false
      };
      const content = generate ? await generate(messages, options) : await generateProfileResponse(messages, profile, options);
      if (!content) {
        throw Object.assign(new Error('Model kullanılabilir cevap üretmedi.'), { code: 'LLM_EMPTY_RESPONSE' });
      }
      return ok({
        ok: true,
        content,
        text: content,
        profileId: profile.id,
        profileName: profile.name,
        provider: profile.provider,
        model: profile.model,
        durationMs: Date.now() - start
      });
    } catch (error) {
      if (error && !error.upstreamStatus && !error.code && /Yanıt süresi|Token bütçesi|düşünme ayarı/.test(error.message)) {
        return ok({ error: error.message, code: 'RUNTIME_OPTIONS_INVALID' }, 400);
      }
      const classified = classifyLLMError(error);
      return ok({ ...classified, durationMs: Date.now() - start }, classified.status);
    }
  }

  // Tek satırlık kullanım: await llm.ask('Merhaba!') veya await llm.ask([{ role: 'user', content: '...' }])
  async function ask(promptOrMessages, options = {}) {
    const messages = normalizeMessagesInput(promptOrMessages, options.system);
    if (!Array.isArray(messages) || !messages.length) {
      throw Object.assign(new Error('Geçerli bir mesaj listesi (messages) veya prompt zorunludur.'), { code: 'MESSAGES_INVALID' });
    }
    const result = await chatCompletion({ ...options, messages });
    if (result.status !== 200) {
      throw Object.assign(new Error(result.body?.error || 'Model çağrısı başarısız.'), {
        code: result.body?.code || 'LLM_ERROR',
        status: result.status
      });
    }
    return result.body.content;
  }

  // path: eklenti köküne göre göreli yol, örn. '/profiles/abc/test' veya '/chat'.
  async function handle({ method, path: routePath, body } = {}) {
    const verb = String(method || 'GET').toUpperCase();
    const match = /^\/(catalog|chat|profiles)(?:\/([^/]+)(?:\/(activate|test|models))?)?\/?$/.exec(routePath || '');
    if (!match) return null;
    const [, resource, rawId, action] = match;
    let id;
    try { id = rawId === undefined ? undefined : decodeURIComponent(rawId); } catch { return notFound(); }

    if (resource === 'catalog') return verb === 'GET' && id === undefined ? ok({ providers: PROVIDERS }) : null;
    if (resource === 'chat') return verb === 'POST' && id === undefined ? chatCompletion(body) : null;

    if (id === undefined) {
      if (verb === 'GET') return ok(store.list());
      if (verb === 'POST') return guarded(() => store.save(body), 201);
      return null;
    }
    if (!action) {
      if (verb === 'PUT') return guarded(() => store.save({ ...body, id }));
      if (verb === 'DELETE') return guarded(() => store.remove(id, body?.revision));
      return null;
    }
    if (action === 'activate' && verb === 'POST') return guarded(() => store.activate(id, body?.revision));
    if (action === 'test' && verb === 'POST') return testProfile(id, body);
    if (action === 'models' && verb === 'GET') return listModels(id);
    return null;
  }

  // Next.js, SvelteKit, Nuxt, Astro, Hono, Bun/Deno için standart Web Request -> Response adaptörü.
  async function fetchHandler(request, { apiPath = '/api/llm', pagePath = '/llm', requireCsrf = true } = {}) {
    const key = `${apiPath}|${pagePath}`;
    if (cachedUiKey !== key) {
      cachedUi = createUiAssets({ apiPath, pagePath });
      cachedUiKey = key;
    }
    const commonHeaders = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    };
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && pathname === pagePath) {
      return new Response(cachedUi.html, {
        status: 200,
        headers: {
          ...commonHeaders,
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
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
          { error: 'İstek doğrulama başlığı eksik.', code: 'CSRF_REQUIRED' },
          { status: 403, headers: commonHeaders }
        );
      }
      const subPath = pathname.slice(apiPath.length) || '/';
      const body = !SAFE_METHODS.includes(request.method)
        ? await request.json().catch(() => ({}))
        : null;
      const result = await handle({ method: request.method, path: subPath, body });
      if (!result) return new Response(null, { status: 404, headers: commonHeaders });
      if (result.body === undefined) return new Response(null, { status: result.status, headers: commonHeaders });
      return Response.json(result.body, { status: result.status, headers: commonHeaders });
    }
    return new Response(null, { status: 404, headers: commonHeaders });
  }

  return { handle, ask, fetch: fetchHandler, store };
}
