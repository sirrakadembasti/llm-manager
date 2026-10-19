import { Router } from 'express';
import { generateProfileResponse, classifyLLMError } from './runtime.js';
import { PROVIDERS, validateProviderUrl } from './providers.js';
import { createLLMProfileStore } from './profileStore.js';
import {
  CSRF_HEADER,
  SAFE_METHODS,
  isValidMountPath,
  createUiAssets,
  createLLMManager
} from './core.js';

export { generateProfileResponse, classifyLLMError, PROVIDERS, validateProviderUrl, createLLMProfileStore };
export { CSRF_HEADER, SAFE_METHODS, isValidMountPath, createUiAssets, createLLMManager };

const COMMON_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};
const PAGE_CSP = "default-src 'self'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

export function mountLLMManagement(app, {
  store = createLLMProfileStore(),
  requireAuth,
  generate,
  apiPath = '/api/llm',
  pagePath = '/llm',
  requireCsrf = true,
  testMessages,
  validateTestReply
} = {}) {
  if (typeof requireAuth !== 'function') throw new Error('LLM yönetimi için requireAuth zorunludur.');
  if (![apiPath, pagePath].every(isValidMountPath)) throw new Error('Geçersiz eklenti mount yolu.');

  const admin = (req, res, next) => req.user?.isAdmin === true ? next() : res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
  const securityHeaders = (_req, res, next) => {
    res.set(COMMON_HEADERS);
    next();
  };
  const protect = [securityHeaders, requireAuth, admin];

  const { html, script } = createUiAssets({ apiPath, pagePath });
  app.get(pagePath, ...protect, (_req, res) => {
    res.set('Content-Security-Policy', PAGE_CSP).type('html').send(html);
  });
  app.get(`${pagePath}/llm-ui.js`, ...protect, (_req, res) => res.type('text/javascript').send(script));

  const manager = createLLMManager({ store, generate, testMessages, validateTestReply });
  const router = Router();
  router.use(...protect);
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
  return router;
}
