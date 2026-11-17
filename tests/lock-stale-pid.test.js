import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withFileLock, withFileLockSync } from '../src/store/fileLock.js';

function lockFixture(t, atMs) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-stale-pid-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const lockPath = path.join(root, 'profiles.json.lock');
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: new Date(atMs).toISOString() }));
  return lockPath;
}

const processStart = () => Date.now() - process.uptime() * 1000;
const options = { timeoutMs: 400, retryIntervalMs: 10 };

for (const [mode, acquire] of [
  ['async', withFileLock],
  ['sync', withFileLockSync]
]) {
  test(`${mode}: süreç başlangıcından eski, aynı PID'li kilit bayat sayılır`, async t => {
    const lockPath = lockFixture(t, processStart() - 60_000);
    assert.equal(await acquire(lockPath, () => 'tamam', options), 'tamam');
  });

  test(`${mode}: bu süreçte alınmış canlı kilit korunur`, async t => {
    const lockPath = lockFixture(t, Date.now());
    await assert.rejects(async () => acquire(lockPath, () => 'tamam', options), { code: 'STORE_LOCKED' });
    assert.equal(fs.existsSync(lockPath), true);
  });
}
