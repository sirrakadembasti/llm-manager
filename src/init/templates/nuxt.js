import { serverHelper } from './shared.js';
import path from 'node:path';
export default function nuxt({ PKG, pagePath = '/llm', apiPath = '/api/llm' }) {
  const files = { 'server/utils/llm.js': serverHelper(PKG, true, { pagePath, apiPath }) };
  for (const relative of [`server/routes${apiPath}/[...slug].js`, `server/routes${pagePath}/[...slug].js`]) {
    // Keep the existing default API location when using /api/*.
    const file = relative.replace(/^server\/routes\/api\//, 'server/api/');
    let imp = path.posix.relative(path.posix.dirname(file), 'server/utils/llm.js');
    if (!imp.startsWith('.')) imp = './' + imp;
    files[file] = `import { defineEventHandler, toWebRequest } from 'h3';
import { llm } from '${imp}';
export default defineEventHandler(event => llm.fetch(toWebRequest(event)));
`;
  }
  return files;
}
