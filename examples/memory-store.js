import { randomUUID } from 'node:crypto';
import { LLMError, ErrorCodes } from '../src/errors.js';
import { PROVIDERS, validateProviderUrl } from '../src/providers.js';
import { normalizeRuntimeOptions } from '../src/runtime.js';
import { credentialEndpointProblem } from '../src/credentialValidation.js';

// Geçici, tek süreçli örnek: apiKey bellekte açık tutulur; kalıcı şifreleme hostun sorumluluğudur.
// Kullanım: createLLMManager({ store: createMemoryStore(), adminPassword: process.env.LLM_ADMIN_PASSWORD })
export function createMemoryStore({ allowLocalHttp = false } = {}) {
  const profiles = new Map();
  let activeId = null;
  const fail = (code, message, status = 400) => {
    throw new LLMError(code, message, { status, retryable: false });
  };
  const find = id => profiles.get(id) || fail(ErrorCodes.PROFILE_NOT_FOUND, 'Profil bulunamadı.', 404);
  const checkRevision = (profile, revision) => {
    if (revision === undefined || revision !== profile.revision)
      fail(ErrorCodes.PROFILE_CONFLICT, 'Profil başka bir işlemde değiştirildi; yenileyin.', 409);
  };
  // Explicit DTO boundary: callers cannot mutate internal records or receive credentials.
  const publicProfile = ({ apiKey, transport: _transport, ...profile }) =>
    structuredClone({ ...profile, hasApiKey: Boolean(apiKey) });
  const list = () => ({ version: 1, activeId, profiles: [...profiles.values()].map(publicProfile) });

  return {
    async list() {
      return list();
    },
    async get(id) {
      return structuredClone(profiles.get(id) || null);
    },
    async getActive() {
      return structuredClone(profiles.get(activeId) || null);
    },
    async save(input) {
      const name = String(input?.name || '')
        .trim()
        .slice(0, 80);
      const model = String(input?.model || '')
        .trim()
        .slice(0, 160);
      const provider = PROVIDERS.find(item => item.id === input?.provider);
      if (!name || !model || !provider) fail(ErrorCodes.PROFILE_INVALID, 'Sağlayıcı, profil adı ve model zorunludur.');
      let baseURL;
      try {
        baseURL = validateProviderUrl(input.baseURL, { allowLocalHttp });
      } catch {
        fail(ErrorCodes.PROFILE_INVALID, 'Geçerli ve izin verilen bir API adresi girin.');
      }
      const existing = input.id ? find(input.id) : null;
      if (existing) checkRevision(existing, input.revision);
      const newKey = String(input.apiKey || '').trim();
      if (existing && (existing.provider !== provider.id || existing.baseURL !== baseURL) && !newKey)
        fail(ErrorCodes.PROFILE_INVALID, 'Sağlayıcı veya adres değişince yeni API anahtarı girin.');
      const apiKey = newKey || existing?.apiKey;
      if (!apiKey) fail(ErrorCodes.PROFILE_INVALID, 'API anahtarı zorunludur.');
      const problem = credentialEndpointProblem(provider.id, baseURL, apiKey);
      if (problem) fail(ErrorCodes.AI_CREDENTIAL_ENDPOINT_MISMATCH, problem);
      const keepTests =
        existing &&
        existing.provider === provider.id &&
        existing.baseURL === baseURL &&
        existing.model === model &&
        !newKey;
      const profile = {
        id: existing?.id || randomUUID(),
        name,
        model,
        provider: provider.id,
        baseURL,
        apiKey,
        transport: provider.transport || 'openai',
        revision: randomUUID(),
        ...normalizeRuntimeOptions({ ...existing, ...input }),
        fallbackProfileIds: Array.isArray(input.fallbackProfileIds)
          ? input.fallbackProfileIds.filter(id => typeof id === 'string' && id.trim())
          : existing?.fallbackProfileIds || [],
        lastTest: keepTests ? existing.lastTest : null,
        lastTests: keepTests ? existing.lastTests : {}
      };
      profiles.set(profile.id, profile);
      return publicProfile(profile);
    },
    async remove(id, revision) {
      checkRevision(find(id), revision);
      profiles.delete(id);
      if (activeId === id) activeId = null;
      return list();
    },
    async activate(id, revision) {
      checkRevision(find(id), revision);
      activeId = id;
      return list();
    },
    async recordTest(id, status, expectedRevision, details = {}) {
      if (!['passed', 'failed'].includes(status)) fail(ErrorCodes.PROFILE_INVALID, 'Geçersiz bağlantı testi sonucu.');
      const profile = find(id);
      if (expectedRevision !== undefined && expectedRevision !== profile.revision) return null;
      const mode = details.mode === 'conversation' ? 'conversation' : 'quick';
      profile.lastTest = {
        status,
        at: new Date().toISOString(),
        mode,
        durationMs: Math.max(0, Number(details.durationMs) || 0),
        ...(details.code ? { code: String(details.code).slice(0, 80) } : {})
      };
      profile.lastTests = { ...profile.lastTests, [mode]: profile.lastTest };
      return publicProfile(profile);
    }
  };
}
