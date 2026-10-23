import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLLMProfileStore } from '../src/profileStore.js';

test('YH1-B1: getActive called 1000 times reads profiles file from disk only once', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-store-cache-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = '33'.repeat(32);

  try {
    // 1. Setup store and populate active profile
    const setupStore = createLLMProfileStore({ filePath, encryptionKey });
    const saved = setupStore.save({
      name: 'Cached Profile',
      provider: 'custom',
      model: 'test-model',
      baseURL: 'https://api.example.com/v1',
      apiKey: 'secret-key-fixture'
    });
    setupStore.activate(saved.id, saved.revision);

    // 2. Fresh store instance on the same file
    const store = createLLMProfileStore({ filePath, encryptionKey });

    let readFileSyncCount = 0;
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = function (targetPath, ...args) {
      if (typeof targetPath === 'string' && path.resolve(targetPath) === path.resolve(filePath)) {
        readFileSyncCount++;
      }
      return originalReadFileSync.apply(this, [targetPath, ...args]);
    };

    try {
      // 3. Perform 1000 reads
      for (let i = 0; i < 1000; i++) {
        const active = store.getActive();
        assert.equal(active.id, saved.id);
        assert.equal(active.apiKey, 'secret-key-fixture');
      }

      // 4. Verification: exactly 1 file read
      assert.equal(readFileSyncCount, 1, 'fs.readFileSync should be called exactly once across 1000 getActive calls');
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B1: structuredClone protects cache from caller mutations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-store-mutation-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = '44'.repeat(32);

  try {
    const store = createLLMProfileStore({ filePath, encryptionKey });
    const saved = store.save({
      name: 'Original Name',
      provider: 'custom',
      model: 'test-model',
      baseURL: 'https://api.example.com/v1',
      apiKey: 'key'
    });
    store.activate(saved.id, saved.revision);

    // Modify the returned object directly in caller space
    const profile1 = store.getActive();
    profile1.name = 'TAMPERED NAME';
    profile1.lastTests.quick = { status: 'passed' };

    // Read again
    const profile2 = store.getActive();
    assert.equal(profile2.name, 'Original Name');
    assert.deepEqual(profile2.lastTests, {});
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('YH1-B1: cache invalidates when file mtime or size changes on disk', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-store-invalidation-'));
  const filePath = path.join(root, 'profiles.json');
  const encryptionKey = '55'.repeat(32);

  try {
    const store1 = createLLMProfileStore({ filePath, encryptionKey });
    const store2 = createLLMProfileStore({ filePath, encryptionKey });

    const saved = store1.save({
      name: 'Version 1',
      provider: 'custom',
      model: 'model-1',
      baseURL: 'https://api.example.com/v1',
      apiKey: 'key'
    });
    store1.activate(saved.id, saved.revision);

    // store2 reads
    const initial = store2.getActive();
    assert.equal(initial.name, 'Version 1');

    // store1 mutates
    store1.save({
      ...saved,
      name: 'Version 2',
      apiKey: 'key'
    });

    // store2 reads again and should detect the update via stat
    const updated = store2.getActive();
    assert.equal(updated.name, 'Version 2');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
