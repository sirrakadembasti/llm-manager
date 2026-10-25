import { credentialEndpointProblem } from './credentialValidation.js';
import { LLMError, ErrorCodes } from './errors.js';
import { normalizeRuntimeOptions } from './runtime.js';
import { withFileLock, robustRename } from './store/fileLock.js';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
const exists = async file => {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
import path from 'node:path';
import { PROVIDERS, validateProviderUrl } from './providers.js';

const CONFLICT_MESSAGE = 'Profil başka bir işlemde değiştirildi; yenileyin.';
const conflictError = () =>
  new LLMError(ErrorCodes.PROFILE_CONFLICT, CONFLICT_MESSAGE, { status: 409, retryable: false });
const notFoundError = () =>
  new LLMError(ErrorCodes.PROFILE_NOT_FOUND, 'Profil bulunamadı.', { status: 404, retryable: false });

function migrate(data) {
  if (!data || typeof data !== 'object') {
    return { version: 1, activeId: null, profiles: [] };
  }
  const currentVersion = data.version !== undefined ? Number(data.version) : 0;
  if (!Number.isInteger(currentVersion) || currentVersion < 0 || currentVersion > 1) {
    throw new LLMError(
      ErrorCodes.STORE_VERSION_UNSUPPORTED,
      `Desteklenmeyen profil depolama sürümü (v${data.version}). Lütfen llm-manager paketini güncelleyin.`,
      { status: 500, retryable: false }
    );
  }
  return {
    version: 1,
    activeId: data.activeId ?? null,
    profiles: Array.isArray(data.profiles) ? data.profiles : []
  };
}

export function parseEncryptionKey(value) {
  const raw = String(value || '').trim();
  const isHex = /^[0-9a-f]{64}$/i.test(raw);
  const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(raw);
  const bytes = isHex ? Buffer.from(raw, 'hex') : isBase64 ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (bytes.length !== 32) {
    throw new LLMError(
      ErrorCodes.PROFILE_INVALID,
      'LLM_CONFIG_ENCRYPTION_KEY 32 baytlık hex veya base64 anahtar olmalıdır.',
      { status: 400, retryable: false }
    );
  }
  return bytes;
}

export function encrypt(secret, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64')).join('.');
}

export function decrypt(payload, key) {
  const parts = String(payload || '').split('.');
  if (parts.length !== 3 || parts.some(part => !part)) {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Şifreli profil verisi geçersiz veya bozuk.', {
      status: 400,
      retryable: false
    });
  }
  const [iv, tag, data] = parts.map(part => Buffer.from(part, 'base64'));
  if (iv.length !== 12 || tag.length !== 16) {
    throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Şifreli profil verisi geçersiz veya bozuk.', {
      status: 400,
      retryable: false
    });
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// API anahtarı (secret) içermeyen, dışarı verilebilir profil görünümü.
const publicProfile = profile => ({
  id: profile.id,
  name: profile.name,
  provider: profile.provider,
  model: profile.model,
  baseURL: profile.baseURL,
  hasApiKey: Boolean(profile.secret),
  revision: profile.revision || null,
  fallbackProfileIds: Array.isArray(profile.fallbackProfileIds)
    ? profile.fallbackProfileIds.filter(id => typeof id === 'string' && id.trim())
    : [],
  ...normalizeRuntimeOptions(profile),
  lastTests: profile.lastTests || {},
  lastTest: profile.lastTest || null
});

const transportOf = provider => PROVIDERS.find(item => item.id === provider)?.transport || 'openai';

// Silme/etkinleştirme için revizyon zorunludur; eksik veya eski revizyon çakışmadır.
function assertRevision(profile, revision) {
  if (revision === undefined || (profile.revision ?? null) !== revision) throw conflictError();
}

async function resolveAutoEncryptionKey(filePath) {
  if (process.env.LLM_CONFIG_ENCRYPTION_KEY) return process.env.LLM_CONFIG_ENCRYPTION_KEY;
  const keyPath = process.env.LLM_CONFIG_KEY_PATH || path.join(path.dirname(filePath), 'llm-encryption.key');
  if (await exists(keyPath)) {
    return (await fs.readFile(keyPath, 'utf8')).trim();
  }
  if (await exists(filePath)) {
    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
    if (data.profiles?.some(profile => profile.secret)) {
      throw new LLMError(
        ErrorCodes.PROFILE_INVALID,
        'Kayıtlı LLM profilleri var fakat şifreleme anahtarı yok. Önce eski LLM_CONFIG_ENCRYPTION_KEY değerini yedekten kurtarın.',
        { status: 400, retryable: false }
      );
    }
  }
  await fs.mkdir(path.dirname(keyPath), { recursive: true });
  const generated = crypto.randomBytes(32).toString('hex');
  try {
    await fs.writeFile(keyPath, `${generated}\n`, { mode: 0o600, flag: 'wx' });
    return generated;
  } catch (error) {
    if (error.code === 'EEXIST') return (await fs.readFile(keyPath, 'utf8')).trim();
    throw error;
  }
}

export function createLLMProfileStore({
  dataDir,
  filePath = process.env.LLM_CONFIG_PATH || path.resolve(dataDir || 'data', 'llm-profiles.json'),
  encryptionKey,
  allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true'
} = {}) {
  let cachedKeyBytes = null;
  let keyIdentity = null;
  const getKeyBytes = async () => {
    const configured = encryptionKey !== undefined ? encryptionKey : process.env.LLM_CONFIG_ENCRYPTION_KEY;
    let identity = configured;
    if (configured === undefined) {
      const keyPath = process.env.LLM_CONFIG_KEY_PATH || path.join(path.dirname(filePath), 'llm-encryption.key');
      const stat = await fs.stat(keyPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
        return null;
      });
      identity = stat ? `${stat.mtimeMs}:${stat.size}` : null;
    }
    if (!cachedKeyBytes || keyIdentity !== identity) {
      cachedKeyBytes = parseEncryptionKey(
        configured !== undefined ? configured : await resolveAutoEncryptionKey(filePath)
      );
      keyIdentity = identity;
    }
    return cachedKeyBytes;
  };

  let cache = null; // { mtimeMs, size, data }

  const read = async () => {
    if (!(await exists(filePath))) {
      cache = null;
      return { version: 1, profiles: [], activeId: null };
    }
    const stat = await fs.stat(filePath);
    if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
      return structuredClone(cache.data);
    }
    const raw = await fs.readFile(filePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseError) {
      throw new LLMError(
        ErrorCodes.STORE_CORRUPT,
        'Profil veri dosyası bozuk veya geçersiz JSON içeriyor. Kurtarmak için .bak uzantılı yedek dosyasını (llm-profiles.json.bak) asıl dosyanın üzerine kopyalayabilirsiniz.',
        { status: 500, retryable: false, cause: parseError }
      );
    }
    const migrated = migrate(parsed);
    cache = { mtimeMs: stat.mtimeMs, size: stat.size, data: migrated };
    return structuredClone(migrated);
  };

  const write = async value => {
    const toWrite = {
      version: 1,
      activeId: value.activeId ?? null,
      profiles: Array.isArray(value.profiles) ? value.profiles : []
    };
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(toWrite, null, 2), { mode: 0o600, flag: 'wx' });

    try {
      // Never replace the last good generation unless its backup succeeds.
      if (await exists(filePath)) await fs.copyFile(filePath, `${filePath}.bak`);
      await robustRename(temporary, filePath);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    try {
      const stat = await fs.stat(filePath);
      cache = { mtimeMs: stat.mtimeMs, size: stat.size, data: structuredClone(toWrite) };
    } catch {
      cache = null;
    }
  };

  const lockPath = `${filePath}.lock`;
  let queue = Promise.resolve();
  const withLock = fn => {
    const operation = queue.then(() =>
      withFileLock(lockPath, () => {
        cache = null; // Kilit alınınca önbelleği geçersiz kıl (YH1-B2 #3)
        return fn();
      })
    );
    queue = operation.catch(() => {});
    return operation;
  };

  // Sunucu tarafı görünüm: çözülmüş apiKey ve transport içerir.
  const withSecret = async profile => ({
    ...publicProfile(profile),
    apiKey: decrypt(profile.secret, await getKeyBytes()),
    transport: transportOf(profile.provider),
    revision: profile.revision || null
  });

  return {
    async list() {
      const data = await read();
      return { version: data.version, activeId: data.activeId, profiles: data.profiles.map(publicProfile) };
    },

    async getActive() {
      const data = await read();
      const profile = data.profiles.find(item => item.id === data.activeId);
      return profile ? withSecret(profile) : null;
    },

    async get(id) {
      const profile = (await read()).profiles.find(item => item.id === id);
      return profile ? withSecret(profile) : null;
    },

    save(input) {
      return withLock(async () => {
        const name = String(input?.name || '')
          .trim()
          .slice(0, 80);
        const provider = String(input?.provider || '').trim();
        const model = String(input?.model || '')
          .trim()
          .slice(0, 160);
        if (!name || !model || !PROVIDERS.some(item => item.id === provider)) {
          throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Sağlayıcı, profil adı ve model zorunludur.', {
            status: 400,
            retryable: false
          });
        }
        const baseURL = validateProviderUrl(input.baseURL, { allowLocalHttp });
        const data = await read();
        const existing = data.profiles.find(item => item.id === input.id);
        if (input.id && !existing) throw notFoundError();
        if (existing && (!Object.hasOwn(input, 'revision') || input.revision !== (existing.revision ?? null))) {
          throw conflictError();
        }
        const newKey = String(input.apiKey || '').trim();
        const problem = credentialEndpointProblem(provider, baseURL, newKey);
        if (problem) {
          throw new LLMError(ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH, problem, {
            status: 400,
            retryable: false
          });
        }
        if (existing && (existing.provider !== provider || existing.baseURL !== baseURL) && !newKey) {
          throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Sağlayıcı değişince yeni API anahtarı girin.', {
            status: 400,
            retryable: false
          });
        }
        const secret = newKey ? encrypt(newKey, await getKeyBytes()) : existing?.secret;
        if (!secret) {
          throw new LLMError(ErrorCodes.PROFILE_INVALID, 'API anahtarı zorunludur.', {
            status: 400,
            retryable: false
          });
        }
        const runtime = normalizeRuntimeOptions({ ...existing, ...input });
        const keepTests = Boolean(
          existing &&
          existing.provider === provider &&
          existing.baseURL === baseURL &&
          existing.model === model &&
          !newKey
        );
        const fallbackProfileIds = Array.isArray(input?.fallbackProfileIds)
          ? input.fallbackProfileIds.filter(id => typeof id === 'string' && id.trim())
          : existing?.fallbackProfileIds || [];
        const profile = {
          ...runtime,
          id: existing?.id || crypto.randomUUID(),
          name,
          provider,
          model,
          baseURL,
          secret,
          fallbackProfileIds,
          revision: crypto.randomUUID(),
          lastTest: keepTests ? existing.lastTest || null : null,
          lastTests: keepTests ? existing.lastTests || {} : {}
        };
        data.profiles = existing
          ? data.profiles.map(item => (item.id === existing.id ? profile : item))
          : [...data.profiles, profile];
        await write(data);
        return publicProfile(profile);
      });
    },

    activate(id, revision) {
      return withLock(async () => {
        const data = await read();
        const profile = data.profiles.find(item => item.id === id);
        if (!profile) throw notFoundError();
        assertRevision(profile, revision);
        data.activeId = id;
        await write(data);
        return this.list();
      });
    },

    async recordTest(id, status, expectedRevision, details = {}) {
      if (!['passed', 'failed'].includes(status)) {
        throw new LLMError(ErrorCodes.PROFILE_INVALID, 'Geçersiz bağlantı testi sonucu.', {
          status: 400,
          retryable: false
        });
      }
      return await withLock(async () => {
        const data = await read();
        const profile = data.profiles.find(item => item.id === id);
        if (!profile) throw notFoundError();
        if (expectedRevision !== undefined && (profile.revision || null) !== expectedRevision) return null;
        const mode = details.mode === 'conversation' ? 'conversation' : 'quick';
        profile.lastTest = {
          status,
          at: new Date().toISOString(),
          mode,
          durationMs: Math.max(0, Number(details.durationMs) || 0),
          ...(details.code ? { code: String(details.code).slice(0, 80) } : {})
        };
        profile.lastTests = { ...(profile.lastTests || {}), [mode]: profile.lastTest };
        await write(data);
        return publicProfile(profile);
      });
    },

    remove(id, revision) {
      return withLock(async () => {
        const data = await read();
        const profile = data.profiles.find(item => item.id === id);
        if (!profile) throw notFoundError();
        assertRevision(profile, revision);
        data.profiles = data.profiles.filter(item => item.id !== id);
        if (data.activeId === id) data.activeId = null;
        await write(data);
        return this.list();
      });
    }
  };
}
