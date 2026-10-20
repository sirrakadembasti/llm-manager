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
