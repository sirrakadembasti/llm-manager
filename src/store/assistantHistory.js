import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { withFileLock, robustRename } from './fileLock.js';

// Codec closures reuse the profile key; no key is exported or persisted here.
export function createAssistantHistoryStorage({ filePath, seal, open }) {
  let queue = Promise.resolve();
  async function read() {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > 64 * 1024 * 1024) throw new Error('History too large');
      const parsed = JSON.parse(await open(await fs.readFile(filePath, 'utf8')));
      if (parsed?.version !== 1 || !parsed.scopes || typeof parsed.scopes !== 'object')
        throw new Error('Invalid history');
      return parsed;
    } catch (error) {
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
            await robustRename(temporary, filePath);
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
