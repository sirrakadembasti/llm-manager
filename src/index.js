import crypto from 'node:crypto';
import { Router } from 'express';
import { LLMError, ErrorCodes } from './errors.js';
import { generateProfileResponse, classifyLLMError } from './runtime.js';
import { PROVIDERS, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import { createRateLimiter } from './rateLimit.js';
import { sanitizeRequestId, createStructuredLogger, redact } from './logger.js';
import { CSRF_HEADER, SAFE_METHODS, isValidMountPath, createUiAssets, createLLMManager } from './core.js';

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

const safeEqual = (left, right) => {
  const a = crypto.createHash('sha256').update(String(left)).digest();
  const b = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
};

export function createBasicAuth({ user = 'admin', password, rateLimit = true } = {}) {
  if (!password) {
    throw new LLMError(ErrorCodes.RUNTIME_OPTIONS_INVALID, 'Basic Auth için parola (adminPassword) zorunludur.', {
      status: 500,
      retryable: false
    });
  }
  const authLimiter = rateLimit !== false ? createRateLimiter({ capacity: 10, refillPerSec: 10 / 60 }) : null;

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
    const decoded = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64').toString() : '';
    const colon = decoded.indexOf(':');
    const candidateUser = colon < 0 ? '' : decoded.slice(0, colon);
    const candidatePass = colon < 0 ? '' : decoded.slice(colon + 1);
    const userOk = safeEqual(candidateUser, user);
    const passOk = safeEqual(candidatePass, password);
    if (colon < 0 || !userOk || !passOk) {
      if (authLimiter) {
        authLimiter.take(ip, 1);
      }
      res.set('WWW-Authenticate', 'Basic realm="LLM Yonetimi"');
      return res.sendStatus(401);
    }
    if (authLimiter) {
      authLimiter.reset(ip);
    }
    req.user = { isAdmin: true };
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
    store = createLLMProfileStore({ dataDir, filePath, encryptionKey, allowLocalHttp }),
    requireAuth,
    adminPassword,
    adminUser = 'admin',
    generate,
    apiPath = '/api/llm',
    pagePath = '/llm',
    requireCsrf = true,
    chatAccess = 'authenticated',
    chatOverrides = 'admin',
    limits,
    rateLimit,
    logger,
    testMessages,
    validateTestReply
  } = {}
) {
  const authMiddleware =
    typeof requireAuth === 'function'
      ? requireAuth
      : adminPassword
        ? createBasicAuth({ user: adminUser, password: adminPassword, rateLimit: rateLimit !== false })
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
    next();
  };
  const securityHeaders = (_req, res, next) => {
    res.set(COMMON_HEADERS);
    next();
  };
  const protectPage = [requestIdMiddleware, securityHeaders, authMiddleware, admin];

  const { html, script } = createUiAssets({ apiPath, pagePath });
  app.get(pagePath, ...protectPage, (_req, res) => {
    res.set('Content-Security-Policy', PAGE_CSP).type('html').send(html);
  });
  app.get(`${pagePath}/llm-ui.js`, ...protectPage, (_req, res) => res.type('text/javascript').send(script));

  const manager = createLLMManager({
    store,
    generate,
    testMessages,
    validateTestReply,
    limits,
    chatOverrides,
    chatAccess,
    rateLimit,
    logger,
    ...(allowLocalHttp !== undefined ? { allowLocalHttp } : {})
  });
  const router = Router();
  router.use(requestIdMiddleware);
  router.use(securityHeaders, authMiddleware);
  router.use((req, res, next) => {
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
            `event: error\ndata: ${JSON.stringify({ error: classified.error, code: classified.code, status: classified.status })}\n\n`
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
