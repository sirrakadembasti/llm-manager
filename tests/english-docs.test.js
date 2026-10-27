import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const english = fs.readFileSync(new URL('../docs/README.en.md', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('English deployment matrix covers the ten supported scenarios and manual/serverless boundaries', () => {
  const matrix = english.split('## Supported environments')[1]?.split('\n## ')[0] ?? '';
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
  assert.match(matrix, /Edge is unsupported/);
  assert.match(matrix, /persistent host store/);
  assert.match(matrix, /manual bridge/);
});

test('English operators can find lifecycle, quota, recovery and privacy instructions', () => {
  for (const instruction of [
    /handleSignals: true/,
    /await instance\.close\(\)/,
    /10 seconds/,
    /getClientId\(request\)/,
    /principal\.id/,
    /trust proxy/,
    /Retry-After/,
    /STORE_CORRUPT/,
    /STORE_VERSION_UNSUPPORTED/,
    /\.bak/,
    /logContent: false/,
    /cannot be enabled/,
    /chat\.completed/,
    /early iterator return/,
    /maxSingleMessageChars/,
    /BODY_TOO_LARGE/,
    /MESSAGES_INVALID/,
    /purpose: 'diagnostic'/,
    /purpose: 'quick'/,
    /purpose: 'default'/,
    /writeEnv: true/,
    /llm-encryption\.key\.old-/,
    /\.env.*unchanged/
  ])
    assert.match(english, instruction);
});

test('English migration documents every public subpath and removed synchronous root exports', () => {
  for (const subpath of Object.keys(pkg.exports).filter(key => key !== '.')) {
    assert.ok(english.includes(`${pkg.name}${subpath.slice(1)}`), `missing ${subpath}`);
  }
  assert.match(
    english,
    /import \{ detectProjectType, detectEntryFile, formatVerificationReport \} from '@sirrakadembasti\/llm-manager\/init'/
  );
  assert.match(english, /removed from the root/);
  assert.match(english, /one compatibility release/);
});
