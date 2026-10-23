import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLLMProfileStore } from '../src/profileStore.js';
import { withFileLockSync, robustRenameSync } from '../src/store/fileLock.js';
import { LLMError, ErrorCodes } from '../src/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.resolve(__dirname, 'helpers/storeWorker.js');

test('YH1-B2: two child_process.fork workers concurrently saving 50 profiles each save 100 profiles without loss', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-concurrent-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = 'aa'.repeat(32);

  try {
    // Launch two workers
    const worker1 = fork(workerPath);
    const worker2 = fork(workerPath);

    const runWorker = (worker, prefix, count) =>
      new Promise((resolve, reject) => {
        worker.on('message', res => {
          if (res.ok) resolve(res);
          else reject(new Error(res.error));
        });
        worker.on('error', reject);
        worker.send({ filePath, encryptionKey, prefix, count });
      });

    const [res1, res2] = await Promise.all([runWorker(worker1, 'w1', 50), runWorker(worker2, 'w2', 50)]);

    assert.equal(res1.ok, true);
    assert.equal(res2.ok, true);

    worker1.kill();
    worker2.kill();

    // Verify final state
    const store = createLLMProfileStore({ filePath, encryptionKey });
    const list = store.list();
    assert.equal(list.profiles.length, 100, 'Expected 100 profiles saved without any concurrency loss');

    const names = new Set(list.profiles.map(p => p.name));
    for (let i = 0; i < 50; i++) {
      assert.ok(names.has(`w1-profile-${i}`), `Missing w1-profile-${i}`);
      assert.ok(names.has(`w2-profile-${i}`), `Missing w2-profile-${i}`);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B2: withFileLockSync throws STORE_LOCKED after timeout when lock is held', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-lock-timeout-'));
  const lockPath = path.join(root, 'test.lock');

  try {
    // Acquire lock and keep it alive
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
    fs.closeSync(fd);

    assert.throws(
      () => withFileLockSync(lockPath, () => 'should-not-run', { timeoutMs: 150, retryIntervalMs: 20 }),
      err => err instanceof LLMError && err.code === ErrorCodes.STORE_LOCKED && err.status === 409
    );
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B2: withFileLockSync clears stale lock when owning pid is dead (> 10s old)', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-stale-lock-'));
  const lockPath = path.join(root, 'test.lock');

  try {
    // Write stale lock with a PID that definitely does not exist (e.g. 999999) and 20 seconds in past
    const staleTime = new Date(Date.now() - 20000).toISOString();
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 999999, at: staleTime }), 'utf8');

    const result = withFileLockSync(lockPath, () => 'lock-acquired-successfully', {
      timeoutMs: 500,
      retryIntervalMs: 20
    });
    assert.equal(result, 'lock-acquired-successfully');
    assert.equal(fs.existsSync(lockPath), false, 'Lock file must be unlinked after execution');
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch {}
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B2: robustRenameSync retries on temporary EBUSY/EPERM', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-robust-rename-'));
  const src = path.join(root, 'temp.txt');
  const dest = path.join(root, 'target.txt');

  fs.writeFileSync(src, 'content', 'utf8');

  let renameAttempts = 0;
  const originalRenameSync = fs.renameSync;
  fs.renameSync = function (from, _to) {
    if (path.resolve(from) === path.resolve(src)) {
      renameAttempts++;
      if (renameAttempts < 3) {
        const err = new Error('resource busy or locked');
        err.code = 'EBUSY';
        throw err;
      }
    }
    return originalRenameSync.apply(this, arguments);
  };

  try {
    robustRenameSync(src, dest);
    assert.equal(renameAttempts, 3, 'Expected 3 attempts before successful rename');
    assert.equal(fs.readFileSync(dest, 'utf8'), 'content');
  } finally {
    fs.renameSync = originalRenameSync;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B3: legacy store format without version field migrates to version: 1', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-schema-v0-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = 'bb'.repeat(32);

  try {
    // Write v0 format without version
    fs.writeFileSync(filePath, JSON.stringify({ activeId: null, profiles: [] }), 'utf8');

    const store = createLLMProfileStore({ filePath, encryptionKey });
    const list = store.list();
    assert.equal(list.version, 1);

    // Save a profile and verify file on disk has version: 1
    store.save({
      name: 'V1 Profile',
      provider: 'custom',
      model: 'model',
      baseURL: 'https://api.example.com/v1',
      apiKey: 'key'
    });

    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(onDisk.version, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B3: store throws STORE_VERSION_UNSUPPORTED on future version and does not overwrite', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-schema-v2-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = 'cc'.repeat(32);

  try {
    const futureData = JSON.stringify({ version: 2, activeId: null, profiles: [] });
    fs.writeFileSync(filePath, futureData, 'utf8');

    const store = createLLMProfileStore({ filePath, encryptionKey });
    assert.throws(
      () => store.list(),
      err => err instanceof LLMError && err.code === ErrorCodes.STORE_VERSION_UNSUPPORTED && err.status === 500
    );

    assert.throws(
      () =>
        store.save({
          name: 'Should Fail',
          provider: 'custom',
          model: 'm',
          baseURL: 'https://example.com/v1',
          apiKey: 'k'
        }),
      err => err instanceof LLMError && err.code === ErrorCodes.STORE_VERSION_UNSUPPORTED
    );

    // File content must remain untouched
    assert.equal(fs.readFileSync(filePath, 'utf8'), futureData);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B3: corrupted JSON throws STORE_CORRUPT with .bak guidance and write generates .bak backup', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-schema-corrupt-'));
  const filePath = path.join(root, 'profiles.json');
  const bakPath = `${filePath}.bak`;
  const encryptionKey = 'dd'.repeat(32);

  try {
    const store = createLLMProfileStore({ filePath, encryptionKey });

    // 1. Initial save creates file
    store.save({
      name: 'Initial Profile',
      provider: 'custom',
      model: 'model',
      baseURL: 'https://example.com/v1',
      apiKey: 'key'
    });

    // 2. Second save creates .bak backup of the initial file
    store.save({
      name: 'Second Profile',
      provider: 'custom',
      model: 'model',
      baseURL: 'https://example.com/v1',
      apiKey: 'key'
    });

    assert.ok(fs.existsSync(bakPath), '.bak backup file must exist');
    const bakContent = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
    assert.equal(bakContent.profiles.length, 1);
    assert.equal(bakContent.profiles[0].name, 'Initial Profile');

    // 3. Corrupt the primary file
    fs.writeFileSync(filePath, '{ invalid json content ...', 'utf8');

    assert.throws(
      () => store.list(),
      err =>
        err instanceof LLMError &&
        err.code === ErrorCodes.STORE_CORRUPT &&
        err.status === 500 &&
        err.message.includes('.bak')
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
