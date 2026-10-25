import fs from 'node:fs';
import path from 'node:path';
export function resolveLlmRelPath(cwd, type) {
  if (type === 'nuxt') return 'server/utils/llm.js';
  if (type === 'spa' || type === 'tauri') {
    if (fs.existsSync(path.join(cwd, 'src', 'llm.js'))) return 'src/llm.js';
    if (fs.existsSync(path.join(cwd, 'llm.js'))) return 'llm.js';
    return fs.existsSync(path.join(cwd, 'src')) ? 'src/llm.js' : 'llm.js';
  }
  if (type === 'nextjs') {
    if (fs.existsSync(path.join(cwd, 'src', 'llm.js'))) return 'src/llm.js';
    if (fs.existsSync(path.join(cwd, 'llm.js'))) return 'llm.js';
    return fs.existsSync(path.join(cwd, 'src', 'app')) ? 'src/llm.js' : 'llm.js';
  }
  if (type === 'sveltekit') {
    return 'src/lib/server/llm.js';
  }
  return 'llm.js';
}
