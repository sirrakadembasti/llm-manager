import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const workflowDir = join(root, '.github', 'workflows');
const workflows = readdirSync(workflowDir)
  .filter(name => /\.ya?ml$/.test(name))
  .map(name => ({ name, text: readFileSync(join(workflowDir, name), 'utf8') }));

test('every workflow action is pinned to a full commit SHA with a version comment', () => {
  assert.ok(workflows.length > 0);
  for (const { name, text } of workflows) {
    const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(.+)$/gm)].map(match => match[1].trim());
    assert.ok(uses.length > 0, `${name} içinde eylem yok`);
    for (const ref of uses) {
      if (ref.startsWith('./')) continue;
      assert.match(ref, /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d+(?:\.\d+){0,2}$/, `${name}: ${ref} sabitlenmemiş`);
    }
  }
});

test('workflows grant read-only repository permissions by default', () => {
  for (const { name, text } of workflows) {
    assert.match(text, /^permissions:\s*\n\s+contents:\s*read\s*$/m, `${name} izinleri daraltılmamış`);
    assert.doesNotMatch(text, /:\s*write\b/, `${name} yazma izni istiyor`);
  }
});

test('checkout steps do not persist the repository token', () => {
  for (const { name, text } of workflows) {
    const checkouts = text.split(/\n(?=\s*- )/).filter(step => /uses:\s*actions\/checkout@/.test(step));
    for (const step of checkouts) {
      assert.match(step, /persist-credentials:\s*false/, `${name} checkout kimlik bilgisini saklıyor`);
    }
  }
});

test('CI verifies registry signatures of installed dependencies', () => {
  const ci = workflows.find(workflow => workflow.name === 'ci.yml');
  assert.ok(ci);
  assert.match(ci.text, /run:\s*npm audit signatures\b/);
});

test('lockfile resolves every package from the public npm registry with sha512 integrity', () => {
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
  assert.ok(lock.lockfileVersion >= 3);
  const entries = Object.entries(lock.packages).filter(([path, info]) => path && !info.link);
  assert.ok(entries.length > 0);
  for (const [path, info] of entries) {
    assert.ok(info.resolved?.startsWith('https://registry.npmjs.org/'), `${path} kaynağı: ${info.resolved}`);
    assert.match(info.integrity ?? '', /^sha512-/, `${path} bütünlük özeti yok`);
  }
});

test('dependabot keeps pinned actions and npm dependencies up to date', () => {
  const file = join(root, '.github', 'dependabot.yml');
  assert.ok(existsSync(file), 'dependabot.yml yok');
  const text = readFileSync(file, 'utf8');
  assert.match(text, /package-ecosystem:\s*["']?github-actions/);
  assert.match(text, /package-ecosystem:\s*["']?npm/);
});
