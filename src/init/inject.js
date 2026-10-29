import fs from 'node:fs';
import path from 'node:path';
import { detectProjectType, detectEntryFile, isEsmProject } from './detect.js';
import { resolveLlmRelPath } from './paths.js';
function findSfcScriptInsertIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*<script\b[^>]*>/i.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
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

export function injectIntoEntryFile({
  cwd = process.cwd(),
  type = detectProjectType(cwd),
  entryFile = detectEntryFile(cwd, type),
  esm,
  journal
} = {}) {
  if (!entryFile) {
    return { modified: false, entryFile: null, addedLines: [], diffPreview: '', rollback: () => {} };
  }
  const relEntry = entryFile.replace(/\\/g, '/').replace(/^\.\//, '');
  const fullPath = path.resolve(cwd, relEntry);
  if (!fullPath.startsWith(path.resolve(cwd) + path.sep)) throw new Error('Entry path escapes project');
  journal?.capture(fullPath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    return { modified: false, entryFile: null, addedLines: [], diffPreview: '', rollback: () => {} };
  }

  const originalContent = fs.readFileSync(fullPath, 'utf8');
  if (type === 'express' && !/\b(?:const|let|var)\s+app\s*=\s*express\s*\(/.test(originalContent)) {
    return {
      modified: false,
      entryFile: relEntry,
      addedLines: [],
      diffPreview: '',
      reason: 'Express app oluşturma noktası doğrulanamadı; setupLLM(app) bağlantısını elle ekleyin.',
      rollback: () => {}
    };
  }
  if (
    ['nuxt', 'sveltekit', 'fastify', 'koa', 'hono', 'nestjs', 'tauri', 'unknown'].includes(type) ||
    (type === 'nextjs' &&
      /^\s*(['"])use client\1\s*;?/.test(originalContent.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '')))
  ) {
    return {
      modified: false,
      entryFile: relEntry,
      addedLines: [],
      diffPreview: '',
      reason: 'İstemci bileşenine sunucu modülü eklenemez; Server Action ya da route handler kullanın.',
      rollback: () => {}
    };
  }
  const rollback = () => {
    fs.writeFileSync(fullPath, originalContent, 'utf8');
  };

  if (/\b(?:setupLLM|askLLM|registerLLMIpc|ask_llm|LlmClient|LlmManager)\b/.test(originalContent)) {
    return {
      modified: false,
      alreadyIntegrated: true,
      entryFile: relEntry,
      addedLines: [],
      diffPreview: '',
      rollback
    };
  }

  const useEsm =
    esm !== undefined
      ? Boolean(esm)
      : (/\.tsx?$/i.test(relEntry) && /^\s*(?:import|export)\b/m.test(originalContent)) || isEsmProject(cwd, type);
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
  } else if (type === 'dotnet') {
    let lastUsing = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*using\s+[A-Za-z0-9_.]+\s*;/.test(lines[i])) {
        lastUsing = i;
      }
    }
    const csLine = 'using LlmManager;';
    lines.splice(lastUsing >= 0 ? lastUsing + 1 : 0, 0, csLine);
    addedLines.push(csLine);
  } else {
    const llmRel = resolveLlmRelPath(cwd, type);
    const entryDir = path.posix.dirname(relEntry);
    let relImport = path.posix.relative(entryDir, llmRel);
    if (!relImport.startsWith('.')) {
      relImport = `./${relImport}`;
    }
    const requireImport = /\.tsx?$/i.test(relEntry) ? relImport : relImport.replace(/\.js$/, '');

    if (type === 'express') {
      const importLine = useEsm
        ? `import { setupLLM, askLLM } from '${relImport}';`
        : `const { setupLLM, askLLM } = require('${requireImport}');`;
      const insertIdx = findJsImportInsertIndex(lines, useEsm);
      lines.splice(insertIdx, 0, importLine);
      addedLines.push(importLine);

      let setupTargetIdx = -1;
      for (let i = 0; i < lines.length; i += 1) {
        if (
          /\bapp\.use\s*\(\s*(?:express\.json|cookieParser|session)\s*\(/.test(lines[i]) &&
          /\)\s*\)\s*;?\s*$/.test(lines[i])
        ) {
          setupTargetIdx = i + 1;
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
    } else if (type === 'spa' || type === 'nextjs' || type === 'nuxt' || type === 'sveltekit') {
      const importLine = `import { askLLM } from '${relImport}';`;
      if (/\.(?:vue|svelte)$/i.test(relEntry)) {
        const scriptIdx = findSfcScriptInsertIndex(lines);
        if (scriptIdx >= 0) {
          lines.splice(scriptIdx, 0, importLine);
          addedLines.push(importLine);
        } else {
          const block = ['<script setup>', importLine, '</script>'];
          lines.splice(0, 0, ...block);
          addedLines.push(...block);
        }
      } else {
        const insertIdx = findJsImportInsertIndex(lines, true);
        lines.splice(insertIdx, 0, importLine);
        addedLines.push(importLine);
      }
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
          if (
            !useEsm &&
            /^\s*(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\s*\(\s*['"]electron['"]\s*\)/.test(lines[i])
          ) {
            lines[i] = lines[i].replace(/\{([^}]*)\}/, (_m, imports) => `{ ${imports.trim()}, ipcMain }`);
            updatedExisting = true;
            break;
          }
        }
        if (!updatedExisting) {
          const ipcImport = useEsm ? "import { ipcMain } from 'electron';" : "const { ipcMain } = require('electron');";
          lines.splice(findJsImportInsertIndex(lines, useEsm), 0, ipcImport);
          addedLines.push(ipcImport);
        }
      }

      const importLine = useEsm
        ? `import { registerLLMIpc, askLLM } from '${relImport}';`
        : `const { registerLLMIpc, askLLM } = require('${requireImport}');`;
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
