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

test('G07: local npm installation resolves scoped core and exposes the current CLI version', t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'scoped-npm-install-'));
  const root = fileURLToPath(new URL('..', import.meta.url));
  const startedAt = Date.now();
  let phase = 'fixture';
  let primaryError;
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify({ private: true }));
    phase = 'npm install';
    const installArgs = ['install', root, '--offline', '--ignore-scripts', '--no-audit', '--no-fund'];
    execFileSync(
      process.platform === 'win32' ? process.execPath : 'npm',
      process.platform === 'win32'
        ? [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...installArgs]
        : installArgs,
      { cwd, stdio: 'pipe', timeout: 60000 }
    );
    t.diagnostic(`Package ${phase} completed at ${Date.now() - startedAt}ms`);
    phase = 'core import';
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
    t.diagnostic(`Package ${phase} completed at ${Date.now() - startedAt}ms`);
    const installed = path.join(cwd, 'node_modules', ...pkg.name.split('/'));
    phase = 'CLI version';
    const version = execFileSync(process.execPath, [path.join(installed, 'bin/llm-manager.js'), '--version'], {
      cwd,
      encoding: 'utf8'
    });
    assert.equal(version.trim(), pkg.version);
    t.diagnostic(`Package ${phase} completed at ${Date.now() - startedAt}ms`);
    phase = 'bin assertion';
    assert.ok(
      fs.existsSync(
        path.join(cwd, 'node_modules', '.bin', process.platform === 'win32' ? 'llm-manager.cmd' : 'llm-manager')
      )
    );
  } catch (error) {
    primaryError = new Error(
      `Package operation failed: ${JSON.stringify({ phase, elapsedMs: Date.now() - startedAt, cwd, code: error.code, status: error.status, signal: error.signal, pid: error.pid, message: error.message })}\nstdout:\n${String(error.stdout ?? '')}\nstderr:\n${String(error.stderr ?? '')}`,
      { cause: error }
    );
  }
  let cleanupError;
  try {
    fs.rmSync(cwd, { recursive: true, force: true });
  } catch (error) {
    cleanupError = error;
  }
  if (primaryError && cleanupError)
    throw new AggregateError(
      [primaryError, cleanupError],
      `${primaryError.message}\nCleanup failed: ${cleanupError.message}`,
      { cause: primaryError }
    );
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
});
