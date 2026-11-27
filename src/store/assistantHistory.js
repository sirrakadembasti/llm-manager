import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { withFileLock, robustRename } from './fileLock.js';

// Codec closures reuse the profile key; no key is exported or persisted here.
export function createAssistantHistoryStorage({ filePath, seal, open, ensureKey }) {
  let queue = Promise.resolve();
  // Çözülmüş içerik, dosya kimliği (mtime+boyut+inode) değişmedikçe yeniden çözülmez.
  let cache = null; // { id, data }
  const identity = stat => `${stat.mtimeNs}:${stat.size}:${stat.ino}`;
  async function read() {
    try {
      const stat = await fs.stat(filePath, { bigint: true });
      if (stat.size > 64n * 1024n * 1024n) throw new Error('History too large');
      if (cache?.id === identity(stat)) {
        await ensureKey?.(); // Önbellek anahtar eksikliği denetimini atlatmamalı: dosya varken anahtar kaybolduysa hata ver.
        return structuredClone(cache.data);
      }
      const parsed = JSON.parse(await open(await fs.readFile(filePath, 'utf8')));
      if (parsed?.version !== 1 || !parsed.scopes || typeof parsed.scopes !== 'object')
        throw new Error('Invalid history');
      cache = { id: identity(stat), data: structuredClone(parsed) };
      return parsed;
    } catch (error) {
      cache = null;
      if (error.code === 'ENOENT') return { version: 1, scopes: {} };
      throw error;
    }
  }
  return {
    read: async scope => structuredClone((await read()).scopes[scope] || []),
    update(scope, mutate) {
      const pending = queue.then(async () => {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        return withFileLock(`${filePath}.lock`, async () => {
          const data = await read();
          const sessions = data.scopes[scope] || [];
          const result = mutate(sessions);
          data.scopes[scope] = sessions;
          const raw = JSON.stringify(data);
          if (Buffer.byteLength(raw) > 40 * 1024 * 1024) throw new Error('History capacity exceeded');
          const encrypted = await seal(raw);
          const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
          try {
            await fs.writeFile(temporary, encrypted, { mode: 0o600, flag: 'wx' });
            const written = await fs.stat(temporary, { bigint: true }); // yeniden adlandırma mtime/inode'u korur
            await robustRename(temporary, filePath);
            cache = { id: identity(written), data: structuredClone(data) };
          } finally {
            await fs.unlink(temporary).catch(error => {
              if (error.code !== 'ENOENT') throw error;
            });
          }
          return structuredClone(result);
        });
      });
      queue = pending.catch(() => {});
      return pending;
    }
  };
}
