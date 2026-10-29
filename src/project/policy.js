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
  'data',
  'dist',
  'build',
  'out',
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
      p =>
        !p ||
        /[.\s]$/.test(p) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) ||
        blockedDirectories.has(p.toLowerCase())
    )
  ) {
    throw projectError(
      'PROJECT_PATH_DENIED',
      'Bu kaynak yoluna erişim izni yok.',
      403,
      parts.some(p => blockedDirectories.has(p.toLowerCase())) ? 'directory' : 'unsafe-path'
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

export function hasProjectSecret(content) {
  if (
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAIza[\w-]{20,}|\bsk-(?:proj-)?[\w-]{16,}|\bgh[pousr]_[\w]{20,}|\bAKIA[A-Z0-9]{16}\b/i.test(
      content
    ) ||
    /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i.test(content)
  )
    return true;
  // Only a direct literal (including a reactive initializer) is a credential.
  // Empty literals are allowed; quoted JSON keys and short passwords are covered.
  const literals =
    /\b[\w$]*(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|pwd|encryption[_-]?key)["']?\s*[:=]\s*(?:(?:ref|shallowRef)\s*(?:<[^>\r\n]+>)?\s*\(\s*)?(["'`])((?:\\.|(?!\1)[^\\\r\n])*)\1/gi;
  for (const match of content.matchAll(literals)) if (match[2].length) return true;
  for (const match of content.matchAll(/\b(?:password|pwd)\s*=\s*([^;\r\n]+)/gi)) {
    const value = match[1].trim();
    if (!value || /^(["'`])\1\s*[,}]?$/.test(value)) continue;
    const prefix = content.slice(Math.max(0, match.index - 120), match.index);
    const code = /(?:\b(?:const|let|var)\s+|[\w$]+\.\s*)$/i.test(prefix);
    const emptyRef =
      /^(?:ref|shallowRef)\s*(?:<[^>]+>)?\s*\(\s*(?:''|""|false|true|null|undefined|0)?\s*\)\s*[,}]?$/.test(value);
    const reference = /^(?:[\w$]+(?:\.[\w$]+)*(?:\(\s*\))?)\s*[,}]?$/.test(value);
    if (code && (emptyRef || reference)) continue;
    return true;
  }
  return false;
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

export function skipDirectory(name) {
  return blockedDirectories.has(name.toLowerCase());
}
