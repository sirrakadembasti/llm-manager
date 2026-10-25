import path from 'node:path';
import { serverHelper, webRoutes } from './shared.js';
export default function nextjs({ cwd, fs, PKG }) {
  const base = fs.existsSync(path.join(cwd, 'src/app')) ? 'src/' : '';
  const helper = base + 'llm.js';
  const files = { [helper]: serverHelper(PKG) };
  for (const route of ['app/api/llm/[...slug]/route.js', 'app/llm/[[...slug]]/route.js']) {
    const rel = base + route;
    let imp = path.posix.relative(path.posix.dirname(rel), helper);
    if (!imp.startsWith('.')) imp = './' + imp;
    files[rel] = `export const runtime = 'nodejs';\n` + webRoutes(imp);
  }
  files[base + 'app/actions/llm.js'] =
    `'use server';\nimport { askLLM } from '../../llm.js';\n// Add your host authorization before exposing this action to users.\nasync function requireAuthorizedUser() { throw new Error('Configure host authorization before enabling this action'); }\nexport async function ask(prompt) { await requireAuthorizedUser(); return askLLM(prompt); }\n`;
  return files;
}
