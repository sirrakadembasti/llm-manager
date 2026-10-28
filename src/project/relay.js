import http from 'node:http';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { buildProviderRequest } from '../runtime.js';
import { providerFetch } from '../providerTransport.js';
import { projectError } from './policy.js';

export async function createProjectRelay({ profile, networkOptions = {}, signal, maxRequests = 40 }) {
  signal?.throwIfAborted();
  const seed = buildProviderRequest(profile, [], { ...networkOptions });
  const transport = seed.transport.id;
  if (!['google', 'anthropic', 'openai'].includes(transport))
    throw projectError('PROJECT_PROVIDER_UNSUPPORTED', 'Bu sağlayıcı araç protokolü desteklenmiyor.');
  const token = crypto.randomBytes(32).toString('hex');
  const deadline = Date.now() + seed.timeoutMs;
  const closed = new AbortController();
  let requests = 0;
  const server = http.createServer({ maxHeaderSize: 16384, requestTimeout: 15000 }, async (req, res) => {
    const deny = (status, message) => {
      req.resume();
      if (!res.headersSent) res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: { message, type: 'relay_error' } }));
    };
    const requestAbort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) requestAbort.abort();
    });
    try {
      const credential =
        req.headers.authorization?.replace(/^Bearer /, '') || req.headers['x-goog-api-key'] || req.headers['x-api-key'];
      if (
        typeof credential !== 'string' ||
        Buffer.byteLength(credential) !== Buffer.byteLength(token) ||
        !crypto.timingSafeEqual(Buffer.from(credential), Buffer.from(token))
      )
        return deny(401, 'Yerel oturum yetkisi gerekli.');
      if (req.method !== 'POST') return deny(404, 'İşlem bulunamadı.');
      const url = new URL(req.url, 'http://localhost');
      const googleRoute = `/v1/models/${encodeURIComponent(profile.model.replace(/^models\//, ''))}`;
      const valid =
        transport === 'google'
          ? [googleRoute + ':generateContent', googleRoute + ':streamGenerateContent'].includes(url.pathname)
          : url.pathname === (transport === 'anthropic' ? '/v1/messages' : '/v1/chat/completions');
      if (!valid) return deny(404, 'İşlem bulunamadı.');
      const chunks = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 1024 * 1024) return deny(413, 'Araç isteği boyut sınırını aşıyor.');
        chunks.push(chunk);
      }
      let body;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return deny(400, 'Geçersiz araç isteği.');
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return deny(400, 'Geçersiz araç isteği.');
      if (transport !== 'google' && body.model !== profile.model)
        return deny(403, 'Yalnız etkin model kullanılabilir.');
      if (++requests > maxRequests) return deny(429, 'Görev istek bütçesi doldu.');
      const remaining = deadline - Date.now();
      if (remaining <= 0) return deny(504, 'Görev zaman bütçesi doldu.');
      const target = new URL(seed.url);
      if (transport === 'google') {
        if (url.pathname.endsWith(':streamGenerateContent')) {
          target.pathname = target.pathname.replace(/:generateContent$/, ':streamGenerateContent');
          target.search = '?alt=sse';
        }
        body.generationConfig = { ...(body.generationConfig || {}), ...seed.body.generationConfig };
      } else {
        for (const [key, value] of Object.entries(seed.body)) {
          if (!['messages', 'system'].includes(key)) body[key] = value;
        }
        if (transport === 'openai') {
          if ('max_completion_tokens' in seed.body) delete body.max_tokens;
          else delete body.max_completion_tokens;
        }
      }
      const combined = AbortSignal.any([
        closed.signal,
        requestAbort.signal,
        AbortSignal.timeout(remaining),
        ...(signal ? [signal] : [])
      ]);
      const headers = { ...seed.headers };
      if (transport === 'anthropic' && typeof req.headers['anthropic-beta'] === 'string')
        headers['anthropic-beta'] = req.headers['anthropic-beta'];
      const response = await providerFetch(target.href, {
        ...networkOptions,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: combined
      });
      if (!response.ok) {
        await response.body?.cancel();
        return deny(response.status, 'Etkin sağlayıcı araç isteğini tamamlayamadı.');
      }
      res.writeHead(response.status, {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store'
      });
      let output = 0;
      for await (const chunk of response.body) {
        output += chunk.length;
        if (output > 8 * 1024 * 1024) {
          requestAbort.abort();
          res.destroy();
          return;
        }
        if (combined.aborted) break;
        if (!res.write(chunk)) await once(res, 'drain', { signal: combined });
      }
      res.end();
    } catch {
      if (res.headersSent) res.destroy();
      else deny(502, 'Sağlayıcı bağlantısı tamamlanamadı veya iptal edildi.');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseURL = `http://127.0.0.1:${server.address().port}/v1`;
  const provider = {
    npm:
      transport === 'google'
        ? '@ai-sdk/google'
        : transport === 'anthropic'
          ? '@ai-sdk/anthropic'
          : '@ai-sdk/openai-compatible',
    name: 'LLM Manager',
    options: { baseURL, apiKey: token },
    models: {
      [profile.model]: {
        name: profile.model,
        tool_call: true,
        limit: { context: 128000, output: profile.maxOutputTokens || 8192 }
      }
    }
  };
  let closePromise;
  function close() {
    if (!closePromise) {
      closed.abort();
      server.closeAllConnections();
      closePromise = new Promise(resolve => server.close(resolve));
    }
    return closePromise;
  }
  return { baseURL, token, provider, model: profile.model, close };
}
