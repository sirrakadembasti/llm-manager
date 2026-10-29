import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import {
  projectError,
  projectPath,
  hasProjectSecret,
  isWithin,
  skipDirectory,
  diagnosticProjectPath
} from './policy.js';
import { isProjectIgnored, gitIgnoredPaths } from './ignore.js';

const digest = value => crypto.createHash('sha256').update(value).digest('hex');

export function createProjectFiles({
  root,
  maxFiles = 2500,
  maxFileBytes = 256 * 1024,
  maxTotalBytes = 4 * 1024 * 1024
} = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root))
    throw projectError('PROJECT_ROOT_INVALID', 'Proje kökü mutlak bir dizin yolu olmalıdır.');
  for (const n of [maxFiles, maxFileBytes, maxTotalBytes]) {
    if (!Number.isSafeInteger(n) || n < 1)
      throw projectError('PROJECT_ROOT_INVALID', 'Tarama sınırları pozitif tam sayı olmalıdır.');
  }
  const configuredRoot = path.resolve(root);
  const rootPath = async () => {
    const resolved = await fs.realpath(configuredRoot).catch(() => {
      throw projectError('PROJECT_ROOT_INVALID', 'Proje kaynak dizini bulunamadı.');
    });
    if (!(await fs.stat(resolved)).isDirectory())
      throw projectError('PROJECT_ROOT_INVALID', 'Proje kökü bir dizin olmalıdır.');
    return resolved;
  };

  async function resolveFile(relativePath) {
    projectPath(relativePath);
    const base = await rootPath();
    let current = base;
    for (const part of relativePath.split('/')) {
      current = path.join(current, part);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink() || !isWithin(base, await fs.realpath(current))) {
        throw projectError('PROJECT_PATH_DENIED', 'Bağlantılı veya kök dışındaki kaynak okunamaz.', 403, 'symlink');
      }
    }
    return current;
  }

  async function read(relativePath, { signal, gitChecked = false } = {}) {
    signal?.throwIfAborted();
    const absolute = await resolveFile(relativePath);
    if (await isProjectIgnored(await rootPath(), relativePath, { git: !gitChecked })) {
      throw projectError('PROJECT_PATH_DENIED', 'Git tarafından dışlanan dosya bağlama alınmaz.', 403, 'ignored');
    }
    const handle = await fs.open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const before = await handle.stat();
      if (!before.isFile())
        throw projectError('PROJECT_PATH_DENIED', 'Yalnız kaynak dosyaları okunabilir.', 403, 'unreadable');
      if (before.size > maxFileBytes)
        throw projectError('PROJECT_FILE_TOO_LARGE', 'Kaynak dosyası boyut sınırını aşıyor.', 413, 'file-size');
      const bytes = Buffer.alloc(Math.min(before.size + 1, maxFileBytes + 1));
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      const after = await handle.stat();
      await resolveFile(relativePath);
      if (before.mtimeMs !== after.mtimeMs || before.size !== after.size || bytesRead > maxFileBytes) {
        throw projectError('PROJECT_CONFLICT', 'Kaynak okunurken değişti; yeniden tarayın.', 409);
      }
      signal?.throwIfAborted();
      const data = bytes.subarray(0, bytesRead);
      if (data.includes(0)) throw projectError('PROJECT_PATH_DENIED', 'İkili dosyalar bağlama alınmaz.', 403, 'binary');
      let content;
      try {
        content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
      } catch {
        throw projectError('PROJECT_PATH_DENIED', 'UTF-8 olmayan kaynak bağlama alınmaz.', 403, 'encoding');
      }
      if (hasProjectSecret(content))
        throw projectError('PROJECT_SECRET_DETECTED', 'Sır içerebilecek kaynak dosyası dışlandı.', 403, 'secret');
      return { path: relativePath, content, hash: digest(data), bytes: bytesRead };
    } finally {
      await handle.close();
    }
  }

  async function scan({ signal } = {}) {
    signal?.throwIfAborted();
    const base = await rootPath();
    const exclusions = [],
      exclusionCounts = {},
      excludedPaths = new Set();
    let excluded = 0,
      diagnosticsLimited = false;
    const exclude = (name, reason) => {
      if (name && excludedPaths.has(name)) return;
      if (name) excludedPaths.add(name);
      excluded++;
      exclusionCounts[reason] = (exclusionCounts[reason] || 0) + 1;
      const safePath = diagnosticProjectPath(name);
      if (safePath && exclusions.length < 200) exclusions.push({ path: safePath, reason });
      else diagnosticsLimited = true;
    };
    let candidates;
    let gitAware = false;
    try {
      const exec = promisify((await import('node:child_process')).execFile);
      const { stdout } = await exec(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '.'],
        {
          cwd: base,
          encoding: 'utf8',
          timeout: 5000,
          maxBuffer: 8 * 1024 * 1024,
          windowsHide: true,
          signal
        }
      );
      candidates = [...new Set(stdout.split('\0').filter(Boolean))].sort();
      gitAware = true;
      try {
        const { stdout: ignored } = await exec(
          'git',
          ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z', '--', '.'],
          { cwd: base, encoding: 'utf8', timeout: 5000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, signal }
        );
        for (const item of ignored.split('\0').filter(Boolean)) {
          const name = item.replace(/\/$/, '');
          let reason = 'ignored';
          try {
            if (!item.endsWith('/')) projectPath(name);
            else if (skipDirectory(path.posix.basename(name))) reason = 'directory';
          } catch (error) {
            reason = error.exclusionReason || 'unsafe-path';
          }
          exclude(name, reason);
        }
      } catch {
        signal?.throwIfAborted();
        diagnosticsLimited = true;
      }
    } catch {
      signal?.throwIfAborted();
    }
    let walkLimited = false;
    if (!candidates) {
      candidates = [];
      let visited = 0;
      const walk = async (directory, prefix = '') => {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
          signal?.throwIfAborted();
          if (++visited > maxFiles * 10) {
            walkLimited = true;
            exclude(prefix.replace(/\/$/, '') || null, 'scan-limit');
            return;
          }
          const relative = prefix + entry.name;
          if (entry.isSymbolicLink()) {
            exclude(relative, 'symlink');
            continue;
          }
          if (entry.isDirectory() && skipDirectory(entry.name)) {
            exclude(relative, 'directory');
            continue;
          }
          if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${relative}/`);
          else if (entry.isFile()) candidates.push(relative);
        }
      };
      await walk(base);
      candidates.sort();
    }
    const priority = name =>
      /(?:^|\/)README(?:\.[^/]+)?$/i.test(name)
        ? 0
        : /\.(?:md|txt)$/i.test(name)
          ? 1
          : /(?:^|\/)(?:package\.json|pyproject\.toml|requirements\.txt)|\.(?:sql|prisma|csproj)$/.test(name)
            ? 2
            : 3;
    candidates.sort((a, b) => priority(a) - priority(b) || a.localeCompare(b));
    const files = [];
    let bytes = 0;
    let partial = walkLimited;
    const gitIgnored = candidates.length ? await gitIgnoredPaths(base, candidates) : new Set();
    for (const name of candidates) {
      signal?.throwIfAborted();
      try {
        projectPath(name);
        if (gitIgnored?.has(name)) {
          exclude(name, 'ignored');
          continue;
        }
        if (files.length >= maxFiles) {
          partial = true;
          exclude(name, 'file-count');
          continue;
        }
        const file = await read(name, { signal, gitChecked: true });
        if (bytes + file.bytes > maxTotalBytes) {
          partial = true;
          exclude(name, 'total-size');
          continue;
        }
        files.push(file);
        bytes += file.bytes;
      } catch (error) {
        signal?.throwIfAborted();
        if (error.code === 'PROJECT_FILE_TOO_LARGE') partial = true;
        if (error.code === 'PROJECT_CONFLICT') throw error;
        exclude(name, error.exclusionReason || 'unreadable');
      }
    }
    return {
      name: path.basename(base),
      files,
      bytes,
      excluded,
      exclusions,
      exclusionCounts,
      exclusionsTruncated: diagnosticsLimited,
      partial,
      gitAware,
      revision: digest(files.map(f => `${f.path}:${f.hash}`).join('\n')),
      scannedAt: new Date().toISOString()
    };
  }

  return { scan, read, root: configuredRoot };
}
