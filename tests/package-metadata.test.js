import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('package.json contains complete metadata and compatibility settings', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.ok(pkg.author, 'package.json must declare an author');
  assert.ok(Array.isArray(pkg.keywords) && pkg.keywords.length >= 5, 'package.json must declare keywords array');
  assert.equal(pkg.sideEffects, false, 'package.json must declare sideEffects: false for bundler optimization');
  assert.equal(pkg.publishConfig?.access, 'public', 'package.json must declare publishConfig.access: public');
  assert.equal(pkg.engines?.node, '>=22.12.0', 'engines.node must be widened to >=22.12.0');
});

test('npm pack bundle excludes tests, data, and secret env files', () => {
  const packArgs = ['pack', '--dry-run', '--json'];
  const rawOutput = execFileSync(
    process.platform === 'win32' ? process.execPath : 'npm',
    process.platform === 'win32'
      ? [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...packArgs]
      : packArgs,
    { encoding: 'utf8' }
  );
  const packInfo = JSON.parse(rawOutput);
  assert.ok(Array.isArray(packInfo) && packInfo.length > 0, 'npm pack output should contain package info');

  const files = packInfo[0].files.map(f => f.path);
  assert.ok(
    files.some(f => f.includes('src/core.js')),
    'Package must include src/core.js'
  );
  assert.ok(
    files.some(f => f.includes('README.md')),
    'Package must include README.md'
  );
  for (const required of ['docs/TEKNIK_KILAVUZ.md', 'docs/GUVENLIK.md', 'docs/DEGISIKLIKLER.md']) {
    assert.ok(files.includes(required), `Package must include ${required}`);
  }
  assert.equal(files.includes('public/i18n/en.json'), false, 'English interface dictionary must not be shipped');
  assert.equal(files.includes('docs/README.en.md'), false, 'English guide must not be shipped');

  // Verify exclusions
  const forbiddenFiles = files.filter(
    f => f.startsWith('tests/') || f.startsWith('data/') || f === '.env' || f.endsWith('/.env')
  );
  assert.deepEqual(forbiddenFiles, [], `Forbidden files packed into tarball: ${forbiddenFiles.join(', ')}`);
});
