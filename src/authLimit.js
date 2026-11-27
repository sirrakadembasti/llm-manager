import crypto from 'node:crypto';
import { createRateLimiter } from './rateLimit.js';

const VERIFIED_TTL_MS = 5 * 60 * 1000;
const VERIFIED_MAX = 100;

/**
 * Hatalı giriş politikası; Express ve Web (fetch) adaptörü aynı kuralı kullanır.
 *  - İstemci kimliği (clientKey / req.ip) varsa: sayaç dolunca o istemcinin bütün denemeleri, doğru parola dahil,
 *    Retry-After süresince reddedilir. Başarılı giriş sayacı sıfırlar.
 *  - İstemci kimliği yoksa: ortak sayaç yoktur, yönetici kilitlenmez. Kimlik bilgisi taşıyan her doğrulama
 *    denemesi doğrulanmadan önce sıralı ve sabit bir gecikmeyle bekletilir; deneme hızı sınırlanır. Daha önce
 *    doğrulanmış bir kimlik bilgisi tahmin sayılmadığı için beklemez. Sıra dolunca yeni deneme reddedilir.
 */
export function createAuthPolicy({ capacity = 10, delayMs = 1000, maxQueue = 20 } = {}) {
  const limiter = createRateLimiter({ capacity, refillPerSec: capacity / 60 });
  const verified = new Map();
  let tail = Promise.resolve();
  let pending = 0;
  const fingerprint = credential => crypto.createHash('sha256').update(credential).digest('hex');

  return {
    /** İstemci kimlikli ve sayacı dolu istemci için `{ retryAfterSec }`, aksi halde null. */
    blocked(key) {
      if (!key) return null;
      const check = limiter.check(key);
      return check.ok ? null : { retryAfterSec: check.retryAfterSec };
    },
    fail(key) {
      if (key) limiter.take(key, 1);
    },
    succeed(key, credential) {
      if (key) limiter.reset(key);
      if (!credential) return;
      const now = Date.now();
      for (const [print, expires] of verified) if (expires <= now) verified.delete(print);
      if (verified.size >= VERIFIED_MAX) verified.delete(verified.keys().next().value);
      verified.set(fingerprint(credential), now + VERIFIED_TTL_MS);
    },
    /** İstemci kimliği olmayan doğrulama denemesini sıraya sokar: `{ ok: true }` ya da `{ ok: false, retryAfterSec }`. */
    async pace(key, credential) {
      if (key || !credential) return { ok: true };
      if ((verified.get(fingerprint(credential)) ?? 0) > Date.now()) return { ok: true };
      if (pending >= maxQueue) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((pending * delayMs) / 1000)) };
      pending++;
      const turn = tail.then(() => new Promise(resolve => setTimeout(resolve, delayMs)));
      tail = turn;
      try {
        await turn;
      } finally {
        pending--;
      }
      return { ok: true };
    }
  };
}

const LOCKED_OUT = { status: 429, code: 'RATE_LIMITED', error: 'Çok fazla hatalı giriş denemesi yapıldı.' };
const DENY = Symbol('authDeny');
const locked = retryAfterSec => ({ denied: { ...LOCKED_OUT, headers: { 'Retry-After': String(retryAfterSec) } } });

/** `resolve` içinden kimlik doğrulama ayarı eksik gibi nedenlerle isteği doğrudan reddetmek için. */
export const denyRequest = (status, code, error) => ({ [DENY]: { status, code, error } });

/** Eşzamanlı adım 1: istemci kimlikli ve sayacı dolu ise `{ denied }` (429), değilse null. */
export function checkLockout(policy, clientKey) {
  const blocked = policy?.blocked(clientKey);
  return blocked ? locked(blocked.retryAfterSec) : null;
}

/**
 * Eşzamanlı adım 2: çözülmüş kimliği sayaca işler. Dönüş: `{ principal }` ya da
 * `{ denied: { status, code, error, headers }, failed? }` (`failed`: geçersiz kimlik bilgisi, günlüğe yazılır).
 */
export function settleCredential(policy, clientKey, credential, principal) {
  if (principal?.[DENY]) return { denied: { ...principal[DENY], headers: {} } };
  if (!principal) {
    policy?.fail(clientKey);
    return {
      failed: true,
      denied: {
        status: 401,
        code: 'UNAUTHORIZED',
        error: 'Kimlik doğrulama gerekli.',
        headers: { 'WWW-Authenticate': 'Basic realm="LLM Yonetimi"' }
      }
    };
  }
  policy?.succeed(clientKey, credential);
  return { principal };
}

/**
 * Express ve Web (fetch) adaptörünün ortak kimlik kapısı: sayaç (checkLockout), sıralı gecikme (pace), kimlik çözümü
 * (`resolve()`: principal, boş değer ya da `denyRequest(...)`) ve sayaç güncellemesi (settleCredential).
 * Express istemci kimliği hep dolu olduğundan eşzamanlı adımları doğrudan kullanır; Web bu işlevi çağırır.
 */
export async function authenticateRequest({ policy, clientKey, credential, resolve }) {
  const lockout = checkLockout(policy, clientKey);
  if (lockout) return lockout;
  const paced = await policy?.pace(clientKey, credential);
  if (paced && !paced.ok) return locked(paced.retryAfterSec);
  return settleCredential(policy, clientKey, credential, await resolve());
}
