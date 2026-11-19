import path from 'node:path';
import { LLMError } from '../errors.js';

const blockedDirectories = new Set([
  '.git',
  '.hg',
  '.svn',
  '.aws',
  '.ssh',
  '.agents',
  '.codex',
  '.claude',
  '.opencode',
  'node_modules',
  'dist',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.venv',
  'venv',
  '__pycache__',
  'obj',
  'graphify-out'
]);
// Common source-folder names (e.g. src/data, app/build) are live data or build
// output only at the project root; nested generated copies are normally ignored.
const rootOnlyDirectories = new Set(['data', 'build', 'out']);

function blockedDirectory(name, depth) {
  const lower = name.toLowerCase();
  return blockedDirectories.has(lower) || (depth === 0 && rootOnlyDirectories.has(lower));
}
const extensions = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.vue',
  '.svelte',
  '.html',
  '.css',
  '.scss',
  '.json',
  '.md',
  '.yaml',
  '.yml',
  '.toml',
  '.xml',
  '.csproj',
  '.fsproj',
  '.sln',
  '.py',
  '.cs',
  '.fs',
  '.vb',
  '.sql',
  '.prisma',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.php',
  '.rb',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.swift',
  '.graphql',
  '.gql',
  '.proto',
  '.sh',
  '.ps1',
  '.txt'
]);

function hasControlCharacters(value) {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export function projectError(code, message, status = 400, exclusionReason) {
  const error = new LLMError(code, message, { status, retryable: false });
  if (exclusionReason) error.exclusionReason = exclusionReason;
  return error;
}

export function projectPath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    hasControlCharacters(value) ||
    value.includes('\\') ||
    value.includes(':') ||
    path.posix.isAbsolute(value)
  ) {
    throw projectError('PROJECT_PATH_DENIED', 'Bu kaynak yoluna erişim izni yok.', 403, 'unsafe-path');
  }
  const parts = value.split('/');
  if (
    parts.some(
      (p, i) =>
        !p ||
        /[.\s]$/.test(p) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) ||
        (i < parts.length - 1 && blockedDirectory(p, i))
    )
  ) {
    throw projectError(
      'PROJECT_PATH_DENIED',
      'Bu kaynak yoluna erişim izni yok.',
      403,
      parts.some((p, i) => i < parts.length - 1 && blockedDirectory(p, i)) ? 'directory' : 'unsafe-path'
    );
  }
  const name = parts.at(-1).toLowerCase();
  if (
    /^\.env(?:\.|$)|\.(?:key|pem|pfx|p12|db|sqlite3?|bak|dump|log)$|^(?:llm-profiles|credentials|secrets)(?:\.|$)|^package-lock\.json$/.test(
      name
    ) ||
    name === '.gitignore'
  ) {
    throw projectError('PROJECT_PATH_DENIED', 'Sır veya veri dosyaları proje bağlamına alınmaz.', 403, 'private-path');
  }
  if (!extensions.has(path.posix.extname(name)) && !['dockerfile', 'makefile', 'gemfile'].includes(name)) {
    throw projectError('PROJECT_PATH_DENIED', 'Bu dosya türü kaynak taraması dışında.', 403, 'unsupported-type');
  }
  return value;
}

// Credential formats that are secrets wherever they appear; a file holding one is never masked.
function hasHardSecret(content) {
  return (
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAIza[\w-]{20,}|\bsk-(?:proj-)?[\w-]{16,}|\bgh[pousr]_[\w]{20,}|\bAKIA[A-Z0-9]{16}\b/i.test(
      content
    ) || /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i.test(content)
  );
}

export function hasProjectSecret(content) {
  if (hasHardSecret(content)) return true;
  // Only a direct literal (including a reactive initializer) is a credential.
  // Empty literals are allowed; quoted JSON keys and short passwords are covered.
  const literals =
    /\b[\w$]*(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|pwd|encryption[_-]?key)["']?\s*[:=]\s*(?:(?:ref|shallowRef)\s*(?:<[^>\r\n]+>)?\s*\(\s*)?(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/gi;
  for (const match of content.matchAll(literals)) {
    if (!match[2].length) continue;
    // Namespaced UI keys ("form.api_key": "API anahtarı") hold human text;
    // tokens and keys never contain whitespace.
    if (content[match.index - 1] === '.' && /\s/.test(match[2])) continue;
    return true;
  }
  for (const match of content.matchAll(/\b(?:password|pwd)\s*=\s*([^;\r\n]+)/gi)) {
    const value = match[1].trim();
    if (!value || /^(["'`])\1\s*[,}]?$/.test(value)) continue;
    // A computed value (call, await, logical fallback) is code, unless it
    // falls back to a non-empty literal such as `env.X || 'default-secret'`.
    const computed = /^(?:await\s+)?[\w$.]*[\w$]\s*\(/.test(value) || /\|\||\?\?|&&/.test(value);
    const fallbackLiteral = /(?:\|\||\?\?)\s*(["'`])(?!\1)/.test(value);
    if (computed && !fallbackLiteral) continue;
    const prefix = content.slice(Math.max(0, match.index - 120), match.index);
    // Declarations, member assignments and destructuring/parameter defaults.
    const code = /(?:\b(?:const|let|var)\s+|[\w$]+\.\s*|[{(,]\s*|[\w$]+\s*:\s*)$/i.test(prefix);
    const emptyRef =
      /^(?:ref|shallowRef)\s*(?:<[^>]+>)?\s*\(\s*(?:''|""|false|true|null|undefined|0)?\s*\)\s*[,}]?$/.test(value);
    const reference = /^[\w$]+(?:\.[\w$]+)*(?:\(\s*\))?\s*(?:[,})]|$)/.test(value);
    if (code && (emptyRef || reference)) continue;
    // A plain statement `password = a.b.c;`: a dotted reference ended by `;`. Without the dots and
    // the semicolon, `PASSWORD=hunter2` or `password=my.secret.pass` would look the same.
    const lineStart = /(?:^|[{}])[ \t]*$/.test(
      content.slice(content.lastIndexOf('\n', match.index - 1) + 1, match.index)
    );
    const assignedReference =
      lineStart && /^[\w$]+(?:\.[\w$]+)+$/.test(value) && content[match.index + match[0].length] === ';';
    if (assignedReference) continue;
    return true;
  }
  return false;
}

export const MASK_TEXT = '[GİZLENDİ]';

/**
 * Sourced-chat view of a file whose only secrets are assignment-style lines (typically synthetic test
 * credentials): each matching line becomes `[GİZLENDİ]` so line numbers still match the file. Returns null
 * (the file stays fully excluded) for hard credential formats, for nothing to mask, and whenever the
 * masked text still looks secret.
 */
export function maskProjectSecrets(content) {
  if (hasHardSecret(content)) return null;
  let count = 0;
  const masked = content
    .split('\n')
    .map(line => {
      if (!hasProjectSecret(line)) return line;
      count++;
      return `${/^[ \t]*/.exec(line)[0]}${MASK_TEXT}${line.endsWith('\r') ? '\r' : ''}`;
    })
    .join('\n');
  return count && !hasProjectSecret(masked) ? { content: masked, count } : null;
}

export function diagnosticProjectPath(value) {
  if (
    typeof value !== 'string' ||
    value.length > 512 ||
    hasControlCharacters(value) ||
    value.includes('\\') ||
    value.includes(':') ||
    path.posix.isAbsolute(value) ||
    value.split('/').some(p => !p || p === '.' || p === '..') ||
    hasProjectSecret(value)
  )
    return null;
  return value;
}

export function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** @param {string} relativeDirectory POSIX path of a directory relative to the project root. */
export function skipDirectory(relativeDirectory) {
  const parts = relativeDirectory.replace(/\/+$/, '').split('/');
  return blockedDirectory(parts.at(-1), parts.length - 1);
}
