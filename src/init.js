import { execFileSync } from 'node:child_process';
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

function getExpectedHelperFiles(cwd, type) {
  if (type === 'python') return ['llm_client.py'];
  if (type === 'spa') return [resolveLlmRelPath(cwd, 'spa')];
  if (type === 'nextjs') {
    const hasSrcApp = fs.existsSync(path.join(cwd, 'src', 'app'));
    const baseDir = hasSrcApp ? 'src' : '';
    const llmRel = baseDir ? `${baseDir}/llm.js` : 'llm.js';
    const apiRouteRel = `${baseDir ? `${baseDir}/` : ''}app/api/llm/[...slug]/route.js`;
    const pageRouteRel = `${baseDir ? `${baseDir}/` : ''}app/llm/[[...slug]]/route.js`;
    return [llmRel, apiRouteRel, pageRouteRel];
  }
  return ['llm.js'];
}

function checkJsxBasicSyntax(content) {
  if (/=\s*;/.test(content)) {
    return "SyntaxError: Unexpected token ';'";
  }
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const closing = new Set([')', '}', ']']);
  const stack = [];
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') i += 1;
      else if (ch === "'" || ch === '\n') inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') i += 1;
      else if (ch === '"' || ch === '\n') inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') i += 1;
      else if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (pairs[ch]) {
      stack.push(pairs[ch]);
    } else if (closing.has(ch)) {
      const expected = stack.pop();
      if (expected !== ch) {
        return `Eşleşmeyen parantez veya blok yapısı ('${ch}')`;
      }
    }
  }

  if (stack.length > 0) {
    return `Kapatılmamış parantez veya blok yapısı ('${stack[stack.length - 1]}' bekleniyordu)`;
  }
  return null;
}

function runNodeSyntaxCheck(fullPath) {
  try {
    execFileSync(process.execPath, ['--check', fullPath], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return null;
  } catch (err) {
    const stderr = String(err.stderr || err.message || '');
    const syntaxLine = stderr
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l.startsWith('SyntaxError:'));
    const fallbackLine = stderr
      .split(/\r?\n/)
      .map(l => l.trim())
      .find(Boolean);
    return syntaxLine || fallbackLine || 'Geçersiz JavaScript sözdizimi';
  }
}

export function verifyIntegration({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  entryFile = detectEntryFile(cwd, type)
} = {}) {
  const normalizedEntry = entryFile ? entryFile.replace(/\\/g, '/').replace(/^\.\//, '') : null;
  const checks = [];

  // 1. data_dir kontrolü
  const dataDirTitle = 'Veri ve Şifreleme Klasörü Kontrolü';
  const dataDir = path.join(cwd, 'data');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
    checks.push({ id: 'data_dir', title: dataDirTitle, ok: true });
  } catch {
    checks.push({
      id: 'data_dir',
      title: dataDirTitle,
      ok: false,
      error: 'Veri klasörüne (./data) yazma izni yok.',
      solution: 'Proje klasörünün yazma izinlerini kontrol edin veya uygulamayı yazma izni olan bir klasörde çalıştırın.'
    });
  }

  // 2. helper_files kontrolü
  const helperTitle = 'Yardımcı Bağlantı Dosyaları Kontrolü';
  const expectedHelpers = getExpectedHelperFiles(cwd, type);
  let missingHelper = null;
  for (const rel of expectedHelpers) {
    const full = path.join(cwd, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile() || fs.readFileSync(full, 'utf8').trim().length === 0) {
      missingHelper = rel;
      break;
    }
  }
  if (missingHelper) {
    checks.push({
      id: 'helper_files',
      title: helperTitle,
      ok: false,
      error: `Eksik bağlantı dosyası tespit edildi: ${missingHelper}`,
      solution: 'Eksik dosyaları yeniden oluşturmak için terminalde "npx llm-manager init --force" komutunu çalıştırın.'
    });
  } else {
    checks.push({ id: 'helper_files', title: helperTitle, ok: true });
  }

  // 3. entry_binding kontrolü
  const bindingTitle = 'Ana Dosya Import / Bağlantı Kontrolü';
  if (normalizedEntry && fs.existsSync(path.join(cwd, normalizedEntry)) && fs.statSync(path.join(cwd, normalizedEntry)).isFile()) {
    const content = fs.readFileSync(path.join(cwd, normalizedEntry), 'utf8');
    let hasBinding = false;
    if (type === 'express') {
      hasBinding = /\b(?:setupLLM|askLLM)\b/.test(content);
    } else if (type === 'spa' || type === 'nextjs') {
      hasBinding = /\baskLLM\b/.test(content);
    } else if (type === 'electron') {
      hasBinding = /\b(?:registerLLMIpc|askLLM)\b/.test(content);
    } else if (type === 'python') {
      hasBinding = /\bask_llm\b/.test(content);
    } else {
      hasBinding = true;
    }

    if (!hasBinding) {
      checks.push({
        id: 'entry_binding',
        title: bindingTitle,
        ok: false,
        error: `${normalizedEntry} dosyasında llm-manager bağlantısı (import/setup) bulunamadı.`,
        solution: `${normalizedEntry} dosyasına ilgili import satırını ekleyin veya "npx llm-manager init" komutunu tekrar çalıştırıp otomatik eklemeyi onaylayın.`
      });
    } else {
      checks.push({ id: 'entry_binding', title: bindingTitle, ok: true });
    }
  } else {
    checks.push({ id: 'entry_binding', title: bindingTitle, ok: true });
  }

  // 4. syntax_check kontrolü
  const syntaxTitle = 'Sözdizimi / Derleme Kontrolü';
  const filesToSyntaxCheck = [];
  if (type !== 'python') {
    const helperRel = resolveLlmRelPath(cwd, type);
    if (fs.existsSync(path.join(cwd, helperRel))) {
      filesToSyntaxCheck.push(helperRel);
    }
  }
  if (normalizedEntry && fs.existsSync(path.join(cwd, normalizedEntry)) && !filesToSyntaxCheck.includes(normalizedEntry)) {
    filesToSyntaxCheck.push(normalizedEntry);
  }

  let syntaxFailure = null;
  for (const rel of filesToSyntaxCheck) {
    const ext = path.extname(rel).toLowerCase();
    const full = path.join(cwd, rel);
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      const detail = runNodeSyntaxCheck(full);
      if (detail) {
        syntaxFailure = { file: rel, detail };
        break;
      }
    } else if (['.jsx', '.tsx'].includes(ext)) {
      const content = fs.readFileSync(full, 'utf8');
      const detail = checkJsxBasicSyntax(content);
      if (detail) {
        syntaxFailure = { file: rel, detail };
        break;
      }
    }
  }

  if (syntaxFailure) {
    checks.push({
      id: 'syntax_check',
      title: syntaxTitle,
      ok: false,
      error: `${syntaxFailure.file} içinde sözdizimi (syntax) hatası tespit edildi: ${syntaxFailure.detail}`,
      solution: `${syntaxFailure.file} dosyasındaki hatalı satırı düzeltin veya yedeğe dönüp "npx llm-manager init --force" çalıştırın.`
    });
  } else {
    checks.push({ id: 'syntax_check', title: syntaxTitle, ok: true });
  }

  return {
    ok: checks.every(c => c.ok),
    type,
    entryFile: normalizedEntry,
    checks
  };
}

export function formatVerificationReport(report) {
  if (!report || !Array.isArray(report.checks)) return '';
  const lines = [];
  for (const check of report.checks) {
    if (check.ok) {
      lines.push(`✔ ${check.title}`);
    } else {
      lines.push(`✖ ${check.title}`);
      if (check.error) lines.push(`  Neden: ${check.error}`);
      if (check.solution) lines.push(`  Çözüm: ${check.solution}`);
    }
  }
  return lines.join('\n');
}
