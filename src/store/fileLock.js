import fs from 'node:fs';
import path from 'node:path';
import { LLMError, ErrorCodes } from '../errors.js';

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, ms));
}

// Exclusive creation can transiently deny access on Windows. Never claim ownership
// or inspect/remove a lock on this path; preserve the first denial if retries fail.
function accessRetryDelay(error, state, deadline) {
  if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) return null;
  state.error ||= error;
  const delays = [10, 20, 40, 80];
  const remaining = deadline - Date.now();
  if (state.attempts >= delays.length || remaining <= 0) throw state.error;
  return Math.min(delays[state.attempts++], remaining);
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== 'ESRCH';
  }
}

function handleStaleLock(lockPath) {
  try {
    const raw = fs.readFileSync(lockPath, 'utf8');
    const lockInfo = JSON.parse(raw);
    const ageMs = Date.now() - new Date(lockInfo.at).getTime();
    if (ageMs > 10000 && !isPidAlive(lockInfo.pid)) {
      fs.unlinkSync(lockPath);
      return true;
    }
  } catch {
    // Lock file might be in the middle of being created/deleted
  }
  return false;
}

export function robustRenameSync(source, target) {
  const delays = [20, 50, 100, 200];
  let attempt = 0;
  while (true) {
    try {
      fs.renameSync(source, target);
      return;
    } catch (err) {
      if (['EPERM', 'EBUSY', 'EACCES'].includes(err.code) && attempt < delays.length) {
        sleepSync(delays[attempt++]);
        continue;
      }
      throw err;
    }
  }
}

export function withFileLockSync(lockPath, fn, { timeoutMs = 5000, retryIntervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const accessRetry = { attempts: 0, error: null };
  while (true) {
    let fd;
    try {
      fd = fs.openSync(lockPath, 'wx');
    } catch (err) {
      const delay = accessRetryDelay(err, accessRetry, deadline);
      if (delay !== null) {
        sleepSync(delay);
        if (Date.now() >= deadline) throw accessRetry.error;
        continue;
      }
      if (err.code === 'ENOENT') {
        fs.mkdirSync(path.dirname(lockPath), { recursive: true });
        continue;
      }
      if (err.code === 'EEXIST') {
        if (handleStaleLock(lockPath)) {
          continue;
        }
        if (Date.now() >= deadline) {
          throw new LLMError(ErrorCodes.STORE_LOCKED, 'Depo dosyası şu anda başka bir işlem tarafından kilitli.', {
            status: 409,
            retryable: true
          });
        }
        sleepSync(retryIntervalMs);
        continue;
      }
      throw err;
    }

    try {
      const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
      fs.writeFileSync(fd, payload, 'utf8');
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {}
      }
    }

    try {
      return fn();
    } finally {
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    }
  }
}

export async function withFileLock(lockPath, fn, { timeoutMs = 5000, retryIntervalMs = 10 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const accessRetry = { attempts: 0, error: null };
  while (true) {
    let fd;
    try {
      fd = await fs.promises.open(lockPath, 'wx', 0o600);
    } catch (err) {
      const delay = accessRetryDelay(err, accessRetry, deadline);
      if (delay !== null) {
        await new Promise(resolve => setTimeout(resolve, delay));
        if (Date.now() >= deadline) throw accessRetry.error;
        continue;
      }
      if (err.code === 'ENOENT') {
        await fs.promises.mkdir(path.dirname(lockPath), { recursive: true });
        continue;
      }
      if (err.code === 'EEXIST') {
        if (await handleStaleLockAsync(lockPath)) {
          continue;
        }
        if (Date.now() >= deadline) {
          throw new LLMError(ErrorCodes.STORE_LOCKED, 'Depo dosyası şu anda başka bir işlem tarafından kilitli.', {
            status: 409,
            retryable: true
          });
        }
        await new Promise(r => setTimeout(r, retryIntervalMs));
        continue;
      }
      throw err;
    }

    try {
      const payload = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
      await fd.writeFile(payload, 'utf8');
    } finally {
      if (fd !== undefined) {
        try {
          await fd.close();
        } catch {}
      }
    }

    try {
      return await fn();
    } finally {
      try {
        await fs.promises.unlink(lockPath);
      } catch {}
      // Give waiting processes a full polling interval before this caller can reacquire.
      await new Promise(resolve => setTimeout(resolve, retryIntervalMs * 2));
    }
  }
}

async function handleStaleLockAsync(lockPath) {
  try {
    const info = JSON.parse(await fs.promises.readFile(lockPath, 'utf8'));
    if (Date.now() - new Date(info.at).getTime() > 10000 && !isPidAlive(info.pid)) {
      await fs.promises.unlink(lockPath);
      return true;
    }
  } catch {}
  return false;
}
export async function robustRename(source, target) {
  const delays = [20, 50, 100, 200];
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.promises.rename(source, target);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error.code) || attempt >= delays.length) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
}
