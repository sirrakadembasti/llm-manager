import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createChangeJournal, initLLMProject, runInteractiveInit } from '../src/init.js';

// Includes empty directories, raw bytes and the modes supported by the host OS.
function snapshot(root) {
  return fs
    .readdirSync(root, { recursive: true })
    .sort()
    .map(relative => {
      const full = path.join(root, relative);
      const stat = fs.lstatSync(full);
      return {
        path: relative,
        kind: stat.isDirectory() ? 'directory' : 'file',
        mode: stat.mode,
        hash: stat.isFile() ? createHash('sha256').update(fs.readFileSync(full)).digest('hex') : null
      };
    });
}

test('forced nested scaffold and repeated env updates restore the original snapshot', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-scaffold-'));
  try {
    fs.writeFileSync(path.join(cwd, 'package.json'), '{"type":"module"}\r\n');
    fs.writeFileSync(path.join(cwd, '.env'), '# original\r\nLLM_ALLOWED_ORIGINS=old\r\n');
    fs.writeFileSync(path.join(cwd, '.env.local'), '# local\r\nVITE_LLM_CHAT_TOKEN=original\r\n');
    fs.mkdirSync(path.join(cwd, 'app/actions'), { recursive: true });
    fs.writeFileSync(path.join(cwd, 'app/actions/llm.js'), Buffer.from([255, 0, 13, 10]));
    fs.mkdirSync(path.join(cwd, 'app/keep-empty'));
    const before = snapshot(cwd);
    const journal = createChangeJournal(cwd);
    initLLMProject({ cwd, type: 'nextjs', force: true, journal });
    initLLMProject({ cwd, type: 'spa', force: true, allowedOrigins: 'http://localhost:3000', journal });
    assert.notDeepEqual(snapshot(cwd), before);
    assert.notEqual(
      fs.readFileSync(path.join(cwd, '.env.local'), 'utf8'),
      '# local\r\nVITE_LLM_CHAT_TOKEN=original\r\n'
    );
    journal.rollback();
    assert.deepEqual(snapshot(cwd), before);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

test('journal restores first captured bytes and modes after repeated writes and removes only new directories', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-bytes-'));
  try {
    fs.mkdirSync(path.join(cwd, 'existing/empty'), { recursive: true });
    const original = path.join(cwd, 'existing/raw.bin');
    fs.writeFileSync(original, Buffer.from([0, 255, 254, 13, 10, 128]));
    fs.chmodSync(original, 0o644);
    const before = snapshot(cwd);
    const journal = createChangeJournal(cwd);
    journal.write(original, 'first replacement');
    journal.write(original, 'second replacement');
    fs.chmodSync(original, 0o666);
    journal.write(path.join(cwd, 'existing/new/deep/generated.txt'), 'new');
    journal.write(path.join(cwd, 'new/deep/generated.bin'), Buffer.from([255, 0]));
    assert.notDeepEqual(snapshot(cwd), before);
    journal.rollback();
    assert.deepEqual(snapshot(cwd), before);
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
});

for (const scenario of ['refusal', 'interactive verification failure', 'automatic verification failure']) {
  test(`wizard ${scenario} restores the exact post-prerequisite tree, hashes and modes`, async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-wizard-'));
    try {
      // Pre-existing host installation is outside the scaffold transaction.
      const installed = path.join(cwd, 'node_modules/@sirrakadembasti/llm-manager');
      fs.mkdirSync(installed, { recursive: true });
      fs.writeFileSync(path.join(installed, 'package.json'), '{"name":"@sirrakadembasti/llm-manager"}\r\n');
      fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"lockfileVersion":3}\r\n');
      fs.writeFileSync(path.join(cwd, 'package.json'), '{"type":"module","dependencies":{"express":"*"}}\r\n');
      fs.writeFileSync(
        path.join(cwd, 'server.js'),
        "import express from 'express';\r\nconst app = express();\r\napp.listen(3000);\r\n"
      );
      // Invalid helper guarantees verification failure, independent of installed compilers.
      fs.writeFileSync(path.join(cwd, 'llm.js'), 'export const broken = ;\r\n');
      fs.writeFileSync(path.join(cwd, '.env'), '# keep CRLF\r\nEXISTING=value\r\n');
      fs.writeFileSync(path.join(cwd, '.gitignore'), '# keep me\r\ncustom/\r\n');
      fs.mkdirSync(path.join(cwd, 'untouched/empty'), { recursive: true });
      fs.writeFileSync(path.join(cwd, 'untouched/raw.bin'), Buffer.from([0, 255, 13, 10]));
      const before = snapshot(cwd);
      const prompts = [];
      const result = await runInteractiveInit({
        cwd,
        type: 'express',
        yes: scenario === 'automatic verification failure',
        openBrowser: false,
        logger: () => {},
        askQuestion(prompt) {
          prompts.push(prompt);
          if (prompt.includes('iç doğrulama adımına')) {
            assert.notDeepEqual(snapshot(cwd), before);
            return scenario === 'refusal' ? 'h' : 'e';
          }
          return 'e';
        }
      });
      assert.equal(result.rolledBack, true);
      assert.equal(result.step, scenario === 'refusal' ? 'inject' : 'verify');
      if (scenario !== 'refusal') {
        assert.equal(result.ok, false);
        assert.equal(result.verification.ok, false);
      }
      if (scenario === 'interactive verification failure')
        assert.ok(prompts.some(prompt => prompt.includes('Değişiklikler geri alınsın mı?')));
      if (scenario === 'automatic verification failure') assert.deepEqual(prompts, []);
      assert.deepEqual(snapshot(cwd), before);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
}
