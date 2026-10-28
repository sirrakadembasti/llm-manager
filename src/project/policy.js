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

export function projectError(code, message, status = 400) {
  return new LLMError(code, message, { status, retryable: false });
}

export function projectPath(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.includes(':') ||
    path.posix.isAbsolute(value)
  ) {
    throw projectError('PROJECT_PATH_DENIED', 'Bu kaynak yoluna erişim izni yok.', 403);
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
    throw projectError('PROJECT_PATH_DENIED', 'Bu kaynak yoluna erişim izni yok.', 403);
  }
  const name = parts.at(-1).toLowerCase();
  if (
    /^\.env(?:\.|$)|\.(?:key|pem|pfx|p12|db|sqlite3?|bak|dump|log)$|^(?:llm-profiles|credentials|secrets)(?:\.|$)|^package-lock\.json$/.test(
      name
    ) ||
    name === '.gitignore'
  ) {
    throw projectError('PROJECT_PATH_DENIED', 'Sır veya veri dosyaları proje bağlamına alınmaz.', 403);
  }
  if (!extensions.has(path.posix.extname(name)) && !['dockerfile', 'makefile', 'gemfile'].includes(name)) {
    throw projectError('PROJECT_PATH_DENIED', 'Bu dosya türü kaynak taraması dışında.', 403);
  }
  return value;
}

export function hasProjectSecret(content) {
  return (
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAIza[\w-]{20,}|\bsk-(?:proj-)?[\w-]{16,}|\bgh[pousr]_[\w]{20,}|\bAKIA[A-Z0-9]{16}\b/i.test(
      content
    ) ||
    /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|encryption[_-]?key)\s*[:=]\s*["'`][^"'`\r\n]{16,}["'`]/i.test(
      content
    ) ||
    /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/]+:[^\s@]+@/i.test(content) ||
    /(?:Password|Pwd)\s*=\s*[^;"'\s][^;"']{2,}/i.test(content)
  );
}

export function isWithin(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export function skipDirectory(name) {
  return blockedDirectories.has(name.toLowerCase());
}
