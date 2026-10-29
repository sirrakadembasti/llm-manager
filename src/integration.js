import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { readEnv } from './envFile.js';
import { mountLLMManagement } from './index.js';
import { chooseManagementPaths, validateManagementPath } from './integration/paths.js';
import { ensureLLMEncryptionKey } from './setup.js';

function routeExists(stack, candidate, depth = 0) {
  if (depth > 20) throw new Error('Router derinliği otomatik yol seçimi için çok büyük.');
  for (const layer of stack) {
    if (typeof layer.match !== 'function' || !layer.match(candidate)) continue;
    if (layer.route) return true;
    if (
      layer.handle?.stack &&
      routeExists(layer.handle.stack, candidate.slice((layer.path || '').length) || '/', depth + 1)
    )
      return true;
  }
  return false;
}

/** Express adapter. Host authorization is explicit; there is no password fallback in host mode. */
export function mountLLMIntegration(
  app,
  { cwd = process.cwd(), authMode, adminRoles, requireAuth, basePath = '', ...options } = {}
) {
  basePath = basePath.replace(/\/+$/, '');
  if (basePath) validateManagementPath(basePath);
  const env = { ...readEnv(path.join(cwd, '.env')), ...process.env };
  authMode ??= env.LLM_AUTH_MODE || 'basic';
  if (!['basic', 'host'].includes(authMode)) throw new Error('authMode basic veya host olmalıdır.');
  if (authMode === 'basic' && requireAuth) throw new Error('requireAuth kullanmak için authMode: host seçin.');
  const adminPassword = options.adminPassword ?? env.LLM_ADMIN_PASSWORD;
  if (authMode === 'basic' && !adminPassword) throw new Error('LLM_ADMIN_PASSWORD veya adminPassword zorunludur.');
  const roles =
    adminRoles ??
    (env.LLM_ADMIN_ROLES || 'admin')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
  if (!Array.isArray(roles) || roles.some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('adminRoles bir rol listesi olmalıdır.');
  }
  if (authMode === 'host' && !requireAuth && env.LLM_HOST_AUTH_MODULE) {
    const modulePath = path.resolve(cwd, env.LLM_HOST_AUTH_MODULE);
    if (
      !modulePath.startsWith(path.resolve(cwd) + path.sep) ||
      !fs.existsSync(modulePath) ||
      !fs.realpathSync(modulePath).startsWith(fs.realpathSync(cwd) + path.sep)
    ) {
      throw new Error('Host yetkilendirme adaptörü proje içinde bulunmalıdır.');
    }
    const adapter = createRequire(import.meta.url)(modulePath);
    requireAuth = adapter.requireAuth || adapter.default || adapter;
  }
  if (authMode === 'host' && typeof requireAuth !== 'function') {
    throw new Error('Host modu için requireAuth veya LLM_HOST_AUTH_MODULE adaptörü zorunludur.');
  }
  const stack =
    app.stack || app._router?.stack || (typeof app.lazyrouter === 'function' ? [] : app.router?.stack) || [];
  const occupied = [];
  for (const layer of stack) {
    const routes = layer.route?.path;
    for (const route of Array.isArray(routes) ? routes : [routes]) {
      if (typeof route === 'string' && (!basePath || route.startsWith(basePath + '/')))
        occupied.push(basePath ? route.slice(basePath.length) : route);
    }
  }
  const selected = chooseManagementPaths(occupied, {
    pagePath: options.pagePath || env.LLM_PAGE_PATH || '/llm',
    apiPath: options.apiPath || env.LLM_API_PATH || '/api' + (options.pagePath || env.LLM_PAGE_PATH || '/llm'),
    isOccupied: candidate => routeExists(stack, basePath + candidate)
  });
  const publicPaths = { pagePath: basePath + selected.pagePath, apiPath: basePath + selected.apiPath };
  const authorize =
    authMode === 'host'
      ? (req, res, next) => {
          try {
            const result = requireAuth(req, res, error => {
              if (error) return next(error);
              const user = req.user;
              if (!user || user.isActive === false || user.disabled === true)
                return res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
              const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
              const isAdmin = user.isAdmin === true || userRoles.some(role => roles.includes(role));
              if (!isAdmin) return res.status(403).json({ error: 'Yönetici yetkisi gerekli.' });
              req.user = { ...user, isAdmin: true };
              next();
            });
            if (result && typeof result.catch === 'function') return result.catch(next);
          } catch (error) {
            next(error);
          }
        }
      : undefined;
  const dataDir = path.resolve(cwd, options.dataDir || env.LLM_DATA_DIR || 'data');
  const filePath = path.resolve(
    cwd,
    options.filePath || env.LLM_CONFIG_PATH || path.join(dataDir, 'llm-profiles.json')
  );
  if (
    options.encryptionKey === undefined &&
    !env.LLM_CONFIG_ENCRYPTION_KEY &&
    env.LLM_CONFIG_KEY_PATH &&
    !fs.existsSync(path.resolve(cwd, env.LLM_CONFIG_KEY_PATH)) &&
    fs.existsSync(filePath + '.assistant.enc')
  ) {
    throw new Error('Kayıtlı sohbetler var fakat şifreleme anahtarı yok; eski anahtarı yedekten kurtarın.');
  }
  const encryptionKey =
    options.encryptionKey ??
    env.LLM_CONFIG_ENCRYPTION_KEY ??
    (env.LLM_CONFIG_KEY_PATH
      ? ensureLLMEncryptionKey({
          envPath: path.join(cwd, '.env'),
          environment: env,
          profilePath: filePath,
          keyPath: path.resolve(cwd, env.LLM_CONFIG_KEY_PATH)
        })
      : undefined);
  const manager = mountLLMManagement(app, {
    ...options,
    ...publicPaths,
    dataDir,
    filePath,
    encryptionKey,
    allowLocalHttp: options.allowLocalHttp ?? env.LLM_ALLOW_LOCAL_HTTP === 'true',
    adminUser: options.adminUser || env.LLM_ADMIN_USER || 'admin',
    adminPassword,
    requireAuth: authorize,
    chatAccess: 'admin',
    chatTokens: [],
    health: false
  });
  Object.assign(manager, publicPaths, { authMode });
  return manager;
}
