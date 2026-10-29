import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guide = fs
  .readFileSync(new URL('../docs/KULLANICI_KILAVUZU.md', import.meta.url), 'utf8')
  .replaceAll('\r\n', '\n');
const scenarios = [
  ['Express', 'express', 'Hayır'],
  ['SPA', 'spa', 'Evet'],
  ['Next.js', 'nextjs', 'Hayır'],
  ['Nuxt', 'nuxt', 'Hayır'],
  ['SvelteKit', 'sveltekit', 'Hayır'],
  ['Electron', 'electron', 'Hayır'],
  ['Tauri', 'tauri', 'Evet'],
  ['Fastify, Koa, Hono ve NestJS', 'fastify/koa/hono/nestjs', 'Hayır'],
  ['Python', 'python', 'Evet'],
  ['.NET ve .NET Framework', 'dotnet', 'Evet']
];
const matrix = guide.split('### Desteklenen ortamlar')[1]?.split('\n### ')[0] ?? '';
const rows = matrix
  .split('\n')
  .filter(line => /^\| /.test(line))
  .slice(2)
  .map(line =>
    line
      .split('|')
      .slice(1, -1)
      .map(cell => cell.trim())
  );

test('YH2-G25: unified guide provides one supported environment matrix', () => {
  assert.deepEqual(
    rows.map(row => row.slice(0, 2)),
    scenarios.map(row => row.slice(0, 2))
  );
  assert.equal((guide.match(/### Desteklenen ortamlar/g) || []).length, 1);
});

test('YH2-G25: unified integration matrix retains process and identity boundaries', () => {
  assert.deepEqual(
    rows.map(row => row[3]),
    scenarios.map(row => row[2])
  );
  assert.match(matrix, /yalnız chat Bearer/);
  assert.match(matrix, /renderer admin parolası almaz/);
  assert.match(matrix, /doğrulanmış principal ile elle köprü/);
  assert.match(matrix, /Edge desteklenmez/);
  assert.match(matrix, /kalıcı ana uygulama deposu/);
  assert.match(guide, /0600.*Windows.*NTFS ACL/);
});
