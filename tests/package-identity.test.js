import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initLLMProject } from '../src/init.js';
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
test('approved package identity and generated imports use scoped name', async () => {
  assert.equal(pkg.name, '@sirrakadembasti/llm-manager');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scoped-init-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ type: 'module' }));
    initLLMProject({ cwd, type: 'express' });
    assert.ok(fs.readFileSync(path.join(cwd, 'llm.js'), 'utf8').includes(`from '${pkg.name}'`));
    assert.equal(typeof (await import('@sirrakadembasti/llm-manager/core')).createLLMManager, 'function');
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('G07: local npm installation resolves scoped core and exposes the current CLI version', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scoped-npm-install-'));
  const root = fileURLToPath(new URL('..', import.meta.url));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ private: true }));
    execFileSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', root, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'],
      { cwd, shell: process.platform === 'win32', stdio: 'pipe', timeout: 60000 }
    );
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { createLLMManager } from '${pkg.name}/core'; console.log(typeof createLLMManager);`
      ],
      { cwd, encoding: 'utf8' }
    );
    assert.equal(output.trim(), 'function');
    const installed = path.join(cwd, 'node_modules', ...pkg.name.split('/'));
    const version = execFileSync(process.execPath, [path.join(installed, 'bin/llm-manager.js'), '--version'], {
      cwd,
      encoding: 'utf8'
    });
    assert.equal(version.trim(), pkg.version);
    assert.ok(
      fs.existsSync(
        path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'llm-manager.cmd' : 'llm-manager')
      )
    );
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});
