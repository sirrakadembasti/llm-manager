import { checkBasicAuth, checkBearerToken } from './auth.js';
import { Router, json } from 'express';
import { LLMError, ErrorCodes } from './errors.js';
import { generateProfileResponse, classifyLLMError } from './runtime.js';
import { PROVIDERS, CATALOG_VERSION, CATALOG_UPDATED_AT, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import { createRateLimiter } from './rateLimit.js';
import { sanitizeRequestId, createStructuredLogger, redact } from './logger.js';
import {
  CSRF_HEADER,
  SAFE_METHODS,
  isValidMountPath,
  createUiAssets,
  createLLMManager,
  createUsageTracker,
  MESSAGES,
  getErrorMessage,
  PACKAGE_VERSION
} from './core.js';

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
export { CSRF_HEADER, SAFE_METHODS, isValidMountPath, createUiAssets, createLLMManager };

/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export async function runInteractiveInit(...a) {
  return (await import('./init.js')).runInteractiveInit(...a);
}
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export async function probeAndOpenBrowser(...a) {
  return (await import('./init.js')).probeAndOpenBrowser(...a);
}
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export async function initLLMProject(...a) {
  return (await import('./init.js')).initLLMProject(...a);
}
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export async function verifyIntegration(...a) {
  return (await import('./init.js')).verifyIntegration(...a);
}
/** @deprecated `llm-manager/init` alt yolunu kullanın. */
export async function injectIntoEntryFile(...a) {
  return (await import('./init.js')).injectIntoEntryFile(...a);
}

const COMMON_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
const PAGE_CSP =
  "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function createBasicAuth({ user = 'admin', password, rateLimit = true, logger } = {}) {
  if (!password) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Basic Auth için parola (adminPassword) zorunludur.', {
      status: 500,
      retryable: false
    });
  }
  const capacity = rateLimit?.authFailuresPerMinute ?? 10;
  const authLimiter = rateLimit !== false ? createRateLimiter({ capacity, refillPerSec: capacity / 60 }) : null;
  const authLogger = createStructuredLogger(logger);

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    if (authLimiter) {
      const check = authLimiter.check(ip);
      if (!check.ok) {
        res.set('Retry-After', String(check.retryAfterSec));
        return res.status(429).json({ error: 'Çok fazla hatalı giriş denemesi yapıldı.', code: 'RATE_LIMITED' });
      }
    }

    const authorization = req.get('Authorization') || '';
    const authentication = checkBasicAuth(authorization, { user, password });
    if (!authentication.ok) {
      if (authLimiter) {
        authLimiter.take(ip, 1);
      }
      authLogger.warn('auth.failed', { ip, requestId: req.requestId });
      res.set('WWW-Authenticate', 'Basic realm="LLM Yonetimi"');
      return res
        .status(401)
        .json({ code: 'UNAUTHORIZED', error: 'Kimlik doğrulama gerekli.', requestId: req.requestId });
    }
    if (authLimiter) {
      authLimiter.reset(ip);
    }
    req.user = authentication.principal;
    next();
  };
}

export function mountLLMManagement(
  app,
  {
    dataDir,
    filePath,
    encryptionKey,
    allowLocalHttp,
    allowedPrivateHosts = [],
    store = createLLMProfileStore({ dataDir, filePath, encryptionKey, allowLocalHttp, allowedPrivateHosts }),
    requireAuth,
    adminPassword,
    adminUser = 'admin',
    chatTokens = process.env.LLM_CHAT_TOKENS,
    generate,
    apiPath = '/api/llm',
    pagePath = '/llm',
    requireCsrf = true,
    chatAccess = 'authenticated',
    chatOverrides = 'admin',
    health = true,
    usageLog = false,
    locale = 'tr',
    homeUrl = '/',
    limits,
    bodyLimit,
    rateLimit,
    logger,
    testMessages,
    validateTestReply,
    ...managerOptions
  } = {}
) {
  const authMiddleware =
    typeof requireAuth === 'function'
      ? requireAuth
      : adminPassword
        ? createBasicAuth({ user: adminUser, password: adminPassword, rateLimit, logger })
        : null;
  if (!authMiddleware) throw new Error('LLM yönetimi için requireAuth veya adminPassword zorunludur.');
  if (![apiPath, pagePath].every(isValidMountPath)) throw new Error('Geçersiz eklenti mount yolu.');
  if (!['authenticated', 'admin', false].includes(chatAccess)) throw new Error('Geçersiz chatAccess ayarı.');

  const admin = (req, res, next) =>
    req.user?.isAdmin === true ? next() : res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
  const requestIdMiddleware = (req, res, next) => {
    const requestId = sanitizeRequestId(req.get('x-request-id'));
    res.set('x-request-id', requestId);
    req.requestId = requestId;
    const sendJson = res.json;
    res.json = function (body) {
      if (this.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
        body = { ...body, requestId };
      }
      return sendJson.call(this, body);
    };
    next();
  };
  const securityHeaders = (_req, res, next) => {
    res.set(COMMON_HEADERS);
    next();
  };
  const rejectChatToken = (req, res, next) =>
    checkBearerToken(req.get('Authorization'), chatTokens)
      ? res.status(403).json({ error: 'Yalnız sohbet yetkisi var.', code: 'FORBIDDEN' })
      : next();
  const protectPage = [requestIdMiddleware, securityHeaders, rejectChatToken, authMiddleware, admin];

  const { html, script } = createUiAssets({ apiPath, pagePath, locale, homeUrl });
  app.get(pagePath, ...protectPage, (_req, res) => {
    res.set('Content-Security-Policy', PAGE_CSP).type('html').send(html);
  });
  app.get(`${pagePath}/llm-ui.js`, ...protectPage, (_req, res) => res.type('text/javascript').send(script));

  const manager = createLLMManager({
    ...managerOptions,
    allowedPrivateHosts,
    adminUser,
    adminPassword,
    chatTokens,
    store,
    dataDir,
    filePath,
    encryptionKey,
    generate,
    testMessages,
    validateTestReply,
    limits,
    chatOverrides,
    chatAccess,
    rateLimit,
    logger,
    health,
    usageLog,
    locale,
    homeUrl,
    ...(allowLocalHttp !== undefined ? { allowLocalHttp } : {})
  });
  const router = Router();
  router.use(requestIdMiddleware);
  router.use(securityHeaders);
  router.use((req, res, next) => {
    const isHealthRoute = /^\/health\/?$/.test(req.path || '');
    if (isHealthRoute) {
      if (health === false) {
        return res.status(404).json({ error: 'Sağlık uç noktası kapalı.', code: 'HEALTH_DISABLED' });
      }
      return next();
    }
    const bearer = checkBearerToken(req.get('Authorization'), chatTokens);
    if (bearer) {
      if (!/^\/chat\/?$/.test(req.path || '') || req.method !== 'POST') {
        return res.status(403).json({ error: 'Yalnız sohbet yetkisi var.', code: 'FORBIDDEN' });
      }
      req.user = bearer;
      return next();
    }
    return authMiddleware(req, res, next);
  });
  router.use((req, res, next) => {
    const isHealthRoute = /^\/health\/?$/.test(req.path || '');
    if (isHealthRoute) return next();

    const isChatRoute = /^\/chat\/?$/.test(req.path || '');
    if (isChatRoute) {
      if (chatAccess === false) {
        return res.status(404).json({ error: 'Sohbet uç noktası kapalı.', code: 'CHAT_DISABLED' });
      }
      if (chatAccess === 'admin' && req.user?.isAdmin !== true) {
        return res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
      }
      return next();
    }
    return admin(req, res, next);
  });
  router.use((req, res, next) => {
    if (requireCsrf && !SAFE_METHODS.includes(req.method) && req.get(CSRF_HEADER) !== '1') {
      return res.status(403).json({ error: 'İstek doğrulama başlığı eksik.', code: 'CSRF_REQUIRED' });
    }
    next();
  });

  router.use(json({ limit: bodyLimit ?? limits?.maxBodyBytes ?? 256 * 1024 }));
  router.use((error, req, res, next) => {
    if (error.type !== 'entity.too.large' && error.type !== 'entity.parse.failed') return next(error);
    const tooLarge = error.type === 'entity.too.large';
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? 'Gövde boyutu sınırı aştı.' : 'Geçersiz JSON gövdesi.',
      code: tooLarge ? 'BODY_TOO_LARGE' : 'BODY_INVALID',
      requestId: req.requestId
    });
  });
  router.use(async (req, res, next) => {
    try {
      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) {
          abortController.abort();
        }
      };
      res.on('close', onClose);

      const result = await manager.handle({
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        principal: req.user,
        requestId: req.requestId,
        clientKey: req.ip,
        signal: abortController.signal
      });
      if (!result) return next();

      if (result.isStream && result.stream) {
        res.writeHead(200, {
          ...COMMON_HEADERS,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'x-request-id': req.requestId
        });

        try {
          for await (const chunk of result.stream) {
            if (abortController.signal.aborted) break;
            if (chunk.type === 'delta') {
              res.write(`event: delta\ndata: ${JSON.stringify({ text: chunk.text })}\n\n`);
            } else if (chunk.type === 'done') {
              res.write(
                `event: done\ndata: ${JSON.stringify({ usage: chunk.usage, finishReason: chunk.finishReason })}\n\n`
              );
            }
          }
        } catch (err) {
          const classified = classifyLLMError(err);
          res.write(
            `event: error\ndata: ${JSON.stringify({ error: classified.error, code: classified.code, status: classified.status, requestId: req.requestId })}\n\n`
          );
        } finally {
          res.off('close', onClose);
          res.end();
        }
        return;
      }

      if (result.body === undefined) return res.sendStatus(result.status);
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  });

  app.use(apiPath, router);
  return Object.assign(router, {
    store,
    ask: manager.ask,
    stream: manager.stream,
    fetch: manager.fetch
  });
}
