import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { readEnv, upsertEnv } from '../src/envFile.js';

test('environment credentials round trip through the Node dotenv parser', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-roundtrip-'));
  const file = path.join(dir, '.env');
  try {
    for (const password of ['a"b', String.raw`a\b`, "a'b#c", ' leading space ', 'a`b"c', '']) {
      fs.writeFileSync(file, '# preserved\r\nLLM_ADMIN_PASSWORD=old\r\nLLM_ADMIN_PASSWORD=duplicate\r\n');
      upsertEnv(file, { LLM_ADMIN_PASSWORD: password });
      const content = fs.readFileSync(file, 'utf8');
      assert.equal(parseEnv(content).LLM_ADMIN_PASSWORD, password);
      assert.equal(readEnv(file).LLM_ADMIN_PASSWORD, password);
      assert.ok(content.startsWith('# preserved\r\n'));
    }
    assert.throws(() => upsertEnv(file, { LLM_ADMIN_PASSWORD: '#\'"`' }), /ortam/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
