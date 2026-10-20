import fs from 'node:fs';
import path from 'node:path';

export function detectProjectType(cwd = process.cwd()) {
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.electron || deps['@tauri-apps/api'] || deps['@tauri-apps/cli']) return 'electron';
      if (deps.next) return 'nextjs';
      if (deps.express) return 'express';
      if (deps.vite || deps.react || deps.vue || deps.svelte || deps['@angular/core']) return 'spa';
      return 'express';
    } catch {
      return 'express';
    }
  }
  if (
    fs.existsSync(path.join(cwd, 'requirements.txt')) ||
    fs.existsSync(path.join(cwd, 'pyproject.toml')) ||
    fs.existsSync(path.join(cwd, 'main.py')) ||
    fs.existsSync(path.join(cwd, 'app.py'))
  ) {
    return 'python';
  }
  if (fs.existsSync(path.join(cwd, 'index.html'))) {
    return 'spa';
  }
  return 'express';
}

function isEsmProject(cwd, type) {
  if (type === 'nextjs' || type === 'spa') return true;
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return true;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.type === 'module';
  } catch {
    return true;
  }
}

function writeFileIfMissing(filePath, content, force = false) {
  if (fs.existsSync(filePath) && !force) {
    return false;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function ensureNpmScript(cwd, password) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.llm) {
      pkg.scripts.llm = `llm-manager --password ${password} --cors *`;
      fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function readPkgMain(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (typeof pkg.main === 'string' && pkg.main.trim()) {
      const normalized = pkg.main.trim().replace(/\\/g, '/').replace(/^\.\//, '');
      if (normalized && path.posix.basename(normalized) !== 'llm.js') {
        return normalized;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function detectEntryFile(cwd = process.cwd(), type = detectProjectType(cwd)) {
  const candidates = [];
  if (type === 'express') {
    const pkgMain = readPkgMain(cwd);
    if (pkgMain) candidates.push(pkgMain);
    candidates.push('server.js', 'app.js', 'index.js', 'src/server.js', 'src/app.js', 'src/index.js');
  } else if (type === 'spa') {
    candidates.push('src/App.jsx', 'src/App.tsx', 'src/App.js', 'src/main.jsx', 'src/main.js', 'main.js', 'index.js');
  } else if (type === 'nextjs') {
    candidates.push('src/app/page.js', 'src/app/page.tsx', 'src/app/page.jsx', 'app/page.js', 'app/page.tsx', 'app/page.jsx');
  } else if (type === 'python') {
    candidates.push('main.py', 'app.py', 'server.py', 'run.py', 'manage.py');
  } else if (type === 'electron') {
    const pkgMain = readPkgMain(cwd);
    if (pkgMain) candidates.push(pkgMain);
    candidates.push('main.js', 'electron/main.js', 'src/main.js', 'index.js');
  }

  for (const rel of candidates) {
    const full = path.join(cwd, rel);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return rel;
    }
  }
  return null;
}

function findJsImportInsertIndex(lines, useEsm) {
  if (useEsm) {
    let lastImport = -1;
    let directiveIdx = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*import\b/.test(lines[i])) {
        lastImport = i;
      } else if (directiveIdx < 0 && /^\s*['"]use (?:client|server)['"];?\s*$/.test(lines[i])) {
        directiveIdx = i;
      }
    }
    if (lastImport >= 0) return lastImport + 1;
    if (directiveIdx >= 0) return directiveIdx + 1;
    return 0;
  }

  let lastRequire = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/\brequire\s*\(/.test(lines[i])) {
      lastRequire = i;
    }
  }
  return lastRequire >= 0 ? lastRequire + 1 : 0;
}

function resolveLlmRelPath(cwd, type) {
  if (type === 'spa') {
    if (fs.existsSync(path.join(cwd, 'src', 'llm.js'))) return 'src/llm.js';
    if (fs.existsSync(path.join(cwd, 'llm.js'))) return 'llm.js';
    return fs.existsSync(path.join(cwd, 'src')) ? 'src/llm.js' : 'llm.js';
  }
  if (type === 'nextjs') {
    if (fs.existsSync(path.join(cwd, 'src', 'llm.js'))) return 'src/llm.js';
    if (fs.existsSync(path.join(cwd, 'llm.js'))) return 'llm.js';
    return fs.existsSync(path.join(cwd, 'src', 'app')) ? 'src/llm.js' : 'llm.js';
  }
  return 'llm.js';
}

export function injectIntoEntryFile({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  entryFile = detectEntryFile(cwd, type),
  esm
} = {}) {
  if (!entryFile) {
    return { modified: false, entryFile: null, addedLines: [], diffPreview: '', rollback: () => {} };
  }
  const relEntry = entryFile.replace(/\\/g, '/').replace(/^\.\//, '');
  const fullPath = path.join(cwd, relEntry);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return { modified: false, entryFile: null, addedLines: [], diffPreview: '', rollback: () => {} };
  }

  const originalContent = fs.readFileSync(fullPath, 'utf8');
  const rollback = () => {
    fs.writeFileSync(fullPath, originalContent, 'utf8');
  };

  if (/\b(?:setupLLM|askLLM|registerLLMIpc|ask_llm)\b/.test(originalContent)) {
    return {
      modified: false,
      alreadyIntegrated: true,
      entryFile: relEntry,
      addedLines: [],
      diffPreview: '',
      rollback
    };
  }

  const useEsm = esm !== undefined ? Boolean(esm) : isEsmProject(cwd, type);
  const eol = originalContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = originalContent.split(/\r?\n/);
  const addedLines = [];

  if (type === 'python') {
    let lastPyImport = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*(?:import\s+\S+|from\s+\S+\s+import\s+)/.test(lines[i])) {
        lastPyImport = i;
      }
    }
    const pyLine = 'from llm_client import ask_llm';
    lines.splice(lastPyImport >= 0 ? lastPyImport + 1 : 0, 0, pyLine);
    addedLines.push(pyLine);
  } else {
    const llmRel = resolveLlmRelPath(cwd, type);
    const entryDir = path.posix.dirname(relEntry);
    let relImport = path.posix.relative(entryDir, llmRel);
    if (!relImport.startsWith('.')) {
      relImport = `./${relImport}`;
    }

    if (type === 'express') {
      const importLine = useEsm
        ? `import { setupLLM, askLLM } from '${relImport}';`
        : `const { setupLLM, askLLM } = require('${relImport.replace(/\.js$/, '')}');`;
      const insertIdx = findJsImportInsertIndex(lines, useEsm);
      lines.splice(insertIdx, 0, importLine);
      addedLines.push(importLine);

      let setupTargetIdx = -1;
      for (let i = 0; i < lines.length; i += 1) {
        if (/\bapp\.use\s*\(\s*express\.json\s*\(\s*\)\s*\)/.test(lines[i])) {
          setupTargetIdx = i + 1;
          break;
        }
      }
      if (setupTargetIdx < 0) {
        for (let i = 0; i < lines.length; i += 1) {
          if (/^\s*(?:const|let|var)\s+app\s*=\s*express\s*\(/.test(lines[i])) {
            setupTargetIdx = i + 1;
            break;
          }
        }
      }
      if (setupTargetIdx < 0) {
        setupTargetIdx = insertIdx + 1;
      }
      const setupLine = 'setupLLM(app);';
      lines.splice(setupTargetIdx, 0, setupLine);
      addedLines.push(setupLine);
    } else if (type === 'spa' || type === 'nextjs') {
      const importLine = `import { askLLM } from '${relImport}';`;
      const insertIdx = findJsImportInsertIndex(lines, true);
      lines.splice(insertIdx, 0, importLine);
      addedLines.push(importLine);
    } else if (type === 'electron') {
      if (!/\bipcMain\b/.test(originalContent)) {
        let updatedExisting = false;
        for (let i = 0; i < lines.length; i += 1) {
          if (useEsm && /^\s*import\s*\{([^}]*)\}\s*from\s*(['"]electron['"].*)$/.test(lines[i])) {
            lines[i] = lines[i].replace(
              /^\s*import\s*\{([^}]*)\}\s*from\s*(['"]electron['"].*)$/,
              (_m, imports, rest) => `import { ${imports.trim()}, ipcMain } from ${rest}`
            );
            updatedExisting = true;
            break;
          }
          if (!useEsm && /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\s*\(\s*['"]electron['"]\s*\)/.test(lines[i])) {
            lines[i] = lines[i].replace(
              /\{([^}]*)\}/,
              (_m, imports) => `{ ${imports.trim()}, ipcMain }`
            );
            updatedExisting = true;
            break;
          }
        }
        if (!updatedExisting) {
          const ipcImport = useEsm
            ? "import { ipcMain } from 'electron';"
            : "const { ipcMain } = require('electron');";
          lines.splice(findJsImportInsertIndex(lines, useEsm), 0, ipcImport);
          addedLines.push(ipcImport);
        }
      }

      const importLine = useEsm
        ? `import { registerLLMIpc, askLLM } from '${relImport}';`
        : `const { registerLLMIpc, askLLM } = require('${relImport.replace(/\.js$/, '')}');`;
      const insertIdx = findJsImportInsertIndex(lines, useEsm);
      lines.splice(insertIdx, 0, importLine);
      addedLines.push(importLine);

      let readyIdx = -1;
      for (let i = 0; i < lines.length; i += 1) {
        if (/app\.whenReady\s*\(\s*\)\.then\s*\(/.test(lines[i])) {
          readyIdx = i;
          break;
        }
      }
      const registerLine = 'registerLLMIpc(ipcMain);';
      if (readyIdx >= 0) {
        lines.splice(readyIdx + 1, 0, `  ${registerLine}`);
      } else {
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.splice(lines.length - 1, 0, registerLine);
        } else {
          lines.push(registerLine);
        }
      }
      addedLines.push(registerLine);
    }
  }

  const newContent = lines.join(eol);
  fs.writeFileSync(fullPath, newContent, 'utf8');
  const diffPreview = addedLines.map(line => `+ ${line}`).join('\n');

  return {
    modified: true,
    entryFile: relEntry,
    addedLines,
    diffPreview,
    rollback
  };
}

export function initLLMProject({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  password = 'admin123',
  force = false
} = {}) {
  const esm = isEsmProject(cwd, type);
  const createdFiles = [];

  if (type === 'express') {
    const target = path.join(cwd, 'llm.js');
    const content = esm
      ? `import { mountLLMManagement, createLLMManager } from 'llm-manager';

let activeManager = null;

// 1. Express uygulamanıza yönetim panelini (/llm) bağlar
export function setupLLM(app, options = {}) {
  activeManager = mountLLMManagement(app, {
    dataDir: './data',
    adminPassword: process.env.LLM_ADMIN_PASSWORD || '${password}',
    ...options
  });
  return activeManager;
}

// 2. Kodunuzun herhangi bir yerinden soru sorun: const cevap = await askLLM('Merhaba')
export async function askLLM(prompt, options = {}) {
  if (!activeManager) {
    activeManager = createLLMManager({ dataDir: './data' });
  }
  return activeManager.ask(prompt, options);
}
`
      : `let managerPromise = null;

function getManager() {
  if (!managerPromise) {
    managerPromise = import('llm-manager/core').then(({ createLLMManager }) =>
      createLLMManager({ dataDir: './data' })
    );
  }
  return managerPromise;
}

async function setupLLM(app, options = {}) {
  const { mountLLMManagement } = await import('llm-manager');
  const mounted = mountLLMManagement(app, {
    dataDir: './data',
    adminPassword: process.env.LLM_ADMIN_PASSWORD || '${password}',
    ...options
  });
  managerPromise = Promise.resolve(mounted);
  return mounted;
}

async function askLLM(prompt, options = {}) {
  const llm = await getManager();
  return llm.ask(prompt, options);
}

module.exports = { setupLLM, askLLM };
`;
    if (writeFileIfMissing(target, content, force)) createdFiles.push('llm.js');
  } else if (type === 'spa') {
    const hasSrc = fs.existsSync(path.join(cwd, 'src'));
    const relPath = hasSrc ? 'src/llm.js' : 'llm.js';
    const target = path.join(cwd, relPath);
    const content = `// Tarayıcıdan (React, Vue, Vite, HTML) yerel llm-manager servisine soru sorar
const LLM_URL = 'http://127.0.0.1:8010/api/llm/chat';
const LLM_PASS = '${password}';

export async function askLLM(prompt, options = {}) {
  const res = await fetch(LLM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LLM-CSRF': '1',
      'Authorization': 'Basic ' + btoa(\`admin:\${LLM_PASS}\`)
    },
    body: JSON.stringify({ prompt, ...options })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'LLM isteği başarısız oldu.');
  return data.text || data.content;
}
`;
    if (writeFileIfMissing(target, content, force)) createdFiles.push(relPath);
  } else if (type === 'nextjs') {
    const hasSrcApp = fs.existsSync(path.join(cwd, 'src', 'app'));
    const baseDir = hasSrcApp ? 'src' : '';
    const llmRel = baseDir ? `${baseDir}/llm.js` : 'llm.js';
    const apiRouteRel = `${baseDir ? `${baseDir}/` : ''}app/api/llm/[...slug]/route.js`;
    const pageRouteRel = `${baseDir ? `${baseDir}/` : ''}app/llm/[[...slug]]/route.js`;
    const importPath = baseDir ? '@/llm' : '../'.repeat(apiRouteRel.split('/').length - 1) + 'llm.js';
    const pageImportPath = baseDir ? '@/llm' : '../'.repeat(pageRouteRel.split('/').length - 1) + 'llm.js';

    const llmContent = `import { createLLMManager } from 'llm-manager/core';

export const llm = createLLMManager({ dataDir: './data' });

export async function askLLM(prompt, options = {}) {
  return llm.ask(prompt, options);
}
`;
    const routeContent = imp => `import { llm } from '${imp}';

export const GET = (req) => llm.fetch(req);
export const POST = (req) => llm.fetch(req);
export const PUT = (req) => llm.fetch(req);
export const DELETE = (req) => llm.fetch(req);
`;
    if (writeFileIfMissing(path.join(cwd, llmRel), llmContent, force)) createdFiles.push(llmRel);
    if (writeFileIfMissing(path.join(cwd, apiRouteRel), routeContent(importPath), force)) createdFiles.push(apiRouteRel);
    if (writeFileIfMissing(path.join(cwd, pageRouteRel), routeContent(pageImportPath), force)) createdFiles.push(pageRouteRel);
  } else if (type === 'electron') {
    const target = path.join(cwd, 'llm.js');
    const content = esm
      ? `import { createLLMManager } from 'llm-manager/core';

export const llm = createLLMManager({ dataDir: './data' });

export async function askLLM(prompt, options = {}) {
  return llm.ask(prompt, options);
}

export function registerLLMIpc(ipcMain) {
  ipcMain.handle('llm:ask', (_event, prompt, options) => askLLM(prompt, options));
}
`
      : `let managerPromise = null;

function getManager() {
  if (!managerPromise) {
    managerPromise = import('llm-manager/core').then(({ createLLMManager }) =>
      createLLMManager({ dataDir: './data' })
    );
  }
  return managerPromise;
}

async function askLLM(prompt, options = {}) {
  const llm = await getManager();
  return llm.ask(prompt, options);
}

function registerLLMIpc(ipcMain) {
  ipcMain.handle('llm:ask', (_event, prompt, options) => askLLM(prompt, options));
}

module.exports = { askLLM, registerLLMIpc };
`;
    if (writeFileIfMissing(target, content, force)) createdFiles.push('llm.js');
  } else if (type === 'python') {
    const target = path.join(cwd, 'llm_client.py');
    const content = `import urllib.request
import json
import base64

LLM_URL = "http://127.0.0.1:8010/api/llm/chat"
LLM_USER = "admin"
LLM_PASS = "${password}"

def ask_llm(prompt: str, system: str = "") -> str:
    token = base64.b64encode(f"{LLM_USER}:{LLM_PASS}".encode()).decode()
    body = json.dumps({"prompt": prompt, "system": system}).encode("utf-8")
    req = urllib.request.Request(
        LLM_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "X-LLM-CSRF": "1",
            "Authorization": f"Basic {token}"
        },
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return data["text"]
`;
    if (writeFileIfMissing(target, content, force)) createdFiles.push('llm_client.py');
  } else {
    throw new Error(`Desteklenmeyen proje tipi: ${type}`);
  }

  const scriptAdded = ensureNpmScript(cwd, password);
  return { type, esm, createdFiles, scriptAdded, password };
}
