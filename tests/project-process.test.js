import test from 'node:test';
import assert from 'node:assert/strict';
import { runProjectProcess } from '../src/project/process.js';

test(
  'project process escalates cancellation when a POSIX tool ignores SIGTERM',
  { skip: process.platform === 'win32' },
  async () => {
    const started = Date.now();
    await assert.rejects(
      runProjectProcess({
        command: process.execPath,
        args: ['-e', "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
        timeoutMs: 1000
      }),
      { code: 'PROJECT_TOOL_TIMEOUT' }
    );
    assert.ok(Date.now() - started < 5000);
  }
);
