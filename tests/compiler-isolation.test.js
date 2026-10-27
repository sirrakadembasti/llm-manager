import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { checkSource } from '../src/init/compiler.js';

test('C# verification cannot register temporary global-tools directories in the user PATH', t => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-compiler-isolation-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  fs.writeFileSync(path.join(cwd, 'LlmClient.cs'), 'public class LlmClient {}');
  const invocations = [];
  const mock = t.mock.method(childProcess, 'execFileSync', (command, args, options) => {
    assert.equal(command, 'dotnet');
    invocations.push({ args, options });
    if (args[0] === '--list-sdks') return '10.0.402 [fixture]\n';
    return Buffer.from('Build succeeded.');
  });
  syncBuiltinESMExports();
  t.after(() => {
    mock.mock.restore();
    syncBuiltinESMExports();
  });
  const parentPath = process.env.PATH;
  const warnings = [];
  assert.equal(checkSource(cwd, 'LlmClient.cs', warnings), null);
  assert.deepEqual(warnings, []);
  assert.equal(invocations.length, 2);
  for (const { options } of invocations) {
    assert.equal(options.env?.DOTNET_ADD_GLOBAL_TOOLS_TO_PATH, 'false');
  }
  assert.equal(process.env.PATH, parentPath);
  assert.equal(fs.existsSync(invocations[1].options.cwd), false, 'temporary build is cleaned up');
});
