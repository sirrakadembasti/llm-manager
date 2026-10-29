import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const guide = fs.readFileSync(new URL('../docs/KULLANICI_KILAVUZU.md', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Turkish technical guide matrix covers the ten supported scenarios and manual/serverless boundaries', () => {
  const matrix = guide.split('### Desteklenen ortamlar')[1]?.split('\n### ')[0] ?? '';
  const rows = matrix
    .split('\n')
    .filter(line => /^\|/.test(line))
    .slice(2);
  assert.deepEqual(
    rows.map(row => row.split('|')[2].trim()),
    [
      'express',
      'spa',
      'nextjs',
      'nuxt',
      'sveltekit',
      'electron',
      'tauri',
      'fastify/koa/hono/nestjs',
      'python',
      'dotnet'
    ]
  );
  assert.match(matrix, /Edge desteklenmez/);
  assert.match(matrix, /kalıcı ana uygulama deposu/);
  assert.match(matrix, /elle köprü/);
});

test('Turkish operators can find lifecycle, quota, recovery and privacy instructions', () => {
  for (const instruction of [
    /handleSignals: true/,
    /await instance\.close\(\)/,
    /10 saniye/,
    /getClientId\(request\)/,
    /principal\.id/,
    /trust proxy/,
    /Retry-After/,
    /STORE_CORRUPT/,
    /STORE_VERSION_UNSUPPORTED/,
    /\.bak/,
    /logContent: false/,
    /açılamaz/,
    /chat\.completed/,
    /erken yineleyici dönüşü/,
    /maxSingleMessageChars/,
    /BODY_TOO_LARGE/,
    /MESSAGES_INVALID/,
    /purpose: 'diagnostic'/,
    /purpose: 'quick'/,
    /purpose: 'default'/,
    /writeEnv: true/,
    /llm-encryption\.key\.old-/,
    /\.env.*değişmez/
  ])
    assert.match(guide, instruction);
});

test('Turkish migration documents every public subpath and removed synchronous root exports', () => {
  for (const subpath of Object.keys(pkg.exports).filter(key => key !== '.')) {
    assert.ok(guide.includes(`${pkg.name}${subpath.slice(1)}`), `missing ${subpath}`);
  }
  assert.match(
    guide,
    /import \{ detectProjectType, detectEntryFile, formatVerificationReport \} from '@sirrakadembasti\/llm-manager\/init'/
  );
  assert.match(guide, /kökten kaldırılmıştır/);
  assert.match(guide, /bir uyumluluk sürümü/);
});
