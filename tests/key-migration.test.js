import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { ensureLLMEncryptionKey } from '../src/setup.js';
import { encrypt, parseEncryptionKey } from '../src/profileStore.js';

test('legacy .env key migrates without changing encrypted profiles and works in a clean process', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-key-migration-'));
  try {
    const key = 'ab'.repeat(32);
    const envPath = path.join(root, '.env');
    const profilePath = path.join(root, 'llm-profiles.json');
    const keyPath = path.join(root, 'llm-encryption.key');
    const envContent = `# preserved\nLLM_CONFIG_ENCRYPTION_KEY="${key}"\nOTHER=value\n`;
    fs.writeFileSync(envPath, envContent);
    const profiles = JSON.stringify({
      version: 1,
      profiles: [
        {
          id: 'legacy',
          name: 'Legacy',
          provider: 'custom',
          model: 'm',
          baseURL: 'https://example.com/v1',
          secret: encrypt('legacy-api-secret', parseEncryptionKey(key))
        }
      ]
    });
    fs.writeFileSync(profilePath, profiles);
    assert.equal(ensureLLMEncryptionKey({ envPath, profilePath, keyPath, environment: {} }), key);
    assert.equal(fs.existsSync(keyPath), true, 'legacy key must persist for future embedded processes');
    assert.equal(fs.readFileSync(keyPath, 'utf8').trim(), key);
    assert.equal(fs.readFileSync(envPath, 'utf8'), envContent);
    assert.equal(fs.readFileSync(profilePath, 'utf8'), profiles);
    const environment = { ...process.env };
    for (const name of ['LLM_CONFIG_ENCRYPTION_KEY', 'LLM_CONFIG_KEY_PATH', 'LLM_CONFIG_PATH'])
      delete environment[name];
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import { createLLMProfileStore } from ${JSON.stringify(new URL('../src/profileStore.js', import.meta.url).href)};
      const store = createLLMProfileStore({ dataDir: ${JSON.stringify(root)} });
      console.log((await store.get('legacy')).apiKey === 'legacy-api-secret' ? 'readable' : 'wrong');
    `
      ],
      { env: environment, cwd: root, encoding: 'utf8' }
    );
    assert.equal(output.trim(), 'readable');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('setup honors explicit environment then existing key file before legacy .env', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-key-priority-'));
  try {
    const envPath = path.join(root, '.env');
    const profilePath = path.join(root, 'profiles.json');
    const keyPath = path.join(root, 'llm-encryption.key');
    const fileKey = 'bc'.repeat(32),
      explicitKey = 'cd'.repeat(32);
    fs.writeFileSync(envPath, `LLM_CONFIG_ENCRYPTION_KEY=${'ab'.repeat(32)}\n`);
    fs.writeFileSync(keyPath, `${fileKey}\n`);
    assert.equal(
      ensureLLMEncryptionKey({
        envPath,
        profilePath,
        keyPath,
        environment: { LLM_CONFIG_ENCRYPTION_KEY: explicitKey }
      }),
      explicitKey
    );
    assert.equal(fs.readFileSync(keyPath, 'utf8'), `${fileKey}\n`);
    assert.equal(ensureLLMEncryptionKey({ envPath, profilePath, keyPath, environment: {} }), fileKey);
    assert.equal(fs.readFileSync(keyPath, 'utf8'), `${fileKey}\n`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('migration preserves a key created by an independent writer at exclusive creation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-key-race-'));
  const originalWrite = fs.writeFileSync;
  try {
    const envPath = path.join(root, '.env');
    const profilePath = path.join(root, 'profiles.json');
    const keyPath = path.join(root, 'llm-encryption.key');
    const winner = 'de'.repeat(32);
    fs.writeFileSync(envPath, `LLM_CONFIG_ENCRYPTION_KEY=${'ab'.repeat(32)}\n`);
    // Inject only the independent writer's timing; all key reads/writes remain real.
    fs.writeFileSync = function (target, content, options) {
      if (target === keyPath) {
        assert.equal(fs.existsSync(`${profilePath}.lock`), true);
        originalWrite.call(this, keyPath, `${winner}\n`, { flag: 'wx' });
      }
      return originalWrite.call(this, target, content, options);
    };
    const environment = {};
    assert.equal(ensureLLMEncryptionKey({ envPath, profilePath, keyPath, environment }), winner);
    assert.equal(environment.LLM_CONFIG_ENCRYPTION_KEY, winner);
    assert.equal(fs.readFileSync(keyPath, 'utf8'), `${winner}\n`);
    assert.equal(fs.existsSync(`${profilePath}.lock`), false);
  } finally {
    fs.writeFileSync = originalWrite;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('existing key files resolve without requiring writes to the profile filesystem', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-key-readonly-'));
  const originalOpen = fs.openSync;
  try {
    const keyPath = path.join(root, 'llm-encryption.key');
    const key = 'ef'.repeat(32);
    fs.writeFileSync(keyPath, `${key}\n`);
    fs.openSync = function (target, flags, ...args) {
      if (flags === 'wx') {
        const error = new Error('read-only filesystem');
        error.code = 'EROFS';
        throw error;
      }
      return originalOpen.call(this, target, flags, ...args);
    };
    assert.equal(
      ensureLLMEncryptionKey({
        envPath: path.join(root, '.env'),
        profilePath: path.join(root, 'absent', 'profiles.json'),
        keyPath,
        environment: {}
      }),
      key
    );
    assert.equal(fs.existsSync(path.join(root, 'absent')), false);
  } finally {
    fs.openSync = originalOpen;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
