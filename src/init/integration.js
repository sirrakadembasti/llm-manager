import fs from 'node:fs';
import path from 'node:path';
import { readEnv } from '../envFile.js';
import { chooseManagementPaths } from '../integration/paths.js';

const skipped = new Set([
  'node_modules',
  '.git',
  '.nuxt',
  '.next',
  '.output',
  'dist',
  'build',
  'data',
  'vendor',
  'graphify-out',
  'tests',
  'test',
  'docs'
]);
export function planIntegration(
  cwd,
  { type, authMode, hostAuthModule, adminRoles, pagePath, apiPath, adminUser } = {}
) {
  const env = readEnv(path.join(cwd, '.env'));
  const example = {
    ...readEnv(new URL('../../.env.example', import.meta.url)),
    ...readEnv(path.join(cwd, '.env.example'))
  };
  authMode ??= env.LLM_AUTH_MODE || 'basic';
  if (!['basic', 'host'].includes(authMode)) throw new Error('authMode basic veya host olmalıdır.');
  hostAuthModule ??= env.LLM_HOST_AUTH_MODULE;
  if (authMode === 'host') {
    if (type !== 'express')
      throw new Error(
        'Otomatik host oturumu bağlantısı yalnız Express için desteklenir. Diğer çatılarda authorize adaptörünü elle bağlayın.'
      );
    if (!hostAuthModule) throw new Error('Host modu için hostAuthModule adaptörü gereklidir.');
    const full = path.resolve(cwd, hostAuthModule);
    if (!full.startsWith(path.resolve(cwd) + path.sep) || !fs.existsSync(full) || !/\.(?:c|m)?js$/.test(full)) {
      throw new Error('hostAuthModule proje içindeki mevcut bir .js/.cjs/.mjs adaptörü olmalıdır.');
    }
    if (!fs.realpathSync(full).startsWith(fs.realpathSync(cwd) + path.sep))
      throw new Error('Host adaptörü proje dışına çıkamaz.');
    hostAuthModule = './' + path.relative(cwd, full).replaceAll('\\', '/');
  }
  adminRoles ??= (env.LLM_ADMIN_ROLES || 'admin')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (!Array.isArray(adminRoles) || adminRoles.some(role => typeof role !== 'string' || !/^[\w:-]+$/.test(role))) {
    throw new Error('adminRoles geçerli rol isimlerinden oluşan bir liste olmalıdır.');
  }
  const manifestPath = path.join(cwd, '.llm-manager.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const owned = new Set(previous.generatedFiles || []);
  const occupied = [];
  let count = 0;
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || skipped.has(entry.name) || entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      const relative = path.relative(cwd, full).replaceAll('\\', '/');
      if (owned.has(relative)) continue;
      if (++count > 15000) throw new Error('Proje çok büyük; kurulum için backend/proje kökünü seçin.');
      if (entry.isDirectory()) {
        // File-based route directories and static folders reserve their URL.
        const apiMatch =
          relative.match(/^(?:src\/)?(?:app|pages|routes)\/api\/(llm\d*)(?:\/|$)/) ||
          relative.match(/^server\/api\/(llm\d*)(?:\/|$)/);
        const match =
          relative.match(/^(?:src\/)?(?:app|pages|routes|public)\/(llm\d*)(?:\/|$)/) ||
          relative.match(/^server\/routes\/(llm\d*)(?:\/|$)/);
        if (apiMatch && ![...owned].some(file => file.startsWith(relative + '/'))) occupied.push('/api/' + apiMatch[1]);
        if (match && ![...owned].some(file => file.startsWith(relative + '/'))) occupied.push('/' + match[1]);
        walk(full);
      } else if (/\.(?:js|jsx|ts|tsx|vue|svelte|html)$/.test(entry.name) && fs.statSync(full).size < 2 * 1024 * 1024) {
        const staticPage = relative.match(/(?:^|\/)(?:public|pages)\/(llm\d*)\.(?:html|vue|jsx?|tsx?)$/);
        if (staticPage) occupied.push('/' + staticPage[1]);
        const content = fs.readFileSync(full, 'utf8');
        for (const match of content.matchAll(
          /\.\s*(?:get|post|put|patch|delete|all|use|route)\s*\(\s*(['"`])(\/[^'"`\r\n]*)\1/g
        ))
          occupied.push(match[2]);
      }
    }
  }
  walk(cwd);
  const selected = chooseManagementPaths(occupied, {
    pagePath: pagePath ?? env.LLM_PAGE_PATH ?? '/llm',
    apiPath: apiPath ?? env.LLM_API_PATH ?? '/api' + (pagePath ?? env.LLM_PAGE_PATH ?? '/llm')
  });
  return {
    ...selected,
    authMode,
    hostAuthModule,
    adminRoles,
    adminUser: adminUser ?? env.LLM_ADMIN_USER ?? example.LLM_ADMIN_USER ?? 'admin',
    examplePassword: example.LLM_ADMIN_PASSWORD,
    previous
  };
}
