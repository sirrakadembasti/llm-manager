import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMProfileStore } from '../src/profileStore.js';
import { ensureLLMEncryptionKey } from '../src/setup.js';
import { withFileLock } from '../src/store/fileLock.js';
test('B2 store methods return promises and concurrent writes retain all profiles', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'async-store-'));
  try {
    const store = createLLMProfileStore({ dataDir: root, encryptionKey: '11'.repeat(32) });
    const result = store.list();
    assert.equal(typeof result.then, 'function');
    await result;
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.save({ name: `p${i}`, provider: 'custom', model: 'm', baseURL: 'https://example.com/v1', apiKey: 'k' })
      )
    );
    assert.equal((await store.list()).profiles.length, 20);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test('B4 default setup preserves existing env and writes key file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'key-default-'));
  try {
    const envPath = path.join(root, '.env');
    fs.writeFileSync(envPath, 'OTHER=value\n');
    const keyPath = path.join(root, 'key');
    ensureLLMEncryptionKey({ envPath, keyPath, profilePath: path.join(root, 'p.json'), environment: {} });
    assert.equal(fs.readFileSync(envPath, 'utf8'), 'OTHER=value\n');
    assert.ok(fs.existsSync(keyPath));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B2 async lock respects configured acquisition deadline and preserves owner', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'async-lock-deadline-'));
  const lockPath = path.join(root, 'store.lock');
  try {
    const owner = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
    fs.writeFileSync(lockPath, owner);
    await assert.rejects(
      withFileLock(lockPath, () => assert.fail('must not acquire'), { timeoutMs: 100, retryIntervalMs: 10 }),
      { code: 'STORE_LOCKED' }
    );
    assert.equal(fs.readFileSync(lockPath, 'utf8'), owner);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B3 a failed backup preserves original store and removes temporary file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-required-'));
  try {
    const filePath = path.join(root, 'profiles.json');
    const store = createLLMProfileStore({ filePath, encryptionKey: '22'.repeat(32) });
    const input = { name: 'first', provider: 'custom', model: 'm', baseURL: 'https://example.com/v1', apiKey: 'k' };
    await store.save(input);
    const before = fs.readFileSync(filePath, 'utf8');
    fs.mkdirSync(`${filePath}.bak`);
    await assert.rejects(store.save({ ...input, name: 'second' }));
    assert.equal(fs.readFileSync(filePath, 'utf8'), before);
    assert.deepEqual(
      fs.readdirSync(root).filter(name => name.endsWith('.tmp')),
      []
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
