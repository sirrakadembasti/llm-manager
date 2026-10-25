import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withFileLock, withFileLockSync } from '../src/store/fileLock.js';

function fixture(t, platform = 'win32') {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { ...descriptor, value: platform });
  t.after(() => Object.defineProperty(process, 'platform', descriptor));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lock-access-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { lockPath: path.join(root, 'profiles.json.lock'), dataPath: path.join(root, 'data.txt') };
}

for (const [mode, acquire, boundary, method] of [
  ['async', withFileLock, fs.promises, 'open'],
  ['sync', withFileLockSync, fs, 'openSync']
]) {
  for (const code of ['EPERM', 'EACCES']) {
    test(`Windows ${mode} exclusive open retries transient ${code} before real protected mutation`, async t => {
      const { lockPath, dataPath } = fixture(t);
      const original = boundary[method];
      let attempts = 0;
      t.mock.method(boundary, method, function (...args) {
        if (args[0] === lockPath) {
          assert.equal(args[1], 'wx');
          if (++attempts <= 2) throw Object.assign(new Error('Geçici erişim hatası.'), { code });
        }
        return Reflect.apply(original, this, args);
      });
      const result = await acquire(lockPath, () => {
        assert.equal(JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid, process.pid);
        fs.writeFileSync(dataPath, 'protected mutation');
        return 'completed';
      });
      assert.equal(result, 'completed');
      assert.equal(fs.readFileSync(dataPath, 'utf8'), 'protected mutation');
      assert.equal(attempts, 3);
      assert.equal(fs.existsSync(lockPath), false);
    });

    test(`Windows ${mode} persistent ${code} preserves first error and another owner's lock`, async t => {
      const { lockPath, dataPath } = fixture(t);
      const owner = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
      fs.writeFileSync(lockPath, owner);
      const first = Object.assign(new Error('İlk erişim hatası.'), { code });
      let attempts = 0;
      t.mock.method(boundary, method, () => {
        attempts++;
        throw attempts === 1 ? first : Object.assign(new Error('Sonraki erişim hatası.'), { code });
      });
      await assert.rejects(
        async () => acquire(lockPath, () => fs.writeFileSync(dataPath, 'must not run')),
        error => error === first
      );
      assert.ok(attempts > 1 && attempts <= 5, 'Access retries must be short and bounded');
      assert.equal(fs.readFileSync(lockPath, 'utf8'), owner);
      assert.equal(fs.existsSync(dataPath), false);
    });
  }

  test(`Windows ${mode} access retry obeys the acquisition deadline`, async t => {
    const { lockPath } = fixture(t);
    const error = Object.assign(new Error('Erişim reddedildi.'), { code: 'EPERM' });
    let attempts = 0;
    t.mock.method(boundary, method, () => {
      attempts++;
      throw error;
    });
    await assert.rejects(
      async () => acquire(lockPath, () => assert.fail('No ownership'), { timeoutMs: 0 }),
      value => value === error
    );
    assert.equal(attempts, 1);
  });

  test(`${mode} exclusive open does not retry access errors outside Windows`, async t => {
    const { lockPath } = fixture(t, 'linux');
    const error = Object.assign(new Error('Erişim reddedildi.'), { code: 'EACCES' });
    let attempts = 0;
    t.mock.method(boundary, method, () => {
      attempts++;
      throw error;
    });
    await assert.rejects(
      async () => acquire(lockPath, () => assert.fail('No ownership')),
      value => value === error
    );
    assert.equal(attempts, 1);
  });

  test(`Windows ${mode} deadline expiring during backoff preserves the access error and owner`, async t => {
    const { lockPath } = fixture(t);
    const owner = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
    fs.writeFileSync(lockPath, owner);
    const error = Object.assign(new Error('Erişim reddedildi.'), { code: 'EPERM' });
    let attempts = 0;
    let clockCalls = 0;
    t.mock.method(Date, 'now', () => (++clockCalls < 3 ? 0 : 1000));
    t.mock.method(boundary, method, () => {
      attempts++;
      throw error;
    });
    await assert.rejects(
      async () => acquire(lockPath, () => assert.fail('No ownership'), { timeoutMs: 100 }),
      value => value === error
    );
    assert.equal(attempts, 1);
    assert.equal(fs.readFileSync(lockPath, 'utf8'), owner);
  });

  test(`Windows ${mode} exclusive open does not retry unrelated filesystem errors`, async t => {
    const { lockPath } = fixture(t);
    const error = Object.assign(new Error('Girdi/çıktı hatası.'), { code: 'EIO' });
    let attempts = 0;
    t.mock.method(boundary, method, () => {
      attempts++;
      throw error;
    });
    await assert.rejects(
      async () => acquire(lockPath, () => assert.fail('No ownership')),
      value => value === error
    );
    assert.equal(attempts, 1);
  });
}
