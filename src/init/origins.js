import fs from 'node:fs';
import path from 'node:path';
import { readEnv } from '../envFile.js';

export function resolveInitOrigins(cwd, allowedOrigins) {
  const configured = allowedOrigins ?? readEnv(path.join(cwd, '.env')).LLM_ALLOWED_ORIGINS;
  if (configured !== undefined) {
    const origins = (Array.isArray(configured) ? configured : String(configured).split(','))
      .map(origin => origin.trim())
      .filter(Boolean);
    for (const origin of origins) {
      let valid = false;
      try {
        const url = new URL(origin);
        valid = ['http:', 'https:'].includes(url.protocol) && url.origin === origin;
      } catch {
        /* Geçersiz origin aşağıda reddedilir. */
      }
      if (!valid)
        throw new Error('Geçersiz CORS origin: yalnız açık http/https origin adresleri kullanın; * kullanmayın.');
    }
    return origins.join(',');
  }
  const pkgPath = path.join(cwd, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  return pkg.dependencies?.vite || pkg.devDependencies?.vite ? 'http://localhost:5173' : '';
}
