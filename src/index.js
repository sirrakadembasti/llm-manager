import crypto from 'node:crypto';
import { Router } from 'express';
import { generateProfileResponse, classifyLLMError } from './runtime.js';
import { PROVIDERS, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import {
  initLLMProject,
  detectProjectType,
  detectEntryFile,
  injectIntoEntryFile,
  verifyIntegration,
  formatVerificationReport,
  probeAndOpenBrowser,
  runInteractiveInit
} from './init.js';
import { CSRF_HEADER, SAFE_METHODS, isValidMountPath, createUiAssets, createLLMManager } from './core.js';

export { generateProfileResponse, classifyLLMError, PROVIDERS, validateProviderUrl, createLLMProfileStore };
export {
  initLLMProject,
  detectProjectType,
  detectEntryFile,
  injectIntoEntryFile,
  verifyIntegration,
  formatVerificationReport,
  probeAndOpenBrowser,
  runInteractiveInit
};
export { CSRF_HEADER, SAFE_METHODS, isValidMountPath, createUiAssets, createLLMManager };

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

export function createBasicAuth({ user = 'admin', password } = {}) {
  if (!password) throw new Error('Basic Auth için parola (adminPassword) zorunludur.');
  return (req, res, next) => {
    const authorization = req.get('Authorization') || '';
    const decoded = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64').toString() : '';
    const colon = decoded.indexOf(':');
    const candidateUser = colon < 0 ? '' : decoded.slice(0, colon);
    const candidatePass = colon < 0 ? '' : decoded.slice(colon + 1);
    const userOk = safeEqual(candidateUser, user);
    const passOk = safeEqual(candidatePass, password);
    if (colon < 0 || !userOk || !passOk) {
      res.set('WWW-Authenticate', 'Basic realm="LLM Yonetimi"');
      return res.sendStatus(401);
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
    testMessages,
    validateTestReply
  } = {}
) {
  const authMiddleware =
    typeof requireAuth === 'function'
      ? requireAuth
      : adminPassword
        ? createBasicAuth({ user: adminUser, password: adminPassword })
        : null;
  if (!authMiddleware) throw new Error('LLM yönetimi için requireAuth veya adminPassword zorunludur.');
  if (![apiPath, pagePath].every(isValidMountPath)) throw new Error('Geçersiz eklenti mount yolu.');
  if (!['authenticated', 'admin', false].includes(chatAccess)) throw new Error('Geçersiz chatAccess ayarı.');

  const admin = (req, res, next) =>
    req.user?.isAdmin === true ? next() : res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
  const securityHeaders = (_req, res, next) => {
    res.set(COMMON_HEADERS);
    next();
  };
  const protectPage = [securityHeaders, authMiddleware, admin];

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
    ...(allowLocalHttp !== undefined ? { allowLocalHttp } : {})
  });
  const router = Router();
  router.use(securityHeaders, authMiddleware);
  router.use((req, res, next) => {
    const isChatRoute = /^\/chat\/?$/.test(req.path || '');
    if (isChatRoute) {
      if (chatAccess === false) return next();
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
      const result = await manager.handle({ method: req.method, path: req.path, body: req.body });
      if (!result) return next();
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
    fetch: manager.fetch
  });
}
