import path from 'node:path';
import { packageInstalled } from '../compiler.js';
import { serverHelper, webRoutes } from './shared.js';
export default function nextjs({ cwd, fs, PKG, pagePath = '/llm', apiPath = '/api/llm' }) {
  const base = fs.existsSync(path.join(cwd, 'src/app')) ? 'src/' : '';
  const helper = base + 'llm.js';
  const files = {
    [helper]:
      (packageInstalled(cwd, 'server-only') ? "import 'server-only';\n" : '') +
      serverHelper(PKG, true, { pagePath, apiPath })
  };
  for (const route of [`app${apiPath}/[...slug]/route.js`, `app${pagePath}/[[...slug]]/route.js`]) {
    const rel = base + route;
    let imp = path.posix.relative(path.posix.dirname(rel), helper);
    if (!imp.startsWith('.')) imp = './' + imp;
    files[rel] = `export const runtime = 'nodejs';\n` + webRoutes(imp);
  }
  files[base + 'app/actions/llm.js'] =
    `'use server';\nimport { askLLM } from '../../llm.js';\n// Add your host authorization before exposing this action to users.\nasync function requireAuthorizedUser() { throw new Error('Bu eylemi etkinleştirmeden önce host kullanıcı yetkilendirmesini yapılandırın'); }\nexport async function ask(prompt) { await requireAuthorizedUser(); return askLLM(prompt); }\n`;
  return files;
}
