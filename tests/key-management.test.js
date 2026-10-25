import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureLLMEncryptionKey, rotateEncryptionKey, exportProfiles, importProfiles } from '../src/setup.js';
import { createLLMProfileStore, parseEncryptionKey, encrypt, decrypt } from '../src/profileStore.js';

const cliPath = fileURLToPath(new URL('../bin/llm-manager.js', import.meta.url));

test('rotateEncryptionKey re-encrypts all profile secrets and backs up old key', async () => {
  const origKey = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-key-rot-'));
  try {
    const keyPath = path.join(tmpDir, 'llm-encryption.key');
    const profilePath = path.join(tmpDir, 'llm-profiles.json');

    const key1 = ensureLLMEncryptionKey({
      keyPath,
      profilePath,
      envPath: path.join(tmpDir, '.env'),
      environment: {},
      writeEnv: false
    });
    const key1Bytes = parseEncryptionKey(key1);

    const secret1 = encrypt('my-secret-api-key-1', key1Bytes);
    const initialProfiles = {
      version: 1,
      activeId: 'p1',
      profiles: [
        {
          id: 'p1',
          name: 'Profile 1',
          provider: 'openai',
          model: 'gpt-4o',
          baseURL: 'https://api.openai.com/v1',
          secret: secret1,
          revision: 'rev-1'
        }
      ]
    };
    fs.writeFileSync(profilePath, JSON.stringify(initialProfiles, null, 2), 'utf8');

    // Perform rotation
    const rotResult = rotateEncryptionKey({
      dataDir: tmpDir,
      filePath: profilePath,
      keyPath,
      oldKey: key1
    });

    assert.equal(rotResult.ok, true);
    assert.equal(rotResult.count, 1);
    assert.notEqual(rotResult.newKey, key1);
    assert.ok(rotResult.backupKeyPath && fs.existsSync(rotResult.backupKeyPath));
    assert.equal(fs.readFileSync(rotResult.backupKeyPath, 'utf8').trim(), key1);

    // Verify current key in file is new key
    const currentKey = fs.readFileSync(keyPath, 'utf8').trim();
    assert.equal(currentKey, rotResult.newKey);

    // Verify profile secret can be decrypted with new key and fails with old key
    const updatedProfiles = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const updatedSecret = updatedProfiles.profiles[0].secret;
    assert.notEqual(updatedSecret, secret1);

    const newKeyBytes = parseEncryptionKey(rotResult.newKey);
    const decryptedWithNew = decrypt(updatedSecret, newKeyBytes);
    assert.equal(decryptedWithNew, 'my-secret-api-key-1');

    assert.throws(() => {
      decrypt(updatedSecret, key1Bytes);
    });
  } finally {
    if (origKey !== undefined) process.env.LLM_CONFIG_ENCRYPTION_KEY = origKey;
    else delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('exportProfiles and importProfiles export encrypted backup and restore across machines', async () => {
  const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-export-'));
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-import-'));
  try {
    const store1 = createLLMProfileStore({ dataDir: dir1 });
    await store1.save({
      name: 'Prod AI',
      provider: 'anthropic',
      model: 'claude-3-7-sonnet',
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: 'sk-ant-test-secret-123'
    });

    const backupFile = path.join(dir1, 'backup.json');
    const password = 'CorrectPassword-456!';

    // 1. Export
    const expResult = exportProfiles({
      dataDir: dir1,
      outputPath: backupFile,
      password
    });
    assert.equal(expResult.ok, true);
    assert.equal(expResult.profileCount, 1);

    const backupContent = fs.readFileSync(backupFile, 'utf8');
    assert.ok(!backupContent.includes('sk-ant-test-secret-123'), 'Plaintext API key must never appear in backup file');
    const parsedBackup = JSON.parse(backupContent);
    assert.equal(parsedBackup.format, 'llm-manager-backup');
    assert.ok(parsedBackup.salt && parsedBackup.iv && parsedBackup.tag && parsedBackup.data);

    // 2. Import into dir2 with wrong password fails
    assert.throws(
      () =>
        importProfiles({
          dataDir: dir2,
          inputPath: backupFile,
          password: 'WrongPassword!'
        }),
      /Yedek parolası hatalı veya dosya bütünlüğü bozulmuş/
    );

    // 3. Import with correct password into dir2 succeeds
    const impResult = importProfiles({
      dataDir: dir2,
      inputPath: backupFile,
      password
    });
    assert.equal(impResult.ok, true);
    assert.equal(impResult.importedCount, 1);

    // 4. Verify restored profiles in store2
    const store2 = createLLMProfileStore({ dataDir: dir2 });
    const list = await store2.list();
    assert.equal(list.profiles.length, 1);
    assert.equal(list.profiles[0].name, 'Prod AI');
    assert.equal(list.profiles[0].hasApiKey, true);

    const internalProfile = await store2.get(list.profiles[0].id);
    assert.equal(internalProfile.apiKey, 'sk-ant-test-secret-123');
  } finally {
    fs.rmSync(dir1, { recursive: true, force: true });
    fs.rmSync(dir2, { recursive: true, force: true });
  }
});

test('CLI key rotate, export, and import commands execute successfully', async () => {
  const origKey = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cli-key-'));
  try {
    const store = createLLMProfileStore({ dataDir: tmpDir });
    await store.save({
      name: 'CLI Model',
      provider: 'openai',
      model: 'gpt-4o',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-cli-test-key-999'
    });

    const keyPath = path.join(tmpDir, 'llm-encryption.key');
    const oldKey = fs.readFileSync(keyPath, 'utf8').trim();

    // 1. CLI key rotate
    const rotateOut = execFileSync(process.execPath, [cliPath, 'key', 'rotate', '--data-dir', tmpDir], {
      cwd: tmpDir,
      encoding: 'utf8'
    });
    assert.match(rotateOut, /Şifreleme anahtarı başarıyla döndürüldü/);
    const newKey = fs.readFileSync(keyPath, 'utf8').trim();
    assert.notEqual(newKey, oldKey);

    // 2. CLI export
    const backupPath = path.join(tmpDir, 'backup.enc.json');
    const exportOut = execFileSync(
      process.execPath,
      [cliPath, 'export', '--out', backupPath, '--password', 'MySecretPass99', '--data-dir', tmpDir],
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert.match(exportOut, /profil başarıyla şifreli olarak dışa aktarıldı/);
    assert.ok(fs.existsSync(backupPath));

    // 3. CLI import into new directory
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-cli-key-target-'));
    try {
      const importOut = execFileSync(
        process.execPath,
        [cliPath, 'import', backupPath, '--password', 'MySecretPass99', '--data-dir', tmpDir2],
        { cwd: tmpDir2, encoding: 'utf8' }
      );
      assert.match(importOut, /profil başarıyla içe aktarıldı/);

      const store2 = createLLMProfileStore({ dataDir: tmpDir2 });
      const list = await store2.list();
      assert.equal(list.profiles.length, 1);
      assert.equal(list.profiles[0].name, 'CLI Model');
      assert.equal((await store2.get(list.profiles[0].id)).apiKey, 'sk-cli-test-key-999');
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  } finally {
    if (origKey !== undefined) process.env.LLM_CONFIG_ENCRYPTION_KEY = origKey;
    else delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('rotation rolls profile bytes back when key replacement fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'key-rollback-'));
  const originalRename = fs.renameSync;
  const previous = process.env.LLM_CONFIG_ENCRYPTION_KEY;
  delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
  try {
    const store = createLLMProfileStore({ dataDir: root });
    const saved = await store.save({
      name: 'p',
      provider: 'custom',
      model: 'm',
      baseURL: 'https://example.com/v1',
      apiKey: 'secret'
    });
    const file = path.join(root, 'llm-profiles.json'),
      key = path.join(root, 'llm-encryption.key');
    const before = fs.readFileSync(file, 'utf8'),
      beforeKey = fs.readFileSync(key, 'utf8');
    fs.renameSync = function (source, target) {
      if (target === key) {
        const error = new Error('key commit failed');
        error.code = 'EIO';
        throw error;
      }
      return originalRename.call(this, source, target);
    };
    assert.throws(() => rotateEncryptionKey({ dataDir: root }), /key commit failed/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
    assert.equal(fs.readFileSync(key, 'utf8'), beforeKey);
    assert.equal((await store.get(saved.id)).apiKey, 'secret');
  } finally {
    fs.renameSync = originalRename;
    if (previous === undefined) delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    else process.env.LLM_CONFIG_ENCRYPTION_KEY = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('B4 setup operations honor environment profile and key paths over dataDir', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'environment-key-paths-'));
  const names = ['LLM_CONFIG_PATH', 'LLM_CONFIG_KEY_PATH', 'LLM_CONFIG_ENCRYPTION_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    const defaultDir = path.join(root, 'default'),
      liveDir = path.join(root, 'live');
    fs.mkdirSync(defaultDir);
    fs.mkdirSync(liveDir);
    const unrelated = path.join(defaultDir, 'llm-profiles.json');
    const unrelatedKey = path.join(defaultDir, 'llm-encryption.key');
    const untouched = JSON.stringify({ version: 1, profiles: [], activeId: null });
    fs.writeFileSync(unrelated, untouched);
    fs.writeFileSync(unrelatedKey, 'unrelated-key');
    process.env.LLM_CONFIG_PATH = path.join(liveDir, 'custom-profiles.json');
    process.env.LLM_CONFIG_KEY_PATH = path.join(liveDir, 'custom-key');
    delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    const saved = await createLLMProfileStore().save({
      name: 'live',
      provider: 'custom',
      model: 'm',
      baseURL: 'https://example.com/v1',
      apiKey: 'live-secret'
    });
    const rotated = rotateEncryptionKey({ dataDir: defaultDir });
    assert.equal(rotated.count, 1);
    assert.equal((await createLLMProfileStore().get(saved.id)).apiKey, 'live-secret');
    const outputPath = path.join(root, 'backup.json');
    assert.equal(exportProfiles({ dataDir: defaultDir, password: 'backup-password', outputPath }).profileCount, 1);
    process.env.LLM_CONFIG_PATH = path.join(liveDir, 'restored.json');
    process.env.LLM_CONFIG_KEY_PATH = path.join(liveDir, 'restored.key');
    delete process.env.LLM_CONFIG_ENCRYPTION_KEY;
    assert.equal(
      importProfiles({ dataDir: defaultDir, password: 'backup-password', inputPath: outputPath }).importedCount,
      1
    );
    assert.equal((await createLLMProfileStore().get(saved.id)).apiKey, 'live-secret');
    assert.equal(fs.readFileSync(unrelated, 'utf8'), untouched);
    assert.equal(fs.readFileSync(unrelatedKey, 'utf8'), 'unrelated-key');
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});
