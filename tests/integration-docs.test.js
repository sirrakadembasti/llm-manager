import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const guide = fs.readFileSync(new URL('../docs/ENTEGRASYON.md', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const scenarios = [
  ['Express', 'express'],
  ['SPA', 'spa'],
  ['Next.js', 'nextjs'],
  ['Nuxt', 'nuxt'],
  ['SvelteKit', 'sveltekit'],
  ['Electron', 'electron'],
  ['Tauri', 'tauri'],
  ['Fastify, Koa, Hono ve NestJS', 'fastify/koa/hono/nestjs'],
  ['Python', 'python'],
  ['.NET ve .NET Framework', 'dotnet']
];
const rows = text =>
  text
    .split('\n')
    .filter(line => /^\| /.test(line))
    .map(line =>
      line
        .split('|')
        .slice(1, -1)
        .map(cell => cell.trim())
    );

test('YH2-G25: scenario names, order and types agree across both environment tables', () => {
  const matrix = readme.split('## Desteklenen ortamlar matrisi')[1]?.split('\n## ')[0] ?? '';
  const environments = guide.split('## Desteklenen ortamlar')[1].split('\n## ')[0];
  assert.deepEqual(
    rows(matrix)
      .slice(2)
      .map(row => row.slice(0, 2)),
    scenarios
  );
  assert.deepEqual(
    rows(environments)
      .slice(2)
      .map(row => row.slice(0, 2)),
    scenarios
  );
  assert.deepEqual(rows(matrix), rows(environments), 'deployment and injection boundaries must agree');
});

test('YH2-G25: each scenario states identity, deployment, serverless and process boundaries', () => {
  for (const [name] of scenarios) {
    const section = guide.split(`## ${name}\n`)[1]?.split('\n## ')[0] ?? '';
    const warning = section.match(/> \[!WARNING\]\n((?:>[^\n]*\n?)+)/)?.[1] ?? '';
    for (const field of ['Güvenlik ve sınırlar', 'Kimlik:', 'Çalışma:', 'Sunucusuz:', 'Ayrı süreç:']) {
      assert.ok(warning.includes(field), `${name}: missing ${field}`);
    }
  }
  const windows =
    "Dosya izinleri (0600) Windows'ta uygulanmaz; `data/` klasörünü yalnız uygulama kullanıcısının erişebileceği bir konuma koyun.";
  assert.ok(readme.includes(windows));
  assert.ok(guide.includes(windows));
});
