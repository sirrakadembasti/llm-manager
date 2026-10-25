import crypto from 'node:crypto';

export function safeEqual(left, right) {
  const digest = value => crypto.createHash('sha256').update(String(value)).digest();
  return crypto.timingSafeEqual(digest(left), digest(right));
}

export function checkBasicAuth(header, { user = 'admin', password } = {}) {
  if (!password || !/^Basic /i.test(header || '')) return { ok: false };
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  const userOk = safeEqual(decoded.slice(0, colon), user);
  const passwordOk = safeEqual(decoded.slice(colon + 1), password);
  return colon >= 0 && userOk && passwordOk
    ? { ok: true, principal: { isAdmin: true, kind: 'admin', id: String(user) } }
    : { ok: false };
}

export function checkBearerToken(header, tokens = []) {
  if (!/^Bearer /i.test(header || '')) return null;
  const candidate = header.slice(7);
  const list = Array.isArray(tokens)
    ? tokens
    : String(tokens || '')
        .split(',')
        .map(token => token.trim());
  let matched = false;
  for (const token of list) {
    if (token && safeEqual(candidate, token)) matched = true;
  }
  if (!matched) return null;
  return {
    isAdmin: false,
    kind: 'chat-client',
    id: crypto.createHash('sha256').update(candidate).digest('hex')
  };
}
