import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const { createProjectFiles } = await import('../src/project/files.js').catch(() => ({}));
const exec = promisify(execFile);

test('ignore character classes and zero-directory globstars exclude tracked and fallback sources', async t => {
  const { root, write } = await fixture(t);
  await write('private.json', '{}');
  await write('nested/private.json', '{}');
  await write('.gitignore', '[p]rivate.json\n**/private.json\n');
  const reader = createProjectFiles({ root });
  assert.deepEqual((await reader.scan()).files, []);
  await assert.rejects(reader.read('private.json'), { code: 'PROJECT_PATH_DENIED' });
  await exec('git', ['init', '--quiet'], { cwd: root });
  await exec('git', ['add', '--force', 'private.json'], { cwd: root });
  assert.deepEqual((await reader.scan()).files, []);
  await assert.rejects(reader.read('private.json'), { code: 'PROJECT_PATH_DENIED' });
});

async function fixture(t) {
  assert.equal(typeof createProjectFiles, 'function', 'safe project reader must be implemented');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llm-project-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (name, content) => {
    const target = path.join(root, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  return { root, write };
}

test('project scanner excludes credentials, profile data, generated code and binary content', async t => {
  const { root, write } = await fixture(t);
  await write('src/app.js', 'export const version = 1;\n');
  await write('README.md', '# Application\n');
  for (const name of ['.env', '.env.local', 'private.key', 'data/profiles.json', 'node_modules/a.js', 'dist/a.js']) {
    await write(name, 'private content');
  }
  await write('src/config.js', "const apiKey = 'sk-this-is-a-synthetic-test-secret';\n");
  await write('src/binary.js', Buffer.from([0, 1, 2, 3]));
  const files = createProjectFiles({ root });
  const scan = await files.scan();
  assert.deepEqual(scan.files.map(f => f.path).sort(), ['README.md', 'src/app.js']);
  assert.equal(scan.partial, false);
  assert.ok(scan.excluded >= 1);
  assert.match((await files.read('src/app.js')).content, /version = 1/);
  await assert.rejects(files.read('.env'), { code: 'PROJECT_PATH_DENIED' });
  await assert.rejects(files.read('src/config.js'), { code: 'PROJECT_SECRET_DETECTED' });
});

test('project reader rejects traversal and cross-platform absolute paths', async t => {
  const { root, write } = await fixture(t);
  await write('src/app.js', 'export const value = 1;');
  const files = createProjectFiles({ root });
  for (const name of [
    '../outside.js',
    'src/../../outside.js',
    'C:\\Windows\\a.js',
    '/etc/passwd',
    '\\\\host\\a.js',
    'a\0.js',
    'data./a.js',
    'data /a.js'
  ]) {
    await assert.rejects(files.read(name), { code: 'PROJECT_PATH_DENIED' });
  }
});

test('source bin directories remain visible while SQL connection passwords are excluded', async t => {
  const { root, write } = await fixture(t);
  await write('bin/app.js', 'export const cli = true;');
  await write(
    'appsettings.json',
    '{"ConnectionStrings":{"Default":"Server=localhost;Password=synthetic-private-value;"}}'
  );
  assert.deepEqual(
    (await createProjectFiles({ root }).scan()).files.map(f => f.path),
    ['bin/app.js']
  );
});

test('project reader rejects junctions into another directory', async t => {
  const { root, write } = await fixture(t);
  await write('external/a.js', 'export const privateValue = true;');
  await fs.mkdir(path.join(root, 'project'));
  await fs.symlink(path.join(root, 'external'), path.join(root, 'project', 'linked'), 'junction');
  const files = createProjectFiles({ root: path.join(root, 'project') });
  assert.deepEqual((await files.scan()).files, []);
  await assert.rejects(files.read('linked/a.js'), { code: 'PROJECT_PATH_DENIED' });
});

test('project scanner respects Git ignores and always blocks tracked secret files', async t => {
  const { root, write } = await fixture(t);
  await write('.gitignore', 'private-src/\n');
  await write('private-src/hidden.js', 'export const hidden = true;');
  await write('src/app.js', 'export const visible = true;');
  await write('.env', 'SYNTHETIC_TOKEN=hidden');
  await exec('git', ['init', '--quiet'], { cwd: root });
  await exec('git', ['add', '-f', '.env'], { cwd: root });
  const scan = await createProjectFiles({ root }).scan();
  assert.deepEqual(
    scan.files.map(f => f.path),
    ['src/app.js']
  );
  await assert.rejects(createProjectFiles({ root }).read('private-src/hidden.js'), { code: 'PROJECT_PATH_DENIED' });
});

test('project scanner honors root ignore rules in a project without Git metadata', async t => {
  const { root, write } = await fixture(t);
  await write('.gitignore', 'private-src/\n*.local.js\n');
  await write('private-src/hidden.js', 'export const hidden = true;');
  await write('settings.local.js', 'export const hidden = true;');
  await write('src/app.js', 'export const visible = true;');
  assert.deepEqual(
    (await createProjectFiles({ root }).scan()).files.map(f => f.path),
    ['src/app.js']
  );
});

test('project inventory refreshes modified and deleted files and discloses scan limits', async t => {
  const { root, write } = await fixture(t);
  await write('a.js', 'export const a = 1;');
  await write('b.js', 'export const b = 1;');
  const files = createProjectFiles({ root });
  const first = await files.scan();
  await write('a.js', 'export const a = 2;');
  await fs.unlink(path.join(root, 'b.js'));
  const second = await files.scan();
  assert.equal(second.files.length, 1);
  assert.notEqual(first.revision, second.revision);
  assert.notEqual(first.files[0].hash, second.files[0].hash);
  await write('c.js', 'export const c = 1;');
  const limited = await createProjectFiles({ root, maxFiles: 1 }).scan();
  assert.equal(limited.partial, true);
  assert.equal(limited.files.length, 1);
});

test('project reader rejects oversized files and aborts before scanning', async t => {
  const { root, write } = await fixture(t);
  await write('large.js', 'x'.repeat(128));
  const files = createProjectFiles({ root, maxFileBytes: 64 });
  await assert.rejects(files.read('large.js'), { code: 'PROJECT_FILE_TOO_LARGE' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(files.scan({ signal: controller.signal }), { name: 'AbortError' });
});
