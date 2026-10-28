import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectWorkspace } from '../src/project/workspace.js';
const { runProjectCommand } = await import('../src/project/commands.js').catch(() => ({}));

async function workspace(t) {
  assert.equal(typeof runProjectCommand, 'function');
  const value = await createProjectWorkspace([{ path: 'app.js', content: 'export const value=1;' }]);
  t.after(() => value.dispose());
  return value;
}

test('project commands require explicit approval and return the actual process exit status', async t => {
  const work = await workspace(t);
  const definition = { command: process.execPath, args: ['-e', 'process.exit(7)'] };
  await assert.rejects(runProjectCommand({ workspace: work, definition }), { code: 'PROJECT_APPROVAL_REQUIRED' });
  const result = await runProjectCommand({ workspace: work, definition, approved: true });
  assert.equal(result.exitCode, 7);
  assert.equal(result.passed, false);
});

test('project commands execute in the staging directory with literal arguments and isolated environment', async t => {
  const work = await workspace(t);
  const result = await runProjectCommand({
    workspace: work,
    approved: true,
    definition: {
      command: process.execPath,
      args: [
        '-e',
        "const fs=require('node:fs');if(!fs.existsSync('app.js'))process.exit(2);if(Object.keys(process.env).some(k=>k.startsWith('LLM_')))process.exit(3);console.log(process.argv[1]);",
        'literal & | argument'
      ]
    }
  });
  assert.equal(result.passed, true);
  assert.match(result.output, /literal & \| argument/);
});

test('project command output containing a credential pattern is withheld', async t => {
  const work = await workspace(t);
  const result = await runProjectCommand({
    workspace: work,
    approved: true,
    definition: { command: process.execPath, args: ['-e', "console.log('sk-this-is-a-synthetic-test-secret')"] }
  });
  assert.equal(result.passed, true);
  assert.ok(!result.output.includes('sk-this-is-a-synthetic-test-secret'));
  assert.equal(result.redacted, true);
});

test('project commands stop on timeout instead of reporting a successful test', async t => {
  const work = await workspace(t);
  await assert.rejects(
    runProjectCommand({
      workspace: work,
      approved: true,
      definition: { command: process.execPath, args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 100 }
    }),
    { code: 'PROJECT_TOOL_TIMEOUT' }
  );
});
