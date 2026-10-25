import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

export function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return parseEnv(fs.readFileSync(filePath, 'utf8'));
}

export function upsertEnv(filePath, entries) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  for (const [key, raw] of Object.entries(entries)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || /[\r\n\0]/.test(String(raw))) {
      throw new Error('Geçersiz ortam değişkeni.');
    }
    const text = String(raw);
    let value = text;
    if (!/^[A-Za-z0-9_./:@+-]+$/.test(text)) {
      const delimiter = ["'", '"', '`'].find(quote => !text.includes(quote));
      if (!delimiter)
        throw new Error('Ortam dosyası için geçersiz ortam değişkeni: tüm tırnak türleri birlikte kullanılamaz.');
      value = `${delimiter}${text}${delimiter}`;
    }
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=[^\\r\\n]*`, 'gm');
    content = pattern.test(content)
      ? content.replace(pattern, () => line)
      : `${content}${content && !content.endsWith('\n') ? eol : ''}${line}${eol}`;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

export function ensureGitignore(cwd, entries = ['data/', '.env', '.env.local', '*.key']) {
  const target = path.join(cwd, '.gitignore');
  const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = new Set(content.split(/\r?\n/).map(line => line.trim()));
  const missing = entries.filter(entry => !lines.has(entry));
  if (missing.length) {
    fs.writeFileSync(
      target,
      `${content}${content && !content.endsWith('\n') ? eol : ''}# llm-manager${eol}${missing.join(eol)}${eol}`
    );
  }
}
