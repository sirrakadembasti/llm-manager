import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

test('package.json contains complete metadata and compatibility settings', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.ok(pkg.author, 'package.json must declare an author');
  assert.ok(Array.isArray(pkg.keywords) && pkg.keywords.length >= 5, 'package.json must declare keywords array');
  assert.equal(pkg.sideEffects, false, 'package.json must declare sideEffects: false for bundler optimization');
  assert.equal(pkg.publishConfig?.access, 'public', 'package.json must declare publishConfig.access: public');
  assert.equal(pkg.engines?.node, '>=20.12.0', 'engines.node must be widened to >=20.12.0');
});

test('npm pack bundle excludes tests, data, and secret env files', () => {
  const rawOutput = execSync('npm pack --dry-run --json', { encoding: 'utf8' });
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
  assert.ok(
    files.some(f => f.includes('README.en.md')),
    'Package must include README.en.md'
  );

  // Verify exclusions
  const forbiddenFiles = files.filter(
    f => f.startsWith('tests/') || f.startsWith('data/') || f === '.env' || f.endsWith('/.env')
  );
  assert.deepEqual(forbiddenFiles, [], `Forbidden files packed into tarball: ${forbiddenFiles.join(', ')}`);
});
