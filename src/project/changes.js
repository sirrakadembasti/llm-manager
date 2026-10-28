import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectPath, hasProjectSecret, isWithin, projectError } from './policy.js';
import { isProjectIgnored } from './ignore.js';

const digest = value => (value === null ? null : crypto.createHash('sha256').update(value).digest('hex'));
const conflict = () =>
  projectError(
    'PROJECT_CONFLICT',
    'Dosya veya görev sürümü değişti. Kullanıcı değişikliklerini korumak için işlem durduruldu.',
    409
  );

export function createProjectChanges({ reader, maxTasks = 10 }) {
  const tasks = new Map();
  let queue = Promise.resolve();
  const view = task => structuredClone({ id: task.id, revision: task.revision, state: task.state, files: task.files });

  function validateFiles(files) {
    const map = new Map();
    for (const file of files) {
      projectPath(file.path);
      if (typeof file.content !== 'string' || Buffer.byteLength(file.content) > 256 * 1024)
        throw projectError('PROJECT_FILE_TOO_LARGE', 'Değişiklik dosyası boyut sınırını aşıyor.', 413);
      if (hasProjectSecret(file.content))
        throw projectError('PROJECT_SECRET_DETECTED', 'Sır içeren içerik değişiklik olarak hazırlanamaz.', 403);
      if (map.has(file.path)) throw projectError('PROJECT_CHANGE_INVALID', 'Aynı dosya birden çok kez tanımlandı.');
      map.set(file.path, file.content);
    }
    return map;
  }

  async function prepare(before, after) {
    const initial = validateFiles(before),
      updated = validateFiles(after);
    const files = [...new Set([...initial.keys(), ...updated.keys()])].sort().flatMap(name => {
      const a = initial.get(name) ?? null,
        b = updated.get(name) ?? null;
      return a === b
        ? []
        : [{ path: name, before: a, after: b, kind: a === null ? 'create' : b === null ? 'delete' : 'update' }];
    });
    if (
      files.length > 100 ||
      files.reduce((n, f) => n + Buffer.byteLength(f.before || '') + Buffer.byteLength(f.after || ''), 0) >
        2 * 1024 * 1024
    ) {
      throw projectError('PROJECT_CHANGE_LIMIT', 'Değişiklik kapsamı 100 dosya veya 2 MiB sınırını aşıyor.', 413);
    }
    if (tasks.size >= maxTasks) {
      const removable = [...tasks].find(([, task]) => task.state !== 'applied');
      if (!removable) throw projectError('PROJECT_TASK_LIMIT', 'Önce mevcut görevleri tamamlayın.', 409);
      tasks.delete(removable[0]);
    }
    const task = {
      id: crypto.randomUUID(),
      revision: crypto.randomUUID(),
      state: 'proposed',
      files,
      root: await fs.realpath(reader.root)
    };
    tasks.set(task.id, task);
    return view(task);
  }

  async function target(task, name) {
    projectPath(name);
    if ((await fs.realpath(reader.root)) !== task.root) throw conflict();
    if (await isProjectIgnored(task.root, name))
      throw projectError('PROJECT_PATH_DENIED', 'Git tarafından dışlanan kaynak değiştirilemez.', 403);
    let current = task.root;
    for (const part of name.split('/')) {
      current = path.join(current, part);
      const stat = await fs.lstat(current).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      if (!stat) continue;
      if (stat.isSymbolicLink() || !isWithin(task.root, await fs.realpath(current))) {
        throw projectError('PROJECT_PATH_DENIED', 'Bağlantılı veya kök dışındaki dosya değiştirilemez.', 403);
      }
    }
    return current;
  }

  async function currentHash(task, file) {
    const location = await target(task, file.path);
    const stat = await fs.lstat(location).catch(error => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (!stat) return null;
    if (!stat.isFile() || stat.size > 256 * 1024) throw conflict();
    return digest(await fs.readFile(location));
  }

  async function writeFile(task, file, expected, content) {
    if ((await currentHash(task, file)) !== digest(expected)) throw conflict();
    const location = await target(task, file.path);
    if (content === null) {
      await fs.unlink(location);
      return;
    }
    const parent = path.dirname(location);
    await fs.mkdir(parent, { recursive: true });
    await target(task, file.path);
    const mode = (await fs.stat(location).catch(() => null))?.mode;
    const temporary = path.join(parent, `.llm-change-${crypto.randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, content, { flag: 'wx', mode: mode ? mode & 0o777 : 0o600 });
      if ((await currentHash(task, file)) !== digest(expected)) throw conflict();
      await fs.rename(temporary, location);
    } finally {
      await fs.unlink(temporary).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
  }

  async function execute(id, approval, reverse) {
    const task = tasks.get(id);
    if (!task) throw projectError('PROJECT_TASK_NOT_FOUND', 'Değişiklik görevi bulunamadı.', 404);
    if (approval?.approved !== true)
      throw projectError('PROJECT_APPROVAL_REQUIRED', 'Dosya farklarını inceledikten sonra işlemi açıkça onaylayın.');
    if (approval.revision !== task.revision || task.state !== (reverse ? 'applied' : 'proposed')) throw conflict();
    const from = reverse ? 'after' : 'before',
      to = reverse ? 'before' : 'after';
    for (const file of task.files) if ((await currentHash(task, file)) !== digest(file[from])) throw conflict();
    const written = [];
    try {
      for (const file of task.files) {
        await writeFile(task, file, file[from], file[to]);
        written.push(file);
      }
    } catch (error) {
      let rollbackConflict = false;
      for (const file of written.reverse()) {
        try {
          await writeFile(task, file, file[to], file[from]);
        } catch {
          rollbackConflict = true;
        }
      }
      if (rollbackConflict)
        throw projectError(
          'PROJECT_PARTIAL_APPLY',
          'İşlem sırasında dosyalar değişti; otomatik kurtarma durdu. Dosyaları elle karşılaştırın.',
          409
        );
      throw error;
    }
    task.state = reverse ? 'reverted' : 'applied';
    task.revision = crypto.randomUUID();
    return view(task);
  }

  function enqueue(id, approval, reverse) {
    const operation = queue.then(() => execute(id, approval, reverse));
    queue = operation.catch(() => {});
    return operation;
  }

  return {
    prepare,
    verify: async id => {
      const task = tasks.get(id);
      if (!task) throw projectError('PROJECT_TASK_NOT_FOUND', 'Değişiklik görevi bulunamadı.', 404);
      const field = task.state === 'applied' ? 'after' : 'before';
      for (const file of task.files) if ((await currentHash(task, file)) !== digest(file[field])) throw conflict();
      return true;
    },
    discard: id => tasks.delete(id),
    apply: (id, approval) => enqueue(id, approval, false),
    revert: (id, approval) => enqueue(id, approval, true),
    get: id => (tasks.has(id) ? view(tasks.get(id)) : null)
  };
}
