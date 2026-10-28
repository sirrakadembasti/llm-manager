import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectFiles } from '../src/project/files.js';
const { createProjectChanges } = await import('../src/project/changes.js').catch(() => ({}));

test('BOM source bytes survive approved apply and reversal', async t => {
  const { root, reader, changes } = await fixture(t);
  const original = '\ufeffclass A {}\r\n';
  await fs.writeFile(path.join(root, 'app.js'), original);
  const before = (await reader.scan()).files;
  const proposal = await changes.prepare(before, [{ ...before[0], content: before[0].content.replace('A', 'B') }]);
  const applied = await changes.apply(proposal.id, { approved: true, revision: proposal.revision });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), original.replace('A', 'B'));
  await changes.revert(proposal.id, { approved: true, revision: applied.revision });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), original);
});

test('partial write failure restores already written sources', async t => {
  const { root, before, changes } = await fixture(t);
  const proposal = await changes.prepare(before, [
    { ...before[0], content: 'export const total = 120;\n' },
    { path: 'new.js', content: 'export const newValue = 1;' }
  ]);
  const rename = fs.rename.bind(fs);
  let calls = 0;
  t.mock.method(fs, 'rename', async (...args) => {
    if (++calls === 2) throw Object.assign(new Error('synthetic disk failure'), { code: 'EIO' });
    return rename(...args);
  });
  await assert.rejects(changes.apply(proposal.id, { approved: true, revision: proposal.revision }));
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), before[0].content);
  await assert.rejects(fs.access(path.join(root, 'new.js')));
});

async function fixture(t) {
  assert.equal(typeof createProjectChanges, 'function');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-changes-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'app.js'), 'export const total = 100;\n// user existing change\n');
  const reader = createProjectFiles({ root });
  const before = (await reader.scan()).files;
  const changes = createProjectChanges({ reader });
  return { root, reader, before, changes };
}

test('project changes require explicit approval and support create, update, delete and exact reversal', async t => {
  const { root, before, changes } = await fixture(t);
  const after = [
    { ...before[0], content: before[0].content.replace('100', '120') },
    { path: 'src/new.js', content: 'export const added = true;\n' }
  ];
  const proposal = await changes.prepare(before, after);
  assert.equal(proposal.state, 'proposed');
  assert.equal(proposal.files.length, 2);
  await assert.rejects(changes.apply(proposal.id, { revision: proposal.revision }), {
    code: 'PROJECT_APPROVAL_REQUIRED'
  });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), before[0].content);
  const applied = await changes.apply(proposal.id, { revision: proposal.revision, approved: true });
  assert.equal(applied.state, 'applied');
  assert.match(await fs.readFile(path.join(root, 'app.js'), 'utf8'), /total = 120/);
  assert.match(await fs.readFile(path.join(root, 'app.js'), 'utf8'), /user existing change/);
  const reverted = await changes.revert(proposal.id, { revision: applied.revision, approved: true });
  assert.equal(reverted.state, 'reverted');
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), before[0].content);
  await assert.rejects(fs.access(path.join(root, 'src/new.js')));
  const deletion = await changes.prepare(before, []);
  const deleted = await changes.apply(deletion.id, { revision: deletion.revision, approved: true });
  await assert.rejects(fs.access(path.join(root, 'app.js')));
  await changes.revert(deletion.id, { revision: deleted.revision, approved: true });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), before[0].content);
});

test('project apply refuses a stale proposal and does not touch any file on conflict', async t => {
  const { root, before, changes } = await fixture(t);
  const proposal = await changes.prepare(before, [
    { ...before[0], content: 'export const total = 120;\n' },
    { path: 'new.js', content: 'export const added = true;' }
  ]);
  const userEdit = before[0].content + '// new user change\n';
  await fs.writeFile(path.join(root, 'app.js'), userEdit);
  await assert.rejects(changes.apply(proposal.id, { revision: proposal.revision, approved: true }), {
    code: 'PROJECT_CONFLICT'
  });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), userEdit);
  await assert.rejects(fs.access(path.join(root, 'new.js')));
});

test('project reversal refuses edits made after assistant apply instead of losing them', async t => {
  const { root, before, changes } = await fixture(t);
  const proposal = await changes.prepare(before, [{ ...before[0], content: before[0].content.replace('100', '120') }]);
  const applied = await changes.apply(proposal.id, { revision: proposal.revision, approved: true });
  const concurrent = (await fs.readFile(path.join(root, 'app.js'), 'utf8')) + '// later user change\n';
  await fs.writeFile(path.join(root, 'app.js'), concurrent);
  await assert.rejects(changes.revert(proposal.id, { revision: applied.revision, approved: true }), {
    code: 'PROJECT_CONFLICT'
  });
  assert.equal(await fs.readFile(path.join(root, 'app.js'), 'utf8'), concurrent);
});

test('project proposals reject secrets, outside paths and stale approval revisions', async t => {
  const { before, changes } = await fixture(t);
  await assert.rejects(changes.prepare(before, [{ path: '../escape.js', content: 'export const x=1;' }]), {
    code: 'PROJECT_PATH_DENIED'
  });
  await assert.rejects(changes.prepare(before, [{ path: '.env', content: 'PRIVATE=hidden' }]), {
    code: 'PROJECT_PATH_DENIED'
  });
  await assert.rejects(
    changes.prepare(before, [{ ...before[0], content: "const apiKey='sk-this-is-a-synthetic-test-secret';" }]),
    { code: 'PROJECT_SECRET_DETECTED' }
  );
  const proposal = await changes.prepare(before, [{ ...before[0], content: before[0].content.replace('100', '120') }]);
  await assert.rejects(changes.apply(proposal.id, { revision: 'stale', approved: true }), { code: 'PROJECT_CONFLICT' });
});

test('project apply refuses a directory changed to a junction after review', async t => {
  const { root, before, changes } = await fixture(t);
  await fs.mkdir(path.join(root, 'target'));
  const proposal = await changes.prepare(before, [...before, { path: 'target/new.js', content: 'export const x=1;' }]);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.rmdir(path.join(root, 'target'));
  await fs.symlink(outside, path.join(root, 'target'), 'junction');
  await assert.rejects(changes.apply(proposal.id, { revision: proposal.revision, approved: true }), {
    code: 'PROJECT_PATH_DENIED'
  });
  await assert.rejects(fs.access(path.join(outside, 'new.js')));
});
