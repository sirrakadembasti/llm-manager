import { credentialEndpointProblem } from './credentialValidation.js';
import { normalizeRuntimeOptions } from './runtime.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PROVIDERS, validateProviderUrl } from './providers.js';

const CONFLICT_MESSAGE = 'Profil başka bir işlemde değiştirildi; yenileyin.';
const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { code: 'PROFILE_CONFLICT' });

export function parseEncryptionKey(value) {
  const raw = String(value || '').trim();
  const isHex = /^[0-9a-f]{64}$/i.test(raw);
  const isBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(raw);
  const bytes = isHex ? Buffer.from(raw, 'hex') : isBase64 ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
  if (bytes.length !== 32) {
    throw new Error('LLM_CONFIG_ENCRYPTION_KEY 32 baytlık hex veya base64 anahtar olmalıdır.');
  }
  return bytes;
}

function encrypt(secret, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64')).join('.');
}

function decrypt(payload, key) {
  const [iv, tag, data] = String(payload).split('.').map(part => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
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
  ...normalizeRuntimeOptions(profile),
  lastTests: profile.lastTests || {},
  lastTest: profile.lastTest || null
});

const transportOf = provider => PROVIDERS.find(item => item.id === provider)?.transport || 'openai';

// Silme/etkinleştirme için revizyon zorunludur; eksik veya eski revizyon çakışmadır.
function assertRevision(profile, revision) {
  if (revision === undefined || (profile.revision ?? null) !== revision) throw conflictError();
}

export function createLLMProfileStore({
  filePath = process.env.LLM_CONFIG_PATH || path.resolve('data/llm-profiles.json'),
  encryptionKey = process.env.LLM_CONFIG_ENCRYPTION_KEY,
  allowLocalHttp = process.env.LLM_ALLOW_LOCAL_HTTP === 'true'
} = {}) {
  const read = () => fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
    : { profiles: [], activeId: null };

  const write = value => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
    try {
      fs.renameSync(temporary, filePath);
    } catch (error) {
      fs.rmSync(temporary, { force: true });
      throw error;
    }
  };

  // Sunucu tarafı görünüm: çözülmüş apiKey ve transport içerir.
  const withSecret = profile => ({
    ...publicProfile(profile),
    apiKey: decrypt(profile.secret, parseEncryptionKey(encryptionKey)),
    transport: transportOf(profile.provider),
    revision: profile.revision || null
  });

  return {
    list() {
      const data = read();
      return { activeId: data.activeId, profiles: data.profiles.map(publicProfile) };
    },

    getActive() {
      const data = read();
      const profile = data.profiles.find(item => item.id === data.activeId);
      return profile ? withSecret(profile) : null;
    },

    get(id) {
      const profile = read().profiles.find(item => item.id === id);
      return profile ? withSecret(profile) : null;
    },

    save(input) {
      const name = String(input?.name || '').trim().slice(0, 80);
      const provider = String(input?.provider || '').trim();
      const model = String(input?.model || '').trim().slice(0, 160);
      if (!name || !model || !PROVIDERS.some(item => item.id === provider)) {
        throw new Error('Sağlayıcı, profil adı ve model zorunludur.');
      }
      const baseURL = validateProviderUrl(input.baseURL, { allowLocalHttp });
      const data = read();
      const existing = data.profiles.find(item => item.id === input.id);
      if (input.id && !existing) throw new Error('Profil bulunamadı.');
      if (existing && (!Object.hasOwn(input, 'revision') || input.revision !== (existing.revision ?? null))) {
        throw conflictError();
      }
      const newKey = String(input.apiKey || '').trim();
      const problem = credentialEndpointProblem(provider, baseURL, newKey);
      if (problem) throw Object.assign(new Error(problem), { code: 'AI_CREDENTIAL_ENDPOINT_MISMATCH' });
      if (existing && (existing.provider !== provider || existing.baseURL !== baseURL) && !newKey) {
        throw new Error('Sağlayıcı değişince yeni API anahtarı girin.');
      }
      const secret = newKey ? encrypt(newKey, parseEncryptionKey(encryptionKey)) : existing?.secret;
      if (!secret) throw new Error('API anahtarı zorunludur.');
      const runtime = normalizeRuntimeOptions({ ...existing, ...input });
      const profile = {
        ...runtime,
        id: existing?.id || crypto.randomUUID(),
        name, provider, model, baseURL, secret,
        revision: crypto.randomUUID(),
        lastTest: null
      };
      data.profiles = existing
        ? data.profiles.map(item => item.id === existing.id ? profile : item)
        : [...data.profiles, profile];
      write(data);
      return publicProfile(profile);
    },

    activate(id, revision) {
      const data = read();
      const profile = data.profiles.find(item => item.id === id);
      if (!profile) throw new Error('Profil bulunamadı.');
      assertRevision(profile, revision);
      data.activeId = id;
      write(data);
      return this.list();
    },

    recordTest(id, status, expectedRevision, details = {}) {
      if (!['passed', 'failed'].includes(status)) throw new Error('Geçersiz bağlantı testi sonucu.');
      const data = read();
      const profile = data.profiles.find(item => item.id === id);
      if (!profile) throw new Error('Profil bulunamadı.');
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
      write(data);
      return publicProfile(profile);
    },

    remove(id, revision) {
      const data = read();
      const profile = data.profiles.find(item => item.id === id);
      if (!profile) throw new Error('Profil bulunamadı.');
      assertRevision(profile, revision);
      data.profiles = data.profiles.filter(item => item.id !== id);
      if (data.activeId === id) data.activeId = null;
      write(data);
      return this.list();
    }
  };
}
